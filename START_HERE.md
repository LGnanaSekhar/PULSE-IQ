# Deploy PULSEIQ once — use the cloud database from the start

This is the replacement React/FastAPI version. You do not run `START_WINDOWS`, Streamlit, Excel or a student data upload. The browser opens the hosted app after these account steps.

## 1. Put the updated project in your GitHub repository

1. Extract this ZIP somewhere separate from your existing repository, for example your Downloads folder.
2. Open your existing `C:\Users\sekha\OneDrive\Desktop\PULSEIQ` folder. Keep its `.git` directory so your existing GitHub remote and commit history remain available.
3. Copy the contents **inside the extracted `PULSEIQ` folder** into that repository folder and replace matching files. `README.md`, `Dockerfile`, `render.yaml`, `backend/` and `frontend/` must be directly inside the repository root, not inside a second nested `PULSEIQ` directory. Include `.gitignore`, `.dockerignore` and `.github` if your file manager hides them.
4. Older Streamlit files are unused by this deployment. You can keep them temporarily; the included Dockerfile starts only `backend.main`. Do not use the older startup scripts.
5. In PowerShell, run:

```powershell
cd C:\Users\sekha\OneDrive\Desktop\PULSEIQ
git status
git add .
git commit -m "Replace Streamlit with hosted React and FastAPI database app"
git push origin main
```

Do not run `git init` again. If `git status` shows uncommitted changes from your own work, preserve those before replacing matching files. Before committing, check that no real database credentials, passwords or student records appear in the changes. The packaged `.env.example` contains placeholders only.

## 2. Create the database in Neon

1. Open [Neon](https://neon.com/) and create/sign in to your account.
2. Create a project named `pulseiq`. Choose a region close to your Render service; the deployment template selects Singapore. If the same region is unavailable for your plan, choose a nearby one.
3. Use the database Neon creates by default, or create one named `pulseiq`. The database name in the connection string is what matters.
4. Click **Connect**. Choose the branch, database and database role you will use for this app. This role must be allowed to create tables and read/write the application's tables.
5. Turn **Connection pooling** on and copy the entire connection string. The pooled host normally contains `-pooler`. Keep the URL options such as `sslmode=require` and any `channel_binding` option Neon provides.

It will have this general form, with your real values:

```text
postgresql://ROLE:PASSWORD@YOUR-POOLER-HOST/DATABASE?sslmode=require
```

Copy the URL, not a shell command such as `psql '...'`. There is **no separate Neon API key** to generate. This connection string already identifies the database, role and password. You will paste it into Render, never into React code or GitHub.

You do not manually create the student/action tables or import a file. FastAPI creates the application's tables when it starts with this database connection.

## 3. Create the backend and app together in Render

1. Open [Render](https://dashboard.render.com/) and sign in.
2. Connect your GitHub account and allow Render to access `LGnanaSekhar/PULSE-IQ`.
3. Select **New → Blueprint**, select that repository and the `main` branch. Use the root `render.yaml` file.
4. Render should show a Docker web service named `pulseiq`. Enter the two prompted private values:

| Prompt | Value |
|---|---|
| `DATABASE_URL` | The entire pooled connection string copied from Neon |
| `BOOTSTRAP_ADMIN_PASSWORD` | A strong password you choose, at least 12 characters |

5. `APP_SECRET` is generated automatically. Leave the other included defaults for a demonstration: `SEED_DEMO=true`, `DEMO_STUDENTS=1000`, `COOKIE_SECURE=true`, `SOURCE_KIND=none`.
6. Review the selected plan and deploy. The included template uses the free demonstration plan. The Docker build installs dependencies and compiles React. No local Python, Node, PostgreSQL or Windows script is required.
7. Wait until the service reports healthy, then open its `https://...onrender.com` address. Sign in with username **admin** and your bootstrap password.

If your Render interface does not offer Blueprint creation, select **New → Web Service**, connect the same repository, choose **Docker**, keep the root directory blank and Dockerfile path `./Dockerfile`, and set health check `/health`. Add the variables in the table above plus `APP_SECRET` (a random secret of at least 32 characters), `SEED_DEMO=true`, `DEMO_STUDENTS=1000`, `COOKIE_SECURE=true` and `SOURCE_KIND=none`. Use automatic deployment from `main`.

The password is used only when the user table is empty. Changing `BOOTSTRAP_ADMIN_PASSWORD` later does not change an existing user's password. Keep the initial password in your password manager. The secret should also stay stable between deployments so existing sessions remain valid.

## 4. Check the dashboard and Action Board

1. Overview should show **1,000 fictional students**. Data is already in Neon, generated directly on the first startup.
2. Open student `DEMO0001`. In the latest reporting period its complete score is **68.0** and the placement support trigger is visible.
3. Enter an owner alias, a support action and due date. Select **Create support action**.
4. Open **Action Board**, edit the action, set **Reviewed** and enter a review note. Save.
5. Refresh the page or sign out and back in. The action and revision history remain in the database.
6. Open **Connections → Staff access** to create faculty and placement accounts, assigning the departments each can access. An administrator can see all departments.

Do not share the administrator password with the team. Create individual staff accounts.

Demo dates are set relative to the first deployment date. If you return more than 30 days later, the original snapshot correctly becomes stale. Select an analysis date near its reporting date when demonstrating those historical records. Restarting the app does not reseed or change existing data.

## 5. Connect the institute's existing database

PULSEIQ's Neon database remains the application database. Your institute's ERP/SIS database remains the source. You are not rebuilding their database.

Ask the institute's IT team for:

- A **read-only** database account or an approved HTTPS API endpoint/token.
- The database engine, host, port, database/schema and TLS requirements.
- Which tables/views contain the eight canonical entities described in [docs/INSTITUTION_CONNECTIONS.md](docs/INSTITUTION_CONNECTIONS.md).
- A consistent student ID, reporting dates, and the institute's table/column mapping.
- Approved connectivity from the backend host. A campus-only/private database needs a permitted network path, gateway or backend placement; cloud hosting cannot reach a private campus address automatically.

For SQL, edit `connectors/mapping.json` to match those approved tables/views, push the mapping to GitHub and add `SOURCE_KIND=sql`, `SOURCE_NAME` and `SOURCE_DATABASE_URL` in Render. See the integration guide for drivers and URL formats. Mapping files contain schema names, not student records or credentials.

For MongoDB, use the MongoDB settings in the integration guide. For an ERP API, use `SOURCE_KIND=api`, `SOURCE_API_URL` and any `SOURCE_API_TOKEN` supplied by the institute. The API must return the canonical snapshot contract; vendor-specific APIs need an adapter.

After saving the source settings and redeploying, sign in as admin and select **Connections → Refresh from institution**. Valid records replace the current snapshot in one transaction. Invalid records leave the previous snapshot and actions intact. Source credentials never enter the browser.

Set `SEED_DEMO=false` for institutional operation. This prevents an empty future database from receiving demo records; it does not delete records from the current database. A successful institution refresh replaces active demo source records. Old demo interventions retain their history, so use no personal information in demo actions.

## What you will use afterward

| Task | Place |
|---|---|
| Open dashboard or Action Board | Your Render HTTPS app address |
| Create staff users or refresh records | App → Connections, as admin |
| Manage database/backup/SQL inspection | Neon console |
| Change credentials or source settings | Render → service → Environment |
| Change code, scoring thresholds or field mapping | This GitHub repository; push to `main` |

Future code changes redeploy the same app and use the same `DATABASE_URL`. You do not migrate from a laptop database.

## If deployment fails

| Symptom | Check |
|---|---|
| Cannot find Dockerfile or render.yaml | Files must be at repository root, not nested one folder down |
| `DATABASE_URL` required or connection failed | Copy the full Neon URL; verify database/role/password, SSL options and network access |
| Bootstrap password error | Enter at least 12 characters before the first startup |
| Login keeps returning to the login screen | Open the Render **HTTPS** address; secure cookies require HTTPS |
| First request after idle is slow | The free Render service may be starting again; use paid compute for regular availability |
| Source refresh fails | Verify source credentials, driver, table/column mapping, TLS and approved network access |
| Data appears stale | Check reporting period and analysis date; the freshness rule is deliberate |
| Another staff member updated an action | Refresh the board, open the current revision and apply your changes again |

References checked for this package: [Neon Connect](https://neon.com/docs/connect/connect-from-any-app), [pooled URI](https://neon.com/faqs/find-pooled-connection-string-dashboard), [Render Blueprint environment variables](https://render.com/docs/blueprint-spec), [Docker deployment](https://render.com/docs/docker), [free plan limits](https://render.com/docs/free).
