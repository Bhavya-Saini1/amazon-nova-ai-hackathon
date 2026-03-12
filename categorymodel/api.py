"""FastAPI app for multi-label incident category inference."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from config import ServingConfig
from inference import MultiLabelPredictor


class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw incident report text")


class PredictResponse(BaseModel):
    predictions: List[Dict[str, Any]]


predictor: MultiLabelPredictor | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global predictor
    cfg = ServingConfig()
    predictor = MultiLabelPredictor(cfg)
    yield


app = FastAPI(
    title="Safety Incident Category API",
    description="Predicts multiple overlapping harassment/safety categories.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    rows = predictor.predict(payload.text)
    return PredictResponse(predictions=rows)
