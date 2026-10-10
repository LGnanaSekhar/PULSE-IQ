# PULSEIQ — React + FastAPI + hosted PostgreSQL

PULSEIQ connects institutional records to an explainable student support dashboard and a persistent faculty Action Board. This version replaces the earlier Streamlit/file-upload workflow.

**Deploy once to the cloud.** The app and API run together on Render. One Neon PostgreSQL database stores students, staff accounts, sessions, actions and revision history. You do not need a local database, Excel, student data files or a Windows startup script.

## Start here

Read **[START_HERE.md](START_HERE.md)** for the exact Neon and Render account steps, the credentials to enter, and how to push this folder into `LGnanaSekhar/PULSE-IQ`.

You need:

1. A Neon project/database: copy its pooled PostgreSQL connection string.
2. A Render web service connected to your GitHub repository: use the included `render.yaml`.
3. A private initial administrator password, at least 12 characters long.

Render builds React, starts FastAPI and exposes one HTTPS address. Tables are created automatically on the first successful startup. With the default demo setting, 1,000 fictional students are inserted directly into the database once. No cloud accounts or live deployments are included in this ZIP; you create them using your own accounts.

## What works

- Staff login using password hashes and server-checked sessions; department scopes for faculty and placement staff.
- Cohort filters, support counts, charts, student profiles and source provenance.
- Transparent academic and placement support rules; missing/stale evidence and student requests remain explicit.
- A saved Action Board: create actions, assign an owner, set a due date, move through Planned/In progress/Reviewed/Closed, reopen, and inspect revision history.
- Version checks reject an outdated action edit instead of overwriting another staff member's change.
- A what-if simulator that leaves the database student record unchanged.
- Administrator staff creation, source refresh, validation messages and refresh history.
- Read-only institution connectors for SQL databases, MongoDB and a canonical HTTPS API. Each institute needs its own field mapping, credentials and network access.

## Connections

The browser loads React from Render and calls `/api/...` on the same Render address. FastAPI reads/writes Neon through `DATABASE_URL`. An optional institution connector reads approved source records into a validated database snapshot. The institution source is separate from the PULSEIQ application database.

| Setting | Where it comes from | Where it goes |
|---|---|---|
| `DATABASE_URL` | Neon → Connect → pooled connection string | Render → Environment |
| `APP_SECRET` | Generated automatically by the Render Blueprint | Render only |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password you choose | Render only, for the first administrator |
| Institution credentials | Institute's database/API administrator | Optional `SOURCE_*` Render variables |

**No Neon management API key, Render API key, OpenAI key or frontend database key is required for this setup.** Browser requests use a login session. Keep actual connection strings and passwords out of this public repository.

## Project map

| Path | Responsibility |
|---|---|
| `frontend/src/` | React dashboard, Action Board, simulator and administration |
| `backend/main.py` | HTTP routes, permissions and persistent workflows |
| `backend/db.py` | PostgreSQL tables and engine |
| `backend/auth.py` | Argon2 passwords, opaque sessions and CSRF checks |
| `backend/repository.py` | Atomic snapshot replacement and database reads |
| `backend/connectors.py` | Read-only SQL/MongoDB/API adapters |
| `backend/validation.py` | Canonical record validation and reporting-period joins |
| `backend/scoring.py`, `config.json` | Explainable scoring and support thresholds |
| `backend/seed.py` | Reproducible fictional database records |
| `connectors/mapping.json` | Institute table/column mapping; contains no credentials |
| `Dockerfile`, `render.yaml` | Hosted build and deployment |
| `tests/` | Authentication, scoring, connectors, permissions and persistence checks |
| `docs/` | Architecture, API, integration, developer and test documentation |

## Demo data and limits

Demo records are fictional, generated with a fixed random seed. They test the software's behavior and do not demonstrate real-world prediction accuracy. The scoring engine is `rules_v1`, not a trained ML model. It supports human review rather than automatic student eligibility decisions.

Each reporting source accepts up to 20,000 rows per refresh. Larger institutes should provide normalized views for the required periods or extend ingestion and pagination. Refresh is an administrator action; automatic scheduled synchronization is not enabled. Use one deployment/database per institute; this version is not a multi-institution SaaS tenant system.

The included Render plan is **free for demonstration** and can pause when idle. For regular institutional use, select a suitable paid compute/database plan, backups and access arrangements. The architecture and database connection stay the same when upgrading plans.

## Verification and further development

See [docs/TEST_REPORT.md](docs/TEST_REPORT.md) for the checks actually run and their limits. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) describes optional developer commands. Those commands are not required for the cloud-first setup.

Provider references: [Neon connection setup](https://neon.com/docs/connect/connect-from-any-app), [Render Blueprints](https://render.com/docs/infrastructure-as-code), [Render environment settings](https://render.com/docs/blueprint-spec), [Render free plan behavior](https://render.com/docs/free).
