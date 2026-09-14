package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyProgress
import app.pantopus.android.data.api.services.HomeInvitationDecisionApi
import app.pantopus.android.data.api.services.HomeResidencyProgressApi
import kotlinx.coroutines.CancellationException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import java.net.HttpURLConnection

enum class HomeInvitationPreview { Found, Missing, Unavailable }

interface HomeInvitationDecisionTransport {
    suspend fun preview(token: String): HomeInvitationPreview

    suspend fun session(scope: HomeCreationScope): String

    suspend fun context(
        scope: HomeCreationScope,
        token: String,
        session: String,
    ): HomeInvitationDecisionContext

    suspend fun resolve(
        draft: PendingHomeInvitationDecision,
        action: HomeInvitationRecoveryAction,
        session: String,
    ): HomeInvitationDecisionOutcome

    suspend fun access(homeId: String): PersonalHomeResidencyProgress
}

class APIHomeInvitationDecisionTransport(
    private val api: HomeInvitationDecisionApi,
    private val progress: HomeResidencyProgressApi,
    private val codec: HomeInvitationDecisionCodec,
) : HomeInvitationDecisionTransport {
    override suspend fun preview(token: String): HomeInvitationPreview =
        try {
            val response = api.preview(token)
            try {
                when {
                    response.code() == HttpURLConnection.HTTP_NOT_FOUND -> HomeInvitationPreview.Missing
                    response.code() == HttpURLConnection.HTTP_OK && codec.validPreview(codec.objectFrom(body(response))) ->
                        HomeInvitationPreview.Found
                    else -> HomeInvitationPreview.Unavailable
                }
            } finally {
                response.body()?.close()
                response.errorBody()?.close()
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            HomeInvitationPreview.Unavailable
        }

    override suspend fun session(scope: HomeCreationScope): String =
        checked {
            val response = api.session()
            val json = body(response)
            check(response.code() == HttpURLConnection.HTTP_OK)
            codec.session(codec.objectFrom(json)["session"], scope)
        }

    override suspend fun context(
        scope: HomeCreationScope,
        token: String,
        session: String,
    ): HomeInvitationDecisionContext =
        checked {
            val response = api.context(token, session)
            val json = body(response)
            if (response.code() != HttpURLConnection.HTTP_OK) {
                val code = codec.objectFrom(json)["code"] as? String
                if (code == "SESSION_SCOPE_CHANGED") throw HomeInvitationFailure(HomeInvitationFailureKind.SessionChanged)
                if (response.code() >= HttpURLConnection.HTTP_INTERNAL_ERROR) {
                    throw HomeInvitationFailure(
                        HomeInvitationFailureKind.Unavailable,
                    )
                }
                throw HomeInvitationRefusal(code)
            }
            codec.context(json, scope, session)
        }

    override suspend fun resolve(
        draft: PendingHomeInvitationDecision,
        action: HomeInvitationRecoveryAction,
        session: String,
    ): HomeInvitationDecisionOutcome =
        checked(HomeInvitationFailureKind.Unknown) {
            check(codec.valid(draft, draft.scope) && HomeResidencyReviewCodec.reviewHash(session))
            val request = draft.request
            val response =
                when (action) {
                    HomeInvitationRecoveryAction.Check -> api.read(request.requestId, session)
                    HomeInvitationRecoveryAction.Retry -> api.submit(codec.encode(request).toRequestBody(JSON), session)
                    HomeInvitationRecoveryAction.Cancel -> api.cancel(request.requestId, codec.cancel(request).toRequestBody(JSON), session)
                }
            val json = body(response)
            check(codec.session(codec.objectFrom(json)["session"], draft.scope) == session)
            codec.outcome(json, draft).also { check(response.code() in checkNotNull(STATUSES[it.state])) }
        }

    override suspend fun access(homeId: String): PersonalHomeResidencyProgress =
        checked {
            progress.progress(homeId).also { check(it.matches(homeId)) }
        }

    private fun body(response: Response<ResponseBody>): String = checkNotNull(response.body() ?: response.errorBody()).use { it.string() }

    private suspend fun <T> checked(
        kind: HomeInvitationFailureKind = HomeInvitationFailureKind.Unavailable,
        action: suspend () -> T,
    ): T =
        try {
            action()
        } catch (
            cancelled: CancellationException,
        ) {
            throw cancelled
        } catch (
            known: HomeInvitationFailure,
        ) {
            throw known
        } catch (known: HomeInvitationRefusal) {
            throw known
        } catch (_: Exception) {
            throw HomeInvitationFailure(kind)
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
