package app.pantopus.android.ui.screens.homes.residencyhistory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.homes.HomeResidencyHistoryCursor
import app.pantopus.android.data.homes.HomeResidencyHistoryFailure
import app.pantopus.android.data.homes.HomeResidencyHistoryFailureKind
import app.pantopus.android.data.homes.HomeResidencyHistoryItem
import app.pantopus.android.data.homes.HomeResidencyHistoryReference
import app.pantopus.android.data.homes.HomeResidencyReviewHistoryCodec
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Only these non-capability references survive navigation within the visible dialog. */
data class HomeResidencyHistoryTarget(val homeId: String, val reference: HomeResidencyHistoryReference? = null)

data class HomeResidencyHistoryUiState(
    val working: Boolean = false,
    val confirmed: Boolean = false,
    val items: List<HomeResidencyHistoryItem> = emptyList(),
    val nextCursor: HomeResidencyHistoryCursor? = null,
    val detail: HomeResidencyHistoryItem? = null,
    val failure: HomeResidencyHistoryFailureKind? = null,
)

@HiltViewModel
class HomeResidencyHistoryViewModel @Inject constructor(private val factory: HomeResidencyHistoryFactory) : ViewModel() {
    private var lifetime: Job? = null
    private var scope: CoroutineScope? = null
    private var session: HomeClaimSessionScope? = null
    private var epoch = 0L
    private var generation = 0L
    private var visible = false
    private var target: HomeResidencyHistoryTarget? = null
    private val _state = MutableStateFlow(HomeResidencyHistoryUiState())
    val state = _state.asStateFlow()

    fun pause() {
        epoch++
        generation++
        visible = false
        lifetime?.cancel()
        lifetime = null
        scope = null
        session = null
        _state.value = HomeResidencyHistoryUiState()
    }

    fun resume(target: HomeResidencyHistoryTarget) {
        pause()
        this.target = target
        visible = true
        val job = SupervisorJob(viewModelScope.coroutineContext[Job])
        lifetime = job
        val scope = CoroutineScope(viewModelScope.coroutineContext + job)
        this.scope = scope
        val session = factory.session(scope)
        this.session = session
        val opening = epoch
        scope.launch {
            session.invalidated.collect { invalidated ->
                if (invalidated && visible && epoch == opening) {
                    pause()
                    _state.value = HomeResidencyHistoryUiState(failure = HomeResidencyHistoryFailureKind.SessionChanged)
                }
            }
        }
        reload()
    }

    /** A failed read restarts recent history; never page from a stale failed snapshot. */
    fun reload() {
        request(after = null, previous = emptyList())
    }

    fun nextPage() {
        val current = _state.value
        if (current.working || !current.confirmed || current.failure != null || target?.reference != null) return
        val cursor = current.nextCursor ?: return
        request(cursor, current.items)
    }

    private fun current(revision: Long): Boolean = visible && generation == revision && session?.isCurrent == true

    private fun request(after: HomeResidencyHistoryCursor?, previous: List<HomeResidencyHistoryItem>) {
        val scope = scope ?: return
        val session = session ?: return
        val target = target ?: return
        if (!visible) return
        val revision = ++generation
        // Retire list, detail, counts and cursor together, including pagination.
        _state.value = HomeResidencyHistoryUiState(working = true)
        scope.launch {
            try {
                session.requireCurrent()
                val identity = factory.identity(session)
                check(HomeResidencyReviewHistoryCodec.uuid(target.homeId))
                if (target.reference != null && (target.reference.homeId != target.homeId || target.reference.actorId != identity.actorId)) {
                    throw HomeResidencyHistoryFailure(HomeResidencyHistoryFailureKind.SessionChanged)
                }
                val proof = factory.transport.session(identity)
                session.requireCurrent()
                val next = if (target.reference != null) {
                    val item = factory.transport.read(target.reference, proof)
                    HomeResidencyHistoryUiState(confirmed = true, detail = item)
                } else {
                    val page = factory.transport.list(target.homeId, proof, after)
                    val items = previous + page.items
                    check(items.map { it.id }.toSet().size == items.size)
                    items.zipWithNext().forEach { (left, right) ->
                        check(HomeResidencyReviewHistoryCodec.earlier(right.createdAt, right.id, left.createdAt, left.id))
                    }
                    HomeResidencyHistoryUiState(confirmed = true, items = items, nextCursor = page.nextCursor)
                }
                session.requireCurrent()
                if (current(revision)) _state.value = next
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: HomeResidencyHistoryFailure) {
                if (current(revision)) {
                    if (failure.kind == HomeResidencyHistoryFailureKind.SessionChanged) pause()
                    _state.value = HomeResidencyHistoryUiState(failure = failure.kind)
                }
            } catch (_: Exception) {
                if (current(revision)) _state.value = HomeResidencyHistoryUiState(failure = HomeResidencyHistoryFailureKind.Unavailable)
            }
        }
    }
}
