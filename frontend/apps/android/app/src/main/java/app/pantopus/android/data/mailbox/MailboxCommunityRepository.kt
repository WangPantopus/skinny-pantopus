package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mailbox.p3.CommunityFeedResponse
import app.pantopus.android.data.api.models.mailbox.p3.CommunityFlagRequest
import app.pantopus.android.data.api.models.mailbox.p3.CommunityFlagResponse
import app.pantopus.android.data.api.models.mailbox.p3.CommunityReactRequest
import app.pantopus.android.data.api.models.mailbox.p3.CommunityReactResponse
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpRequest
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxCommunityApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [MailboxCommunityApi] returning the typed
 * [NetworkResult] taxonomy. Backs the A17.4 Community-mail feed.
 */
@Singleton
open class MailboxCommunityRepository
    @Inject
    constructor(
        private val api: MailboxCommunityApi,
    ) {
        /** `GET api/mailbox/v2/p3/community/feed`. */
        open suspend fun feed(
            type: String? = null,
            limit: Int = 30,
            offset: Int = 0,
        ): NetworkResult<CommunityFeedResponse> = safeApiCall { api.feed(type, limit, offset) }

        /** `POST api/mailbox/v2/p3/community/react`. */
        open suspend fun react(
            communityItemId: String,
            reactionType: String,
        ): NetworkResult<CommunityReactResponse> =
            safeApiCall {
                api.react(
                    CommunityReactRequest(
                        communityItemId = communityItemId,
                        reactionType = reactionType,
                    ),
                )
            }

        /** `POST api/mailbox/v2/p3/community/rsvp`. */
        open suspend fun rsvp(communityItemId: String): NetworkResult<CommunityRsvpResponse> =
            safeApiCall { api.rsvp(CommunityRsvpRequest(communityItemId = communityItemId)) }

        /** `POST api/mailbox/v2/p3/community/flag`. */
        open suspend fun flag(communityItemId: String): NetworkResult<CommunityFlagResponse> =
            safeApiCall { api.flag(CommunityFlagRequest(communityItemId = communityItemId)) }
    }
