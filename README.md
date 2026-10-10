# PULSEIQ

An institution-focused Student Success Intelligence Platform, based on the Campus Compass PRD. Colleges supply student records; faculty and placement teams use explainable evidence to agree on support actions.

**Complete runnable hackathon prototype:** CSV integration, data quality reports, academic and placement support flags, dashboard filters, student profiles, editable interventions with revision history, exports and a what-if simulator. Runs on a CPU laptop without an API key, GPU, Ollama or database.

The engine is transparent rule-based decision intelligence. It is **not a trained dropout or placement predictor**. All thresholds are prototype defaults requiring institutional review.

## Start on Windows

1. Install **Python 3.12** from https://www.python.org/downloads/ with the Python launcher enabled.
2. Extract the ZIP. Open the `PULSEIQ` folder.
3. Double-click **start_windows.bat**. It creates a local virtual environment and installs the dependencies. Internet is needed for this first installation.
4. Open **http://localhost:8501** if the browser does not open automatically. The synthetic demo loads immediately.

Manual commands in PowerShell or the VS Code terminal, inside the project folder:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m streamlit run app.py
```

No environment activation is needed with these commands, so PowerShell execution-policy changes are unnecessary. Python 3.11 is also supported by the source; the Windows launcher specifically chooses 3.12. Local verification was performed with Python 3.12 on Linux; Windows steps are provided but were not executed on Windows.

macOS/Linux: install Python 3.11 or 3.12, then run `sh start.sh`. Stop the server with Ctrl+C.

## What is included

| File/folder | Purpose |
| --- | --- |
| `app.py` | Navigation, session state, dataset switching and filters |
| `data_io.py` | CSV schemas, row validation, provenance and exact-period joins |
| `scoring.py` | Versioned formulas, coverage, flags, segments and recommendations |
| `views.py` | Dashboard, profiles, import screen, action board and simulator |
| `interventions.py` | Action validation and append-only session revision history |
| `config.json` | Scoring weights and prototype thresholds |
| `demo_data/` | Eight fictional college CSVs, 200 students, two periods |
| `benchmark_data/` | Licensed academic-only derivative of 4,424 real UCI records |
| `templates/` | Empty upload templates with required column headers |
| `fixtures/invalid/` | Deliberately invalid records for validation demos |
| `scripts/` | Reproducible data generation and benchmark verification |
| `tests/` | Scoring, import, workflow and Streamlit integration tests |
| `docs/` | Architecture, team stages, data contracts, deployment and demo guides |
| `.github/workflows/tests.yml` | Automated GitHub tests on Python 3.11 and 3.12 |
| `.streamlit/config.toml` | Theme and upload limits |

## Demo in three minutes

1. **Overview:** inspect the cohort and filter support segments.
2. **Student Profile → DEMO001:** strong academics, a placement gap, reference score **68.0**. Inspect raw fields and provenance.
3. Choose a coding support playbook, enter an owner alias and create an action.
4. **Action Board:** edit the action, mark it Reviewed with a note, reopen it if needed, and export actions and revision history.
5. **What-if Simulator:** adjust coding/aptitude/interview values in a scenario copy and export it separately.
6. **Import & data quality:** inspect missing values and zero denominators. To demonstrate blocking errors, upload `fixtures/invalid/students.csv` and `fixtures/invalid/academic.csv` together; the previous dataset stays active.
7. **Real academic benchmark:** view the UCI derivative or load its 400-student academic-only sample. There are no overall scores because it lacks required evidence.

Default analysis date is **10 October 2026**, an explicit demo reference date. The periods are 31 August and 30 September 2026. The first period is stale under the default 30-day rule; adjust the visible analysis date if demonstrating it. Nothing silently updates reporting dates to appear fresh.

## Included data

The complete demo is **synthetic**, not scraped college records. It supplies all seven evidence categories plus the roster and supports honest end-to-end testing. Generate it again with:

```powershell
.\.venv\Scripts\python.exe scripts/generate_demo_data.py
```

The separate real benchmark uses UCI dataset 697, **Predict Students' Dropout and Academic Success**, under **CC BY 4.0**. It keeps academic fields, a course code and outcomes, while excluding demographics and financial/family attributes. Real outcomes are never used in the rules engine. Its importer sample does not fabricate attendance, placement, skills, LMS, engagement or feedback. See [DATA_SOURCES.md](DATA_SOURCES.md) for attribution and transformations.

## Scoring

For full evidence: `Score = 0.30A + 0.20T + 0.15L + 0.25P + 0.05S + 0.05E`.

- `A`: marks percentage; `T`: attendance percentage; `L`: assignment completion percentage.
- `P`: mean of aptitude, coding and interview; `S`: mean of technical and communication assessments.
- `E`: activity completion percentage. Zero denominators mean missing evidence.
- Fresh available weight below 80%: no overall score. Partial coverage at or above 80%: provisional score, divided by available weight.
- Academic support: marks <50, attendance <75% or backlogs >0.
- Placement support: placement mean <60 or coding <50. A good overall score never cancels these flags.
- Missing required flag fields with no known trigger: Undetermined. Feedback requests do not reduce scores.

Edit `config.json` and the engine for approved rule changes. Change `scoring_version` when changing rules. If altering the 80% coverage rule, also update the corresponding explanatory text and tests. The source freshness window is configurable in the sidebar; exported data includes analysis date, age and source freshness.

## Test before pushing changes

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts/benchmark.py
```

Optional real-browser checks (including actual uploads/downloads and mobile layout):

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-browser.txt
.\.venv\Scripts\python.exe -m playwright install chromium
.\.venv\Scripts\python.exe scripts/browser_smoke.py
```

This starts a temporary local app on port 8511. Screenshots/downloads go into ignored `exports/browser_qa/`. Close any app already using that port first.

Observed local results are in [docs/TEST_REPORT.md](docs/TEST_REPORT.md). Unit tests verify calculations and workflows, not real predictive accuracy. Public hosting remains a separate release gate.

## Push to your existing PULSEIQ repository

Clone your existing repository to preserve its README/history and accepted teammate permissions:

```powershell
git clone https://github.com/YOUR_USERNAME/PULSEIQ.git
cd PULSEIQ
```

Copy **the contents** of the extracted PULSEIQ folder into this clone. Include `.github`, `.streamlit` and `.gitignore`; do not create a nested `PULSEIQ/PULSEIQ` app. Keep the clone's `.git` folder. Review the files, then:

```powershell
git status
git add .
git commit -m "Add complete PULSEIQ student success prototype"
git push
```

Do not copy virtual environments or upload exports. `.gitignore` excludes those locations and secrets. The package contains only fictional demo records and the attributed public academic derivative.

For deployment, read [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). GitHub stores the source; a Python host runs the Streamlit app. GitHub Pages cannot execute this Python application.

## Team ownership and stages

See [docs/TEAM_GUIDE.md](docs/TEAM_GUIDE.md) for the five-member division and step-by-step integration order. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system diagram and module contracts.

## Scope and state

This is a public demonstration prototype with **no authentication, department authorization, persistent database or ERP/LMS connector**. UI filters are not security roles. Uploads, actions and notes are session-scoped, not globally cached, and are lost on dataset switch, reset, disconnection expiry or server restart. Export before leaving. CSV reports are snapshots; action restore/import is not implemented.

A production institutional release needs approved data handling, authenticated access, department restrictions, durable audit storage and correction/appeal workflows. Current scores support faculty review and must not automatically decide exam, placement or service eligibility.

The UCI derivative retains its CC BY 4.0 attribution obligations. Choose the team's project-code license before distributing it more broadly; no code license has been selected by this package.
