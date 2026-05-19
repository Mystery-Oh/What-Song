import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).with_name(".env"))

from chatgpt_music_assistant import (  # noqa: E402
    APIConnectionError,
    APIStatusError,
    DEFAULT_CHAT_MODEL,
    RateLimitError,
    fetch_recommendations,
    interpret_mood_query,
    require_openai_client,
)
from recommendation_api import router as recommendation_router  # noqa: E402


def parse_allowed_origins() -> list[str]:
    raw_origins = os.getenv(
        "FASTAPI_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


app = FastAPI(
    title="What Song Music Recommendation API",
    description="LLM mood interpretation and Russell-coordinate song recommendation API.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recommendation_router)


class RecommendationRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Natural-language mood or vibe request.",
        examples=["비 오는 밤에 듣기 좋은 차분한 노래 추천해줘"],
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of songs to return.",
    )
    model: str | None = Field(
        default=None,
        description="OpenAI chat model override. Uses OPENAI_CHAT_MODEL when omitted.",
    )


class MoodAnalysis(BaseModel):
    valence: float
    arousal: float
    reason: str
    search_tags: list[str]


class RecommendedSong(BaseModel):
    title: str
    artist_name: str | None = None
    valence: float
    arousal: float
    distance: float


class RecommendationResponse(BaseModel):
    query: str
    limit: int
    model: str
    mood: MoodAnalysis
    songs: list[RecommendedSong]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/recommend", response_model=RecommendationResponse)
def recommend(request: RecommendationRequest) -> dict[str, Any]:
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="query must not be empty.")

    model = request.model or DEFAULT_CHAT_MODEL

    try:
        client = require_openai_client()
        mood = interpret_mood_query(client, query, model)
        songs = fetch_recommendations(
            mood["valence"],
            mood["arousal"],
            request.limit,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        if RateLimitError is not None and isinstance(exc, RateLimitError):
            raise HTTPException(
                status_code=429,
                detail="OpenAI API quota exceeded or rate limited.",
            ) from exc
        if APIConnectionError is not None and isinstance(exc, APIConnectionError):
            raise HTTPException(
                status_code=503,
                detail="Failed to reach the OpenAI API.",
            ) from exc
        if APIStatusError is not None and isinstance(exc, APIStatusError):
            raise HTTPException(
                status_code=502,
                detail=f"OpenAI API request failed with status {exc.status_code}.",
            ) from exc
        raise HTTPException(status_code=500, detail="Recommendation failed.") from exc

    return {
        "query": query,
        "limit": request.limit,
        "model": model,
        "mood": mood,
        "songs": songs,
    }
