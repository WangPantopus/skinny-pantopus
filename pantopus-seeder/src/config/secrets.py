"""AWS Secrets Manager loader, cached per Lambda invocation."""

from __future__ import annotations

import json
import os
from urllib.parse import urlparse

from pydantic import BaseModel, Field, ValidationError, ValidationInfo, field_validator


def _normalize_required_string(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} must not be empty")
    return normalized


def _normalize_http_url(value: str, field_name: str) -> str:
    normalized = _normalize_required_string(value, field_name)
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"{field_name} must be a valid http(s) URL")
    return normalized


def _format_secret_source(secret_name: str | None) -> str:
    if secret_name:
        return f"Secrets Manager secret '{secret_name}'"
    return "environment variables"


def _raise_secret_validation_error(
    *,
    secret_label: str,
    source: str,
    exc: ValidationError,
) -> None:
    details = "; ".join(
        f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
        for error in exc.errors()
    )
    raise RuntimeError(f"Invalid {secret_label} from {source}: {details}") from exc


class SeederSecrets(BaseModel):
    """Typed container for all secrets needed by the seeder Lambdas."""

    supabase_url: str = Field(min_length=1)
    supabase_service_role_key: str = Field(min_length=1)
    pantopus_api_base_url: str = Field(min_length=1)
    curator_email: str = Field(min_length=1)
    curator_password: str = Field(min_length=1)
    openai_api_key: str = Field(min_length=1)

    @field_validator("supabase_url", "pantopus_api_base_url")
    @classmethod
    def validate_http_urls(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_http_url(value, info.field_name)

    @field_validator(
        "supabase_service_role_key",
        "curator_email",
        "curator_password",
        "openai_api_key",
    )
    @classmethod
    def validate_required_strings(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_required_string(value, info.field_name)


_cached_secrets: SeederSecrets | None = None


def get_secrets() -> SeederSecrets:
    """Load secrets and return a validated SeederSecrets instance.

    On AWS Lambda the secret is read from Secrets Manager using the
    ``SECRET_NAME`` environment variable.  For local development, when
    ``SECRET_NAME`` is not set, values are read from environment variables
    (UPPER_SNAKE_CASE matching the field names).

    Results are cached in a module-level variable so repeated calls within
    the same Lambda invocation don't hit Secrets Manager again.
    """
    global _cached_secrets
    if _cached_secrets is not None:
        return _cached_secrets

    secret_name = os.environ.get("SECRET_NAME")

    source = _format_secret_source(secret_name)

    try:
        if secret_name:
            _cached_secrets = _load_from_secrets_manager(secret_name)
        else:
            _cached_secrets = _load_from_env()
    except ValidationError as exc:
        _raise_secret_validation_error(
            secret_label="seeder secrets",
            source=source,
            exc=exc,
        )

    return _cached_secrets


def _load_from_secrets_manager(secret_name: str) -> SeederSecrets:
    """Fetch the JSON secret from AWS Secrets Manager."""
    import boto3
    from botocore.exceptions import ClientError

    region = os.environ.get("AWS_REGION_NAME", "us-west-2")

    try:
        client = boto3.client("secretsmanager", region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        raise RuntimeError(
            f"Failed to load secret '{secret_name}' from Secrets Manager: "
            f"{error_code} — {exc}"
        ) from exc

    raw = json.loads(response["SecretString"])
    return SeederSecrets(
        supabase_url=raw["SUPABASE_URL"],
        supabase_service_role_key=raw["SUPABASE_SERVICE_ROLE_KEY"],
        pantopus_api_base_url=raw["PANTOPUS_API_BASE_URL"],
        curator_email=raw["CURATOR_EMAIL"],
        curator_password=raw["CURATOR_PASSWORD"],
        openai_api_key=raw["OPENAI_API_KEY"],
    )


def _load_from_env() -> SeederSecrets:
    """Fallback: read secrets from environment variables (local development)."""
    return SeederSecrets(
        supabase_url=os.environ.get("SUPABASE_URL", ""),
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        pantopus_api_base_url=os.environ.get("PANTOPUS_API_BASE_URL", ""),
        curator_email=os.environ.get("CURATOR_EMAIL", ""),
        curator_password=os.environ.get("CURATOR_PASSWORD", ""),
        openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
    )


def clear_cache() -> None:
    """Clear the cached secrets (useful for testing)."""
    global _cached_secrets
    _cached_secrets = None


# ── Briefing Secrets ─────────────────────────────────────────────


class BriefingSecrets(BaseModel):
    """Typed container for secrets needed by the briefing scheduler Lambda."""

    supabase_url: str = Field(min_length=1)
    supabase_service_role_key: str = Field(min_length=1)
    pantopus_api_base_url: str = Field(min_length=1)
    internal_api_key: str = Field(min_length=1)
    # WeatherKit credentials (optional — falls back to NOAA if empty)
    weatherkit_key_id: str = ""
    weatherkit_team_id: str = ""
    weatherkit_service_id: str = ""
    weatherkit_private_key: str = ""

    @field_validator("supabase_url", "pantopus_api_base_url")
    @classmethod
    def validate_http_urls(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_http_url(value, info.field_name)

    @field_validator("supabase_service_role_key", "internal_api_key")
    @classmethod
    def validate_required_strings(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_required_string(value, info.field_name)


_cached_briefing_secrets: BriefingSecrets | None = None


def get_briefing_secrets() -> BriefingSecrets:
    """Load briefing secrets and return a validated BriefingSecrets instance.

    Uses the same ``SECRET_NAME`` Secrets Manager secret as the seeder —
    the JSON payload contains all fields for both models.  For local
    development, reads from environment variables (UPPER_SNAKE_CASE).

    Results are cached in a module-level variable so repeated calls
    within the same Lambda invocation don't hit Secrets Manager again.
    """
    global _cached_briefing_secrets
    if _cached_briefing_secrets is not None:
        return _cached_briefing_secrets

    secret_name = os.environ.get("SECRET_NAME")

    source = _format_secret_source(secret_name)

    try:
        if secret_name:
            _cached_briefing_secrets = _load_briefing_from_secrets_manager(secret_name)
        else:
            _cached_briefing_secrets = _load_briefing_from_env()
    except ValidationError as exc:
        _raise_secret_validation_error(
            secret_label="briefing secrets",
            source=source,
            exc=exc,
        )

    return _cached_briefing_secrets


def _load_briefing_from_secrets_manager(secret_name: str) -> BriefingSecrets:
    """Fetch briefing fields from the shared Secrets Manager secret."""
    import boto3
    from botocore.exceptions import ClientError

    region = os.environ.get("AWS_REGION_NAME", "us-west-2")

    try:
        client = boto3.client("secretsmanager", region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        raise RuntimeError(
            f"Failed to load secret '{secret_name}' from Secrets Manager: "
            f"{error_code} — {exc}"
        ) from exc

    raw = json.loads(response["SecretString"])
    return BriefingSecrets(
        supabase_url=raw["SUPABASE_URL"],
        supabase_service_role_key=raw["SUPABASE_SERVICE_ROLE_KEY"],
        pantopus_api_base_url=raw["PANTOPUS_API_BASE_URL"],
        internal_api_key=raw["INTERNAL_API_KEY"],
        weatherkit_key_id=raw.get("WEATHERKIT_KEY_ID", ""),
        weatherkit_team_id=raw.get("WEATHERKIT_TEAM_ID", ""),
        weatherkit_service_id=raw.get("WEATHERKIT_SERVICE_ID", ""),
        weatherkit_private_key=raw.get("WEATHERKIT_PRIVATE_KEY", ""),
    )


def _load_briefing_from_env() -> BriefingSecrets:
    """Fallback: read briefing secrets from environment variables."""
    return BriefingSecrets(
        supabase_url=os.environ.get("SUPABASE_URL", ""),
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        pantopus_api_base_url=os.environ.get("PANTOPUS_API_BASE_URL", ""),
        internal_api_key=os.environ.get("INTERNAL_API_KEY", ""),
        weatherkit_key_id=os.environ.get("WEATHERKIT_KEY_ID", ""),
        weatherkit_team_id=os.environ.get("WEATHERKIT_TEAM_ID", ""),
        weatherkit_service_id=os.environ.get("WEATHERKIT_SERVICE_ID", ""),
        weatherkit_private_key=os.environ.get("WEATHERKIT_PRIVATE_KEY", ""),
    )


def clear_briefing_cache() -> None:
    """Clear the cached briefing secrets (useful for testing)."""
    global _cached_briefing_secrets
    _cached_briefing_secrets = None
