package app.pantopus.android.data.api.net

import java.io.IOException

/**
 * An [IOException] that [RetryInterceptor] must NOT retry.
 *
 * Used by `TokenAuthenticator` to surface a *transient* token-refresh failure
 * as a network error (so `restore()` / callers preserve the session instead of
 * treating it as a 401) WITHOUT triggering RetryInterceptor's GET/HEAD retry.
 * Retrying would re-drive the refresh and — if the first refresh succeeded
 * server-side but its response was lost — replay the now-rotated refresh token,
 * which the backend flags as `TOKEN_REUSE` and forces a logout.
 */
class NonRetriableIOException(
    message: String,
) : IOException(message)
