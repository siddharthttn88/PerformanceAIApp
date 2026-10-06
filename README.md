# Performance AI Monitor

A FastAPI dashboard for load-test and production performance reviews. You pick a project, name a test, select one or more services in the same user journey, choose a time range, and inspect CPU, memory, HPA, latency, throughput, and New Relic traces. Saved tests can be compared side by side. Optional AI analysis uses Cursor Agent and can include traces with span breakdowns.

The UI is served from this app at `http://127.0.0.1:8001/`. Metrics and traces come from New Relic and Grafana through configured MCP servers (not custom scrape scripts). Pins and projects are stored locally in SQLite (`pinned_results.db`).

## What it does

- **Monitor** — Fetch metrics for every selected service, then switch charts with the service chips. Multi-select groups services that belong to one test; it is not an overlay comparison.
- **Traces** — List transactions, filter traces that have Span/SpanEvent data, and open a full-screen span breakdown.
- **Save / pin** — Persist test name, time range, metrics, traces, and breakdowns under a project.
- **Compare** — Overlay two saved tests, including traces.
- **AI analysis** — Chat over the current metrics; optionally include traces with breakdowns.

## Requirements

- Python 3.10 or later
- Node.js / `npx` if your MCP servers are launched that way (typical for New Relic and Grafana MCP)
- Cursor Agent on Windows at `%LOCALAPPDATA%\cursor-agent\cursor-agent.ps1` (needed only for AI analysis)
- A Cursor MCP config file (`mcp.json`) with `newrelic` and `grafana-infra` (or the names you set in env)
- Credentials in a `.env` file (see [Environment](#environment))

## Setup

Commands below assume you are in this `monitor` directory.

### 1. Create and activate a virtual environment

**Windows PowerShell**

```powershell
cd monitor
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If activation is blocked, run this once in an elevated PowerShell session, then activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**Windows Command Prompt**

```bat
cd monitor
python -m venv .venv
.venv\Scripts\activate.bat
```

**macOS / Linux**

```bash
cd monitor
python3 -m venv .venv
source .venv/bin/activate
```

Your prompt should show `(.venv)` when the environment is active.

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Environment

This app loads **`../.env`** (the parent `CursorAI_Backend` folder), not a `.env` inside `monitor`.

Create or edit `CursorAI_Backend/.env` with placeholders only — never commit real keys:

```
NEWRELIC_API_KEY=<your_new_relic_api_key>
NEWRELIC_ACCOUNT_ID=<your_account_id>
GRAFANA_URL=<your_grafana_base_url>
GRAFANA_API_KEY=<your_grafana_api_key>
GRAFANA_PROMETHEUS_UID=<prometheus_datasource_uid>
GRAFANA_HPA_NAMESPACE=load-test
```

Optional:

| Variable | Purpose |
| --- | --- |
| `MCP_CONFIG_FILE` | Path to `mcp.json` (default is the Cursor user MCP config) |
| `MONITOR_NR_MCP_SERVER` | MCP server name for New Relic (default `newrelic`) |
| `MONITOR_GRAFANA_MCP_SERVER` | MCP server name for Grafana (default `grafana-infra`) |
| `CURSOR_MODEL` | Model for analysis (default `gpt-5-mini`) |
| `CURSOR_TIMEOUT` | Agent timeout in seconds (default `300`) |

`mcp.json` must contain an `mcpServers` object. Command/url values may use `${ENV_VAR}` placeholders; those variables must be set in `.env` or the process environment.

### 4. Run the app

With the venv activated, from `monitor`:

```powershell
uvicorn monitor_app:app --host 127.0.0.1 --port 8001 --reload
```

Open [http://127.0.0.1:8001/](http://127.0.0.1:8001/).

Health check: [http://127.0.0.1:8001/health](http://127.0.0.1:8001/health).

`--reload` restarts on code changes. Use it for local development only.

## Layout

| Path | Role |
| --- | --- |
| `monitor_app.py` | FastAPI app, MCP clients, NRQL/Grafana calls, pins, analysis |
| `static/` | Dashboard HTML, CSS, JS |
| `Assets/` | Source images (favicon is copied to `static/`) |
| `requirements.txt` | Python dependencies |
| `pinned_results.db` | Local SQLite for projects and saved tests (created at runtime) |

## Typical workflow

1. Create or select a **project**.
2. Enter a **test name** and select **all services** in that journey.
3. Choose a **time range** (presets or custom).
4. Load metrics and, if needed, traces / span breakdowns.
5. **Save** the test. The list label is `Test name | time range`.
6. Use **Compare** to overlay two saved tests.
7. Use **AI analysis** for a write-up; check “include traces with breakdowns” when you want span context.

## Troubleshooting

- **Empty service list** — Confirm New Relic credentials and that applications are visible on that account. Check `GET /api/services/health`.
- **MCP connection warnings on startup** — Point `MCP_CONFIG_FILE` at a valid `mcp.json` and ensure those servers start (`npx` on PATH).
- **No HPA data** — Check `GRAFANA_URL`, API key, Prometheus UID, and `GRAFANA_HPA_NAMESPACE`.
- **AI analysis fails** — Confirm Cursor Agent exists at the path above and is signed in.
- **Stale UI after a JS/CSS change** — Hard-refresh the browser; static files are cache-busted with `?v=` query params.

Do not commit `.env`, `.venv`, or `pinned_results.db`.
