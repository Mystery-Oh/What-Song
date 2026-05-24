import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

try:
    from openai import APIConnectionError, APIStatusError, OpenAI, RateLimitError
except ImportError as exc:  # pragma: no cover - import guard for missing dependency
    OpenAI = None
    APIConnectionError = None
    APIStatusError = None
    RateLimitError = None
    OPENAI_IMPORT_ERROR = exc
else:
    OPENAI_IMPORT_ERROR = None

try:
    import pymysql
except ImportError as exc:  # pragma: no cover - import guard for missing dependency
    pymysql = None
    PYMYSQL_IMPORT_ERROR = exc
else:
    PYMYSQL_IMPORT_ERROR = None


DEFAULT_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-5.4-mini")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Analyze lyrics with ChatGPT and recommend songs by mood."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    analyze_parser = subparsers.add_parser(
        "analyze-lyrics",
        help="Analyze lyrics text and estimate valence/arousal."
    )
    analyze_parser.add_argument("--lyrics", help="Lyrics text to analyze.")
    analyze_parser.add_argument(
        "--lyrics-file",
        help="Path to a UTF-8 text file containing lyrics."
    )
    analyze_parser.add_argument(
        "--model",
        default=DEFAULT_CHAT_MODEL,
        help=f"OpenAI model to use. Default: {DEFAULT_CHAT_MODEL}"
    )

    recommend_parser = subparsers.add_parser(
        "recommend",
        help="Recommend songs for a requested mood."
    )
    recommend_parser.add_argument(
        "--query",
        required=True,
        help="Natural language description of the desired mood or vibe."
    )
    recommend_parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of songs to return. Default: 5"
    )
    recommend_parser.add_argument(
        "--model",
        default=DEFAULT_CHAT_MODEL,
        help=f"OpenAI model to use. Default: {DEFAULT_CHAT_MODEL}"
    )

    return parser


def require_openai_client() -> OpenAI:
    if OpenAI is None:
        raise RuntimeError(
            "The 'openai' package is not installed. Install it with "
            "'pip install openai' and try again."
        ) from OPENAI_IMPORT_ERROR

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to your environment or .env file."
        )

    return OpenAI(api_key=api_key)


def load_text_input(direct_text: str | None, file_path: str | None) -> str:
    if direct_text:
        return direct_text.strip()

    if not file_path:
        raise ValueError("Provide either --lyrics or --lyrics-file.")

    text = Path(file_path).read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError("Lyrics input is empty.")

    return text


def response_format(schema_name: str, schema: dict[str, Any]) -> dict[str, Any]:
    return {
        "format": {
            "type": "json_schema",
            "name": schema_name,
            "schema": schema,
            "strict": True,
        }
    }


def parse_json_response(raw_text: str) -> dict[str, Any]:
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Model returned invalid JSON: {raw_text}") from exc


def clamp_score(value: float) -> float:
    return max(-1.0, min(1.0, value))


def normalize_tags_coord(payload: dict[str, Any]) -> None:
    coord_by_tag = {
        item["tags"]: item["coord"]
        for item in payload.get("tags_coord", [])
        if isinstance(item, dict) and "tags" in item and "coord" in item
    }

    normalized_coords = []
    for tag in payload["search_tags"]:
        raw_coord = coord_by_tag.get(tag, {})
        normalized_coords.append(
            {
                "tags": tag,
                "coord": {
                    "valence": round(
                        clamp_score(float(raw_coord.get("valence", payload["valence"]))),
                        4,
                    ),
                    "arousal": round(
                        clamp_score(float(raw_coord.get("arousal", payload["arousal"]))),
                        4,
                    ),
                },
            }
        )

    payload["tags_coord"] = normalized_coords


def analyze_lyrics_with_openai(client: OpenAI, lyrics: str, model: str) -> dict[str, Any]:
    schema = {
        "type": "object",
        "properties": {
            "valence": {
                "type": "number",
                "minimum": -1,
                "maximum": 1,
            },
            "arousal": {
                "type": "number",
                "minimum": -1,
                "maximum": 1,
            },
            "summary": {"type": "string"},
            "keywords": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 6,
            },
        },
        "required": ["valence", "arousal", "summary", "keywords"],
        "additionalProperties": False,
    }

    prompt = (
        "You are analyzing song lyrics using the Russell circumplex model of emotion.\n"
        "Return valence and arousal as real numbers from -1.0 to 1.0.\n"
        "Valence measures negative to positive feeling.\n"
        "Arousal measures calm to energetic intensity.\n"
        "Base the answer on the emotional meaning of the lyrics, not on genre assumptions.\n"
        "Also return a short Korean summary and a short keyword list.\n\n"
        f"Lyrics:\n{lyrics}"
    )

    response = client.responses.create(
        model=model,
        input=prompt,
        text=response_format("lyrics_emotion_analysis", schema),
    )
    payload = parse_json_response(response.output_text)
    payload["valence"] = round(clamp_score(float(payload["valence"])), 4)
    payload["arousal"] = round(clamp_score(float(payload["arousal"])), 4)
    return payload


def interpret_mood_query(client: OpenAI, query: str, model: str) -> dict[str, Any]:
    schema = {
        "type": "object",
        "properties": {
            "valence": {
                "type": "number",
                "minimum": -1,
                "maximum": 1,
            },
            "arousal": {
                "type": "number",
                "minimum": -1,
                "maximum": 1,
            },
            "reason": {"type": "string"},
            "search_tags": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
                "maxItems": 6,
            },
            "tags_coord": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "tags": {"type": "string"},
                        "coord": {
                            "type": "object",
                            "properties": {
                                "valence": {
                                    "type": "number",
                                    "minimum": -1,
                                    "maximum": 1,
                                },
                                "arousal": {
                                    "type": "number",
                                    "minimum": -1,
                                    "maximum": 1,
                                },
                            },
                            "required": ["valence", "arousal"],
                            "additionalProperties": False,
                        },
                    },
                    "required": ["tags", "coord"],
                    "additionalProperties": False,
                },
                "minItems": 2,
                "maxItems": 6,
            },
        },
        "required": ["valence", "arousal", "reason", "search_tags", "tags_coord"],
        "additionalProperties": False,
    }

    prompt = (
        "Convert the user's music mood request into a target valence/arousal point.\n"
        "Return valence and arousal as real numbers from -1.0 to 1.0.\n"
        "Also return a short Korean reason and a few concise search tags.\n"
        "Also return tags_coord with one coordinate for each search_tags item, "
        "using the same tag text and order.\n"
        "Interpret the request in terms of musical feeling, energy, and emotional tone.\n\n"
        f"User request:\n{query}"
    )

    response = client.responses.create(
        model=model,
        input=prompt,
        text=response_format("mood_query_analysis", schema),
    )
    payload = parse_json_response(response.output_text)
    payload["valence"] = round(clamp_score(float(payload["valence"])), 4)
    payload["arousal"] = round(clamp_score(float(payload["arousal"])), 4)
    normalize_tags_coord(payload)
    return payload


def get_db_connection():
    if pymysql is None:
        raise RuntimeError(
            "The 'pymysql' package is not installed. Install it with "
            "'pip install pymysql' and try again."
        ) from PYMYSQL_IMPORT_ERROR

    required_env = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [key for key in required_env if not os.getenv(key)]
    if missing:
        raise RuntimeError(
            f"Missing database settings: {', '.join(missing)}"
        )

    return pymysql.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def fetch_recommendations(target_valence: float, target_arousal: float, limit: int) -> list[dict[str, Any]]:
    query = """
    SELECT
        s.title,
        a.artist_name,
        ST_X(s.russell_pt) AS valence,
        ST_Y(s.russell_pt) AS arousal,
        SQRT(
            POW(ST_X(s.russell_pt) - %s, 2) +
            POW(ST_Y(s.russell_pt) - %s, 2)
        ) AS distance
    FROM songs_pop AS s
    LEFT JOIN artists AS a
        ON s.artist_id = a.artist_id
    WHERE s.russell_pt IS NOT NULL
    ORDER BY distance ASC, s.title ASC
    LIMIT %s
    """

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(query, (target_valence, target_arousal, int(limit)))
            rows = cursor.fetchall()
    finally:
        connection.close()

    for row in rows:
        row["valence"] = round(float(row["valence"]), 4)
        row["arousal"] = round(float(row["arousal"]), 4)
        row["distance"] = round(float(row["distance"]), 4)
    return rows


def print_lyrics_analysis(result: dict[str, Any]) -> None:
    print("=== Lyrics Emotion Analysis ===")
    print(f"Valence : {result['valence']}")
    print(f"Arousal : {result['arousal']}")
    print(f"Summary : {result['summary']}")
    print(f"Keywords: {', '.join(result['keywords'])}")


def print_recommendations(mood: dict[str, Any], songs: list[dict[str, Any]]) -> None:
    print("=== Mood Query Analysis ===")
    print(f"Target Valence : {mood['valence']}")
    print(f"Target Arousal : {mood['arousal']}")
    print(f"Reason         : {mood['reason']}")
    print(f"Tags           : {', '.join(mood['search_tags'])}")
    print("Tags Coord     :")
    for item in mood["tags_coord"]:
        print(
            f"  - {item['tags']}: "
            f"valence={item['coord']['valence']}, arousal={item['coord']['arousal']}"
        )
    print()
    print("=== Recommended Songs ===")

    if not songs:
        print("No songs found in songs_pop.")
        return

    for index, song in enumerate(songs, start=1):
        artist = song["artist_name"] or "Unknown Artist"
        print(
            f"{index}. {artist} - {song['title']} | "
            f"valence={song['valence']}, arousal={song['arousal']}, distance={song['distance']}"
        )


def main() -> None:
    load_dotenv()
    parser = build_parser()
    if len(sys.argv) == 1:
        parser.print_help()
        return
    try:
        args = parser.parse_args()
        client = require_openai_client()

        if args.command == "analyze-lyrics":
            lyrics = load_text_input(args.lyrics, args.lyrics_file)
            result = analyze_lyrics_with_openai(client, lyrics, args.model)
            print_lyrics_analysis(result)
            return

        if args.command == "recommend":
            limit = max(1, min(20, args.limit))
            mood = interpret_mood_query(client, args.query, args.model)
            songs = fetch_recommendations(mood["valence"], mood["arousal"], limit)
            print_recommendations(mood, songs)
            return

        raise RuntimeError(f"Unsupported command: {args.command}")
    except RateLimitError as exc:
        raise RuntimeError(
            "OpenAI API quota exceeded or billing is unavailable for this key. "
            "Check your OpenAI plan, billing status, and remaining quota, then try again."
        ) from exc
    except APIConnectionError as exc:
        raise RuntimeError(
            "Failed to reach the OpenAI API. Check your internet connection or proxy settings and try again."
        ) from exc
    except APIStatusError as exc:
        raise RuntimeError(
            f"OpenAI API request failed with status {exc.status_code}. "
            "Check the API key, model name, and account status."
        ) from exc


if __name__ == "__main__":
    main()
