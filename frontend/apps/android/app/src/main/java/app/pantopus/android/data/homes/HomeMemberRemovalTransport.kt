package app.pantopus.android.data.homes

import app.pantopus.android.data.api.services.HomeMemberRemovalApi
import kotlinx.coroutines.CancellationException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import java.net.HttpURLConnection

interface HomeMemberRemovalTransport {
    suspend fun session(scope: HomeCreationScope): String

    suspend fun context(
        scope: HomeCreationScope,
        intent: HomeMemberRemovalIntent,
        session: String,
    ): HomeMemberRemovalContext

    suspend fun resolve(
        draft: PendingHomeMemberRemoval,
        action: HomeMemberRemovalRecovery,
        session: String,
    ): HomeMemberRemovalOutcome

    suspend fun currentRoster(
        draft: PendingHomeMemberRemoval,
        session: String,
    ): HomeMemberRemovalCurrent
}

class APIHomeMemberRemovalTransport(
    private val api: HomeMemberRemovalApi,
    private val codec: HomeMemberRemovalCodec,
) : HomeMemberRemovalTransport {
    override suspend fun session(scope: HomeCreationScope): String =
        checked {
            val response = api.session()
            val json = body(response)
            retireAuthentication(response.code(), codec.objectFrom(json))
            check(response.code() == HttpURLConnection.HTTP_OK)
            codec.session(codec.objectFrom(json)["session"], scope)
        }

    override suspend fun context(
        scope: HomeCreationScope,
        intent: HomeMemberRemovalIntent,
        session: String,
    ): HomeMemberRemovalContext =
        checked {
            check(intent.isValid())
            val response = api.context(codec.intent(intent).toRequestBody(JSON), session)
            val json = body(response)
            val row = codec.objectFrom(json)
            retireAuthentication(response.code(), row)
            check(codec.session(row["session"], scope) == session)
            if (response.code() != HttpURLConnection.HTTP_OK) {
                if (response.code() >= HttpURLConnection.HTTP_INTERNAL_ERROR) {
                    throw HomeMemberRemovalFailure(
                        HomeMemberRemovalFailureKind.Unavailable,
                    )
                }
                throw HomeMemberRemovalRefusal(row["code"] as? String)
            }
            codec.context(json, scope, session, intent)
        }

    override suspend fun resolve(
        draft: PendingHomeMemberRemoval,
        action: HomeMemberRemovalRecovery,
        session: String,
    ): HomeMemberRemovalOutcome =
        checked(HomeMemberRemovalFailureKind.Unknown) {
            check(codec.valid(draft, draft.scope) && HomeResidencyReviewCodec.reviewHash(session))
            val response =
                when (action) {
                    HomeMemberRemovalRecovery.Check -> api.read(draft.request.requestId, session)
                    HomeMemberRemovalRecovery.Retry -> api.submit(draft.requestJson.toRequestBody(JSON), session)
                    HomeMemberRemovalRecovery.Cancel ->
                        api.cancel(
                            draft.request.requestId,
                            codec.cancel(draft).toRequestBody(JSON),
                            session,
                        )
                }
            val json = body(response)
            val row = codec.objectFrom(json)
            retireAuthentication(response.code(), row)
            check(codec.session(row["session"], draft.scope) == session)
            if (action == HomeMemberRemovalRecovery.Check) check(!row.containsKey("replayed"))
            codec.outcome(json, draft).also { check(response.code() == (it.status ?: HttpURLConnection.HTTP_OK)) }
        }

    override suspend fun currentRoster(
        draft: PendingHomeMemberRemoval,
        session: String,
    ): HomeMemberRemovalCurrent =
        checked {
            check(codec.valid(draft, draft.scope))
            val response = api.members(draft.request.intent.homeId)
            val json = body(response)
            val row = codec.objectFrom(json)
            retireAuthentication(response.code(), row)
            check(response.code() == HttpURLConnection.HTTP_OK)
            val current = codec.currentRoster(json, draft.request.intent)
            // The legacy roster has no session envelope. Recheck the live server
            // identity before publishing this separate current snapshot.
            if (this.session(draft.scope) != session) throw HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.SessionChanged)
            current
        }

    private fun retireAuthentication(
        status: Int,
        row: Map<String, Any?>,
    ) {
        if (status == HttpURLConnection.HTTP_UNAUTHORIZED ||
            (status == HttpURLConnection.HTTP_CONFLICT && row["code"] == "SESSION_SCOPE_CHANGED")
        ) {
            throw HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.SessionChanged)
        }
    }

    private fun body(response: Response<ResponseBody>): String {
        if (response.code() == HttpURLConnection.HTTP_UNAUTHORIZED) {
            (response.body() ?: response.errorBody())?.close()
            throw HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.SessionChanged)
        }
        return checkNotNull(response.body() ?: response.errorBody()).use { it.string() }
    }

    private suspend fun <T> checked(
        kind: HomeMemberRemovalFailureKind = HomeMemberRemovalFailureKind.Unavailable,
        action: suspend () -> T,
    ): T =
        try {
            action()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (known: HomeMemberRemovalFailure) {
            throw known
        } catch (known: HomeMemberRemovalRefusal) {
            throw known
        } catch (_: Exception) {
            throw HomeMemberRemovalFailure(kind)
        }

    private companion object {
        val JSON = "application/json".toMediaType()
    }
}
