@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.api.services.HomeCreationApi
import app.pantopus.android.data.homes.HomeCreationCodec
import app.pantopus.android.data.homes.HomeCreationOutcome
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.PendingHomeCreation
import app.pantopus.android.data.homes.PendingHomeCreationStore
import app.pantopus.android.data.homes.PersistentPendingHomeCreationStore
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CancellationException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Retrofit
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject

enum class HomeCreationAction { Submit, Check, Cancel }

fun interface HomeCreationTransport {
    suspend fun resolve(
        draft: PendingHomeCreation,
        action: HomeCreationAction,
    ): HomeCreationOutcome
}

class HomeCreationFactory
    @Inject
    constructor(
        private val store: PersistentPendingHomeCreationStore,
        private val retrofit: Retrofit,
        private val moshi: Moshi,
    ) {
        fun create(session: HomeClaimSessionScope): HomeCreationCoordinator {
            val codec = HomeCreationCodec(moshi)
            return HomeCreationCoordinator(
                HomeCreationScope(retrofit.baseUrl().toString(), session.actorId.orEmpty()),
                store,
                codec,
                APIHomeCreationTransport(retrofit.create(HomeCreationApi::class.java), codec),
                session::requireCurrent,
            )
        }
    }

class APIHomeCreationTransport(private val api: HomeCreationApi, private val codec: HomeCreationCodec) : HomeCreationTransport {
    // Explicit HTTP codes bind retained outcomes to the server wire contract.
    @Suppress("MagicNumber")
    override suspend fun resolve(
        draft: PendingHomeCreation,
        action: HomeCreationAction,
    ): HomeCreationOutcome {
        try {
            val response =
                when (action) {
                    HomeCreationAction.Submit -> api.submit(draft.requestJson.toRequestBody("application/json".toMediaType()))
                    HomeCreationAction.Check -> api.status(draft.requestId)
                    HomeCreationAction.Cancel -> api.cancel(draft.requestId)
                }
            val raw = (response.body() ?: response.errorBody())?.use { it.string() }
            val result = codec.outcome(checkNotNull(raw))
            val accepted =
                when (result.state) {
                    "completed" -> response.code() in setOf(200, 201)
                    "pending" -> response.code() in setOf(200, 202, 503)
                    "cancelled" -> response.code() == 200
                    "rejected" -> response.code() in setOf(400, 403, 404, 409, 422)
                    else -> false
                }
            check(accepted && result.matches(draft, codec.request(draft)))
            return result
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            // An unbound 404/timeout is not proof that a delayed POST cannot arrive.
            error("The Home request could not be confirmed. Its original details are saved; check again or cancel the request.")
        }
    }
}

/** Retain the original command through unknown outcomes, restart and lifecycle retirement. */
class HomeCreationCoordinator(
    private val scope: HomeCreationScope,
    private val store: PendingHomeCreationStore,
    private val codec: HomeCreationCodec,
    private val transport: HomeCreationTransport,
    private val requireCurrent: suspend () -> Unit,
    private val newRequestId: () -> String = { UUID.randomUUID().toString() },
) {
    var pending: PendingHomeCreation? = null
        private set
    var isBusy = false
        private set
    var storageFailed = false
        private set
    private var revision = 0L
    private var knownOutcome: HomeCreationOutcome? = null
    private var expectedRequestId: String? = null
    val outcome: HomeCreationOutcome? get() = knownOutcome ?: pending?.outcome

    suspend fun restore() {
        val openingRevision = revision
        requireCurrent()
        check(scope.isValid()) { "Your session changed. Reopen Add Home to recover its request." }
        val saved = readSaved()
        requireCurrent()
        check(openingRevision == revision) { CHANGED }
        check(expectedRequestId == null || saved?.requestId == expectedRequestId) { CHANGED }
        check(pending == null || saved == null || checkNotNull(pending).sameIntent(saved)) { CHANGED }
        val known = knownOutcome
        if (known != null) {
            check(saved != null && known.matches(saved, codec.request(saved))) { CHANGED }
            check(!known.isTerminal || saved.outcome?.isTerminal != true || known.sameDecision(saved.outcome)) { CHANGED }
        }
        pending = saved
        expectedRequestId = saved?.requestId
        if (known?.isTerminal != true) knownOutcome = saved?.outcome
    }

    suspend fun prepare(
        request: CreateHomeRequest,
        form: Map<String, String>,
    ) {
        val openingRevision = revision
        requireCurrent()
        check(!isBusy && pending == null && knownOutcome == null && readSaved() == null) { CHANGED }
        check(openingRevision == revision) { CHANGED }
        val id = newRequestId()
        val original = PendingHomeCreation(scope, id, codec.encode(request.copy(requestId = id)), form.toMap())
        check(codec.valid(original, scope)) { "Your Home details could not be retained. Review them and try again." }
        requireCurrent()
        replace(null, original)
        requireCurrent()
        check(openingRevision == revision) { CHANGED }
        pending = original
        expectedRequestId = id
    }

    suspend fun resolve(action: HomeCreationAction): HomeCreationOutcome {
        requireCurrent()
        check(!isBusy && activeScopes.add(scope)) { "Your original Home request is still being checked. Try again shortly." }
        isBusy = true
        val openingRevision = revision
        try {
            restore()
            check(openingRevision == revision) { CHANGED }
            val draft = checkNotNull(pending) { CHANGED }
            val known = knownOutcome
            if (known?.isTerminal == true) {
                persist(known, draft)
                return known
            }
            val result = transport.resolve(draft, action)
            requireCurrent()
            check(openingRevision == revision && result.matches(draft, codec.request(draft))) { CHANGED }
            persist(result, draft)
            return checkNotNull(outcome)
        } finally {
            isBusy = false
            activeScopes.remove(scope)
        }
    }

    suspend fun acknowledge(): PendingHomeCreation {
        requireCurrent()
        val original = checkNotNull(pending) { CHANGED }
        val proof = checkNotNull(outcome) { CHANGED }
        val saved = checkNotNull(readSaved()) { CHANGED }
        check(!isBusy && proof.isTerminal && original.sameIntent(saved) && saved.outcome?.sameDecision(proof) == true) { CHANGED }
        requireCurrent()
        replace(saved, null)
        requireCurrent()
        pending = null
        knownOutcome = null
        expectedRequestId = null
        return original
    }

    fun hide() {
        revision++
        pending = null
        if (knownOutcome?.isTerminal != true) knownOutcome = null
    }

    fun request(draft: PendingHomeCreation): CreateHomeRequest = codec.request(draft)

    private suspend fun persist(
        result: HomeCreationOutcome,
        draft: PendingHomeCreation,
    ) {
        val saved = checkNotNull(readSaved()) { CHANGED }
        requireCurrent()
        check(saved.sameIntent(draft)) { CHANGED }
        val previous = knownOutcome?.takeIf { it.isTerminal } ?: saved.outcome
        val retained =
            if (previous?.isTerminal == true) {
                check(!result.isTerminal || previous.sameDecision(result)) { CHANGED }
                previous
            } else {
                result
            }
        knownOutcome = retained
        val confirmed = saved.copy(outcome = retained)
        pending = confirmed
        replace(saved, confirmed)
        requireCurrent()
    }

    private suspend fun readSaved(): PendingHomeCreation? =
        storage {
            store.read(scope).also { check(it == null || codec.valid(it, scope)) }
        }

    private suspend fun replace(
        expected: PendingHomeCreation?,
        next: PendingHomeCreation?,
    ) = storage {
        store.replace(scope, expected, next)
    }

    private suspend fun <T> storage(action: suspend () -> T): T {
        try {
            return action().also { storageFailed = false }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            storageFailed = true
            error("Your saved Home request could not be read or saved. Retry recovery before starting another request.")
        }
    }

    private companion object {
        const val CHANGED = "The saved Home request changed. Reopen Add Home to recover it."
        val activeScopes: MutableSet<HomeCreationScope> = ConcurrentHashMap.newKeySet()
    }
}
