# PropsEdge TimesFM 2.5 shadow engine

Deploy via the repository Render Blueprint `render.yaml`. This model is memory-intensive; verify the selected paid instance has adequate RAM before deployment.

The service requires `TIMESFM_API_KEY`. The public /health endpoint has no private data. The /forecast endpoint requires Bearer authentication. Use HTTPS for cloud access. No execution or trading orders exist in this service.

In Vercel project **quantflow-team/propsedge** set production variables:
- `TIMESFM_SERVICE_URL` = the HTTPS Render service URL
- `TIMESFM_API_KEY` = same generated key as on Render

The Next.js handler also requires existing `TWELVEDATA_API_KEY`. Never commit secrets. Activate cloud endpoint only after verifying Twelve Data supplies >=128 **closed** M5 candles. The forecast is read-only and does not modify setups, confidence, or positions.

Local run: `TIMESFM_API_KEY="$(openssl rand -hex 32)" uvicorn main:app --host 127.0.0.1 --port 8000` (save the key in a secure manager).
