# Progress Log

## Phase 0 – Tool install and verify (2026-11-04)
OS: Windows 11 Pro Education 10.0.26300 (WSL2 Ubuntu available; working natively in PowerShell/Git Bash with Docker Desktop).

| Tool | Version |
| --- | --- |
| Git | 2.53.0.windows.1 |
| Node / npm | v24.14.0 / 11.9.0 |
| Docker Client/Server | 29.8.2 / 29.8.2 |
| Docker Compose | v5.6.0 |
| Docker Buildx | v0.37.2 |
| AWS CLI | 2.39.3 (installed via winget) |
| Terraform | v1.16.6 (installed via winget) |
| GitHub CLI | 2.103.3 (installed via winget) |
| curl | 8.21.0 |
| jq | 1.8.2 (installed via winget) |
| openssl | 3.5.5 (Git for Windows bundle: C:\Program Files\Git\usr\bin) |
| autocannon | 8.0.0 (npx) |

`docker run --rm hello-world` succeeded (Docker Desktop had to be started manually).
Note: Node 24 locally; Dockerfile/CI will use the version decided in Phase 1.

## Phase 1 – Audit and prepare (2026-11-04)
Decisions: keep `MONGODB_URI` (plan scripts use this name, not `MONGO_URI`); Node 22 for Docker/CI; health keeps the `{success,message,data}` envelope.
Folders: `backend/` and `frontend/` (plan's `server/` -> `backend/`, `client/` -> `frontend/`; Vite output `dist/`).
Changes: `/api/health` now checks `mongoose.connection.readyState` (200 `data:{status,db,uptime,version}` or 503), version from `APP_VERSION`; server listens on `0.0.0.0`; root `.gitignore` now allows `.env.example`; `.env.example` updated; health tests updated (+503 case).
Verified: backend 70 tests pass, frontend 108 tests pass, frontend build OK, local API against Docker Mongo: health 200, register/login/create/edit/delete note OK, no-token 401. Re-grep: only the dev default URI (no credentials) in `env.ts`.

## Phase 2 – Containerize (2026-11-04)
Files: `frontend/Dockerfile`, `frontend/nginx.conf`, `backend/Dockerfile` (2-stage: tsc build, then prod deps, non-root `node`, entry `dist/server.js`), `.dockerignore` x2, root `docker-compose.yml`, `.env.example`. Local `.env` (gitignored) holds a generated `JWT_SECRET`. Node 22-alpine, nginx 1.27-alpine. Compose passes `MONGODB_URI` (the code's name).
Checkpoint 2 results: web/api/mongo all healthy; `localhost:8080` serves app and `/notes/123` returns 200 (SPA fallback); `localhost:5000` unreachable from host; `localhost:8080/api/health` 200 via Nginx; web cannot resolve/reach mongo; api runs as `node`; notes persisted across `compose down` + `up`.
Image sizes: web 74 MB, api 269 MB (slightly above the plan's ~60/~250 targets; those are approximate and acceptable).
[SCREENSHOT] to take: `docker compose ps` output, and the app at http://localhost:8080.
