package app.pantopus.android.data.audience

import app.pantopus.android.data.api.models.audience.AudienceFollowerStatusBody
import app.pantopus.android.data.api.models.audience.AudienceFollowerUpdateResponse
import app.pantopus.android.data.api.models.audience.AudienceListResponse
import app.pantopus.android.data.api.models.audience.AudienceMemberActionBody
import app.pantopus.android.data.api.models.audience.AudienceMemberActionResponse
import app.pantopus.android.data.api.models.audience.BroadcastHistoryResponse
import app.pantopus.android.data.api.models.audience.MembershipStatsResponse
import app.pantopus.android.data.api.models.audience.PersonaMeResponse
import app.pantopus.android.data.api.models.audience.PersonaPostsResponse
import app.pantopus.android.data.api.models.audience.PersonaThreadsResponse
import app.pantopus.android.data.api.models.audience.PersonaTiersResponse
import app.pantopus.android.data.api.models.audience.PublishUpdateBody
import app.pantopus.android.data.api.models.audience.PublishUpdateResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AudienceProfileApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps `/api/personas/[*]` and `/api/broadcast/[*]` in [NetworkResult]. */
@Singleton
class AudienceProfileRepository
    @Inject
    constructor(
        private val api: AudienceProfileApi,
    ) {
        suspend fun me(): NetworkResult<PersonaMeResponse> = safeApiCall { api.me() }

        suspend fun audience(): NetworkResult<AudienceListResponse> = safeApiCall { api.audience() }

        /** A22.2 "Your audience" — filtered + sorted fan page. `offset` walks
         *  the `pagination.nextOffset` cursor the handler echoes back. */
        suspend fun audienceMembers(
            status: String?,
            tierRank: Int?,
            sort: String? = null,
            limit: Int? = null,
            offset: Int? = null,
        ): NetworkResult<AudienceListResponse> =
            safeApiCall {
                api.audience(
                    sort = sort,
                    status = status,
                    tierRank = tierRank,
                    limit = limit,
                    offset = offset?.takeIf { it > 0 },
                )
            }

        /** A22.2 — approve / decline / remove / mute / unmute one member. */
        suspend fun audienceMemberAction(
            membershipId: String,
            action: String,
        ): NetworkResult<AudienceMemberActionResponse> =
            safeApiCall { api.audienceMemberAction(membershipId, AudienceMemberActionBody(action)) }

        /** A22.2 — block (or otherwise re-status) one follower. The
         *  `/me/audience` action verbs have no block, so this goes through
         *  the follower route, which resolves `followId` as a membership id. */
        suspend fun updateFollowerStatus(
            personaId: String,
            membershipId: String,
            status: String,
        ): NetworkResult<AudienceFollowerUpdateResponse> =
            safeApiCall {
                api.updateFollowerStatus(personaId, membershipId, AudienceFollowerStatusBody(status))
            }

        suspend fun posts(handle: String): NetworkResult<PersonaPostsResponse> = safeApiCall { api.posts(handle) }

        suspend fun tiers(handle: String): NetworkResult<PersonaTiersResponse> = safeApiCall { api.tiers(handle) }

        suspend fun membershipStats(personaId: String): NetworkResult<MembershipStatsResponse> =
            safeApiCall { api.membershipStats(personaId) }

        suspend fun threads(personaId: String): NetworkResult<PersonaThreadsResponse> = safeApiCall { api.threads(personaId) }

        suspend fun publishUpdate(
            channelId: String,
            body: PublishUpdateBody,
        ): NetworkResult<PublishUpdateResponse> = safeApiCall { api.publishUpdate(channelId, body) }

        /** A.7 — broadcast history (recent updates) for the compose surface. */
        suspend fun broadcastHistory(
            channelId: String,
            limit: Int = 50,
        ): NetworkResult<BroadcastHistoryResponse> = safeApiCall { api.broadcastHistory(channelId, limit) }
    }
