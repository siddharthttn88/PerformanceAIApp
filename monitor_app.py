import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import uuid
from contextlib import AsyncExitStack
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
import urllib.error
import urllib.parse
import urllib.request

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from mcp import ClientSessionGroup, StdioServerParameters
from mcp.client.session import ClientSession
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE_PATH = PROJECT_ROOT / ".env"
STATIC_DIR = Path(__file__).resolve().parent / "static"
load_dotenv(dotenv_path=ENV_FILE_PATH, override=True)

app = FastAPI(
    title="Infra Monitoring App",
    description="Standalone infra and result monitoring dashboard",
    version="1.0.0",
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.on_event("startup")
async def startup() -> None:
    """Connect to all configured MCP servers on app startup."""
    try:
        print("[Startup] Connecting to MCP servers...")
        # Connect to New Relic MCP
        try:
            client = await mcp_manager.get_client(MONITOR_NR_MCP_SERVER)
            print(f"[Startup] Connected to {MONITOR_NR_MCP_SERVER} MCP server")
        except Exception as exc:
            print(f"[Startup] Warning: Failed to connect to {MONITOR_NR_MCP_SERVER}: {exc}")
        
        # Connect to Grafana MCP
        try:
            client = await mcp_manager.get_client(MONITOR_GRAFANA_MCP_SERVER)
            print(f"[Startup] Connected to {MONITOR_GRAFANA_MCP_SERVER} MCP server")
        except Exception as exc:
            print(f"[Startup] Warning: Failed to connect to {MONITOR_GRAFANA_MCP_SERVER}: {exc}")
        
        # Pre-fetch and cache services
        try:
            print("[Startup] Pre-fetching services list...")
            services = await get_services()
            print(f"[Startup] Cached {len(services.services)} services: {services.services[:5]}...")
        except Exception as exc:
            print(f"[Startup] Warning: Failed to pre-fetch services: {exc}")
    except Exception as exc:
        print(f"[Startup] Unexpected error: {exc}")


@app.on_event("shutdown")
async def shutdown() -> None:
    await mcp_manager.disconnect_all()

CURSOR_MODEL = os.getenv("CURSOR_MODEL", "gpt-5-mini")
CURSOR_TIMEOUT = int(os.getenv("CURSOR_TIMEOUT", "300"))
CURSOR_AGENT = os.path.expandvars(r"%LOCALAPPDATA%\cursor-agent\cursor-agent.ps1")
def _clean_base_url(value: str) -> str:
    cleaned = value.strip()
    while cleaned.startswith("="):
        cleaned = cleaned[1:].strip()
    return cleaned.rstrip("/")


GRAFANA_URL = _clean_base_url(os.getenv("GRAFANA_URL", ""))
GRAFANA_API_KEY = os.getenv("GRAFANA_API_KEY", "").strip()
GRAFANA_PROMETHEUS_UID = os.getenv("GRAFANA_PROMETHEUS_UID", "bezqgzwpyn8cgc").strip()
GRAFANA_HPA_NAMESPACE = os.getenv("GRAFANA_HPA_NAMESPACE", "load-test").strip()
SERVICE_CACHE_TTL_SECONDS = 300
_service_cache: list[str] | None = None
_service_cache_time = 0.0
PIN_DB_PATH = PROJECT_ROOT / "monitor" / "pinned_results.db"
MCP_CONFIG_FILE = Path(
    os.getenv("MCP_CONFIG_FILE", "C:\\Users\\Siddharth Sarkhel\\.cursor\\mcp.json")
)
MONITOR_NR_MCP_SERVER = os.getenv("MONITOR_NR_MCP_SERVER", "newrelic").strip()
MONITOR_GRAFANA_MCP_SERVER = os.getenv(
    "MONITOR_GRAFANA_MCP_SERVER", "grafana-infra"
).strip()


class ServicesResponse(BaseModel):
    services: list[str]


class MetricsRequest(BaseModel):
    service: str
    start_time: str
    end_time: str


class ThroughputRequest(BaseModel):
    service: str
    start_time: str
    end_time: str
    endpoint: str | None = None


class TracesRequest(BaseModel):
    service: str
    start_time: str
    end_time: str
    endpoint: str | None = None
    withBreakdown: bool = False


class TraceBreakdownRequest(BaseModel):
    start_time: str
    end_time: str
    traceId: str | None = None
    guid: str | None = None
    service: str | None = None


class AnalyzeRequest(BaseModel):
    service: str
    metrics: dict[str, Any] | None = None
    question: str | None = None
    model: str | None = None
    history: list[dict[str, str]] | None = None
    session: str | None = None
    traces: dict[str, Any] | None = None
    includeTraces: bool = False
    includeMetrics: bool = True
    includeHistory: bool = False


class ProjectRequest(BaseModel):
    name: str


class PinRequest(BaseModel):
    projectId: str
    testName: str
    service: str
    rangePreset: str
    rangeLabel: str
    startTimeInput: str | None = None
    endTimeInput: str | None = None
    startTime: str
    endTime: str
    metrics: dict[str, Any]
    analysis: str = ""
    analysisConversation: list[dict[str, str]] = Field(default_factory=list)
    analysisSessionId: str | None = None
    model: str | None = None
    savedAtIST: str | None = None
    traces: dict[str, Any] | None = None
    services: list[str] = Field(default_factory=list)
    metricsByService: dict[str, Any] | None = None
    tracesByService: dict[str, Any] | None = None
    endpointMetricsByService: dict[str, Any] | None = None


ENV_PATTERN = re.compile(r"\$\{([^}]+)\}")


def _resolve_env_variables(value: Any) -> Any:
    if isinstance(value, str):
        def replace(match: re.Match[str]) -> str:
            key = match.group(1)
            env_value = os.getenv(key)
            if env_value is None:
                raise RuntimeError(f"Environment variable '{key}' is not set.")
            return env_value

        return ENV_PATTERN.sub(replace, value)
    if isinstance(value, dict):
        return {k: _resolve_env_variables(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_resolve_env_variables(item) for item in value]
    return value


def _normalize_command(command: str) -> str:
    if sys.platform != "win32":
        return command
    mapping = {"npx": "npx.cmd", "npm": "npm.cmd", "yarn": "yarn.cmd", "pnpm": "pnpm.cmd"}
    return mapping.get(command.lower(), command)


def _load_mcp_config() -> dict[str, Any]:
    if not MCP_CONFIG_FILE.exists():
        raise RuntimeError(f"MCP config not found: {MCP_CONFIG_FILE}")
    with open(MCP_CONFIG_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if "mcpServers" not in raw:
        raise RuntimeError("mcp.json must contain 'mcpServers'.")
    return _resolve_env_variables(raw)


def _get_server_config(server_name: str) -> dict[str, Any]:
    servers = _load_mcp_config()["mcpServers"]
    if server_name not in servers:
        raise RuntimeError(f"MCP server '{server_name}' not configured.")
    config = servers[server_name]
    if "command" not in config and "url" not in config:
        raise RuntimeError(
            f"MCP server '{server_name}' must contain either 'command' or 'url'."
        )
    return config


class MCPClientManager:
    def __init__(self) -> None:
        self.group: ClientSessionGroup | None = None
        self.exit_stack: AsyncExitStack | None = None

    async def _ensure_group(self) -> ClientSessionGroup:
        if self.group is None:
            self.exit_stack = AsyncExitStack()
            self.group = ClientSessionGroup(exit_stack=self.exit_stack)
        return self.group

    async def get_client(self, server_name: str) -> ClientSession:
        """Connect to an MCP server and return its session."""
        group = await self._ensure_group()
        server_config = _get_server_config(server_name)
        
        try:
            if "command" in server_config:
                params = StdioServerParameters(
                    command=_normalize_command(server_config["command"]),
                    args=server_config.get("args", []),
                    env={str(k): str(v) for k, v in server_config.get("env", {}).items()},
                )
            else:
                # For HTTP/SSE servers, import the necessary class
                from mcp.client.session_group import StreamableHttpParameters
                
                url = str(server_config["url"])
                headers = server_config.get("headers", {})
                params = StreamableHttpParameters(url=url, headers=headers or {})
            
            session = await group.connect_to_server(params)
            return session
        except Exception as exc:
            print(f"[MCPClientManager] Failed to connect to {server_name}: {exc}")
            raise

    async def call_tool(
        self, server_name: str, tool_name: str, arguments: dict[str, Any]
    ) -> Any:
        """Call a tool on a specific MCP server via the group."""
        group = await self._ensure_group()
        try:
            result = await group.call_tool(tool_name, arguments=arguments)
            return result
        except Exception as exc:
            print(f"[MCPClientManager] call_tool failed for {server_name}:{tool_name}: {exc}")
            raise

    async def disconnect_all(self) -> None:
        """Cleanup all MCP connections."""
        if self.exit_stack:
            try:
                await self.exit_stack.aclose()
            except Exception as exc:
                print(f"[MCPClientManager] Error during disconnect: {exc}")
        self.group = None
        self.exit_stack = None


mcp_manager = MCPClientManager()


def _serialize(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, dict):
        return {str(k): _serialize(v) for k, v in value.items()}
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "__dict__"):
        return {k: _serialize(v) for k, v in value.__dict__.items() if not k.startswith("_")}
    return str(value)


def _serialize_tool_result(result: Any) -> dict[str, Any]:
    return {
        "isError": getattr(result, "is_error", False),
        "structuredContent": _serialize(getattr(result, "structured_content", None)),
        "content": [_serialize(item) for item in getattr(result, "content", [])],
    }


def _extract_content_text(content_item: Any) -> str:
    if isinstance(content_item, str):
        return content_item
    if isinstance(content_item, dict):
        text_value = content_item.get("text")
        if isinstance(text_value, str):
            return text_value
    text_attr = getattr(content_item, "text", None)
    return text_attr if isinstance(text_attr, str) else ""


def _parse_mcp_tool_result(result: Any) -> dict[str, Any]:
    serialized = _serialize_tool_result(result)
    if serialized.get("isError"):
        raise RuntimeError(f"MCP tool error: {serialized}")

    structured = serialized.get("structuredContent")
    if isinstance(structured, dict):
        return structured
    if isinstance(structured, list):
        return {"result": structured}

    payload: dict[str, Any] = {}
    for item in serialized.get("content", []):
        text = _extract_content_text(item)
        if not text:
            continue
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, list):
            return {"result": obj}
        if isinstance(obj, dict):
            payload = obj
            break
    return payload


def _extract_unique_names(rows: list[dict[str, Any]]) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()

    def add(value: Any) -> None:
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                names.append(cleaned)
            return
        if isinstance(value, list):
            for item in value:
                add(item)

    for row in rows:
        if not isinstance(row, dict):
            continue
        for key, value in row.items():
            if key in {"beginTimeSeconds", "endTimeSeconds", "timestamp"}:
                continue
            if isinstance(value, list) or "unique" in key.lower():
                add(value)
    return names


def _resolve_rpm_field(rows: list[dict[str, Any]]) -> str:
    preferred = [
        "rate.count.apm.service.transaction.duration",
        "rpm",
        "rate.count",
    ]
    if not rows:
        return preferred[0]
    sample = rows[0]
    for key in preferred:
        if key in sample:
            return key
    for key, value in sample.items():
        if key in {"beginTimeSeconds", "endTimeSeconds", "timestamp"}:
            continue
        if isinstance(value, (int, float)):
            return key
        if isinstance(value, dict) and any(isinstance(item, (int, float)) for item in value.values()):
            return key
    return preferred[0]


def _throughput_payload(rows: list[dict[str, Any]], endpoint: str | None = None) -> dict[str, Any]:
    field = _resolve_rpm_field(rows)
    series = normalize_timeseries(rows, [field])
    rpm_values = series["series"].get(field, [])
    return {
        "endpoint": endpoint or None,
        "timestamps": series["timestamps"],
        "rpm": rpm_values,
        "max_rpm": max(rpm_values) if rpm_values else 0.0,
        "avg_rpm": (sum(rpm_values) / len(rpm_values)) if rpm_values else 0.0,
        "total_rpm": int(round(sum(rpm_values))) if rpm_values else 0,
    }


def _latency_nrql(service: str, since: str, until: str, endpoint: str | None = None) -> str:
    escaped_service = _escape_nrql_string(service)
    where = f"appName = '{escaped_service}'"
    if endpoint:
        escaped_endpoint = _escape_nrql_string(endpoint)
        where += f" AND name = '{escaped_endpoint}'"
    return (
        "SELECT percentile(duration, 50) AS p50, percentile(duration, 90) AS p90, "
        "percentile(duration, 95) AS p95 "
        "FROM Transaction "
        f"WHERE {where} "
        f"SINCE {since} UNTIL {until} TIMESERIES"
    )


def _latency_payload(rows: list[dict[str, Any]]) -> dict[str, Any]:
    series = normalize_timeseries(rows, ["p50", "p90", "p95"])
    return {
        "timestamps": series["timestamps"],
        "p50": [value * 1000.0 for value in series["series"]["p50"]],
        "p90": [value * 1000.0 for value in series["series"]["p90"]],
        "p95": [value * 1000.0 for value in series["series"]["p95"]],
    }


def _trace_nrql(
    service: str,
    since: str,
    until: str,
    endpoint: str | None = None,
    *,
    rich: bool = True,
    limit: int = 15,
    trace_ids: list[str] | None = None,
) -> str:
    escaped_service = _escape_nrql_string(service)
    where = f"appName = '{escaped_service}'"
    if endpoint:
        escaped_endpoint = _escape_nrql_string(endpoint)
        where += f" AND name = '{escaped_endpoint}'"
    if trace_ids:
        quoted = ", ".join(f"'{_escape_nrql_string(trace_id)}'" for trace_id in trace_ids[:40])
        where += f" AND (traceId IN ({quoted}) OR guid IN ({quoted}))"
    columns = (
        "timestamp, name, duration, error, request.uri, httpResponseCode, "
        "http.statusCode, host, guid, traceId"
        if rich
        else "timestamp, name, duration, error"
    )
    return " ".join(
        [
            f"SELECT {columns}",
            "FROM Transaction",
            f"WHERE {where}",
            f"SINCE {since}",
            f"UNTIL {until}",
            "ORDER BY duration DESC",
            f"LIMIT {max(1, min(limit, 50))}",
        ]
    )


def _row_value(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
        nested = row
        parts = key.split(".")
        found = True
        for part in parts:
            if not isinstance(nested, dict) or part not in nested:
                found = False
                break
            nested = nested[part]
        if found and nested not in (None, ""):
            return nested
    return None


def _trace_timestamp(value: Any) -> str:
    if isinstance(value, (int, float)):
        seconds = float(value) / 1000.0 if float(value) > 10_000_000_000 else float(value)
        return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat()
    if isinstance(value, str) and value.strip():
        return value
    return ""


def _trace_duration_ms(value: Any) -> float:
    duration = _to_float(value, 0.0)
    if duration <= 0:
        return 0.0
    return duration * 1000.0 if duration < 100 else duration


def _trace_payload(
    rows: list[dict[str, Any]],
    endpoint: str | None = None,
    *,
    with_breakdown: bool = False,
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    for row in rows:
        items.append(
            {
                "timestamp": _trace_timestamp(_row_value(row, "timestamp")),
                "name": str(_row_value(row, "name") or ""),
                "durationMs": round(_trace_duration_ms(_row_value(row, "duration")), 2),
                "error": bool(_row_value(row, "error")),
                "uri": str(_row_value(row, "request.uri", "requestUri") or ""),
                "status": str(
                    _row_value(row, "http.statusCode", "httpResponseCode", "response.status") or ""
                ),
                "host": str(_row_value(row, "host") or ""),
                "guid": str(_row_value(row, "guid") or ""),
                "traceId": str(_row_value(row, "traceId", "trace.id") or ""),
            }
        )
    return {
        "endpoint": endpoint or None,
        "items": items,
        "count": len(items),
        "withBreakdown": with_breakdown,
    }


def _span_nrql(trace_id: str, since: str, until: str, *, table: str = "Span", rich: bool = True) -> str:
    escaped_trace = _escape_nrql_string(trace_id)
    columns = (
        "timestamp, name, duration, guid, id, parentId, `parent.id`, `span.kind`, "
        "category, `http.url`, `db.statement`, error, `entity.name`, `service.name`"
        if rich
        else "timestamp, name, duration, guid, parentId"
    )
    return " ".join(
        [
            f"SELECT {columns}",
            f"FROM {table}",
            f"WHERE trace.id = '{escaped_trace}' OR traceId = '{escaped_trace}'",
            f"SINCE {since}",
            f"UNTIL {until}",
            "LIMIT 200",
        ]
    )


def _span_facet_trace_nrql(service: str, since: str, until: str, *, table: str = "Span") -> str:
    escaped_service = _escape_nrql_string(service)
    return " ".join(
        [
            "SELECT count(*)",
            f"FROM {table}",
            (
                f"WHERE appName = '{escaped_service}' OR entity.name = '{escaped_service}' "
                f"OR service.name = '{escaped_service}'"
            ),
            f"SINCE {since}",
            f"UNTIL {until}",
            "FACET trace.id",
            "LIMIT 50",
        ]
    )


def _spans_present_nrql(trace_ids: list[str], since: str, until: str, *, table: str = "Span") -> str:
    quoted = ", ".join(f"'{_escape_nrql_string(trace_id)}'" for trace_id in trace_ids[:40])
    return " ".join(
        [
            "SELECT count(*)",
            f"FROM {table}",
            f"WHERE trace.id IN ({quoted}) OR traceId IN ({quoted})",
            f"SINCE {since}",
            f"UNTIL {until}",
            "FACET trace.id",
            "LIMIT 50",
        ]
    )


def _extract_facet_ids(rows: list[dict[str, Any]]) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    for row in rows:
        value = _row_value(row, "facet", "trace.id", "traceId", "name")
        if isinstance(value, list) and value:
            value = value[0]
        text = str(value or "").strip()
        if text and text not in seen:
            seen.add(text)
            ids.append(text)
    return ids


def _item_trace_keys(item: dict[str, Any]) -> list[str]:
    keys: list[str] = []
    for field in ("traceId", "guid"):
        value = str(item.get(field) or "").strip()
        if value and value not in keys:
            keys.append(value)
    return keys


async def _trace_ids_with_spans(trace_ids: list[str], since: str, until: str) -> set[str]:
    unique_ids = [trace_id for trace_id in dict.fromkeys(trace_ids) if trace_id][:40]
    if not unique_ids:
        return set()
    for table in ("Span", "SpanEvent"):
        nrql = _spans_present_nrql(unique_ids, since, until, table=table)
        print(f"[get_traces] SPAN CHECK NRQL: {nrql}")
        try:
            rows = await _mcp_run_nrql(nrql)
        except Exception as exc:
            print(f"[get_traces] Span check failed ({table}): {exc}")
            continue
        found = set(_extract_facet_ids(rows))
        if found:
            return found
    return set()


async def _service_trace_ids_with_spans(service: str, since: str, until: str) -> list[str]:
    for table in ("Span", "SpanEvent"):
        nrql = _span_facet_trace_nrql(service, since, until, table=table)
        print(f"[get_traces] SPAN FACET NRQL: {nrql}")
        try:
            rows = await _mcp_run_nrql(nrql)
        except Exception as exc:
            print(f"[get_traces] Span facet failed ({table}): {exc}")
            continue
        found = _extract_facet_ids(rows)
        if found:
            return found
    return []


def _span_duration_ms(value: Any) -> float:
    return _trace_duration_ms(value)


def _span_items(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for row in rows:
        span_id = str(_row_value(row, "guid", "id", "span.id") or "")
        parent_id = str(_row_value(row, "parentId", "parent.id") or "")
        items.append(
            {
                "timestamp": _trace_timestamp(_row_value(row, "timestamp")),
                "name": str(_row_value(row, "name") or "span"),
                "durationMs": round(_span_duration_ms(_row_value(row, "duration")), 2),
                "id": span_id,
                "parentId": parent_id,
                "kind": str(_row_value(row, "span.kind", "category") or ""),
                "uri": str(_row_value(row, "http.url") or ""),
                "db": str(_row_value(row, "db.statement") or ""),
                "error": bool(_row_value(row, "error")),
                "service": str(_row_value(row, "entity.name", "service.name") or ""),
            }
        )
    items.sort(key=lambda item: (-item["durationMs"], item["name"]))
    return items


def _flatten_span_tree(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {item["id"]: item for item in items if item["id"]}
    children: dict[str, list[dict[str, Any]]] = {}
    roots: list[dict[str, Any]] = []
    for item in items:
        parent_id = item["parentId"]
        if parent_id and parent_id in by_id and parent_id != item["id"]:
            children.setdefault(parent_id, []).append(item)
        else:
            roots.append(item)

    ordered: list[dict[str, Any]] = []

    def walk(node: dict[str, Any], depth: int) -> None:
        ordered.append({**node, "depth": depth})
        kids = children.get(node["id"], [])
        kids.sort(key=lambda item: (-item["durationMs"], item["name"]))
        for child in kids:
            walk(child, depth + 1)

    for root in roots:
        walk(root, 0)
    if len(ordered) < len(items):
        seen = {item["id"] for item in ordered if item["id"]}
        for item in items:
            if item["id"] not in seen:
                ordered.append({**item, "depth": 0})
    return ordered


def _throughput_nrql(service: str, since: str, until: str, endpoint: str | None = None) -> str:
    escaped_service = _escape_nrql_string(service)
    if endpoint:
        escaped_endpoint = _escape_nrql_string(endpoint)
        where = (
            f"appName = '{escaped_service}' "
            f"AND (transactionName = '{escaped_endpoint}')"
        )
    else:
        where = f"appName = '{escaped_service}' OR entity.name = '{escaped_service}'"
    return (
        "SELECT rate(count(apm.service.transaction.duration), 1 minute) "
        "FROM Metric "
        f"WHERE {where} "
        f"SINCE {since} UNTIL {until} TIMESERIES"
    )


def _extract_nrql_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = [
        payload.get("results"),
        payload.get("data", {}).get("results") if isinstance(payload.get("data"), dict) else None,
        payload.get("nrql", {}).get("results") if isinstance(payload.get("nrql"), dict) else None,
    ]
    for candidate in candidates:
        if isinstance(candidate, list):
            return [row for row in candidate if isinstance(row, dict)]
    return []


def _extract_apm_app_names(payload: dict[str, Any]) -> list[str]:
    """Extract application names from New Relic APM REST API response."""
    # Build candidates list - try different response structures
    candidates: list[Any] = [
        payload.get("applications"),  # Direct top-level
        payload.get("data", {}).get("applications") if isinstance(payload.get("data"), dict) else None,
        payload.get("results"),  # Alternative format
    ]
    
    # Handle items array format (items -> [0] -> applications)
    items = payload.get("items")
    if isinstance(items, list) and len(items) > 0:
        first_item = items[0]
        if isinstance(first_item, dict):
            apps = first_item.get("applications")
            if isinstance(apps, list):
                candidates.append(apps)
    
    names: set[str] = set()
    
    # Try each candidate
    for candidate in candidates:
        if not isinstance(candidate, list):
            continue
        for item in candidate:
            if not isinstance(item, dict):
                continue
            # Try multiple field names for app name
            raw_name = (
                item.get("name") 
                or item.get("appName") 
                or item.get("application_name")
                or item.get("id")  # Fallback to id if name is missing
            )
            if isinstance(raw_name, str) and raw_name.strip():
                names.add(raw_name.strip())
    
    # If no names found in candidates, try recursive extraction
    if not names:
        def extract_names_recursive(obj: Any) -> None:
            if isinstance(obj, dict):
                for key, value in obj.items():
                    # Look for objects with name/appName/id fields
                    if isinstance(value, dict):
                        name = value.get("name") or value.get("appName") or value.get("application_name")
                        if isinstance(name, str) and name.strip():
                            names.add(name.strip())
                    # Recurse into lists and dicts
                    extract_names_recursive(value)
            elif isinstance(obj, list):
                for item in obj:
                    extract_names_recursive(item)
        
        extract_names_recursive(payload)
    
    return sorted(names)


def _extract_prometheus_series(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    if isinstance(payload.get("result"), list):
        return [item for item in payload["result"] if isinstance(item, dict)]
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("result"), list):
        return [item for item in data["result"] if isinstance(item, dict)]
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    return []


async def _mcp_call(server_name: str, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    result = await mcp_manager.call_tool(server_name, tool_name, arguments)
    payload = _parse_mcp_tool_result(result)
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unexpected MCP payload for {server_name}:{tool_name}")
    return payload


async def _mcp_run_nrql(nrql: str) -> list[dict[str, Any]]:
    args: dict[str, Any] = {"nrql": nrql}
    account_id = (
        os.getenv("NEWRELIC_ACCOUNT_ID") or os.getenv("NEW_RELIC_ACCOUNT_ID") or ""
    ).strip()
    if account_id:
        args["target_account_id"] = account_id
    payload = await _mcp_call(MONITOR_NR_MCP_SERVER, "run_nrql_query", args)
    return _extract_nrql_rows(payload)


async def _mcp_query_prometheus(expr: str, start_time: str, end_time: str) -> list[dict[str, Any]]:
    payload = await _mcp_call(
        MONITOR_GRAFANA_MCP_SERVER,
        "query_prometheus",
        {
            "datasourceUid": GRAFANA_PROMETHEUS_UID,
            "expr": expr,
            "queryType": "range",
            "startTime": start_time,
            "endTime": end_time,
            "stepSeconds": 60,
        },
    )
    return _extract_prometheus_series(payload)


def _db_connect() -> sqlite3.Connection:
    PIN_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(PIN_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_pin_store() -> None:
    with _db_connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pinned_results (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                test_name TEXT,
                service TEXT NOT NULL,
                range_preset TEXT NOT NULL,
                range_label TEXT NOT NULL,
                start_time_input TEXT,
                end_time_input TEXT,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                metrics_json TEXT NOT NULL,
                analysis TEXT NOT NULL,
                analysis_conversation_json TEXT NOT NULL,
                analysis_session_id TEXT,
                model TEXT,
                saved_at_ist TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        columns = {
            str(row["name"])
            for row in conn.execute("PRAGMA table_info(pinned_results)").fetchall()
        }
        if "project_id" not in columns:
            conn.execute("ALTER TABLE pinned_results ADD COLUMN project_id TEXT")
        if "test_name" not in columns:
            conn.execute("ALTER TABLE pinned_results ADD COLUMN test_name TEXT")
        if "traces_json" not in columns:
            conn.execute("ALTER TABLE pinned_results ADD COLUMN traces_json TEXT")
        if "journey_json" not in columns:
            conn.execute("ALTER TABLE pinned_results ADD COLUMN journey_json TEXT")

        default_project = conn.execute(
            "SELECT id FROM projects ORDER BY created_at ASC LIMIT 1"
        ).fetchone()
        if default_project is None:
            default_project_id = uuid.uuid4().hex
            conn.execute(
                "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)",
                (default_project_id, "Default Project", datetime.utcnow().isoformat()),
            )
        else:
            default_project_id = str(default_project["id"])
        conn.execute(
            "UPDATE pinned_results SET project_id = ? WHERE project_id IS NULL OR project_id = ''",
            (default_project_id,),
        )
        conn.execute(
            """
            UPDATE pinned_results
            SET test_name = service || ' - ' || range_label
            WHERE test_name IS NULL OR test_name = ''
            """
        )


def _pin_summary_from_row(row: sqlite3.Row) -> dict[str, str]:
    return {
        "id": str(row["id"]),
        "projectId": str(row["project_id"]),
        "testName": str(row["test_name"]),
        "service": str(row["service"]),
        "rangeLabel": str(row["range_label"]),
        "savedAtIST": str(row["saved_at_ist"]),
    }


def _parse_pin_json(value: Any, fallback: Any) -> Any:
    if value in (None, ""):
        return fallback
    try:
        return json.loads(str(value))
    except json.JSONDecodeError:
        return fallback


def _pin_full_from_row(row: sqlite3.Row) -> dict[str, Any]:
    keys = set(row.keys())
    traces = _parse_pin_json(row["traces_json"] if "traces_json" in keys else None, {})
    if not isinstance(traces, dict):
        traces = {"items": traces if isinstance(traces, list) else []}
    journey = _parse_pin_json(row["journey_json"] if "journey_json" in keys else None, {})
    if not isinstance(journey, dict):
        journey = {}
    services = journey.get("services") if isinstance(journey.get("services"), list) else []
    metrics_by_service = journey.get("metricsByService") if isinstance(journey.get("metricsByService"), dict) else {}
    traces_by_service = journey.get("tracesByService") if isinstance(journey.get("tracesByService"), dict) else {}
    endpoint_metrics_by_service = (
        journey.get("endpointMetricsByService")
        if isinstance(journey.get("endpointMetricsByService"), dict)
        else {}
    )
    return {
        "id": str(row["id"]),
        "projectId": str(row["project_id"]),
        "testName": str(row["test_name"]),
        "service": str(row["service"]),
        "rangePreset": str(row["range_preset"]),
        "rangeLabel": str(row["range_label"]),
        "startTimeInput": row["start_time_input"],
        "endTimeInput": row["end_time_input"],
        "startTime": str(row["start_time"]),
        "endTime": str(row["end_time"]),
        "metrics": json.loads(str(row["metrics_json"])),
        "analysis": str(row["analysis"]),
        "analysisConversation": json.loads(str(row["analysis_conversation_json"])),
        "analysisSessionId": row["analysis_session_id"],
        "model": row["model"],
        "savedAtIST": str(row["saved_at_ist"]),
        "traces": traces,
        "services": services,
        "metricsByService": metrics_by_service,
        "tracesByService": traces_by_service,
        "endpointMetricsByService": endpoint_metrics_by_service,
    }


_init_pin_store()


def _get_newrelic_config() -> tuple[str, str]:
    # Reload .env so runtime changes are picked up without requiring module re-import.
    load_dotenv(dotenv_path=ENV_FILE_PATH, override=True)
    api_key = (
        os.getenv("NEWRELIC_API_KEY")
        or os.getenv("NEW_RELIC_API_KEY")
        or ""
    ).strip()
    account_id = (
        os.getenv("NEWRELIC_ACCOUNT_ID")
        or os.getenv("NEW_RELIC_ACCOUNT_ID")
        or ""
    ).strip()
    return api_key, account_id


def _extract_json(text: str) -> dict[str, Any]:
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", stripped, re.DOTALL)
    if not match:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to parse JSON output from Cursor Agent.",
                "raw_output": stripped,
            },
        )

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Cursor Agent returned malformed JSON.",
                "error": str(exc),
            },
        )


def run_cursor_agent(
    prompt: str,
    model: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    if not os.path.exists(CURSOR_AGENT):
        raise HTTPException(
            status_code=500,
            detail=f"Cursor Agent not found at: {CURSOR_AGENT}",
        )

    selected_model = model or CURSOR_MODEL

    command = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        CURSOR_AGENT,
        "-p",
        prompt,
        "--model",
        selected_model,
        "--output-format",
        "json",
        "--trust",
        "--approve-mcps",
    ]
    if session_id and session_id != "new":
        command.extend(["--resume", session_id])

    try:
        process = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=CURSOR_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Cursor Agent execution timed out.")
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to execute Cursor Agent: {str(exc)}"
        )

    if process.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=(
                process.stderr.strip()
                or process.stdout.strip()
                or "Cursor Agent failed."
            ),
        )

    result = _extract_json(process.stdout)
    if result.get("is_error"):
        raise HTTPException(
            status_code=500,
            detail=result.get("result", "Cursor Agent returned an error."),
        )
    return result


def _call_and_extract_result(prompt: str, model: str | None = None) -> str:
    result = run_cursor_agent(prompt=prompt, model=model)
    text = result.get("result", "")
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=500, detail="Empty response from Cursor Agent.")
    return text


def _to_iso8601(value: str) -> str:
    if value.startswith("now"):
        return value
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.isoformat()
    except ValueError:
        return value


def _absolute_iso(value: str, now: datetime) -> str:
    """Freeze a relative range such as now-5m to the instant it was queried."""
    text = value.strip()
    if text == "now":
        return now.isoformat()
    if text.startswith("now-"):
        tail = text[4:]
        seconds = {"m": 60, "h": 3600, "d": 86400}
        if len(tail) >= 2 and tail[:-1].isdigit() and tail[-1] in seconds:
            return (now - timedelta(seconds=int(tail[:-1]) * seconds[tail[-1]])).isoformat()
    return _to_iso8601(text)


def _to_nrql_time(value: str) -> str:
    """Convert to New Relic NRQL time format: 'YYYY-MM-DD HH:MM:SS+ZZZZ'"""
    value = value.strip()
    if value == "now":
        return "now"
    if value.startswith("now-"):
        tail = value[4:]
        unit_map = {"m": "minute", "h": "hour", "d": "day"}
        if tail and tail[-1] in unit_map:
            number = tail[:-1]
            unit = unit_map[tail[-1]]
            if number.isdigit():
                plural = "" if number == "1" else "s"
                return f"{number} {unit}{plural} ago"
    
    # Convert to datetime and format as 'YYYY-MM-DD HH:MM:SS+ZZZZ'
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        # Format: 'YYYY-MM-DD HH:MM:SS+ZZZZ'
        formatted = parsed.strftime("%Y-%m-%d %H:%M:%S%z")
        # Add colon in timezone offset if needed (e.g., +00:00 instead of +0000)
        if formatted[-5] in "+-":
            tz_part = formatted[-5:]
            # Format as +HHMM
            return f"'{formatted[:-5]}{tz_part}'"
        return f"'{formatted}'"
    except (ValueError, AttributeError):
        return f"'{value}'"


def _escape_nrql_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def _to_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return default


def normalize_timeseries(
    rows: list[dict[str, Any]],
    field_names: list[str],
) -> dict[str, Any]:
    timestamps: list[str] = []
    series: dict[str, list[float]] = {name: [] for name in field_names}

    for row in rows:
        end_seconds = row.get("endTimeSeconds")
        if isinstance(end_seconds, (int, float)):
            dt = datetime.fromtimestamp(float(end_seconds), tz=timezone.utc)
            timestamps.append(dt.isoformat())
        else:
            timestamps.append("")

        for field in field_names:
            value = row.get(field)
            if isinstance(value, dict):
                nested_numeric = None
                for nested_value in value.values():
                    if isinstance(nested_value, (int, float)):
                        nested_numeric = float(nested_value)
                        break
                series[field].append(nested_numeric if nested_numeric is not None else 0.0)
            elif isinstance(value, (int, float)):
                series[field].append(float(value))
            else:
                series[field].append(0.0)

    return {"timestamps": timestamps, "series": series}


def _pick_numeric(row: dict[str, Any], keys: list[str], default: float = 0.0) -> float:
    for key in keys:
        if key in row:
            value = _to_float(row.get(key), default=default)
            return value

    # Fallback: pick first numeric value other than common timestamp keys.
    for key, value in row.items():
        if key in {"beginTimeSeconds", "endTimeSeconds", "timestamp"}:
            continue
        numeric = _to_float(value, default=float("nan"))
        if not (numeric != numeric):  # NaN check
            return numeric
    return default


def _hpa_aliases(service: str) -> list[str]:
    aliases = {service}

    patterns = [
        r"^paytv-load-test-",
        r"^paytv-prod-",
        r"^paytv-stage-",
        r"^paytv-test-",
        r"^stage2-vrgo-",
        r"^stage-vrgo-",
        r"^test-vrgo-",
    ]
    for pattern in patterns:
        alias = re.sub(pattern, "", service)
        if alias and alias != service:
            aliases.add(alias)

    parts = service.split("-")
    if len(parts) >= 2:
        aliases.add("-".join(parts[-2:]))
    if len(parts) >= 3:
        aliases.add("-".join(parts[-3:]))

    return sorted(aliases)


def _to_unix_seconds(value: str) -> int:
    value = value.strip()
    now = int(time.time())
    if value == "now":
        return now
    if value.startswith("now-"):
        tail = value[4:]
        if len(tail) >= 2 and tail[:-1].isdigit():
            amount = int(tail[:-1])
            unit = tail[-1]
            seconds_per = {"m": 60, "h": 3600, "d": 86400}
            if unit in seconds_per:
                return now - (amount * seconds_per[unit])
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return int(parsed.timestamp())


def _grafana_query_range(expr: str, start_time: str, end_time: str) -> list[dict[str, Any]]:
    if not GRAFANA_URL or not GRAFANA_API_KEY:
        raise ValueError("Grafana URL/API key not configured.")

    start_unix = _to_unix_seconds(start_time)
    end_unix = _to_unix_seconds(end_time)
    if end_unix <= start_unix:
        raise ValueError("Invalid Grafana query range.")

    query = urllib.parse.urlencode(
        {
            "query": expr,
            "start": str(start_unix),
            "end": str(end_unix),
            "step": "60",
        }
    )
    url = (
        f"{GRAFANA_URL}/api/datasources/proxy/uid/"
        f"{urllib.parse.quote(GRAFANA_PROMETHEUS_UID)}/api/v1/query_range?{query}"
    )
    request = urllib.request.Request(
        url=url,
        headers={
            "Authorization": f"Bearer {GRAFANA_API_KEY}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"Grafana HTTP {exc.code}: {detail}")
    except urllib.error.URLError as exc:
        raise ValueError(f"Grafana connection error: {exc.reason}")
    except json.JSONDecodeError as exc:
        raise ValueError(f"Grafana invalid JSON: {str(exc)}")

    result = payload.get("data", {}).get("result", [])
    return result if isinstance(result, list) else []


def _pick_best_series(series_list: list[dict[str, Any]], aliases: list[str]) -> dict[str, Any] | None:
    if not series_list:
        return None

    alias_l = [alias.lower() for alias in aliases if alias]

    def score(metric_label: str) -> int:
        label = metric_label.lower()
        best = 0
        for alias in alias_l:
            if label.endswith(alias):
                best = max(best, 300 + len(alias))
            if f"-{alias}-" in label:
                best = max(best, 220 + len(alias))
            if alias in label:
                best = max(best, 150 + len(alias))
        return best

    ranked: list[tuple[int, dict[str, Any]]] = []
    for item in series_list:
        metric = item.get("metric", {})
        name = str(metric.get("horizontalpodautoscaler", ""))
        ranked.append((score(name), item))

    ranked.sort(key=lambda x: x[0], reverse=True)
    return ranked[0][1] if ranked else None


def _values_to_series(values: list[list[Any]]) -> tuple[list[str], list[float]]:
    timestamps: list[str] = []
    data: list[float] = []
    for entry in values:
        if not isinstance(entry, list) or len(entry) < 2:
            continue
        ts_raw, val_raw = entry[0], entry[1]
        try:
            timestamps.append(datetime.fromtimestamp(float(ts_raw)).isoformat())
        except Exception:
            timestamps.append("")
        try:
            data.append(float(val_raw))
        except Exception:
            data.append(0.0)
    return timestamps, data


def _fetch_hpa_from_grafana_direct(service: str, start_time: str, end_time: str) -> dict[str, Any]:
    aliases = _hpa_aliases(service)
    regex_fragment = "|".join(
        re.escape(alias).replace("\\-", "-") for alias in aliases if alias
    )
    if not regex_fragment:
        raise ValueError("No aliases found for HPA query.")

    namespace_filter = (
        f'namespace="{GRAFANA_HPA_NAMESPACE}", ' if GRAFANA_HPA_NAMESPACE else ""
    )
    current_expr = (
        "kube_horizontalpodautoscaler_status_current_replicas"
        f'{{{namespace_filter}horizontalpodautoscaler=~".*({regex_fragment}).*"}}'
    )
    desired_expr = (
        "kube_horizontalpodautoscaler_status_desired_replicas"
        f'{{{namespace_filter}horizontalpodautoscaler=~".*({regex_fragment}).*"}}'
    )
    min_expr = (
        "kube_horizontalpodautoscaler_spec_min_replicas"
        f'{{{namespace_filter}horizontalpodautoscaler=~".*({regex_fragment}).*"}}'
    )
    max_expr = (
        "kube_horizontalpodautoscaler_spec_max_replicas"
        f'{{{namespace_filter}horizontalpodautoscaler=~".*({regex_fragment}).*"}}'
    )

    current_results = _grafana_query_range(current_expr, start_time, end_time)
    desired_results = _grafana_query_range(desired_expr, start_time, end_time)
    min_results = _grafana_query_range(min_expr, start_time, end_time)
    max_results = _grafana_query_range(max_expr, start_time, end_time)

    current_series = _pick_best_series(current_results, aliases)
    desired_series = _pick_best_series(desired_results, aliases)
    min_series = _pick_best_series(min_results, aliases)
    max_series = _pick_best_series(max_results, aliases)

    if not current_series and not desired_series and not min_series and not max_series:
        return {
            "timestamps": [],
            "current_replicas": [],
            "desired_replicas": [],
            "min_replicas": [],
            "max_replicas": [],
            "latest_current": 0,
            "latest_desired": 0,
            "latest_min": 0,
            "latest_max": 0,
        }

    current_ts, current_vals = _values_to_series(
        current_series.get("values", []) if current_series else []
    )
    desired_ts, desired_vals = _values_to_series(
        desired_series.get("values", []) if desired_series else []
    )
    min_ts, min_vals = _values_to_series(min_series.get("values", []) if min_series else [])
    max_ts, max_vals = _values_to_series(max_series.get("values", []) if max_series else [])

    timestamp_candidates = [current_ts, desired_ts, min_ts, max_ts]
    timestamps = max(timestamp_candidates, key=len, default=[])

    def _pad(values: list[float]) -> list[float]:
        if len(values) < len(timestamps):
            return values + [0.0] * (len(timestamps) - len(values))
        return values

    current_vals = _pad(current_vals)
    desired_vals = _pad(desired_vals)
    min_vals = _pad(min_vals)
    max_vals = _pad(max_vals)

    return {
        "timestamps": timestamps,
        "current_replicas": current_vals,
        "desired_replicas": desired_vals,
        "min_replicas": min_vals,
        "max_replicas": max_vals,
        "latest_current": current_vals[-1] if current_vals else 0,
        "latest_desired": desired_vals[-1] if desired_vals else 0,
        "latest_min": min_vals[-1] if min_vals else 0,
        "latest_max": max_vals[-1] if max_vals else 0,
    }


async def _resolve_dashboard_hpa(service: str) -> str | None:
    """Match the dashboard variable: label_values(kube_horizontalpodautoscaler_info)."""
    aliases = _hpa_aliases(service)
    regex_fragment = "|".join(
        re.escape(alias).replace("\\-", "-") for alias in aliases if alias
    )
    if not regex_fragment or not GRAFANA_HPA_NAMESPACE:
        return None
    expr = (
        "kube_horizontalpodautoscaler_info"
        f'{{namespace="{GRAFANA_HPA_NAMESPACE}", '
        f'horizontalpodautoscaler=~".*({regex_fragment}).*"}}'
    )
    series = await _mcp_query_prometheus(expr, "now-15m", "now")
    best = _pick_best_series(series, aliases)
    if not best:
        return None
    name = str(best.get("metric", {}).get("horizontalpodautoscaler", "")).strip()
    return name or None


def _dashboard_hpa_expr(metric: str, hpa_name: str) -> str:
    """Queries copied from the Horizontal Pod Autoscaler dashboard panels."""
    return (
        f'{metric}{{namespace="{GRAFANA_HPA_NAMESPACE}", '
        f'horizontalpodautoscaler="{hpa_name}"}}'
    )


async def _fetch_hpa_from_grafana_mcp(service: str, start_time: str, end_time: str) -> dict[str, Any]:
    empty = {
        "timestamps": [],
        "current_replicas": [],
        "desired_replicas": [],
        "min_replicas": [],
        "max_replicas": [],
        "latest_current": 0,
        "latest_desired": 0,
        "latest_min": 0,
        "latest_max": 0,
        "hpa": None,
    }
    hpa_name = await _resolve_dashboard_hpa(service)
    if not hpa_name:
        print(f"[hpa] No dashboard HPA match for {service}")
        return empty

    print(f"[hpa] Using dashboard HPA {hpa_name} in {GRAFANA_HPA_NAMESPACE}")
    current_expr = _dashboard_hpa_expr(
        "kube_horizontalpodautoscaler_status_current_replicas", hpa_name
    )
    desired_expr = _dashboard_hpa_expr(
        "kube_horizontalpodautoscaler_status_desired_replicas", hpa_name
    )
    min_expr = _dashboard_hpa_expr(
        "kube_horizontalpodautoscaler_spec_min_replicas", hpa_name
    )
    max_expr = _dashboard_hpa_expr(
        "kube_horizontalpodautoscaler_spec_max_replicas", hpa_name
    )

    current_results = await _mcp_query_prometheus(current_expr, start_time, end_time)
    desired_results = await _mcp_query_prometheus(desired_expr, start_time, end_time)
    min_results = await _mcp_query_prometheus(min_expr, start_time, end_time)
    max_results = await _mcp_query_prometheus(max_expr, start_time, end_time)

    current_series = current_results[0] if current_results else None
    desired_series = desired_results[0] if desired_results else None
    min_series = min_results[0] if min_results else None
    max_series = max_results[0] if max_results else None

    if not current_series and not desired_series and not min_series and not max_series:
        return {
            "timestamps": [],
            "current_replicas": [],
            "desired_replicas": [],
            "min_replicas": [],
            "max_replicas": [],
            "latest_current": 0,
            "latest_desired": 0,
            "latest_min": 0,
            "latest_max": 0,
        }

    current_ts, current_vals = _values_to_series(
        current_series.get("values", []) if current_series else []
    )
    desired_ts, desired_vals = _values_to_series(
        desired_series.get("values", []) if desired_series else []
    )
    min_ts, min_vals = _values_to_series(min_series.get("values", []) if min_series else [])
    max_ts, max_vals = _values_to_series(max_series.get("values", []) if max_series else [])

    timestamp_candidates = [current_ts, desired_ts, min_ts, max_ts]
    timestamps = max(timestamp_candidates, key=len, default=[])

    def _pad(values: list[float]) -> list[float]:
        if len(values) < len(timestamps):
            return values + [0.0] * (len(timestamps) - len(values))
        return values

    current_vals = _pad(current_vals)
    desired_vals = _pad(desired_vals)
    min_vals = _pad(min_vals)
    max_vals = _pad(max_vals)

    return {
        "timestamps": timestamps,
        "current_replicas": current_vals,
        "desired_replicas": desired_vals,
        "min_replicas": min_vals,
        "max_replicas": max_vals,
        "latest_current": current_vals[-1] if current_vals else 0,
        "latest_desired": desired_vals[-1] if desired_vals else 0,
        "latest_min": min_vals[-1] if min_vals else 0,
        "latest_max": max_vals[-1] if max_vals else 0,
        "hpa": hpa_name,
    }


def _fetch_hpa_from_grafana(service: str, start_time: str, end_time: str) -> dict[str, Any]:
    # Prefer direct Grafana API for accuracy and speed. Fall back to MCP-agent.
    try:
        return _fetch_hpa_from_grafana_direct(service, start_time, end_time)
    except Exception:
        pass

    aliases = _hpa_aliases(service)
    prompt = f"""
Use ONLY namespace grafana-infra.
Need HPA replicas for service "{service}" in range "{start_time}" to "{end_time}".
Aliases: {json.dumps(aliases)}

Rules:
1) Find Prometheus datasource UID.
2) Query range data for BOTH metrics:
   kube_horizontalpodautoscaler_status_current_replicas
   kube_horizontalpodautoscaler_status_desired_replicas
   kube_horizontalpodautoscaler_spec_min_replicas
   kube_horizontalpodautoscaler_spec_max_replicas
3) Match horizontalpodautoscaler label against aliases (including keda-hpa-...-scaledobject variants).
4) If alias-filtered query is empty, fetch broader series and choose best alias match.
5) Return ONLY this JSON schema:
{{
  "hpa_scaling": {{
    "timestamps": ["..."],
    "current_replicas": [0],
    "desired_replicas": [0],
    "min_replicas": [0],
    "max_replicas": [0],
    "latest_current": 0,
    "latest_desired": 0,
    "latest_min": 0,
    "latest_max": 0
  }}
}}
No markdown.
"""
    candidate_models: list[str] = []
    for model_name in [CURSOR_MODEL, "gpt-5"]:
        if model_name and model_name not in candidate_models:
            candidate_models.append(model_name)

    last_error: Exception | None = None
    for model_name in candidate_models:
        try:
            raw = _call_and_extract_result(prompt, model=model_name)
            parsed = _extract_json(raw)
            hpa = parsed.get("hpa_scaling")
            if isinstance(hpa, dict):
                return hpa
            last_error = HTTPException(
                status_code=500, detail="Invalid Grafana HPA payload."
            )
        except Exception as exc:
            last_error = exc
            continue

    if last_error:
        raise last_error
    raise HTTPException(status_code=500, detail="Failed to fetch Grafana HPA payload.")


@app.get("/")
def frontend() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "index.html"))


@app.get("/favicon.ico")
def favicon() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "favicon.png"), media_type="image/png")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.get("/api/services", response_model=ServicesResponse)
async def get_services() -> ServicesResponse:
    global _service_cache, _service_cache_time
    if _service_cache and (time.time() - _service_cache_time) < SERVICE_CACHE_TTL_SECONDS:
        return ServicesResponse(services=_service_cache)

    try:
        print(f"[get_services] Calling MCP tool: {MONITOR_NR_MCP_SERVER}:list_apm_applications_rest")
        payload = await _mcp_call(
            MONITOR_NR_MCP_SERVER,
            "list_apm_applications_rest",
            {"auto_paginate": True},
        )
        print(f"[get_services] MCP response payload: {json.dumps(payload, indent=2)[:500]}")
        cleaned = _extract_apm_app_names(payload)
        print(f"[get_services] Extracted service names: {cleaned}")
    except Exception as exc:
        print(f"[get_services] Error: {exc}")
        raise HTTPException(status_code=502, detail=f"MCP services fetch failed: {exc}")

    _service_cache = cleaned
    _service_cache_time = time.time()
    return ServicesResponse(services=cleaned)


@app.get("/api/services/health")
async def services_health() -> dict[str, Any]:
    """
    Lightweight diagnostics endpoint for direct New Relic service discovery.
    """
    print("[services_health] Running diagnostics...")
    try:
        print(f"[services_health] Calling MCP tool: {MONITOR_NR_MCP_SERVER}:list_apm_applications_rest")
        payload = await _mcp_call(
            MONITOR_NR_MCP_SERVER,
            "list_apm_applications_rest",
            {"auto_paginate": True},
        )
        print(f"[services_health] Full MCP response: {json.dumps(payload, indent=2)[:1000]}")
        services = _extract_apm_app_names(payload)
        print(f"[services_health] Extracted services: {services}")
        return {
            "ok": True,
            "configured": True,
            "service_count": len(services),
            "sample_services": services[:10],
            "source": f"mcp:{MONITOR_NR_MCP_SERVER}:list_apm_applications_rest",
            "raw_payload_sample": json.dumps(payload, indent=2)[:500],
        }
    except Exception as exc:
        print(f"[services_health] Error: {exc}")
        return {
            "ok": False,
            "configured": True,
            "message": str(exc),
            "source": f"mcp:{MONITOR_NR_MCP_SERVER}",
        }


@app.post("/api/metrics")
async def get_metrics(request: MetricsRequest) -> dict[str, Any]:
    service = request.service.strip()
    if not service:
        raise HTTPException(status_code=400, detail="Service is required.")

    queried_at = datetime.now(timezone.utc)
    start_time = _absolute_iso(request.start_time, queried_at)
    end_time = _absolute_iso(request.end_time, queried_at)
    escaped_service = _escape_nrql_string(service)
    nrql_since = _to_nrql_time(request.start_time)
    nrql_until = _to_nrql_time(request.end_time)

    payload: dict[str, Any] = {
        "service": service,
        "time_range": {
            "start_time": start_time,
            "end_time": end_time,
        },
        "cpu_memory": {
            "timestamps": [],
            "cpu_percent": [],
            "memory_percent": [],
            "avg_cpu_percent": 0.0,
            "avg_memory_percent": 0.0,
        },
        "hpa_scaling": {
            "timestamps": [],
            "current_replicas": [],
            "desired_replicas": [],
            "min_replicas": [],
            "max_replicas": [],
            "latest_current": 0,
            "latest_desired": 0,
            "latest_min": 0,
            "latest_max": 0,
        },
        "response_time_ms": {
            "timestamps": [],
            "p50": [],
            "p90": [],
            "p95": [],
        },
        "throughput": {
            "timestamps": [],
            "rpm": [],
            "max_rpm": 0.0,
            "avg_rpm": 0.0,
            "total_rpm": 0,
            "endpoint": None,
        },
        "endpoints": [],
    }

    try:
        cpu_mem_nrql = (
            "SELECT average(apm.service.cpu.usertime.utilization) AS cpu_util, "
            "average(apm.service.memory.heap.used) AS mem_heap_used, "
            "average(apm.service.memory.heap.max) AS mem_heap_max, "
            "average(apm.service.memory.physical) AS mem_physical "
            "FROM Metric "
            f"WHERE appName = '{escaped_service}' "
            f"SINCE {nrql_since} UNTIL {nrql_until} TIMESERIES"
        )
        print(f"[get_metrics] CPU/MEM NRQL: {cpu_mem_nrql}")
        cpu_mem_rows = await _mcp_run_nrql(cpu_mem_nrql)
        cpu_mem_ts = normalize_timeseries(
            cpu_mem_rows, ["cpu_util", "mem_heap_used", "mem_heap_max", "mem_physical"]
        )
        cpu_raw = cpu_mem_ts["series"]["cpu_util"]
        mem_heap_used = cpu_mem_ts["series"]["mem_heap_used"]
        mem_heap_max = cpu_mem_ts["series"]["mem_heap_max"]
        mem_physical = cpu_mem_ts["series"]["mem_physical"]

        cpu_values: list[float] = [max(0.0, value * 100.0) for value in cpu_raw]
        mem_values: list[float] = []
        for i in range(len(cpu_mem_ts["timestamps"])):
            used = mem_heap_used[i] if i < len(mem_heap_used) else 0.0
            maxv = mem_heap_max[i] if i < len(mem_heap_max) else 0.0
            phys = mem_physical[i] if i < len(mem_physical) else 0.0
            if maxv > 0:
                mem_values.append(max(0.0, min(100.0, (used / maxv) * 100.0)))
            elif phys > 0:
                # Fallback if heap max is not available in this bucket.
                mem_values.append(phys)
            else:
                mem_values.append(0.0)

        payload["cpu_memory"] = {
            "timestamps": cpu_mem_ts["timestamps"],
            "cpu_percent": cpu_values,
            "memory_percent": mem_values,
            "avg_cpu_percent": (sum(cpu_values) / len(cpu_values)) if cpu_values else 0.0,
            "avg_memory_percent": (sum(mem_values) / len(mem_values)) if mem_values else 0.0,
        }
    except Exception:
        pass

    try:
        latency_nrql = _latency_nrql(service, nrql_since, nrql_until)
        print(f"[get_metrics] LATENCY NRQL: {latency_nrql}")
        latency_rows = await _mcp_run_nrql(latency_nrql)
        payload["response_time_ms"] = _latency_payload(latency_rows)
    except Exception as exc:
        print(f"[get_metrics] LATENCY failed: {exc}")

    try:
        golden_rpm_nrql = _throughput_nrql(service, nrql_since, nrql_until)
        print(f"[get_metrics] THROUGHPUT NRQL: {golden_rpm_nrql}")
        golden_rpm_rows = await _mcp_run_nrql(golden_rpm_nrql)
        payload["throughput"] = _throughput_payload(golden_rpm_rows)
    except Exception as exc:
        print(f"[get_metrics] THROUGHPUT failed: {exc}")

    try:
        endpoints_nrql = " ".join(
            [
                "SELECT uniques(name)",
                "FROM Transaction",
                f"WHERE appName = '{escaped_service}'",
                f"SINCE {nrql_since}",
                f"UNTIL {nrql_until}",
            ]
        )
        print(f"[get_metrics] ENDPOINTS NRQL REPR: {endpoints_nrql!r}")
        endpoint_rows = await _mcp_run_nrql(endpoints_nrql)
        print(f"[get_metrics] ENDPOINT ROWS sample: {json.dumps(endpoint_rows[:2], default=str)[:2000]}")
        payload["endpoints"] = _extract_unique_names(endpoint_rows)
        print(f"[get_metrics] ENDPOINTS count: {len(payload['endpoints'])}")
    except Exception as exc:
        print(f"[get_metrics] ENDPOINTS failed: {exc}")

    try:
        payload["hpa_scaling"] = await _fetch_hpa_from_grafana_mcp(
            service=service,
            start_time=request.start_time,
            end_time=request.end_time,
        )
    except Exception:
        pass

    return payload


@app.post("/api/throughput")
async def get_throughput(request: ThroughputRequest) -> dict[str, Any]:
    service = request.service.strip()
    if not service:
        raise HTTPException(status_code=400, detail="Service is required.")

    endpoint = request.endpoint.strip() if request.endpoint else ""
    nrql_since = _to_nrql_time(request.start_time)
    nrql_until = _to_nrql_time(request.end_time)
    selected = endpoint or None
    nrql = _throughput_nrql(service, nrql_since, nrql_until, selected)
    latency_nrql = _latency_nrql(service, nrql_since, nrql_until, selected)
    print(f"[get_throughput] NRQL: {nrql}")
    print(f"[get_throughput] LATENCY NRQL: {latency_nrql}")
    try:
        rows = await _mcp_run_nrql(nrql)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Throughput query failed: {exc}")
    result = _throughput_payload(rows, selected)
    try:
        latency_rows = await _mcp_run_nrql(latency_nrql)
        result["response_time_ms"] = _latency_payload(latency_rows)
    except Exception as exc:
        print(f"[get_throughput] LATENCY failed: {exc}")
        result["response_time_ms"] = {
            "timestamps": [],
            "p50": [],
            "p90": [],
            "p95": [],
        }
    return result


async def _fetch_transaction_rows(
    service: str,
    since: str,
    until: str,
    endpoint: str | None,
    *,
    limit: int = 15,
    trace_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    nrql = _trace_nrql(
        service,
        since,
        until,
        endpoint,
        rich=True,
        limit=limit,
        trace_ids=trace_ids,
    )
    print(f"[get_traces] NRQL: {nrql}")
    try:
        return await _mcp_run_nrql(nrql)
    except Exception as exc:
        print(f"[get_traces] Rich query failed: {exc}")
        fallback = _trace_nrql(
            service,
            since,
            until,
            endpoint,
            rich=False,
            limit=limit,
            trace_ids=trace_ids,
        )
        print(f"[get_traces] FALLBACK NRQL: {fallback}")
        try:
            return await _mcp_run_nrql(fallback)
        except Exception as fallback_exc:
            raise HTTPException(status_code=502, detail=f"Traces query failed: {fallback_exc}")


@app.post("/api/traces")
async def get_traces(request: TracesRequest) -> dict[str, Any]:
    service = request.service.strip()
    if not service:
        raise HTTPException(status_code=400, detail="Service is required.")

    endpoint = request.endpoint.strip() if request.endpoint else ""
    selected = endpoint or None
    nrql_since = _to_nrql_time(request.start_time)
    nrql_until = _to_nrql_time(request.end_time)
    with_breakdown = bool(request.withBreakdown)
    limit = 40 if with_breakdown else 15
    rows = await _fetch_transaction_rows(
        service,
        nrql_since,
        nrql_until,
        selected,
        limit=limit,
    )
    payload = _trace_payload(rows, selected, with_breakdown=with_breakdown)
    if not with_breakdown:
        return payload

    candidate_ids: list[str] = []
    for item in payload["items"]:
        candidate_ids.extend(_item_trace_keys(item))
    span_ids = await _trace_ids_with_spans(candidate_ids, nrql_since, nrql_until)
    filtered = [
        item
        for item in payload["items"]
        if any(key in span_ids for key in _item_trace_keys(item))
    ]

    if len(filtered) < 15:
        extra_ids = [
            trace_id
            for trace_id in await _service_trace_ids_with_spans(service, nrql_since, nrql_until)
            if trace_id not in span_ids
        ]
        if extra_ids:
            extra_rows = await _fetch_transaction_rows(
                service,
                nrql_since,
                nrql_until,
                selected,
                limit=15,
                trace_ids=extra_ids,
            )
            seen = {key for item in filtered for key in _item_trace_keys(item)}
            for item in _trace_payload(extra_rows, selected, with_breakdown=True)["items"]:
                keys = _item_trace_keys(item)
                if keys and not seen.intersection(keys):
                    filtered.append(item)
                    seen.update(keys)

    payload["items"] = filtered[:15]
    payload["count"] = len(payload["items"])
    return payload


@app.post("/api/trace-breakdown")
async def get_trace_breakdown(request: TraceBreakdownRequest) -> dict[str, Any]:
    trace_id = (request.traceId or request.guid or "").strip()
    if not trace_id:
        raise HTTPException(status_code=400, detail="A trace ID is required.")

    nrql_since = _to_nrql_time(request.start_time)
    nrql_until = _to_nrql_time(request.end_time)
    queries = [
        _span_nrql(trace_id, nrql_since, nrql_until, table="Span", rich=True),
        _span_nrql(trace_id, nrql_since, nrql_until, table="Span", rich=False),
        _span_nrql(trace_id, nrql_since, nrql_until, table="SpanEvent", rich=False),
    ]
    last_error = ""
    rows: list[dict[str, Any]] = []
    used_query = queries[0]
    succeeded = False
    for nrql in queries:
        print(f"[get_trace_breakdown] NRQL: {nrql}")
        try:
            rows = await _mcp_run_nrql(nrql)
            used_query = nrql
            succeeded = True
            if rows:
                break
        except Exception as exc:
            last_error = str(exc)
            print(f"[get_trace_breakdown] Query failed: {exc}")
    if not succeeded:
        raise HTTPException(status_code=502, detail=f"Trace breakdown query failed: {last_error}")
    items = _flatten_span_tree(_span_items(rows))
    return {
        "traceId": trace_id,
        "count": len(items),
        "items": items,
        "query": used_query,
    }


@app.get("/api/projects")
def list_projects() -> dict[str, list[dict[str, Any]]]:
    with _db_connect() as conn:
        rows = conn.execute(
            """
            SELECT p.id, p.name, p.created_at, COUNT(r.id) AS test_count
            FROM projects p
            LEFT JOIN pinned_results r ON r.project_id = p.id
            GROUP BY p.id, p.name, p.created_at
            ORDER BY p.created_at ASC
            """
        ).fetchall()
    return {
        "items": [
            {
                "id": str(row["id"]),
                "name": str(row["name"]),
                "testCount": int(row["test_count"]),
            }
            for row in rows
        ]
    }


@app.post("/api/projects")
def create_project(request: ProjectRequest) -> dict[str, str]:
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required.")
    project_id = uuid.uuid4().hex
    try:
        with _db_connect() as conn:
            conn.execute(
                "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)",
                (project_id, name, datetime.utcnow().isoformat()),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="A project with this name already exists.")
    return {"id": project_id, "name": name}


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str) -> dict[str, bool]:
    with _db_connect() as conn:
        project_count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        if int(project_count) <= 1:
            raise HTTPException(status_code=400, detail="At least one project must remain.")
        project = conn.execute(
            "SELECT id FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found.")
        conn.execute("DELETE FROM pinned_results WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    return {"success": True}


@app.get("/api/pins")
def list_pins(project_id: str | None = None) -> dict[str, list[dict[str, str]]]:
    with _db_connect() as conn:
        if project_id:
            rows = conn.execute(
                """
                SELECT id, project_id, test_name, service, range_label, saved_at_ist
                FROM pinned_results
                WHERE project_id = ?
                ORDER BY created_at DESC
                LIMIT 200
                """,
                (project_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, project_id, test_name, service, range_label, saved_at_ist
                FROM pinned_results
                ORDER BY created_at DESC
                LIMIT 200
                """
            ).fetchall()
    return {"items": [_pin_summary_from_row(row) for row in rows]}


@app.get("/api/pins/{pin_id}")
def get_pin(pin_id: str) -> dict[str, Any]:
    with _db_connect() as conn:
        row = conn.execute(
            """
            SELECT id, project_id, test_name, service, range_preset, range_label,
                   start_time_input, end_time_input,
                   start_time, end_time, metrics_json, analysis, analysis_conversation_json,
                   analysis_session_id, model, saved_at_ist, traces_json, journey_json
            FROM pinned_results
            WHERE id = ?
            """,
            (pin_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Pinned result not found.")
    return _pin_full_from_row(row)


@app.post("/api/pins")
def create_pin(request: PinRequest) -> dict[str, str]:
    project_id = request.projectId.strip()
    test_name = request.testName.strip()
    if not project_id:
        raise HTTPException(status_code=400, detail="Project is required.")
    if not test_name:
        raise HTTPException(status_code=400, detail="Test name is required.")
    pin_id = uuid.uuid4().hex
    saved_at_ist = request.savedAtIST or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    created_at = datetime.utcnow().isoformat()
    with _db_connect() as conn:
        project = conn.execute(
            "SELECT id FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found.")
        conn.execute(
            """
            INSERT INTO pinned_results (
                id, project_id, test_name, service, range_preset, range_label,
                start_time_input, end_time_input,
                start_time, end_time, metrics_json, analysis, analysis_conversation_json,
                analysis_session_id, model, saved_at_ist, traces_json, journey_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pin_id,
                project_id,
                test_name,
                request.service,
                request.rangePreset,
                request.rangeLabel,
                request.startTimeInput,
                request.endTimeInput,
                request.startTime,
                request.endTime,
                json.dumps(request.metrics, ensure_ascii=True),
                request.analysis,
                json.dumps(request.analysisConversation, ensure_ascii=True),
                request.analysisSessionId,
                request.model,
                saved_at_ist,
                json.dumps(request.traces or {}, ensure_ascii=True),
                json.dumps(
                    {
                        "services": request.services or [],
                        "metricsByService": request.metricsByService or {},
                        "tracesByService": request.tracesByService or {},
                        "endpointMetricsByService": request.endpointMetricsByService or {},
                    },
                    ensure_ascii=True,
                ),
                created_at,
            ),
        )
    return {"id": pin_id}


@app.put("/api/pins/{pin_id}")
def update_pin(pin_id: str, request: PinRequest) -> dict[str, bool]:
    saved_at_ist = request.savedAtIST or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with _db_connect() as conn:
        cursor = conn.execute(
            """
            UPDATE pinned_results
            SET project_id = ?,
                test_name = ?,
                service = ?,
                range_preset = ?,
                range_label = ?,
                start_time_input = ?,
                end_time_input = ?,
                start_time = ?,
                end_time = ?,
                metrics_json = ?,
                analysis = ?,
                analysis_conversation_json = ?,
                analysis_session_id = ?,
                model = ?,
                saved_at_ist = ?,
                traces_json = ?,
                journey_json = ?
            WHERE id = ?
            """,
            (
                request.projectId,
                request.testName.strip(),
                request.service,
                request.rangePreset,
                request.rangeLabel,
                request.startTimeInput,
                request.endTimeInput,
                request.startTime,
                request.endTime,
                json.dumps(request.metrics, ensure_ascii=True),
                request.analysis,
                json.dumps(request.analysisConversation, ensure_ascii=True),
                request.analysisSessionId,
                request.model,
                saved_at_ist,
                json.dumps(request.traces or {}, ensure_ascii=True),
                json.dumps(
                    {
                        "services": request.services or [],
                        "metricsByService": request.metricsByService or {},
                        "tracesByService": request.tracesByService or {},
                        "endpointMetricsByService": request.endpointMetricsByService or {},
                    },
                    ensure_ascii=True,
                ),
                pin_id,
            ),
        )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Pinned result not found.")
    return {"success": True}


@app.delete("/api/pins/{pin_id}")
def delete_pin(pin_id: str) -> dict[str, bool]:
    with _db_connect() as conn:
        cursor = conn.execute("DELETE FROM pinned_results WHERE id = ?", (pin_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Pinned result not found.")
    return {"success": True}


@app.post("/api/analyze")
def analyze_metrics(request: AnalyzeRequest) -> dict[str, Any]:
    question = request.question.strip() if request.question else ""
    has_question = bool(question)
    include_metrics = bool(request.includeMetrics and request.metrics)
    if has_question and include_metrics:
        question_line = (
            f'User question: "{question}", you can use MCP tools (newrelic & grafana-infra) to serve results'
        )
    elif has_question:
        question_line = (
            f'User question: "{question}".'
            "Do not restate full metric dumps unless the user asks about performance data."
        )
    else:
        question_line = "User question: none (provide proactive analysis)"
    history_lines: list[str] = []
    if request.includeHistory:
        for entry in request.history or []:
            role = str(entry.get("role", "")).strip().lower()
            content = str(entry.get("content", "")).strip()
            if role in {"user", "assistant"} and content:
                history_lines.append(f"{role}: {content}")
    conversation_context = "\n".join(history_lines) if history_lines else "none (use agent session)"

    answer_style_rules = (
        """
Rules:
- Answer in markdown with short sections.
- Use headings like ## Finding and bullet lists with one item per line.
- 2 to 4 short bullets focused only on the user question.
- Do NOT repeat the full analysis or restate unchanged metrics.
- Keep total answer under 160 words unless the user explicitly asks for detail.
- End with one short practical recommendation.
- Do not wrap the JSON in markdown fences.
"""
        if has_question
        else """
Rules:
- Answer in markdown, not one long paragraph.
- Use headings such as ## CPU, ## Memory, ## HPA, ## Latency, ## Throughput, ## Traces, ## Recommendations.
- Under each heading, use '-' bullets with one bullet per line.
- Mention CPU, memory, HPA behavior, and response-time percentiles.
- If traces/span breakdowns are provided, call out the slowest traces and their slow spans.
- Include a brief recommendation section at the end.
- Do not wrap the JSON in markdown fences.
"""
    )

    traces_block = "none"
    if request.includeTraces and request.traces:
        traces_block = json.dumps(request.traces, ensure_ascii=True)

    metrics_block = "none"
    if include_metrics:
        metrics_block = json.dumps(request.metrics, ensure_ascii=True)

    task_intro = (
        f'Analyze the metrics JSON below for service "{request.service}".'
        if include_metrics
        else f'Continue the performance chat for service "{request.service}".'
    )

    prompt = f"""
{task_intro}
{question_line}
Conversation context:
{conversation_context}

Return ONLY valid JSON with this exact shape:
{{
  "analysis": "markdown analysis text with headings and line breaks"
}}

{answer_style_rules}

The "analysis" value MUST include real newline characters between headings and bullets.

Metrics JSON:
{metrics_block}

Transaction traces with span breakdowns:
{traces_block}
"""

    result = run_cursor_agent(
        prompt=prompt,
        model=request.model,
        session_id=request.session,
    )
    raw = result.get("result", "")
    if not isinstance(raw, str) or not raw.strip():
        raise HTTPException(status_code=500, detail="Empty response from Cursor Agent.")
    payload = _extract_json(raw)
    analysis = payload.get("analysis", "")
    if not isinstance(analysis, str) or not analysis.strip():
        raise HTTPException(status_code=500, detail="Invalid analysis payload.")
    session_id = result.get("session_id")
    return {
        "analysis": analysis,
        "session_id": session_id if isinstance(session_id, str) else None,
    }
