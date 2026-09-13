package app.pantopus.android.data.homes

import app.pantopus.android.data.api.services.HomeResidencyReviewHistoryApi
import kotlinx.coroutines.CancellationException
import okhttp3.ResponseBody
import retrofit2.Response
import java.net.HttpURLConnection

interface HomeResidencyReviewHistoryTransport {
    suspend fun session(scope: HomeCreationScope): HomeResidencyHistorySession

    suspend fun list(homeId: String, session: HomeResidencyHistorySession, after: HomeResidencyHistoryCursor?): HomeResidencyHistoryPage

    suspend fun read(reference: HomeResidencyHistoryReference, session: HomeResidencyHistorySession): HomeResidencyHistoryItem
}

class APIHomeResidencyReviewHistoryTransport(
    private val api: HomeResidencyReviewHistoryApi,
    private val codec: HomeResidencyReviewHistoryCodec,
) : HomeResidencyReviewHistoryTransport {
    override suspend fun session(scope: HomeCreationScope): HomeResidencyHistorySession = checked {
        check(scope.isValid())
        codec.session(codec.objectFrom(success(api.session()))["session"], scope.actorId)
    }

    override suspend fun list(
        homeId: String,
        session: HomeResidencyHistorySession,
        after: HomeResidencyHistoryCursor?,
    ): HomeResidencyHistoryPage = checked {
        check(HomeResidencyReviewHistoryCodec.uuid(homeId))
        requireSession(session)
        after?.let { check(codec.cursor(it.encoded, homeId, session.actorId) == it) }
        codec.page(success(api.list(homeId, session.sessionScope, after?.encoded)), homeId, session, after)
    }

    override suspend fun read(reference: HomeResidencyHistoryReference, session: HomeResidencyHistorySession): HomeResidencyHistoryItem = checked {
        check(HomeResidencyReviewHistoryCodec.uuid(reference.homeId) && HomeResidencyReviewHistoryCodec.uuid(reference.receiptId))
        check(reference.actorId == session.actorId)
        requireSession(session)
        codec.detail(success(api.read(reference.homeId, reference.receiptId, session.sessionScope)), reference, session)
    }

    private fun requireSession(session: HomeResidencyHistorySession) {
        check(codec.session(mapOf("actor_id" to session.actorId, "session_scope" to session.sessionScope), session.actorId) == session)
    }

    private fun success(response: Response<ResponseBody>): String {
        val body = response.body() ?: response.errorBody()
        if (response.code() == HttpURLConnection.HTTP_UNAUTHORIZED) {
            body?.close()
            throw HomeResidencyHistoryFailure(HomeResidencyHistoryFailureKind.SessionChanged)
        }
        val json = checkNotNull(body).use { it.string() }
        if (response.code() == HttpURLConnection.HTTP_OK) return json
        val code = codec.objectFrom(json)["code"] as? String
        val kind = when {
            response.code() == HttpURLConnection.HTTP_CONFLICT && code == "SESSION_SCOPE_CHANGED" -> HomeResidencyHistoryFailureKind.SessionChanged
            response.code() == HttpURLConnection.HTTP_FORBIDDEN && code == "MEMBERS_MANAGE_REQUIRED" -> HomeResidencyHistoryFailureKind.Forbidden
            response.code() == HttpURLConnection.HTTP_NOT_FOUND && code == "HOME_NOT_FOUND" -> HomeResidencyHistoryFailureKind.MissingHome
            response.code() == HttpURLConnection.HTTP_NOT_FOUND && code == "RESIDENCY_HISTORY_NOT_FOUND" -> HomeResidencyHistoryFailureKind.MissingDecision
            response.code() == HttpURLConnection.HTTP_BAD_REQUEST && code == "RESIDENCY_HISTORY_CURSOR_INVALID" -> HomeResidencyHistoryFailureKind.InvalidCursor
            else -> HomeResidencyHistoryFailureKind.Unavailable
        }
        throw HomeResidencyHistoryFailure(kind)
    }

    private suspend fun <T> checked(action: suspend () -> T): T = try {
        action()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (failure: HomeResidencyHistoryFailure) {
        throw failure
    } catch (_: Exception) {
        throw HomeResidencyHistoryFailure(HomeResidencyHistoryFailureKind.Unavailable)
    }
}
