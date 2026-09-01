package app.pantopus.android.data.api.services

import retrofit2.http.DELETE

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
     */
    @DELETE("api/users/account")
    suspend fun deleteAccount()
}
