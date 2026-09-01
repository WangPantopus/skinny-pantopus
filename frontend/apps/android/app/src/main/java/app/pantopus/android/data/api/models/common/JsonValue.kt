package app.pantopus.android.data.api.models.common

/**
 * Untyped JSON escape hatch. Use only for response fields whose shape is
 * provider-dependent (e.g. `GET /api/hub/today`, S3-sourced mail object
 * payloads). Callers cast / inspect at the edge; typed DTOs are always
 * preferred.
 */
typealias JsonValue = Map<String, Any?>

/** Untyped JSON list element — paired with [JsonValue] for array payloads. */
typealias JsonArrayValue = List<Any?>
