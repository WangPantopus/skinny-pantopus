package app.pantopus.android.data.homes

import app.pantopus.android.data.api.services.HomeResidencyQueueApi
import kotlinx.coroutines.CancellationException
import okhttp3.ResponseBody
import retrofit2.Response
import java.net.HttpURLConnection

interface HomeResidencyQueueTransport {
    suspend fun session(scope: HomeCreationScope): HomeResidencyQueueSession

    suspend fun list(
        homeId: String,
        session: HomeResidencyQueueSession,
    ): HomeResidencyQueuePage
}

class APIHomeResidencyQueueTransport(
    private val api: HomeResidencyQueueApi,
    private val codec: HomeResidencyQueueCodec,
) : HomeResidencyQueueTransport {
    override suspend fun session(scope: HomeCreationScope): HomeResidencyQueueSession =
        checked {
            check(scope.isValid())
            codec.bootstrap(success(api.session()), scope.actorId)
        }

    override suspend fun list(
        homeId: String,
        session: HomeResidencyQueueSession,
    ): HomeResidencyQueuePage =
        checked {
            check(HomeResidencyQueueCodec.uuid(homeId))
            check(codec.session(mapOf("actor_id" to session.actorId, "session_scope" to session.sessionScope), session.actorId) == session)
            codec.page(success(api.list(homeId, session.sessionScope)), homeId, session)
        }

    private fun success(response: Response<ResponseBody>): String {
        val body = response.body() ?: response.errorBody()
        if (response.code() == HttpURLConnection.HTTP_UNAUTHORIZED) {
            body?.close()
            throw HomeResidencyQueueFailure(HomeResidencyQueueFailureKind.SessionChanged)
        }
        val json = checkNotNull(body).use { it.string() }
        if (response.code() == HttpURLConnection.HTTP_OK) return json
        val code = codec.objectFrom(json)["code"] as? String
        val kind =
            when {
                response.code() == HttpURLConnection.HTTP_CONFLICT && code == "SESSION_SCOPE_CHANGED" ->
                    HomeResidencyQueueFailureKind.SessionChanged
                response.code() == HttpURLConnection.HTTP_FORBIDDEN && code == "MEMBERS_MANAGE_REQUIRED" ->
                    HomeResidencyQueueFailureKind.Forbidden
                response.code() == HttpURLConnection.HTTP_NOT_FOUND && code == "HOME_NOT_FOUND" ->
                    HomeResidencyQueueFailureKind.MissingHome
                else -> HomeResidencyQueueFailureKind.Unavailable
            }
        throw HomeResidencyQueueFailure(kind)
    }

    private suspend fun <T> checked(action: suspend () -> T): T =
        try {
            action()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: HomeResidencyQueueFailure) {
            throw failure
        } catch (_: Exception) {
            throw HomeResidencyQueueFailure(HomeResidencyQueueFailureKind.Unavailable)
        }
}
