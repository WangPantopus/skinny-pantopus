@file:Suppress("PackageNaming", "TooManyFunctions", "LongParameterList", "ReturnCount")

package app.pantopus.android.ui.screens.gigs.stop

import app.pantopus.android.data.api.models.gigs.GigStopCommand
import app.pantopus.android.data.api.models.gigs.GigStopConflict
import app.pantopus.android.data.api.models.gigs.GigStopPreview
import app.pantopus.android.data.api.models.gigs.GigStopProgress
import app.pantopus.android.data.api.models.gigs.GigStopRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigStopRecoveryChanged
import app.pantopus.android.data.gigs.GigStopRepository
import app.pantopus.android.data.gigs.GigStopScopeChanged
import app.pantopus.android.data.gigs.GigStopValidation
import app.pantopus.android.data.gigs.PendingGigStopStore
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.launch
import java.io.IOException
import java.net.HttpURLConnection
import java.security.GeneralSecurityException
import java.util.UUID

data class GigStopState(
    val visible: Boolean = false,
    val invalidated: Boolean = false,
    val busy: Boolean = false,
    val preview: GigStopPreview? = null,
    val request: GigStopRequest? = null,
    val progress: GigStopProgress? = null,
    val canRetry: Boolean = false,
    val error: String? = null,
    val recoveryAvailable: Boolean = false,
    val recoveryError: String? = null,
    val recoveryOnly: Boolean = false,
) {
    val maySubmit: Boolean get() =
        visible && !invalidated && !busy && !recoveryOnly && request == null &&
            preview?.eligible == true && preview.activeRequestId == null
}

/** GET recovers a receipt; only an explicit confirmation/retry can mutate. */
class GigStopCoordinator(
    private val repository: GigStopRepository,
    private val store: PendingGigStopStore,
    private val scope: CoroutineScope,
    private val identity: suspend () -> GigStopIdentity?,
    moshi: Moshi,
    private val scopeMarker: () -> String?,
    identityChanges: Flow<Unit> = emptyFlow(),
    private val onCompleted: () -> Unit = {},
) {
    private data class Target(val gigId: String, val action: String, val key: String, val recoveryOnly: Boolean)

    private val initialScopeMarker = scopeMarker()
    private val initialIdentity = scope.async(start = CoroutineStart.UNDISPATCHED) { readIdentity() }
    private val _state = MutableStateFlow(GigStopState())
    val state = _state.asStateFlow()
    private val conflictAdapter = moshi.adapter(GigStopConflict::class.java)
    private val completed = mutableSetOf<String>()
    private var target: Target? = null
    private var generation = 0
    private var probeGeneration = 0
    private var serverSession: String? = null
    private var operationJob: Job? = null

    init {
        scope.launch { identityChanges.collect { current() } }
    }

    private suspend fun current(): Boolean {
        if (_state.value.invalidated) return false
        if (initialScopeMarker == null || initialScopeMarker != scopeMarker()) {
            retire()
            return false
        }
        val initial = initialIdentity.await()
        if (initial == null || initial != readIdentity() || initialScopeMarker != scopeMarker()) {
            retire()
            return false
        }
        return true
    }

    private fun retire() {
        operationJob?.cancel()
        generation++
        probeGeneration++
        target = null
        serverSession = null
        _state.value = GigStopState(visible = _state.value.visible, invalidated = true, error = GigStopScopeChanged().message)
    }

    /** Independent of current owner/worker/status: a lost terminal reply still has an entry. */
    fun probeRecovery(gigId: String) {
        val ticket = ++probeGeneration
        scope.launch {
            if (!current() || !GigStopValidation.id(gigId)) return@launch
            try {
                val saved = saved(key(gigId), gigId)
                if (current() && ticket == probeGeneration) {
                    _state.value = _state.value.copy(recoveryAvailable = saved != null, recoveryError = null)
                }
            } catch (error: CancellationException) {
                throw error
            } catch (_: IOException) {
                probeFailed(ticket)
            } catch (_: JsonDataException) {
                probeFailed(ticket)
            } catch (_: IllegalStateException) {
                probeFailed(ticket)
            } catch (_: SecurityException) {
                probeFailed(ticket)
            }
        }
    }

    private suspend fun probeFailed(ticket: Int) {
        if (current() && ticket == probeGeneration) {
            _state.value =
                _state.value.copy(
                    recoveryAvailable = true,
                    recoveryError = "Saved task recovery could not be read. Check task action status before continuing.",
                )
        }
    }

    fun open(
        gigId: String,
        action: String = "cancel",
    ) = openTarget(gigId, action, recoveryOnly = false)

    fun openRecovery(gigId: String) = openTarget(gigId, "cancel", recoveryOnly = true)

    private fun openTarget(
        gigId: String,
        action: String,
        recoveryOnly: Boolean,
    ) {
        if (_state.value.invalidated || _state.value.busy) return
        val ticket = ++generation
        target = null
        serverSession = null
        _state.value =
            GigStopState(
                visible = true, busy = true, recoveryAvailable = _state.value.recoveryAvailable, recoveryOnly = recoveryOnly,
            )
        scope.launch {
            if (!current() || ticket != generation) return@launch
            if (!GigStopValidation.id(gigId) || action !in GigStopValidation.actions) {
                _state.value = _state.value.copy(busy = false, error = "Reopen the task to check its action details.")
                return@launch
            }
            target = Target(gigId, action, key(gigId), recoveryOnly)
            _state.value = _state.value.copy(busy = false)
            checkStatus()
        }
    }

    fun close() {
        operationJob?.cancel()
        generation++
        target = null
        serverSession = null
        _state.value =
            GigStopState(
                invalidated = _state.value.invalidated, recoveryAvailable = _state.value.recoveryAvailable,
                recoveryError = _state.value.recoveryError,
            )
    }

    fun checkStatus() =
        operation { current, ticket ->
            _state.value = _state.value.copy(preview = null, canRetry = false, error = null)
            val original = _state.value.request ?: saved(current.key, current.gigId)
            if (!owns(ticket)) return@operation
            _state.value = _state.value.copy(request = original, recoveryAvailable = original?.actorId == actor())
            if (original != null) {
                recoverOriginal(current, ticket, original)
                return@operation
            }
            if (current.recoveryOnly) {
                _state.value =
                    _state.value.copy(
                        recoveryAvailable = false,
                        error = "No original request is saved here. Reopen the task to choose a new action if it is still available.",
                    )
                return@operation
            }
            val preview = fetchPreview(current, current.action, ticket) ?: return@operation
            val active = preview.activeRequestId ?: return@operation
            val response = value(repository.request(current.gigId, active))
            if (owns(ticket)) accept(current, response, active, null, ticket)
        }

    private suspend fun recoverOriginal(
        current: Target,
        ticket: Int,
        original: GigStopRequest,
    ) {
        when (val result = repository.request(current.gigId, original.requestId)) {
            is NetworkResult.Success -> {
                if (owns(ticket)) accept(current, result.data, original.requestId, original, ticket)
                return
            }
            is NetworkResult.Failure -> if (result.error != NetworkError.NotFound) throw result.error
        }
        if (!owns(ticket)) return
        val preview = fetchPreview(current, original.action, ticket) ?: return
        _state.value =
            _state.value.copy(
                canRetry =
                    original.actorId == actor() && (
                        preview.activeRequestId != null ||
                            (preview.eligible && preview.terms == original.terms && preview.financialAction == original.financialAction)
                    ),
                error = "The original request is not confirmed. Check again or explicitly retry the same request when available.",
            )
    }

    fun submit(reason: String? = null) {
        val state = _state.value
        if (reason != null && reason !in GigStopValidation.reasons) return
        if (state.request != null) {
            if (!state.canRetry || state.progress?.status == "completed") return
        } else if (!state.maySubmit) {
            return
        }
        operation { current, ticket ->
            val proof = checkNotNull(serverSession) { "Check task action details before continuing." }
            val request =
                state.request ?: checkNotNull(state.preview).let { preview ->
                    GigStopRequest(
                        UUID.randomUUID().toString(), current.gigId, actor(), preview.action,
                        preview.terms, reason, null, preview.financialAction,
                    )
                }
            check(request.actorId == actor()) { "Only the original actor can retry this request." }
            store.retain(current.key, request, canCommit = { ownsCommit(ticket) })
            if (!owns(ticket)) return@operation
            _state.value = _state.value.copy(request = request, canRetry = false, error = null, recoveryAvailable = true)
            val response =
                repository.submit(
                    current.gigId,
                    GigStopCommand(request.requestId, request.action, actor(), proof, request.terms, request.reason, request.rollbackMode),
                )
            if (!owns(ticket)) return@operation
            when (response) {
                is NetworkResult.Success -> accept(current, response.data, request.requestId, request, ticket)
                is NetworkResult.Failure -> {
                    if (retiresAccess(response.error)) throw response.error
                    if (!recoverConflict(
                            current,
                            response.error,
                            request,
                            ticket,
                        )
                    ) {
                        error("The result is not confirmed. Check status to recover this request before trying another action.")
                    }
                }
            }
        }
    }

    private suspend fun fetchPreview(
        current: Target,
        action: String,
        ticket: Int,
    ): GigStopPreview? {
        val preview = value(repository.preview(current.gigId, action))
        if (!owns(ticket)) return null
        GigStopValidation.preview(preview, current.gigId, actor(), action, serverSession)
        serverSession = preview.sessionScope
        _state.value = _state.value.copy(preview = preview)
        return preview
    }

    private suspend fun accept(
        current: Target,
        response: GigStopProgress,
        requestId: String,
        expected: GigStopRequest?,
        ticket: Int,
        replacing: GigStopRequest? = null,
    ) {
        GigStopValidation.progress(response, current.gigId, actor(), requestId, serverSession, expected)
        serverSession = response.sessionScope
        if (response.status == "completed") {
            store.complete(current.key, replacing ?: response.request, canCommit = { ownsCommit(ticket) })
        } else if (response.request.actorId == actor()) {
            store.retain(current.key, response.request, replacing, canCommit = { ownsCommit(ticket) })
        } else if (replacing != null) {
            store.complete(current.key, replacing, canCommit = { ownsCommit(ticket) })
        }
        if (!owns(ticket)) return
        _state.value =
            _state.value.copy(
                request = response.request, progress = response, canRetry = response.canRetry && response.status != "completed",
                recoveryAvailable = response.status != "completed" && response.request.actorId == actor(),
                recoveryError = null, error = null,
            )
        if (response.status == "completed" && completed.add(requestId)) onCompleted()
    }

    private suspend fun recoverConflict(
        current: Target,
        error: NetworkError,
        original: GigStopRequest,
        ticket: Int,
    ): Boolean {
        if (error !is NetworkError.ClientError || error.code != HttpURLConnection.HTTP_CONFLICT) return false
        val conflict = runCatching { conflictAdapter.fromJson(error.body.orEmpty()) }.getOrNull() ?: return false
        val active = conflict.activeRequestId
        if (conflict.code != "STOP_ACTIVE" || !GigStopValidation.id(active) || active == original.requestId) return false
        val response = value(repository.request(current.gigId, checkNotNull(active)))
        if (!owns(ticket)) return true
        accept(current, response, active, null, ticket, original)
        return true
    }

    private fun operation(block: suspend (Target, Int) -> Unit) {
        val current = target ?: return
        if (!_state.value.visible || _state.value.invalidated || _state.value.busy) return
        val ticket = generation
        probeGeneration++
        _state.value = _state.value.copy(busy = true)
        operationJob =
            scope.launch {
                try {
                    if (owns(ticket)) block(current, ticket)
                } catch (error: CancellationException) {
                    throw error
                } catch (_: GigStopScopeChanged) {
                    if (owns(ticket)) retire()
                } catch (error: GigStopRecoveryChanged) {
                    showRecoveryConflict(current, ticket, error)
                } catch (error: NetworkError) {
                    handleNetworkError(ticket, error)
                } catch (error: IOException) {
                    showError(ticket, error)
                } catch (error: JsonDataException) {
                    showError(ticket, error)
                } catch (error: IllegalStateException) {
                    showError(ticket, error)
                } catch (error: SecurityException) {
                    showError(ticket, error)
                } finally {
                    if (owns(ticket)) _state.value = _state.value.copy(busy = false)
                }
            }
    }

    private suspend fun showRecoveryConflict(
        current: Target,
        ticket: Int,
        error: GigStopRecoveryChanged,
    ) {
        if (!owns(ticket)) return
        target = current.copy(recoveryOnly = true)
        _state.value =
            _state.value.copy(
                request = null, progress = null, preview = null, canRetry = false,
                recoveryOnly = true, recoveryAvailable = true, recoveryError = error.message, error = error.message,
            )
    }

    private suspend fun handleNetworkError(
        ticket: Int,
        error: NetworkError,
    ) {
        if (!owns(ticket)) return
        if (retiresAccess(error)) retire() else showError(ticket, error)
    }

    private suspend fun showError(
        ticket: Int,
        error: Throwable,
    ) {
        if (owns(ticket)) _state.value = _state.value.copy(error = error.message ?: "Could not confirm task action status. Check again.")
    }

    private fun retiresAccess(error: NetworkError): Boolean =
        error.code in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN) ||
            (
                error is NetworkError.ClientError &&
                    runCatching { conflictAdapter.fromJson(error.body.orEmpty())?.code == "SESSION_SCOPE_CHANGED" }.getOrDefault(false)
            )

    private suspend fun saved(
        key: String,
        gigId: String,
    ): GigStopRequest? =
        store.read(key)?.also {
            check(GigStopValidation.request(it, gigId) && it.actorId == actor()) {
                "Saved task recovery could not be verified. Contact support before continuing."
            }
        }

    private suspend fun actor(): String = checkNotNull(initialIdentity.await()).actorId

    private suspend fun key(gigId: String): String = checkNotNull(initialIdentity.await()).let { "${it.apiOrigin}|${it.actorId}|$gigId" }

    private suspend fun owns(ticket: Int): Boolean = current() && ticket == generation && _state.value.visible

    private fun ownsCommit(ticket: Int): Boolean =
        ticket == generation && _state.value.visible && !_state.value.invalidated &&
            initialScopeMarker != null && initialScopeMarker == scopeMarker()

    private suspend fun readIdentity(): GigStopIdentity? =
        try {
            identity()
        } catch (error: CancellationException) {
            throw error
        } catch (_: IOException) {
            null
        } catch (_: GeneralSecurityException) {
            null
        } catch (_: IllegalStateException) {
            null
        } catch (_: SecurityException) {
            null
        }

    private fun <T> value(result: NetworkResult<T>): T =
        when (result) {
            is NetworkResult.Success -> result.data
            is NetworkResult.Failure -> throw result.error
        }
}
