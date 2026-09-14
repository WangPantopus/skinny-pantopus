@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_review

import app.pantopus.android.data.api.models.homes.HomeRelationshipAction
import app.pantopus.android.data.api.models.homes.HomeRelationshipCommand
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeRelationshipScope
import app.pantopus.android.data.homes.PendingHomeRelationship
import app.pantopus.android.data.homes.PendingHomeRelationshipStore
import app.pantopus.android.data.homes.validPendingRelationship
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import java.net.HttpURLConnection.HTTP_CONFLICT
import java.net.HttpURLConnection.HTTP_FORBIDDEN
import java.net.HttpURLConnection.HTTP_NOT_FOUND
import java.net.HttpURLConnection.HTTP_UNAUTHORIZED
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** UI-dispatcher lifecycle with one protected original per account/Home. */
class HomeRelationshipController(
    private val access: HomeRelationshipAccess,
    private val store: PendingHomeRelationshipStore,
    private val scope: CoroutineScope,
    requestedClaim: String?,
    action: HomeRelationshipAction,
) {
    private val identity = access.identity
    private val mutable = MutableStateFlow(HomeRelationshipUiState(identity.actorId, requestedClaim, action))
    val state = mutable.asStateFlow()
    private var generation = 0
    private var work: Job? = null
    private var reloadQueued = false
    private val observer = scope.launch { access.invalidated.collect { if (it) retire() } }

    fun show() {
        mutable.value = state.value.copy(visible = true)
        resume()
    }

    fun resume() {
        if (!state.value.visible || state.value.retired) return
        if (!access.isCurrent) {
            retire()
            return
        }
        mutable.value = state.value.copy(active = true)
        reload()
    }

    fun pause() {
        generation++
        reloadQueued = false
        work?.cancel()
        mutable.value = clearContent().copy(active = false, busy = work != null, error = null)
    }

    fun close() {
        pause()
        mutable.value = state.value.copy(visible = false)
    }

    fun dispose() {
        close()
        observer.cancel()
        mutable.value = state.value.copy(retired = true)
    }

    fun retire() {
        pause()
        mutable.value = state.value.copy(retired = true, error = CLAIM_SESSION_CHANGED)
    }

    fun reload() {
        if (!state.value.active || state.value.retired) return
        if (work != null) {
            reloadQueued = true
            return
        }
        runAction { revision ->
            mutable.value = clearContent()
            val saved = readSaved()
            current(revision)
            val claim = saved?.claimId ?: state.value.requestedClaim
            if (claim == null) {
                mutable.value = state.value.copy(empty = true)
            } else {
                val review = access.read(claim)
                check(readSaved() == saved) { RELATIONSHIP_CHANGED }
                current(revision)
                mutable.value = state.value.copy(review = review, pending = saved)
            }
        }
    }

    fun editAction(action: HomeRelationshipAction) {
        if (state.value.canEdit) mutable.value = state.value.copy(action = action, reviewed = false)
    }

    fun editNote(note: String) {
        if (state.value.canEdit) mutable.value = state.value.copy(note = note, reviewed = false)
    }

    fun review(value: Boolean) {
        if (state.value.canEdit) mutable.value = state.value.copy(reviewed = value)
    }

    fun submit() {
        if (!state.value.canSubmit) return
        val claim = state.value.review?.claim ?: return
        perform(
            PendingHomeRelationship(
                identity,
                claim.id,
                HomeRelationshipCommand(state.value.action, state.value.note.trim(), UUID.randomUUID().toString(), claim.reviewToken),
            ),
        )
    }

    fun retry() {
        if (state.value.pending == null || state.value.pending?.confirmed != null) return
        perform(null)
    }

    private fun perform(draft: PendingHomeRelationship?) {
        if (state.value.review == null) return
        runAction { revision ->
            val pending = state.value.pending
            check(readSaved() == pending) { RELATIONSHIP_CHANGED }
            current(revision)
            val original =
                if (draft == null) {
                    checkNotNull(pending).also { check(it.confirmed == null) { RELATIONSHIP_CHANGED } }
                } else {
                    check(pending == null && validPendingRelationship(draft, identity)) { RELATIONSHIP_CHANGED }
                    store.replace(identity, null, draft)
                    current(revision)
                    mutable.value = state.value.copy(pending = draft)
                    draft
                }
            val response =
                access.decide(original) { currentReview ->
                    val saved = readSaved()
                    current(revision)
                    check(saved == original) { RELATIONSHIP_CHANGED }
                    mutable.value = state.value.copy(review = currentReview)
                }
            current(revision)
            val confirmed = original.copy(confirmed = response.receipt)
            store.replace(identity, original, confirmed)
            current(revision)
            mutable.value = state.value.copy(pending = confirmed, reviewed = false)
            val review = access.read(original.claimId)
            current(revision)
            mutable.value = state.value.copy(review = review)
        }
    }

    fun acknowledge() {
        val original = state.value.pending ?: return
        if (original.confirmed == null && !state.value.canDismiss) return
        runAction { revision ->
            val review = access.read(original.claimId)
            check(readSaved() == original) { RELATIONSHIP_CHANGED }
            current(revision)
            store.replace(identity, original, null)
            current(revision)
            mutable.value = state.value.copy(review = review, pending = null, note = "", reviewed = false)
        }
    }

    private suspend fun readSaved(): PendingHomeRelationship? =
        store.read(identity).also { check(it == null || validPendingRelationship(it, identity)) { RELATIONSHIP_CHANGED } }

    private suspend fun current(revision: Int) {
        access.requireCurrent()
        currentCoroutineContext().ensureActive()
        if (!state.value.interactive || revision != generation) throw CancellationException()
    }

    private fun clearContent(): HomeRelationshipUiState =
        state.value.copy(review = null, pending = null, note = "", reviewed = false, canDismiss = false, empty = false)

    private fun runAction(action: suspend (Int) -> Unit) {
        if (!state.value.interactive || work != null) return
        if (!access.isCurrent) {
            retire()
            return
        }
        val lock = locks.getOrPut(identity) { Mutex() }
        if (!lock.tryLock()) {
            mutable.value = state.value.copy(error = "A relationship decision is already running. Reload when it finishes.")
            return
        }
        val revision = ++generation
        mutable.value = state.value.copy(busy = true, error = null, canDismiss = false)
        work =
            scope.launch(start = CoroutineStart.LAZY) {
                try {
                    action(revision)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: NetworkError) {
                    failed(error, revision)
                } catch (error: IllegalStateException) {
                    failed(error, revision)
                } catch (error: IllegalArgumentException) {
                    failed(error, revision)
                } finally {
                    lock.unlock()
                    work = null
                    mutable.value = state.value.copy(busy = false)
                    if (reloadQueued && state.value.active) {
                        reloadQueued = false
                        reload()
                    }
                }
            }
        work?.start()
    }

    private fun failed(
        error: Throwable,
        revision: Int,
    ) {
        val network = (error as? HomeRelationshipDispatchFailure)?.failure ?: error as? NetworkError
        val code = relationshipErrorCode(network)
        if (!access.isCurrent || error is HomeRelationshipSessionChanged || code == "SESSION_SCOPE_CHANGED") {
            retire()
            return
        }
        if (!state.value.active || revision != generation) return
        val message =
            network?.displayMessage("Could not confirm the relationship decision. Retry the saved original.")
                ?: error.message ?: RELATIONSHIP_CHANGED
        if (network?.code in setOf(HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_NOT_FOUND)) {
            mutable.value = clearContent().copy(error = message)
        } else {
            mutable.value =
                state.value.copy(
                    error = message,
                    canDismiss =
                        error is HomeRelationshipDispatchFailure && network?.code == HTTP_CONFLICT &&
                            code in setOf("CLAIM_REVIEW_CHANGED", "CLAIM_NOT_ELIGIBLE", "CLAIM_CHALLENGE_REVIEW_REQUIRED"),
                )
        }
    }

    companion object {
        private val locks = ConcurrentHashMap<HomeRelationshipScope, Mutex>()
    }
}

private fun relationshipErrorCode(error: NetworkError?): String? {
    if (error !is NetworkError.ClientError) return null
    val type = Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
    val adapter = Moshi.Builder().build().adapter<Map<String, Any?>>(type)
    return runCatching { error.body?.let(adapter::fromJson)?.get("code") as? String }.getOrNull()
}
