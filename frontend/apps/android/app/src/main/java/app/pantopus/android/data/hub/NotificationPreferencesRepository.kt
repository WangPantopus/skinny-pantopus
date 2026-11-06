package app.pantopus.android.data.hub

import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.mapFresh
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.NotificationPreferencesApi
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.Stored
import app.pantopus.android.data.store.asResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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
        private val store: ScreenStore,
    ) {
        /**
         * `GET /api/hub/preferences`: the server's answer, never an older copy. The launch notices each ask for it as
         * the tabs open, at once or moments apart: the store's one request per key joins them, and an answer from the
         * last few seconds is still the server's. Off the main thread: opening the entry reads its saved copy.
         */
        suspend fun preferences(): NetworkResult<NotificationPreferences> =
            withContext(Dispatchers.IO) {
                val copy = store.peek(StoreKeys.notificationPreferences)
                val justRead = copy.failure == null && System.currentTimeMillis() - copy.fetchedAt in 0 until JUST_READ_MS
                preferencesStored(force = !justRead).asResult()
            }

        /** The preferences through the screens' store (fresh for 10 minutes). [force] reads now. */
        suspend fun preferencesStored(force: Boolean = false): Stored<NotificationPreferences> =
            store.read(StoreKeys.notificationPreferences, force) { etag ->
                conditionalApiCall { api.preferencesConditional(etag) }.mapFresh { NotificationPreferences.from(it.preferences) }
            }

        /** `PUT /api/hub/preferences` — partial patch, echoes the saved row back, which becomes the stored copy. */
        suspend fun updatePreferences(
            patch: NotificationPreferencesPatch,
            dispatchGuard: AuthenticatedDispatchGuard? = null,
        ): NetworkResult<NotificationPreferences> {
            val remember = store.writer(StoreKeys.notificationPreferences)
            return safeApiCall { NotificationPreferences.from(api.updatePreferences(patch, dispatchGuard).preferences) }
                .also { if (it is NetworkResult.Success) remember(it.data) }
        }

        private companion object {
            const val JUST_READ_MS = 5_000L
        }
    }
