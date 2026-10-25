"""Independent, read-only API/database probes and bounded resource telemetry.

Runs outside the API host. Emits only numeric metrics, never response bodies,
credentials, query text or people data. A failed probe does not retry immediately.
"""

import json
import math
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor

import httpx

from ..config.secrets import get_briefing_secrets

_previous_sample = None
_TIMEOUT = httpx.Timeout(4.0, connect=3.0)
_client = httpx.Client(timeout=_TIMEOUT, follow_redirects=False, limits=httpx.Limits(
    max_connections=3, max_keepalive_connections=3, keepalive_expiry=90,
))
_SAMPLE = re.compile(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+([^\s]+)')


def _probe_api(secrets):
    started = time.monotonic()
    healthy = False
    try:
        response = _client.get(
            secrets.pantopus_api_base_url.rstrip('/') + '/health',
        )
        body = response.json() if response.status_code == 200 else {}
        healthy = body.get('status') == 'healthy' and body.get('database') == 'connected'
    except (httpx.HTTPError, ValueError, AttributeError):
        pass
    return {'ApiHealthy': int(healthy), 'ApiLatencyMs': (time.monotonic() - started) * 1000}


def _probe_database(secrets):
    started = time.monotonic()
    healthy = False
    try:
        # Same bounded connectivity query as /health, but bypasses the API host.
        # HEAD executes the query without returning user rows or an exact count.
        response = _client.head(
            secrets.supabase_url.rstrip('/') + '/rest/v1/User',
            params={'select': 'id', 'limit': '1'},
            headers={'apikey': secrets.supabase_service_role_key,
                     'Authorization': 'Bearer ' + secrets.supabase_service_role_key},
        )
        healthy = response.status_code in (200, 206)
    except httpx.HTTPError:
        pass
    return {'DatabaseHealthy': int(healthy), 'DatabaseLatencyMs': (time.monotonic() - started) * 1000}


def _resource_metrics(secrets):
    global _previous_sample
    try:
        response = _client.get(
            secrets.supabase_url.rstrip('/') + '/customer/v1/privileged/metrics',
            auth=('service_role', secrets.supabase_service_role_key),
        )
        response.raise_for_status()
        values = {}
        for line in response.text.splitlines():
            match = _SAMPLE.match(line)
            if not match:
                continue
            name, labels, raw = match.groups()
            value = float(raw)
            if not math.isfinite(value):
                continue
            if name == 'node_cpu_seconds_total':
                values['cpu_total'] = values.get('cpu_total', 0) + value
                for mode in ('idle', 'iowait'):
                    if f'mode="{mode}"' in (labels or ''):
                        values['cpu_' + mode] = values.get('cpu_' + mode, 0) + value
            elif name in {
                'node_memory_MemTotal_bytes', 'node_memory_MemAvailable_bytes',
                'node_memory_SwapTotal_bytes', 'node_memory_SwapFree_bytes',
                'node_load1', 'node_vmstat_pswpin', 'node_vmstat_pswpout',
                'node_pressure_io_stalled_seconds_total',
            }:
                values[name] = value
        total = values['node_memory_MemTotal_bytes']
        available = values['node_memory_MemAvailable_bytes']
        if total <= 0 or not 0 <= available <= total:
            raise ValueError('Invalid memory telemetry')
        metrics = {
            'TelemetryHealthy': 1,
            'MemoryAvailablePercent': 100 * available / total,
            'SwapUsedBytes': values['node_memory_SwapTotal_bytes'] - values['node_memory_SwapFree_bytes'],
            'DatabaseLoad1': values['node_load1'],
        }
        # Counter differences are valid only across nearby samples from the
        # same VM. Cold starts, exporter gaps and VM restarts leave rates absent.
        now = time.monotonic()
        previous = _previous_sample
        if previous and 0 < now - previous[0] <= 180:
            elapsed = now - previous[0]
            old = previous[1]
            def delta(key):
                return values[key] - old[key] if key in values and key in old else -1
            cpu = delta('cpu_total')
            if cpu > 0:
                for key, metric in [('cpu_iowait', 'IoWaitPercent'), ('cpu_idle', 'CpuIdlePercent')]:
                    change = delta(key)
                    if 0 <= change <= cpu:
                        metrics[metric] = 100 * change / cpu
            for key, metric in [('node_vmstat_pswpin', 'SwapInPagesPerSecond'),
                                ('node_vmstat_pswpout', 'SwapOutPagesPerSecond')]:
                change = delta(key)
                if change >= 0:
                    metrics[metric] = change / elapsed
            stalled = delta('node_pressure_io_stalled_seconds_total')
            if stalled >= 0:
                metrics['IoStallPercent'] = min(100, 100 * stalled / elapsed)
        _previous_sample = (now, values)
        return metrics
    except (httpx.HTTPError, ValueError, KeyError, ZeroDivisionError):
        _previous_sample = None
        return {'TelemetryHealthy': 0}


def handler(event, context):
    try:
        secrets = get_briefing_secrets()
    except Exception:
        # Validation exception chains can contain credential input values.
        # Fail the probes without printing the secret or exception chain.
        metrics = {'ApiHealthy': 0, 'DatabaseHealthy': 0, 'TelemetryHealthy': 0}
    else:
        # Independent probes: an API outage must not suppress the direct DB signal.
        with ThreadPoolExecutor(max_workers=3) as executor:
            results = list(executor.map(lambda probe: probe(secrets),
                                        (_probe_api, _probe_database, _resource_metrics)))
        metrics = {key: value for result in results for key, value in result.items()}
    if os.environ.get('AWS_LAMBDA_FUNCTION_NAME'):
        def unit(name):
            if name.endswith('Percent'):
                return 'Percent'
            if name.endswith('Ms'):
                return 'Milliseconds'
            if name.endswith('Bytes'):
                return 'Bytes'
            return 'None'
        print(json.dumps({
            '_aws': {
                'Timestamp': int(time.time() * 1000),
                'CloudWatchMetrics': [{
                    'Namespace': f"Pantopus/Backend/{os.environ.get('ENVIRONMENT', 'dev')}",
                    'Dimensions': [[]],
                    'Metrics': [{'Name': name, 'Unit': unit(name)} for name in metrics],
                }],
            },
            **metrics,
        }), flush=True)
    return metrics
