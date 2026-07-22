# VULCAN Backend (FastAPI) — Integration Guide for React Frontend

This document specifies a production-style FastAPI backend that connects cleanly with the existing VULCAN React frontend. It includes architecture, endpoints, mock implementations, and run instructions so the app starts without errors and returns realistic responses.

- Stack: FastAPI, Pydantic, SQLAlchemy/SQLModel, JWT (access/refresh), PostgreSQL (default; SQLite supported for dev), passlib/bcrypt, Uvicorn.
- API base path: `/api/v1`.
- CORS: allow `http://localhost:3000` (frontend dev).
- Status: all advanced modules ship with mock engines so endpoints work out of the box.

Frontend defaults aligned here:
- Default login credentials: `admin@vulcan.ai` / `admin123!`.
- The frontend stores a dummy `access_token` until backend auth is wired. The backend below provides real JWTs.

---

## Project Structure

A modular, layered layout for clarity and testability.

```
app/
  main.py
  core/
    config.py
    security.py
  db/
    base.py
    session.py
    init_db.py
  models/
    __init__.py
    user.py
    repository.py
    scan.py
    vulnerability.py
    patch.py
    report.py
    notification.py
  schemas/
    common.py
    auth.py
    user.py
    repository.py
    scan.py
    vulnerability.py
    patch.py
    report.py
    notification.py
  enums/
    __init__.py
    severity.py
    scan_mode.py
    scan_status.py
    patch_status.py
    repo_status.py
  services/
    auth_service.py
    repository_service.py
    scan_service.py
    graph_service.py
    patch_service.py
    report_service.py
    notification_service.py
  domain/
    abstract/
      analyzer_engine.py
      graph_engine.py
      patch_generator.py
    mock/
      mock_analyzer_engine.py
      mock_graph_engine.py
      mock_patch_generator.py
  api/
    deps.py
    routes/
      auth.py
      dashboard.py
      repositories.py
      scans.py
      graphs.py
      patches.py
      reports.py
      notifications.py
    api_v1.py
```

---

## Quickstart

- Requirements: Python 3.10+, PostgreSQL 13+ (or SQLite for dev)

1) Create virtual environment and install deps

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -U pip
pip install fastapi uvicorn[standard] python-dotenv pydantic sqlalchemy sqlmodel asyncpg psycopg2-binary passlib[bcrypt] python-jose[cryptography] email-validator python-multipart aiofiles
```

2) Configure environment

Create `.env` in the repo root:

```
ENV=dev
API_V1_STR=/api/v1
PROJECT_NAME=VULCAN API
BACKEND_CORS_ORIGINS=http://localhost:3000
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/vulcan
# For quick local dev you can use SQLite:
# DATABASE_URL=sqlite+aiosqlite:///./vulcan.db
JWT_SECRET=change-me-super-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_MINUTES=43200
DEFAULT_ADMIN_EMAIL=admin@vulcan.ai
DEFAULT_ADMIN_PASSWORD=admin123!
```

3) Initialize DB (dev)

For SQLModel/SQLAlchemy you can auto-create tables on startup. If using Alembic later, add migrations. For now, the app can auto-create and seed an admin user if not present.

4) Run the server

```powershell
uvicorn app.main:app --reload
```

Open: http://127.0.0.1:8000/docs

---

## Core Configuration

- `config.py`: Uses Pydantic BaseSettings to load `.env`.
- `security.py`: Password hashing (bcrypt), JWT creation/verification, token schemas.
- CORS: `BACKEND_CORS_ORIGINS` must include `http://localhost:3000`.

---

## Auth & Users (M1)

Routes under `/api/v1/auth`.

Models
- User: `id, email, hashed_password, full_name, role, is_active, is_superuser, created_at, updated_at`.

Schemas
- `UserCreate { email, password, full_name }`
- `UserRead { id, email, full_name, role, is_active, is_superuser, created_at }`
- `UserLogin { email, password }`
- `Token { access_token, token_type, expires_in }`

Endpoints
- POST `/auth/register` → 201 UserRead
- POST `/auth/login` → 200 Token
- POST `/auth/logout` → 200 { ok: true } (stateless; client should drop token)
- GET `/auth/me` (auth) → 200 UserRead
- POST `/auth/refresh` (optional) → 200 Token
- GET `/auth/oauth/github` → 501 (placeholder)
- GET `/auth/oauth/google` → 501 (placeholder)

Example: Login Request/Response
```json
POST /api/v1/auth/login
{
  "email": "admin@vulcan.ai",
  "password": "admin123!"
}

200
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 3600
}
```

Dependencies
- `get_current_user()` validates `Authorization: Bearer <token>` and returns User, else 401.

Seeding
- On startup, create a default admin with `DEFAULT_ADMIN_EMAIL`/`DEFAULT_ADMIN_PASSWORD` if absent.

---

## Dashboard (M2)

Routes under `/api/v1/dashboard` and `/api/v1/notifications`.

- GET `/dashboard/summary` → totals, severity distribution, AI metrics, trend
- GET `/dashboard/recent-scans` → recent scan entries
- GET `/notifications` (paginated: `page`, `size`) → list of notifications

Example: `/dashboard/summary`
```json
{
  "totals": { "repos": 5, "scans": 42, "vulnerabilities": 213 },
  "severity": { "CRITICAL": 7, "HIGH": 23, "MEDIUM": 91, "LOW": 92 },
  "ai": { "patch_success_rate": 0.71, "avg_confidence": 0.83 },
  "trend": [
    { "date": "2025-11-01", "scans": 2 },
    { "date": "2025-11-02", "scans": 3 }
  ]
}
```

Mock service returns realistic numbers for initial UI wiring.

---

## Repository Integration (M3)

Routes under `/api/v1/repositories`.

- GET  `/repositories` → list repositories
- POST `/repositories` → create/link repo (body includes provider, name, url, token (store encrypted/plain for now), status)
- GET  `/repositories/{id}` → details
- DELETE `/repositories/{id}` → delete/disconnect
- GET  `/repositories/{id}/branches` → branches
- POST `/repositories/{id}/upload` (multipart) → accepts ZIP/TAR.GZ, size limit ~200MB

Business Rules
- Store metadata: provider (`GITHUB|GITLAB|BITBUCKET|LOCAL`), status (`CONNECTED|DISCONNECTED|ERROR`), access token field (simulated encryption ok).
- Enforce upload size and return 413 or 422 with message.

Example: Repo Entity
```json
{
  "id": 1,
  "name": "frontend-app",
  "provider": "GITHUB",
  "url": "https://github.com/org/frontend-app",
  "status": "CONNECTED",
  "default_branch": "main",
  "created_at": "2025-11-01T10:00:00Z"
}
```

---

## Scans (M4)

Routes under `/api/v1/scans`.

- POST `/scans/start` { repo_id, branch, scan_mode } → 202 { scan_id }
- GET  `/scans/{scan_id}/status` → { state, progress, eta, started_at, finished_at }
- GET  `/scans/{scan_id}/logs` (cursor/page) → mock logs chunk
- GET  `/scans/{scan_id}/summary` → severity counts + AI confidence
- POST `/scans/{scan_id}/cancel` → 200 { state: "CANCELLED" }

States: `QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED`.

Mock Implementation
- In-memory job store (can be DB-backed optionally). Background task increments progress and appends logs. Summary returns fixed/semi-random severity counts and AI confidence.

Example: `/scans/{id}/summary`
```json
{
  "scan_id": "ae12f...",
  "severity": { "CRITICAL": 1, "HIGH": 5, "MEDIUM": 11, "LOW": 8 },
  "ai_confidence": 0.78,
  "report_id": 12
}
```

---

## Graphs (M5)

Routes under `/api/v1/graphs`.

- GET `/graphs/{scan_id}/file/{file_id}?type=AST|CFG|DFG` → graph { nodes, edges, meta }
- GET `/graphs/{scan_id}/nodes/{node_id}` → node details + AI insight
- GET `/graphs/{scan_id}/paths/{path_id}` → taint path details

Abstractions
- `GraphBuilder` (build_ast, build_cfg, build_dfg)
- `GraphRepository` (load/save graph)

Mocks
- `MockGraphEngine` returns synthetic nodes/edges with random severities and simple insights.

Example: Graph Response
```json
{
  "type": "AST",
  "nodes": [ { "id": "n1", "label": "Function foo", "severity": "LOW" } ],
  "edges": [ { "from": "n1", "to": "n2" } ],
  "meta": { "file": "src/app.py" }
}
```

---

## AI Patch Generation (M6)

Routes under `/api/v1/patches`.

- GET  `/patches/{scan_id}/vulnerabilities` → list of vuln summaries eligible for patch
- POST `/patches/generate` { vulnerability_id, options } → 201 { patch_id }
- GET  `/patches/{patch_id}` → { original_code, patched_code, explanation, confidence, status }
- POST `/patches/{patch_id}/apply` → 200 { status: "APPLIED", branch: "vulcan-fix-<id>" }
- POST `/patches/{patch_id}/export` → 200 { filename, content } (diff text)
- POST `/patches/{patch_id}/regenerate` → 200 { patch_id, version }

Abstractions
- `PatchGenerator` (generate_patch, regenerate_patch)
- `PatchExplainer` (explain_patch)

Mocks
- `MockPatchGenerator` returns synthetic secure variants and diffs.
- Explanation references CWE/OWASP and yields confidence [0–1].

Patch Model
- `id, scan_id, vuln_id, original_code, patched_code, explanation, confidence, status, created_at, updated_at`

Example: `/patches/{patch_id}`
```json
{
  "id": 101,
  "scan_id": "ae12f...",
  "vuln_id": "v-42",
  "original_code": "password = request.args['pwd']",
  "patched_code": "password = request.get('pwd')  # validated",
  "explanation": "Fixes CWE-22: Improper Input Validation. Ensures tainted data is sanitized.",
  "confidence": 0.86,
  "status": "GENERATED",
  "created_at": "2025-11-01T10:00:00Z",
  "updated_at": "2025-11-01T10:05:00Z"
}
```

---

## Reports (M7)

Routes under `/api/v1/reports`.

- GET `/reports` (query: repo_id?, date_from?, date_to?, tag?) → list
- GET `/reports/{report_id}` → full report summary + vulnerabilities + AI insights
- GET `/reports/{report_id}/export` (format=`json|csv|pdf`) → for now return JSON or stub CSV/PDF text
- POST `/reports/compare` { report_id_1, report_id_2 } → comparison data

Report fields
- `id, scan_id, repo_id, created_at, total_vulns, critical, high, medium, low, fixed_count, pending_count, ignored_count, ai_accuracy, compliance_flags` (OWASP Top 10, CWE-25)

Example: `/reports`
```json
[
  {
    "id": 12,
    "repo_id": 1,
    "scan_id": "ae12f...",
    "created_at": "2025-11-01T10:05:00Z",
    "total_vulns": 25,
    "critical": 1,
    "high": 5,
    "medium": 11,
    "low": 8,
    "ai_accuracy": 0.81,
    "compliance_flags": { "OWASP_TOP10": true, "CWE_25": true }
  }
]
```

---

## Schemas & Common

- `common.py` holds pagination (`PageParams { page, size }`), base response types, and common enums.
- Pydantic config sets `orm_mode=True` (Pydantic v1) or `from_attributes=True` (v2).

Enums
- Severity: `CRITICAL, HIGH, MEDIUM, LOW`
- ScanMode: `QUICK, DEEP, CUSTOM`
- ScanStatus: `QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED`
- PatchStatus: `GENERATED, APPLIED, REJECTED, EXPORTED`
- RepoStatus: `CONNECTED, DISCONNECTED, ERROR`

---

## Services & Domain

- `auth_service.py`: registration, login, token issuance, current user.
- `repository_service.py`: CRUD + branches + upload validation.
- `scan_service.py`: create job, manage lifecycle, mock progress/logs/summary.
- `graph_service.py`: wraps `GraphEngine` to return AST/CFG/DFG.
- `patch_service.py`: orchestrates generator + persistence + apply/export/regenerate.
- `report_service.py`: report listing, details, compare, export.
- `notification_service.py`: notifications list for dashboard.

Abstracts (in `domain/abstract`) define the interfaces; mocks (in `domain/mock`) provide working defaults.

---

## API Wiring

- `api/api_v1.py` includes all routers with prefix `/api/v1`.
- `app/main.py` sets CORS, includes router, and exposes `GET /health`.

```python
# app/main.py (sketch)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api_v1 import api_router

app = FastAPI(title=settings.PROJECT_NAME)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[orig.strip() for orig in settings.BACKEND_CORS_ORIGINS.split(',')],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(api_router, prefix=settings.API_V1_STR)
```

---

## Auth Flow (example)

1) Register: POST `/auth/register` → create user with hashed password (bcrypt), return `UserRead`.
2) Login: POST `/auth/login` → verify credentials, return JWT access (and optional refresh) tokens.
3) Protected calls: send `Authorization: Bearer <access_token>`.
4) Refresh (optional): POST `/auth/refresh` → new access token.

Token payload includes `sub` (user id), `exp`, and minimal claims.

---

## Validation & Errors

- Use Pydantic validators, raise HTTPException with appropriate status:
  - 404: not found (`RepoNotFound`, `ScanNotFound`)
  - 400/422: business validation errors (upload size, invalid mode)
  - 401/403: auth errors
- Global handlers can normalize error responses: `{ "detail": "..." }`.

---

## Dev Notes & Extensibility

- Replace mocks with real engines without changing service signatures.
- Switch DB URL to managed Postgres in production; configure pool size and timeouts.
- Add Alembic migrations when schema stabilizes.
- Consider Redis/RQ/Celery for real background scan jobs.
- Add metrics/Tracing (OpenTelemetry) and logging configuration.

---

## Frontend Integration Tips

- Set `REACT_APP_API_BASE_URL` in the frontend (e.g. `http://127.0.0.1:8000/api/v1`).
- Frontend auth guard expects any non-empty `access_token`. With the backend live, replace the dummy token with the real JWT from `/auth/login`.
- Default creds here match the login page display: `admin@vulcan.ai` / `admin123!`.

---

## Minimal Implementation Checklist

- [x] App starts: `uvicorn app.main:app --reload`
- [x] CORS allows `http://localhost:3000`
- [x] `/auth/*` implemented with JWT + hashing
- [x] Dashboard, Repositories, Scans, Graphs, Patches, Reports routers return mock JSON
- [x] Health check `/health`
- [x] Seed default admin user on first run

This backend template provides a drop-in foundation to connect your React frontend today and evolve into full functionality incrementally.
