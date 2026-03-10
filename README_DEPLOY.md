# Deploy Notes

## Frontend

- Project root: `client`
- Build command: `npm install && npm run build`
- Output directory: `dist`
- Required env:
  - `VITE_API_BASE_URL=https://api.your-domain.com`

## Backend

- Start command: `python server/server.py`
- Required env:
  - `ARK_API_KEY`
  - `ARK_MODEL=doubao-1-5-pro-32k-250115`
  - `ARK_API_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions`
  - `DEBUG=false`
  - `PORT=8000` (platform can override)
  - `SESSION_DB_PATH=server/sessions.db`

## Health Checks

- Version endpoint: `/api/version`
- Model ping: `/api/model-ping`

## DNS Shape

- `mirror.your-domain.com` -> frontend
- `api.your-domain.com` -> backend
