package app.pantopus.android.data.api.services

import retrofit2.http.DELETE
import retrofit2.http.Header

/**
 * Irreversible account removal. Kept in its own interface (rather than on
 * `UsersApi`) so the one destructive route is obvious at a glance.
 */
interface AccountDeletionApi {
    /**
     * `DELETE /api/users/account` — permanently delete the signed-in user
     * and every cascading row. Route `backend/routes/users.js:3945`.
     *
     * Takes no body. `200 { message }` on success. `409 { error, … }` when
     * the account still has in-progress gigs (`users.js:3958` / `:3972`)
     * or pending / escrowed payments (`users.js:3986`) — the `error`
     * string is the only actionable copy and must reach the user.
     *
     * Persistent login (CONTRACT §`DELETE /api/users/account`): requires
     * `X-Step-Up` — purpose `delete_account` (password when the account has
     * one, `device_key` from an interactive session for OAuth-only
     * accounts) or the wildcard token from `/reauthenticate`. Without it the
     * backend answers 403 `STEP_UP_REQUIRED` (the interceptor then runs the
     * step-up UI and retries once; callers should still pre-fetch).
     */
    @DELETE("api/users/account")
    suspend fun deleteAccount(
        @Header("X-Step-Up") stepUp: String? = null,
    )
}
