package app.pantopus.android.data.hub

import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.NotificationPreferencesApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * T2 — wraps [NotificationPreferencesApi] in the [NetworkResult]
 * taxonomy and resolves the backend's defaults so the view-model only
 * ever sees a fully-populated [NotificationPreferences].
 */
@Singleton
class NotificationPreferencesRepository
    @Inject
    constructor(
        private val api: NotificationPreferencesApi,
    ) {
        /** `GET /api/hub/preferences`. */
        suspend fun preferences(): NetworkResult<NotificationPreferences> =
            safeApiCall { NotificationPreferences.from(api.preferences().preferences) }

        /** `PUT /api/hub/preferences` — partial patch, echoes the saved row back. */
        suspend fun updatePreferences(patch: NotificationPreferencesPatch): NetworkResult<NotificationPreferences> =
            safeApiCall { NotificationPreferences.from(api.updatePreferences(patch).preferences) }
    }
