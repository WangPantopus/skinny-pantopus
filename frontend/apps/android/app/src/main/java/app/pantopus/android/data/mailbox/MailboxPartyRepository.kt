package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mailbox.v2.CreateMailPartyRequest
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyActiveResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyAssignRequest
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyAssignResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyCreateResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyDeclineResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyJoinResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyReactionRequest
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyReactionResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartySessionRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxPartyApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Family Mail Party co-opening sessions. Wraps [MailboxPartyApi] in the
 * [NetworkResult] taxonomy.
 */
@Singleton
open class MailboxPartyRepository
    @Inject
    constructor(
        private val api: MailboxPartyApi,
    ) {
        /** `GET api/mailbox/v2/p2/party/active`. */
        open suspend fun activeSessions(): NetworkResult<MailPartyActiveResponse> = safeApiCall { api.activeSessions() }

        /** `POST api/mailbox/v2/p2/party/create`. */
        open suspend fun createSession(mailId: String): NetworkResult<MailPartyCreateResponse> =
            safeApiCall { api.createSession(CreateMailPartyRequest(mailId = mailId)) }

        /** `POST api/mailbox/v2/p2/party/join`. */
        open suspend fun joinSession(sessionId: String): NetworkResult<MailPartyJoinResponse> =
            safeApiCall { api.joinSession(MailPartySessionRequest(sessionId = sessionId)) }

        /** `POST api/mailbox/v2/p2/party/decline`. */
        open suspend fun declineSession(sessionId: String): NetworkResult<MailPartyDeclineResponse> =
            safeApiCall { api.declineSession(MailPartySessionRequest(sessionId = sessionId)) }

        /** `POST api/mailbox/v2/p2/party/reaction`. */
        open suspend fun sendReaction(
            sessionId: String,
            reaction: String,
        ): NetworkResult<MailPartyReactionResponse> =
            safeApiCall {
                api.sendReaction(MailPartyReactionRequest(sessionId = sessionId, reaction = reaction))
            }

        /** `POST api/mailbox/v2/p2/party/assign`. */
        open suspend fun assignItem(
            sessionId: String,
            mailId: String,
            assignToUserId: String,
        ): NetworkResult<MailPartyAssignResponse> =
            safeApiCall {
                api.assignItem(
                    MailPartyAssignRequest(
                        sessionId = sessionId,
                        mailId = mailId,
                        assignToUserId = assignToUserId,
                    ),
                )
            }
    }
