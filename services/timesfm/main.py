import os
import secrets
import numpy as np
import timesfm
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

app = FastAPI(title="PropsEdge TimesFM Shadow Engine")

model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
    "google/timesfm-2.5-200m-pytorch",
    torch_compile=False,
)
model.compile(timesfm.ForecastConfig(
    max_context=512, max_horizon=32, normalize_inputs=True,
    per_core_batch_size=1, use_continuous_quantile_head=True,
    fix_quantile_crossing=True,
))

class ForecastRequest(BaseModel):
    symbol: str
    timeframe: str
    closes: list[float] = Field(min_length=128, max_length=512)

@app.get("/health")
def health():
    return {"status": "ok", "model": "TimesFM 2.5"}

@app.post("/forecast")
def forecast(data: ForecastRequest, authorization: str | None = Header(default=None)):
    secret = os.environ.get("TIMESFM_API_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="API key not configured")
    if not secrets.compare_digest(authorization or "", f"Bearer {secret}"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if data.symbol != "XAUUSD" or data.timeframe != "5m":
        raise HTTPException(status_code=422, detail="Only XAUUSD 5m enabled")
    prices = np.asarray(data.closes, dtype=np.float32)
    if not np.all(np.isfinite(prices)) or np.any(prices <= 0):
        raise HTTPException(status_code=422, detail="Invalid closing prices")
    point, quantiles = model.forecast(horizon=12, inputs=[prices])
    if not (np.all(np.isfinite(point)) and np.all(np.isfinite(quantiles))):
        raise HTTPException(status_code=503, detail="Nonfinite model output")
    return {
        "symbol": data.symbol, "timeframe": data.timeframe,
        "last_close": float(prices[-1]),
        "predictions": point[0].tolist(),
        "lower_band": quantiles[0, :, 1].tolist(),
        "upper_band": quantiles[0, :, 9].tolist(),
    }
