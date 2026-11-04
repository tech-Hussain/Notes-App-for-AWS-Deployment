# Phase 1A Audit (2026-11-04)

Read-only audit. No application code has been changed.

## 1. Layout
Two apps in one folder: `backend/` (Express + TypeScript, compiled to `dist/`) and `frontend/` (React + TypeScript + Vite). Not `client/` / `server/`, so the plan's paths and Dockerfile context must be adapted (`./frontend`, `./backend`). **The folder is not a git repository** (no `.git`), so there is no history to scan, but Phase 3 must `git init`.

## 2. Frontend
- Vite 5, React 18, react-router-dom 6 (BrowserRouter-style deep links, so Nginx needs the `try_files ... /index.html` fallback).
- Build: `tsc && vite build`, output **`dist/`**, with hashed assets under `/assets/`.
- Tests: Jest 30 + Testing Library (`npm test`). **No ESLint / lint script.**

## 3. How the frontend calls the API
`frontend/src/services/api.ts:17`: `import.meta.env.VITE_API_URL || '/api'`. Already relative `/api` by default, and `vite.config.ts` proxies `/api` to `localhost:5000` in dev (dev server on port 3000). **No change needed** (just never set `VITE_API_URL` in Docker builds).

## 4. Backend
- Entry: `src/server.ts` (built to `dist/server.js`, `npm start`). `app.ts` exports the Express app separately from `listen`, which is good for tests.
- Express 4.21, helmet, cors, pino, mongoose 8, bcryptjs, jsonwebtoken.
- Env vars (all via `src/config/env.ts`): `NODE_ENV`, `PORT` (default 5000), `LOG_LEVEL`, **`MONGODB_URI`**, `JWT_SECRET`.
- **Naming mismatch with the plan:** the plan uses `MONGO_URI`. The code uses `MONGODB_URI`. Plan to keep the code's name and adjust the SSM param, `.env.runtime` and compose accordingly (a decision for you; see "Decisions needed").
- `mongoose.connect(env.mongoUri)` in `config/database.ts`, called before `listen`.
- Already fails fast outside dev if `MONGODB_URI` / `JWT_SECRET` are missing; JWT secret must be at least 32 characters and not an example value. This already satisfies plan item 1B.1 (except that `NODE_ENV=test` falls back to defaults, which is fine).
- `app.listen(env.port)` has no host argument, so Node binds to `::` (all interfaces), which is reachable in Docker. Passing `'0.0.0.0'` explicitly is optional.
- Graceful shutdown on SIGTERM/SIGINT is **already implemented** (closes HTTP server and Mongo).
- Routes: `/api/health`, `/api/auth/*`, `/api/notes/*`, all under `/api`, so the Nginx proxy matches.

## 5. Auth
- Stateless JWT (`jsonwebtoken`), no `express-session`, which is fine behind a load balancer.
- Token stored in **`localStorage`** and sent as a Bearer header (no cookies, so no sameSite/secure concerns).
- `TokenRevocation` model: logout revocation is stored in MongoDB, so it is shared across instances.

## 6. CORS
`origin: nodeEnv === 'development' ? true : false`, so no CORS headers in production. Fine, because Nginx makes requests same-origin.

## 7. File uploads
None found (no multer or upload code). No S3 change needed.

## 8. Tests and lint
- Backend: Mocha + Chai + Sinon + Supertest, run with tsx (`npm test`, `test:coverage` via c8). **The existing tests appear to be unit tests with stubs**, so they may not need a real Mongo. To be confirmed in Phase 3.
- Frontend: Jest (see above). No lint.
- SonarQube config and screenshots exist (`sonar-project.properties`, `.coderabbit.yaml`).

## 9. Secrets
- Source has no hardcoded credentials. The only URI is the dev default `mongodb://127.0.0.1:27017/notes-app` in `env.ts` (no password).
- `backend/.env` exists locally and is gitignored (`.env`, `.env.*` in the root `.gitignore`; `backend/.gitignore` allows `.env.example`). `backend/.env.example` has no real values. The root `.gitignore` pattern `.env.*` would also ignore `.env.example`, so it needs a `!.env.example` line.
- Git history cannot be checked (no repo). `backend/.env` should still be treated as local-only; rotate if it ever got shared.

## 10. Node version
No `engines` field and no `.nvmrc`. Local Node is v24.14.0. The plan templates use Node 20; the `@types/node` is `^22`, so **I propose Node 22 LTS** for Docker/CI. `package-lock.json` exists in both apps.

## Gaps vs. Phase 1B

| 1B item | Status |
| --- | --- |
| Env-only config, fail fast | Done (uses `MONGODB_URI`) |
| `GET /api/health` with DB state | **Missing the DB check**: it always returns 200 with `{status, uptime}` inside the app's `{success, message, data}` envelope. Needs `readyState === 1` check, 503 on failure and (Phase 9) a `version` field |
| Relative `/api` base URL | Done |
| Graceful SIGTERM | Done |
| Listen on 0.0.0.0 | Works as is; will make explicit |
| `.env.example` | Exists (backend); add `!.env.example` to the root ignore; JWT_SECRET blank |
| Rotate leaked secrets | None found; no action |
| Sessions / uploads | N/A |

## Decisions needed before 1B
1. **Env var name:** keep `MONGODB_URI` (recommended; touch the plan's scripts, not the code) or rename to `MONGO_URI`.
2. **Node version for containers/CI:** 22 (recommended) or 20.
3. **Health response shape:** keep the existing envelope and add `db` and `version` inside `data` (recommended, as the frontend and tests expect the envelope).
