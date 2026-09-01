package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.models.hub.NotificationPreferencesResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PUT

/**
 * T2 — the notification / briefing preferences pair from
 * `backend/routes/hub.js`. Split out of [HubApi] because it is owned by
 * the A14.5 Notifications settings screen, not the Hub surfaces.
 */
interface NotificationPreferencesApi {
    /**
     * `GET /api/hub/preferences` — route `backend/routes/hub.js:648`.
     *
     * Always 200s: the handler falls back to a hand-built default object
     * when the user has no `UserNotificationPreferences` row
     * (`hub.js:666-684`).
     */
    @GET("api/hub/preferences")
    suspend fun preferences(): NotificationPreferencesResponse

    /**
     * `PUT /api/hub/preferences` — route `backend/routes/hub.js:716`.
     *
     * Partial update: the handler upserts `user_id` plus whatever the
     * body carries, and Joi validates the key set at `hub.js:697-714`
     * with `.min(1)`. Send only the keys that changed.
     */
    @PUT("api/hub/preferences")
    suspend fun updatePreferences(
        @Body patch: NotificationPreferencesPatch,
    ): NotificationPreferencesResponse
}
