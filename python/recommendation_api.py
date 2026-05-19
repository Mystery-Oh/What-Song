import os
from enum import Enum
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    import pymysql
except ImportError as exc:  # pragma: no cover - import guard for missing dependency
    pymysql = None
    PYMYSQL_IMPORT_ERROR = exc
else:
    PYMYSQL_IMPORT_ERROR = None


load_dotenv(Path(__file__).with_name(".env"))

SONG_TABLE = os.getenv("SONG_TABLE", "songs_pop")

EVENT_WEIGHTS = {
    "play": 1.0,
    "complete": 3.0,
    "like": 5.0,
    "unlike": -5.0,
    "skip": -3.0,
}


def get_db_connection():
    if pymysql is None:
        raise RuntimeError(
            "The 'pymysql' package is not installed. Install it with "
            "'pip install pymysql' and try again."
        ) from PYMYSQL_IMPORT_ERROR

    required_env = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [key for key in required_env if not os.getenv(key)]
    if missing:
        raise RuntimeError(f"Missing database settings: {', '.join(missing)}")

    return pymysql.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def event_score(event_type: str, play_ms: int | None) -> float:
    score = EVENT_WEIGHTS[event_type]
    if event_type == "play" and play_ms is not None:
        if play_ms >= 30_000:
            score += 1.0
        if play_ms >= 120_000:
            score += 1.0
    return score


def normalize_history_score(score: float) -> float:
    return clamp(score / 10.0, -1.0, 1.0)


class UserSongEventType(str, Enum):
    play = "play"
    complete = "complete"
    like = "like"
    unlike = "unlike"
    skip = "skip"


class UserSongEventRequest(BaseModel):
    song_id: int = Field(..., ge=1)
    event_type: UserSongEventType
    play_ms: int | None = Field(default=None, ge=0)


class UserSongEventResponse(BaseModel):
    success: bool
    user_no: int
    song_id: int
    event_type: UserSongEventType
    score_delta: float


class PersonalizedRecommendationRequest(BaseModel):
    valence: float = Field(..., ge=-1.0, le=1.0)
    arousal: float = Field(..., ge=-1.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=50)
    candidate_limit: int = Field(default=200, ge=20, le=500)


class PersonalizedSong(BaseModel):
    song_id: int
    title: str
    artist_name: str | None = None
    valence: float
    arousal: float
    distance: float
    final_score: float
    emotion_score: float
    profile_score: float
    artist_score: float
    history_score: float


class PersonalizedRecommendationResponse(BaseModel):
    user_no: int
    target: dict[str, float]
    profile: dict[str, float | None]
    songs: list[PersonalizedSong]


router = APIRouter(tags=["user recommendations"])


@router.post("/users/{user_no}/events", response_model=UserSongEventResponse)
def record_user_song_event(user_no: int, request: UserSongEventRequest) -> dict[str, Any]:
    score_delta = event_score(request.event_type.value, request.play_ms)

    insert_event_sql = """
    INSERT INTO user_song_events (user_no, song_id, event_type, play_ms, score_delta)
    VALUES (%s, %s, %s, %s, %s)
    """
    upsert_stats_sql = """
    INSERT INTO user_song_stats (
        user_no,
        song_id,
        play_count,
        complete_count,
        like_count,
        skip_count,
        preference_score,
        last_event_at
    )
    VALUES (
        %s,
        %s,
        IF(%s = 'play', 1, 0),
        IF(%s = 'complete', 1, 0),
        IF(%s = 'like', 1, 0),
        IF(%s = 'skip', 1, 0),
        %s,
        CURRENT_TIMESTAMP
    )
    ON DUPLICATE KEY UPDATE
        play_count = play_count + IF(VALUES(play_count) > 0, 1, 0),
        complete_count = complete_count + IF(VALUES(complete_count) > 0, 1, 0),
        like_count = GREATEST(0, like_count + IF(%s = 'like', 1, IF(%s = 'unlike', -1, 0))),
        skip_count = skip_count + IF(VALUES(skip_count) > 0, 1, 0),
        preference_score = preference_score + VALUES(preference_score),
        last_event_at = CURRENT_TIMESTAMP
    """

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                insert_event_sql,
                (
                    user_no,
                    request.song_id,
                    request.event_type.value,
                    request.play_ms,
                    score_delta,
                ),
            )
            cursor.execute(
                upsert_stats_sql,
                (
                    user_no,
                    request.song_id,
                    request.event_type.value,
                    request.event_type.value,
                    request.event_type.value,
                    request.event_type.value,
                    score_delta,
                    request.event_type.value,
                    request.event_type.value,
                ),
            )
        connection.commit()
    except Exception as exc:
        connection.rollback()
        raise HTTPException(status_code=500, detail="Failed to record user event.") from exc
    finally:
        connection.close()

    return {
        "success": True,
        "user_no": user_no,
        "song_id": request.song_id,
        "event_type": request.event_type,
        "score_delta": score_delta,
    }


@router.get("/users/{user_no}/recommendations", response_model=PersonalizedRecommendationResponse)
def recommend_for_user(
    user_no: int,
    valence: float,
    arousal: float,
    limit: int = 10,
    candidate_limit: int = 200,
) -> dict[str, Any]:
    request = PersonalizedRecommendationRequest(
        valence=valence,
        arousal=arousal,
        limit=limit,
        candidate_limit=candidate_limit,
    )

    candidate_sql = f"""
    SELECT
        s.song_id,
        s.title,
        s.artist_id,
        a.artist_name,
        ST_X(s.russell_pt) AS valence,
        ST_Y(s.russell_pt) AS arousal,
        SQRT(
            POW(ST_X(s.russell_pt) - %s, 2) +
            POW(ST_Y(s.russell_pt) - %s, 2)
        ) AS distance
    FROM {SONG_TABLE} AS s
    LEFT JOIN artists AS a
        ON s.artist_id = a.artist_id
    WHERE s.russell_pt IS NOT NULL
    ORDER BY distance ASC, s.song_id ASC
    LIMIT %s
    """
    stats_sql = f"""
    SELECT
        us.song_id,
        us.preference_score,
        us.skip_count,
        s.artist_id,
        ST_X(s.russell_pt) AS valence,
        ST_Y(s.russell_pt) AS arousal
    FROM user_song_stats AS us
    JOIN {SONG_TABLE} AS s
        ON us.song_id = s.song_id
    WHERE us.user_no = %s
    """

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                candidate_sql,
                (request.valence, request.arousal, request.candidate_limit),
            )
            candidates = cursor.fetchall()
            cursor.execute(stats_sql, (user_no,))
            user_stats = cursor.fetchall()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load recommendations.") from exc
    finally:
        connection.close()

    stats_by_song = {row["song_id"]: row for row in user_stats}
    artist_scores: dict[int, float] = {}
    profile_weight_sum = 0.0
    profile_valence_sum = 0.0
    profile_arousal_sum = 0.0

    for row in user_stats:
        score = float(row["preference_score"])
        artist_id = row["artist_id"]
        if artist_id is not None:
            artist_scores[artist_id] = artist_scores.get(artist_id, 0.0) + score
        if score > 0:
            profile_weight_sum += score
            profile_valence_sum += score * float(row["valence"])
            profile_arousal_sum += score * float(row["arousal"])

    profile_valence = None
    profile_arousal = None
    if profile_weight_sum > 0:
        profile_valence = profile_valence_sum / profile_weight_sum
        profile_arousal = profile_arousal_sum / profile_weight_sum

    ranked_songs = []
    for song in candidates:
        distance = float(song["distance"])
        emotion_score = 1.0 / (1.0 + distance)

        profile_score = 0.0
        if profile_valence is not None and profile_arousal is not None:
            profile_distance = (
                (float(song["valence"]) - profile_valence) ** 2
                + (float(song["arousal"]) - profile_arousal) ** 2
            ) ** 0.5
            profile_score = 1.0 / (1.0 + profile_distance)

        artist_score = 0.0
        artist_id = song["artist_id"]
        if artist_id is not None:
            artist_score = normalize_history_score(artist_scores.get(artist_id, 0.0))

        stats = stats_by_song.get(song["song_id"])
        history_score = normalize_history_score(float(stats["preference_score"])) if stats else 0.0
        skip_penalty = min(float(stats["skip_count"]) * 0.08, 0.4) if stats else 0.0

        final_score = (
            emotion_score * 0.55
            + profile_score * 0.20
            + artist_score * 0.15
            + history_score * 0.10
            - skip_penalty
        )

        ranked_songs.append(
            {
                "song_id": song["song_id"],
                "title": song["title"],
                "artist_name": song["artist_name"],
                "valence": round(float(song["valence"]), 4),
                "arousal": round(float(song["arousal"]), 4),
                "distance": round(distance, 4),
                "final_score": round(final_score, 4),
                "emotion_score": round(emotion_score, 4),
                "profile_score": round(profile_score, 4),
                "artist_score": round(artist_score, 4),
                "history_score": round(history_score, 4),
            }
        )

    ranked_songs.sort(key=lambda row: row["final_score"], reverse=True)

    return {
        "user_no": user_no,
        "target": {
            "valence": request.valence,
            "arousal": request.arousal,
        },
        "profile": {
            "valence": round(profile_valence, 4) if profile_valence is not None else None,
            "arousal": round(profile_arousal, 4) if profile_arousal is not None else None,
            "positive_weight": round(profile_weight_sum, 4),
        },
        "songs": ranked_songs[: request.limit],
    }
