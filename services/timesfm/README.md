# PropsEdge TimesFM 2.5 shadow engine

**Zero-cost requirement:** do not deploy this model on Render Free: it has 512 MB RAM, below the model weights alone (~925 MB). `render.yaml` explicitly uses `plan: free` to prevent accidental paid provisioning, but that plan is not expected to run this model. A fully free experiment is supported on the user's existing Mac; a remote service requires separately confirmed free compute or a user-managed temporary tunnel. Never upgrade a plan without approval.

The service requires `TIMESFM_API_KEY`. The public /health endpoint has no private data. The /forecast endpoint requires Bearer authentication. Use HTTPS for cloud access. No execution or trading orders exist in this service.

In Vercel project **quantflow-team/propsedge** set production variables:
- `TIMESFM_SERVICE_URL` = the HTTPS Render service URL
- `TIMESFM_API_KEY` = same generated key as on Render

The Next.js handler also requires existing `TWELVEDATA_API_KEY`. Never commit secrets. Activate cloud endpoint only after verifying Twelve Data supplies >=128 **closed** M5 candles. The forecast is read-only and does not modify setups, confidence, or positions.

Local run: `TIMESFM_API_KEY="$(openssl rand -hex 32)" uvicorn main:app --host 127.0.0.1 --port 8000` (save the key in a secure manager).
