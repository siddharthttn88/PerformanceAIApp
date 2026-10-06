import json
from datetime import datetime, timezone
import urllib.error
import urllib.request


NEWRELIC_GRAPHQL_URL = "https://api.newrelic.com/graphql"


class NewRelicClientError(Exception):
    pass


def _post_graphql(api_key: str, payload: dict, timeout_seconds: int) -> dict:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        NEWRELIC_GRAPHQL_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "API-Key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise NewRelicClientError(f"New Relic HTTP {exc.code}: {detail}")
    except urllib.error.URLError as exc:
        raise NewRelicClientError(f"New Relic connection error: {exc.reason}")
    except json.JSONDecodeError as exc:
        raise NewRelicClientError(f"Invalid JSON from New Relic: {str(exc)}")


def fetch_apm_services(api_key: str, account_id: str, timeout_seconds: int = 20) -> list[str]:
    """
    Fetch APM application names directly from New Relic NerdGraph.
    """
    query = """
query($entityQuery: String!) {
  actor {
    entitySearch(query: $entityQuery) {
      results {
        entities {
          name
        }
      }
    }
  }
}
"""

    entity_query = (
        f"type = 'APPLICATION' AND domain = 'APM' AND accountId = '{account_id}'"
    )

    payload = {"query": query, "variables": {"entityQuery": entity_query}}
    response = _post_graphql(api_key, payload, timeout_seconds)

    errors = response.get("errors") or []
    if errors:
        raise NewRelicClientError(f"New Relic GraphQL errors: {errors}")

    results = (
        response.get("data", {})
        .get("actor", {})
        .get("entitySearch", {})
        .get("results", {})
    )
    entities = results.get("entities") or []

    services: set[str] = set()
    for entity in entities:
        name = str(entity.get("name", "")).strip()
        if name:
            services.add(name)

    return sorted(services)


def query_nrql(
    api_key: str,
    account_id: str,
    nrql: str,
    timeout_seconds: int = 30,
) -> list[dict]:
    query = """
query($accountId: Int!, $nrql: Nrql!) {
  actor {
    account(id: $accountId) {
      nrql(query: $nrql) {
        results
      }
    }
  }
}
"""

    try:
        account_id_int = int(account_id)
    except ValueError:
        raise NewRelicClientError("NEWRELIC_ACCOUNT_ID must be a valid integer.")

    payload = {
        "query": query,
        "variables": {
            "accountId": account_id_int,
            "nrql": nrql,
        },
    }

    response = _post_graphql(api_key, payload, timeout_seconds)
    errors = response.get("errors") or []
    if errors:
        raise NewRelicClientError(f"New Relic GraphQL errors: {errors}")

    results = (
        response.get("data", {})
        .get("actor", {})
        .get("account", {})
        .get("nrql", {})
        .get("results")
    )
    if not isinstance(results, list):
        return []
    return results


def normalize_timeseries(
    rows: list[dict],
    field_names: list[str],
) -> dict[str, list]:
    timestamps: list[str] = []
    series: dict[str, list] = {name: [] for name in field_names}

    for row in rows:
        end_seconds = row.get("endTimeSeconds")
        if isinstance(end_seconds, (int, float)):
            dt = datetime.fromtimestamp(end_seconds, tz=timezone.utc)
            timestamps.append(dt.isoformat())
        else:
            timestamps.append("")

        for field in field_names:
            value = row.get(field)
            if isinstance(value, dict):
                # New Relic percentiles often come as {"50": value}
                numeric_value = None
                for nested in value.values():
                    if isinstance(nested, (int, float)):
                        numeric_value = float(nested)
                        break
                series[field].append(numeric_value if numeric_value is not None else 0.0)
            elif isinstance(value, (int, float)):
                series[field].append(float(value))
            else:
                series[field].append(0.0)

    return {"timestamps": timestamps, "series": series}
