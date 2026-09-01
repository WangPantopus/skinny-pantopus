package app.pantopus.android.data.following

import app.pantopus.android.data.api.models.following.FollowNotificationLevelBody
import app.pantopus.android.data.api.models.following.FollowPreferencesResponse
import app.pantopus.android.data.api.models.following.FollowingActionEcho
import app.pantopus.android.data.api.models.following.FollowingListResponse
import app.pantopus.android.data.api.models.following.FollowingMuteBody
import app.pantopus.android.data.api.models.following.FollowingMuteResponse
import app.pantopus.android.data.api.models.following.FollowingSeenResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.FollowingApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * §1A① — "Following" (Beacons you follow). Wraps [FollowingApi] in
 * `safeApiCall` so the ViewModel routes on the `NetworkResult` taxonomy.
 */
@Singleton
class FollowingRepository
    @Inject
    constructor(
        private val api: FollowingApi,
    ) {
        suspend fun list(sort: String): NetworkResult<FollowingListResponse> = safeApiCall { api.list(sort = sort) }

        suspend fun markSeen(personaId: String): NetworkResult<FollowingSeenResponse?> = safeApiCall { api.markSeen(personaId) }

        suspend fun mute(
            personaId: String,
            days: Int,
        ): NetworkResult<FollowingMuteResponse> = safeApiCall { api.mute(personaId, FollowingMuteBody(days = days)) }

        suspend fun unfollow(personaId: String): NetworkResult<FollowingActionEcho> = safeApiCall { api.unfollow(personaId) }

        /** `PATCH …/follow/preferences` — All / Highlights / Off. */
        suspend fun updateNotificationLevel(
            personaId: String,
            level: String,
        ): NetworkResult<FollowPreferencesResponse> =
            safeApiCall {
                api.updateNotificationLevel(personaId, FollowNotificationLevelBody(notificationLevel = level))
            }
    }
