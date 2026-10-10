# START HERE — PULSEIQ 3.0

1. **Back up Neon** and extract this folder; push it to a **private** GitHub repository.
2. In Render, deploy the included `render.yaml` Blueprint (or a Docker Web Service).
3. Set `DATABASE_URL` (Neon pooled Postgres URL) and `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters).
4. Also set `BOOTSTRAP_COLLEGE_NAME`, `BOOTSTRAP_COLLEGE_DOMAIN`, `BOOTSTRAP_ADMIN_EMAIL` (email must match domain). Keep `APP_SECRET` stable (Render Blueprint generates it).
5. Keep `SEED_DEMO=false` for real college information. For an empty demonstration, use `SEED_DEMO=true` to insert **fictional** records. For first-time migration from old v2 tables, instead use `IMPORT_LEGACY_V2=true` once, then turn it off.
6. After deployment, visit Render's HTTPS URL and sign in using `BOOTSTRAP_ADMIN_EMAIL` plus the chosen password. The original `admin` username no longer works.
7. In College Admin: create student roster → faculty accounts → teaching assignments → student accounts → database connections and mappings. Then log in as faculty/student to verify permissions.
8. For more colleges, run `python -m scripts.add_college` in a secure shell (instructions in `README.md`).

**No front-end database credentials or API keys.** Neon stays server-side. PULSEIQ cannot access a college's database without the college authorizing and providing a connection. See `README.md` and `docs/DEPLOYMENT.md` for details.
