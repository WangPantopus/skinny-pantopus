package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.geo.GeoResolveRequest
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.homes.HomeTaskGigLocation
import app.pantopus.android.data.api.models.homes.HomeTaskGigRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.homes.HomeTaskGigScope
import app.pantopus.android.data.homes.PendingHomeTaskGig
import app.pantopus.android.data.homes.PendingHomeTaskGigStore
import app.pantopus.android.data.homes.homeTaskUUID
import app.pantopus.android.data.homes.validPendingTaskGig
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
import java.net.HttpURLConnection.HTTP_BAD_REQUEST
import java.net.HttpURLConnection.HTTP_CONFLICT
import java.net.HttpURLConnection.HTTP_FORBIDDEN
import java.net.HttpURLConnection.HTTP_NOT_FOUND
import java.net.HttpURLConnection.HTTP_UNAUTHORIZED
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val GIG_STORAGE_CHANGED = "The saved publication could not be verified. Reload to recover the original before publishing."
internal const val MIN_GIG_ADDRESS_QUERY = 3

/** UI-dispatcher controller; protected originals and current authority gate every action. */
class HomeTaskGigController(
    private val access: HomeTaskGigAccess,
    private val store: PendingHomeTaskGigStore,
    private val geo: GeoApi,
    private val scope: CoroutineScope,
) {
    private val mutable = MutableStateFlow(HomeTaskGigUiState())
    val state = mutable.asStateFlow()
    private val identity = access.identity
    private var generation = 0
    private var work: Job? = null
    private var reloadQueued = false

    init {
        scope.launch { access.invalidated.collect { if (it) retire() } }
    }

    fun show() {
        mutable.value = state.value.copy(visible = true)
        resume()
    }

    fun resume() {
        if (!state.value.visible) return
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
        mutable.value =
            state.value.copy(
                active = false, busy = work != null, task = null, publication = null, pending = null,
                error = null, canDismiss = false, reviewed = false, suggestions = emptyList(),
            )
    }

    fun close() {
        pause()
        mutable.value = state.value.copy(visible = false)
    }

    fun retire() {
        pause()
        mutable.value = HomeTaskGigUiState(visible = state.value.visible, error = TASK_SESSION_CHANGED)
    }

    fun reload() {
        if (!state.value.active) return
        if (work != null) {
            reloadQueued = true
            return
        }
        runAction { revision ->
            mutable.value = state.value.copy(task = null, publication = null, pending = null, reviewed = false)
            val (task, publication) = access.source()
            val pending = readSaved()
            current(revision)
            mutable.value = state.value.copy(task = task, publication = publication, pending = pending)
        }
    }

    fun edit(input: HomeTaskGigInput) {
        if (!state.value.canEdit) return
        val changedAddress = input.address != state.value.input.address
        mutable.value =
            state.value.copy(
                input = input, reviewed = false,
                location = state.value.location.takeUnless { changedAddress },
                suggestions = state.value.suggestions.takeUnless { changedAddress } ?: emptyList(),
            )
    }

    fun review(value: Boolean) {
        if (state.value.canEdit) mutable.value = state.value.copy(reviewed = value)
    }

    fun searchAddress() {
        if (!state.value.canEdit || state.value.input.address.trim().length < MIN_GIG_ADDRESS_QUERY) return
        val query = state.value.input.address
        runAction { revision ->
            current(revision)
            val result = safeApiCall { geo.autocomplete(query) }.gigValue()
            current(revision)
            mutable.value =
                state.value.copy(
                    suggestions = result.suggestions,
                    error = if (result.suggestions.isEmpty()) "No matching locations. Try a more complete address." else null,
                )
        }
    }

    fun chooseAddress(suggestion: GeoSuggestion) {
        if (!state.value.canEdit || suggestion !in state.value.suggestions) return
        runAction { revision ->
            current(revision)
            val address = safeApiCall { geo.resolve(GeoResolveRequest(suggestion.suggestionId)) }.gigValue().normalized
            current(revision)
            val location =
                HomeTaskGigLocation(
                    checkNotNull(address.address),
                    checkNotNull(address.latitude),
                    checkNotNull(address.longitude),
                    address.city,
                    address.state,
                    address.zipcode,
                )
            check(location.valid()) { "The location could not be verified. Select another address." }
            mutable.value = state.value.copy(location = location, suggestions = emptyList(), reviewed = false)
        }
    }

    fun publish() {
        if (!state.value.canPublish) return
        perform(state.value.request(UUID.randomUUID().toString()))
    }

    fun retry() {
        if (state.value.pending?.confirmed != null || state.value.pending == null) return
        perform(null)
    }

    private fun perform(request: HomeTaskGigRequest?) {
        if (state.value.publication == null) return
        runAction { revision ->
            val pending = state.value.pending
            check(readSaved() == pending) { GIG_STORAGE_CHANGED }
            current(revision)
            val original =
                if (request == null) {
                    checkNotNull(pending).also { check(it.confirmed == null) { GIG_STORAGE_CHANGED } }
                } else {
                    check(pending == null && request.valid()) { GIG_STORAGE_CHANGED }
                    PendingHomeTaskGig(identity, request).also {
                        store.replace(identity, null, it)
                        current(revision)
                        mutable.value = state.value.copy(pending = it)
                    }
                }
            val response =
                access.publish(original) {
                    val saved = readSaved()
                    // Credential storage can change before its reactive flow is delivered.
                    current(revision)
                    check(saved == original) { GIG_STORAGE_CHANGED }
                }
            current(revision)
            val confirmed = original.copy(confirmed = response.receipt)
            store.replace(identity, original, confirmed)
            current(revision)
            mutable.value = state.value.copy(pending = confirmed)
            val (task, publication) = access.source()
            current(revision)
            mutable.value = state.value.copy(task = task, publication = publication, reviewed = false)
        }
    }

    fun acknowledge() {
        val original = state.value.pending ?: return
        if (original.confirmed == null && !state.value.canDismiss) return
        runAction { revision ->
            val (task, publication) = access.source()
            check(readSaved() == original) { GIG_STORAGE_CHANGED }
            current(revision)
            store.replace(identity, original, null)
            current(revision)
            mutable.value = state.value.copy(task = task, publication = publication, pending = null, reviewed = false)
        }
    }

    fun openGig(onOpen: (String) -> Unit) {
        runAction { revision ->
            val (_, publication) = access.source()
            check(readSaved() == state.value.pending) { GIG_STORAGE_CHANGED }
            current(revision)
            val destination = state.value.pending?.confirmed?.gigId ?: publication.gigId
            check(homeTaskUUID(destination) && publication.gigId == destination) { GIG_SOURCE_CHANGED }
            close()
            onOpen(checkNotNull(destination))
        }
    }

    private suspend fun readSaved(): PendingHomeTaskGig? =
        store.read(identity).also {
            check(it == null || validPendingTaskGig(it, identity)) { GIG_STORAGE_CHANGED }
        }

    private suspend fun current(revision: Int) {
        access.requireCurrent()
        currentCoroutineContext().ensureActive()
        if (!state.value.active || !state.value.visible || revision != generation) throw CancellationException()
    }

    private fun runAction(action: suspend (Int) -> Unit) {
        if (!state.value.active || !state.value.visible || work != null) return
        if (!access.isCurrent) {
            retire()
            return
        }
        val lock = locks.getOrPut(identity) { Mutex() }
        if (!lock.tryLock()) {
            mutable.value = state.value.copy(error = "A publication is already running. Reload when it finishes.")
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
        if (!access.isCurrent) {
            retire()
            return
        }
        if (!state.value.active || revision != generation) return
        val network = (error as? GigPublicationFailure)?.failure ?: error as? NetworkError
        val message =
            network?.displayMessage("Could not confirm publication. Retry the saved request.") ?: error.message ?: GIG_STORAGE_CHANGED
        val hide =
            network?.code in setOf(HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_NOT_FOUND) ||
                message == TASK_ACCESS_CHANGED || message == GIG_SOURCE_CHANGED
        mutable.value =
            if (hide) {
                HomeTaskGigUiState(visible = true, active = true, busy = true, error = message)
            } else {
                state.value.copy(
                    error = message, canDismiss = error is GigPublicationFailure && definitiveGigRejection(error.failure),
                )
            }
    }

    companion object {
        private val locks = ConcurrentHashMap<HomeTaskGigScope, Mutex>()
    }
}

private fun definitiveGigRejection(error: NetworkError): Boolean {
    if (error !is NetworkError.ClientError) return false
    val type = Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
    val adapter = Moshi.Builder().build().adapter<Map<String, Any?>>(type)
    val code = runCatching { error.body?.let(adapter::fromJson)?.get("code") }.getOrNull()
    val conflicts = setOf("HOME_TASK_GIG_STALE", "HOME_TASK_GIG_NOT_READY", "HOME_TASK_GIG_LINKED", "HOME_TASK_GIG_RETIRED")
    return (error.code == HTTP_BAD_REQUEST && code == "HOME_RECORD_INVALID") || (error.code == HTTP_CONFLICT && code in conflicts)
}
