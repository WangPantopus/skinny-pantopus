package app.pantopus.android.ui.screens.homes.postal

import app.pantopus.android.data.api.services.HomePostalApi
import app.pantopus.android.data.homes.HomePostalCodec
import app.pantopus.android.data.homes.HomePostalKind
import app.pantopus.android.data.homes.HomePostalOutcome
import app.pantopus.android.data.homes.HomePostalScope
import app.pantopus.android.data.homes.HomePostalStatus
import app.pantopus.android.data.homes.PendingHomePostalCommand
import app.pantopus.android.data.homes.PersistentPendingHomePostalStore
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CancellationException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Retrofit
import javax.inject.Inject

class HomePostalFactory
    @Inject
    constructor(
        private val store: PersistentPendingHomePostalStore,
        private val retrofit: Retrofit,
        moshi: Moshi,
    ) {
        val codec = HomePostalCodec(moshi)
        private val api = retrofit.create(HomePostalApi::class.java)

        fun create(
            session: HomeClaimSessionScope,
            homeId: String,
        ): HomePostalCoordinator =
            HomePostalCoordinator(
                HomePostalScope(retrofit.baseUrl().toString(), session.actorId.orEmpty(), homeId),
                store,
                codec,
                APIHomePostalTransport(api, codec),
                session::requireCurrent,
            )

        suspend fun current(scope: HomePostalScope): HomePostalStatus {
            check(scope.isValid())
            val response = api.current(scope.homeId)
            val raw = (response.body() ?: response.errorBody())?.use { it.string() }
            check(response.isSuccessful)
            return codec.status(checkNotNull(raw), scope)
        }
    }

class APIHomePostalTransport(private val api: HomePostalApi, private val codec: HomePostalCodec) : HomePostalTransport {
    private suspend fun send(
        draft: PendingHomePostalCommand,
        action: HomePostalAction,
    ) = if (draft.kind == HomePostalKind.Mail) {
        when (action) {
            HomePostalAction.Submit -> api.submitMail(draft.scope.homeId, draft.requestJson.toRequestBody("application/json".toMediaType()))
            HomePostalAction.Check -> api.readMail(draft.scope.homeId, draft.requestId)
            HomePostalAction.Cancel -> api.cancelMail(draft.scope.homeId, draft.requestId)
        }
    } else {
        val card = checkNotNull(draft.postcardId)
        when (action) {
            HomePostalAction.Submit ->
                api.submitCode(
                    draft.scope.homeId,
                    card,
                    draft.requestJson.toRequestBody("application/json".toMediaType()),
                )
            HomePostalAction.Check -> api.readCode(draft.scope.homeId, card, draft.requestId)
            HomePostalAction.Cancel -> api.cancelCode(draft.scope.homeId, card, draft.requestId)
        }
    }

    @Suppress("MagicNumber")
    override suspend fun resolve(
        draft: PendingHomePostalCommand,
        action: HomePostalAction,
    ): HomePostalOutcome {
        try {
            check(codec.valid(draft, draft.scope))
            val response = send(draft, action)
            val raw = (response.body() ?: response.errorBody())?.use { it.string() }
            val outcome = codec.outcome(checkNotNull(raw))
            val accepted =
                when (outcome.state) {
                    "completed", "cancelled" -> response.code() == 200
                    "pending" -> response.code() == 202
                    "rejected" -> response.code() in setOf(400, 403, 404, 409, 410, 422, 429)
                    else -> false
                }
            check(accepted && outcome.matches(draft))
            return outcome.projected()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            error(
                "The result is not confirmed. Your original details are kept. " +
                    "Check again, retry the same request, or confirm cancellation.",
            )
        }
    }
}
