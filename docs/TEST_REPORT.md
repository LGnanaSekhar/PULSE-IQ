# PULSEIQ local verification report

Verified on 10 October 2026 with Python 3.12.14 on Linux x86_64. Dependencies: Streamlit 1.50.0, pandas 2.3.3, NumPy 2.3.3 and Plotly 6.3.1. Tests: pytest 8.4.2. Browser: Playwright 1.55.0 with Chromium 140.

## Automated checks

`python -m pytest -q`: **34 passed in 3.76 seconds** on the final application source. Timings vary by machine.

Verified the 68.0 reference score, independent placement support despite strong marks, insufficient and provisional coverage, known triggers with missing assessments, overlapping segments and feedback requests that do not alter scores. Tests also cover stale/future exclusion, baseline-preserving scenarios, invalid scenario values, unique-period joins, leading-zero IDs, duplicate rejection, unmatched-ID exclusion, percentage/count/date constraints, zero denominators, file limits and formula-safe exports.

Action tests cover creation, validation, review, reopening and preservation of previous notes. Streamlit integration tests cover all seven screens, empty filters, profile/action workflow, benchmark switching and independent session state. The UCI sample is verified to receive no overall scores or unsupported on-track labels.

These establish software behavior and arithmetic, not real dropout/placement prediction accuracy or causal intervention effectiveness.

## Actual Chromium checks

- Desktop overview, profiles, charts and action board rendered without application exceptions.
- Invalid academic CSV blocked activation while the previous synthetic dataset stayed active.
- All eight valid demo CSVs were uploaded and activated; DEMO001 still displayed 68.0.
- A faculty action was created and action/history CSVs were downloaded with expected contents.
- Cohort download contained 200 student records plus the header.
- A separate browser context started with the original demo and no actions from the first context.
- Mobile viewport 390 × 844 rendered without document horizontal overflow; desktop was 1440 × 1100. Screenshots were visually inspected.
- The local server health endpoint returned HTTP 200.

The packaged `scripts/browser_smoke.py` harness also passed. Optional dependencies are in `requirements-browser.txt`. Its screenshots and downloads go into ignored `exports/browser_qa/`, excluded from the delivered archive.

## Data and timings

`python scripts/benchmark.py`, September period, analysis 10 October 2026, freshness 30 days:

| Input | Students | Validation | Join + score | Total | Score state |
| --- | --- | --- | --- | --- | --- |
| Synthetic full demo | 200 | 0.0475 s | 0.0256 s | 0.0732 s | 186 complete, 13 provisional, 1 insufficient |
| UCI academic-only sample | 400 | 0.0114 s | 0.0270 s | 0.0384 s | 400 insufficient; maximum coverage 30% |

The synthetic cohort has 96 academic-support and 94 placement-support flags; these counts overlap. The UCI academic derivative retains 4,424 study rows. Its importer sample uses 400 students and 800 academic period rows; no missing source categories are fabricated.

These are one-run local measurements, excluding browser rendering, dependency installation and cold hosted startup. They are not a hosting performance guarantee. Before delivery, the archive is checked for CRC integrity, required files and root structure, and tests are repeated on the extracted source.

## Remaining release gates

Windows startup instructions are supplied but were not executed on Windows. GitHub CI is configured for Python 3.11/3.12; local verification used Python 3.12 only. No GitHub push or public hosting was performed. After deployment, complete the fresh-HTTPS-browser checklist in `docs/DEPLOYMENT.md`.

Authentication, department authorization, persistent storage, approved institutional connectors and independently evaluated prediction are future work.
