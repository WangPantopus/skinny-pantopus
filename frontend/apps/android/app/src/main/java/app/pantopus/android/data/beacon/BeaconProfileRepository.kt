package app.pantopus.android.data.beacon

import app.pantopus.android.data.api.models.audience.PersonaTiersResponse
import app.pantopus.android.data.api.models.beacon.BeaconActionEcho
import app.pantopus.android.data.api.models.beacon.BeaconFollowPreferencesBody
import app.pantopus.android.data.api.models.beacon.BeaconPersonaResponse
import app.pantopus.android.data.api.models.beacon.BeaconPostsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BeaconProfileApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * A21.1 — wraps [BeaconProfileApi] in the `NetworkResult` taxonomy.
 * Mirrors iOS `BeaconProfileViewModel`'s direct `APIClient` calls.
 */
@Singleton
class BeaconProfileRepository
    @Inject
    constructor(
        private val api: BeaconProfileApi,
    ) {
        /** Owner ("My Beacon") — `GET /personas/me`. */
        suspend fun me(): NetworkResult<BeaconPersonaResponse> = safeApiCall { api.me() }

        /** Visitor — `GET /personas/:handle`. */
        suspend fun persona(handle: String): NetworkResult<BeaconPersonaResponse> = safeApiCall { api.persona(handle) }

        suspend fun posts(handle: String): NetworkResult<BeaconPostsResponse> = safeApiCall { api.posts(handle) }

        suspend fun tiers(handle: String): NetworkResult<PersonaTiersResponse> = safeApiCall { api.tiers(handle) }

        suspend fun unfollow(personaId: String): NetworkResult<BeaconActionEcho> = safeApiCall { api.unfollow(personaId) }

        suspend fun setNotificationLevel(
            personaId: String,
            level: String,
        ): NetworkResult<BeaconActionEcho> =
            safeApiCall { api.updatePreferences(personaId, BeaconFollowPreferencesBody(notificationLevel = level)) }
    }
