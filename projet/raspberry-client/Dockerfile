FROM python:3.12-slim

WORKDIR /app

# Seul "requests" est nécessaire en simulation (pyserial sert au vrai Arduino)
RUN pip install --no-cache-dir requests

COPY . .

# Affiche les print() immédiatement dans "docker compose logs"
ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
