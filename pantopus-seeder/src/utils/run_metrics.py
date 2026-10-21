"""Report caught job failures without changing delivery/retry semantics."""

import json
import os
import time


def publish_run_outcome(result: dict, *error_counters: str) -> None:
    """Emit one low-cardinality CloudWatch EMF metric through Lambda logs.

    Quiet days are successful runs. Caught/partial failures still need an alarm,
    but raising after publishing content could retry and publish another item.
    Do not include result data, user identifiers or exception text in metrics.
    """
    function_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
    if not function_name:
        return
    failed = bool(result.get("error")) or any(result.get(key, 0) > 0 for key in error_counters)
    print(json.dumps({
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [{
                "Namespace": f"Pantopus/ScheduledJobs/{os.environ.get('ENVIRONMENT', 'dev')}",
                "Dimensions": [["FunctionName"]],
                "Metrics": [{"Name": "RunFailures", "Unit": "Count"}],
            }],
        },
        "FunctionName": function_name,
        "RunFailures": int(failed),
    }), flush=True)
