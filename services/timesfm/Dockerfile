FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/app/.cache/huggingface
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
# Download model weights at image build time to avoid cold-start downloads.
RUN python -c "import timesfm; timesfm.TimesFM_2p5_200M_torch.from_pretrained('google/timesfm-2.5-200m-pytorch', torch_compile=False)"
EXPOSE 10000
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","10000","--workers","1"]
