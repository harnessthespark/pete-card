# Stage 1: build the React front end
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: run the Python back end, which also serves the built site
FROM python:3.13-slim
WORKDIR /app
RUN pip install --no-cache-dir "fastapi[standard]"
COPY main.py .
COPY --from=web /web/dist ./frontend/dist
ENV DATA_DIR=/data
RUN mkdir -p /data
EXPOSE 8000
CMD ["fastapi", "run", "main.py", "--port", "8000"]
