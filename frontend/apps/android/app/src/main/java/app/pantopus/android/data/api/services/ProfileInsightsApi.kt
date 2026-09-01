package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.users.InviteCodeDto
import app.pantopus.android.data.api.models.users.InviteProgressDto
import app.pantopus.android.data.api.models.users.MonthlyReceiptDto
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Profile-tab insight cards — Monthly Receipt and Invite / referral progress.
 * Both live on `backend/routes/users.js`, registered before the catch-all
 * `/:username` route, so the `/me/…` paths are literal.
 */
interface ProfileInsightsApi {
    /**
     * `GET /api/users/me/monthly-receipt?year=&month=` — the stored monthly
     * receipt, or one computed on demand when the roll-up job hasn't run.
     * `month` is **1-based** and validated server-side (400 outside 1…12).
     * Route `backend/routes/users.js:2921`.
     */
    @GET("api/users/me/monthly-receipt")
    suspend fun monthlyReceipt(
        @Query("year") year: Int,
        @Query("month") month: Int,
    ): MonthlyReceiptDto

    /**
     * `GET /api/users/me/invite-progress` — referral counts, unlocked
     * features, and the next unlock tier.
     * Route `backend/routes/users.js:2835`.
     */
    @GET("api/users/me/invite-progress")
    suspend fun inviteProgress(): InviteProgressDto

    /**
     * `GET /api/users/me/invite-code` — the user's stable invite code plus its
     * shareable URL. Creates one on first call.
     * Route `backend/routes/users.js:2850`.
     */
    @GET("api/users/me/invite-code")
    suspend fun inviteCode(): InviteCodeDto
}
