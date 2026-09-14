package app.pantopus.android.data.homes

import app.pantopus.android.data.api.services.HomeInvitationSenderApi
import kotlinx.coroutines.CancellationException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import java.net.HttpURLConnection

interface HomeInvitationSenderTransport {
    suspend fun session(scope: HomeCreationScope): String

    suspend fun context(
        scope: HomeCreationScope,
        intent: HomeInvitationSenderIntent,
        session: String,
    ): HomeInvitationSenderContext

    suspend fun resolve(
        draft: PendingHomeInvitationSender,
        action: HomeInvitationSenderRecovery,
        session: String,
    ): HomeInvitationSenderOutcome
}

class APIHomeInvitationSenderTransport(
    private val api: HomeInvitationSenderApi,
    private val codec: HomeInvitationSenderCodec,
) : HomeInvitationSenderTransport {
    override suspend fun session(scope: HomeCreationScope): String =
        checked {
            val response = api.session()
            val json = body(response)
            check(response.code() == HttpURLConnection.HTTP_OK)
            codec.session(codec.objectFrom(json)["session"], scope)
        }

    override suspend fun context(
        scope: HomeCreationScope,
        intent: HomeInvitationSenderIntent,
        session: String,
    ): HomeInvitationSenderContext =
        checked {
            check(intent.isValid())
            val response = api.context(codec.intent(intent).toRequestBody(JSON), session)
            val json = body(response)
            if (response.code() != HttpURLConnection.HTTP_OK) {
                val code = codec.objectFrom(json)["code"] as? String
                if (code == "SESSION_SCOPE_CHANGED") throw HomeInvitationSenderFailure(HomeInvitationSenderFailureKind.SessionChanged)
                if (response.code() >= HttpURLConnection.HTTP_INTERNAL_ERROR) {
                    throw HomeInvitationSenderFailure(
                        HomeInvitationSenderFailureKind.Unavailable,
                    )
                }
                throw HomeInvitationSenderRefusal(code)
            }
            codec.context(json, scope, session, intent)
        }

    override suspend fun resolve(
        draft: PendingHomeInvitationSender,
        action: HomeInvitationSenderRecovery,
        session: String,
    ): HomeInvitationSenderOutcome =
        checked(HomeInvitationSenderFailureKind.Unknown) {
            check(codec.valid(draft, draft.scope) && HomeResidencyReviewCodec.reviewHash(session))
            val response =
                when (action) {
                    HomeInvitationSenderRecovery.Check -> api.read(draft.request.requestId, session)
                    HomeInvitationSenderRecovery.Retry -> api.submit(draft.requestJson.toRequestBody(JSON), session)
                    HomeInvitationSenderRecovery.Cancel ->
                        api.cancel(
                            draft.request.requestId,
                            codec.cancel(draft).toRequestBody(JSON),
                            session,
                        )
                }
            val json = body(response)
            val row = codec.objectFrom(json)
            if (row["code"] == "SESSION_SCOPE_CHANGED") throw HomeInvitationSenderFailure(HomeInvitationSenderFailureKind.SessionChanged)
            check(codec.session(row["session"], draft.scope) == session)
            codec.outcome(json, draft).also { check(response.code() in checkNotNull(STATUSES[it.state])) }
        }

    private fun body(response: Response<ResponseBody>): String = checkNotNull(response.body() ?: response.errorBody()).use { it.string() }

    private suspend fun <T> checked(
        kind: HomeInvitationSenderFailureKind = HomeInvitationSenderFailureKind.Unavailable,
        action: suspend () -> T,
    ): T =
        try {
            action()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (known: HomeInvitationSenderFailure) {
            throw known
        } catch (known: HomeInvitationSenderRefusal) {
            throw known
        } catch (_: Exception) {
            throw HomeInvitationSenderFailure(kind)
        }

    private companion object {
        val JSON = "application/json".toMediaType()
        val STATUSES =
            mapOf(
                "completed" to setOf(200, 201),
                "pending" to setOf(202),
                "cancelled" to setOf(200),
                "rejected" to setOf(400, 403, 404, 409, 410, 422),
            )
    }
}
