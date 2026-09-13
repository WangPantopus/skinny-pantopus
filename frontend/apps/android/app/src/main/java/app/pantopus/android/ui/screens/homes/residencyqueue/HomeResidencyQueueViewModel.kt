package app.pantopus.android.ui.screens.homes.residencyqueue

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.homes.HomeResidencyQueueClaim
import app.pantopus.android.data.homes.HomeResidencyQueueCodec
import app.pantopus.android.data.homes.HomeResidencyQueueFailure
import app.pantopus.android.data.homes.HomeResidencyQueueFailureKind
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

data class HomeResidencyQueueUiState(
    val working: Boolean = false,
    val confirmed: Boolean = false,
    val claims: List<HomeResidencyQueueClaim> = emptyList(),
    val failure: HomeResidencyQueueFailureKind? = null,
)

@HiltViewModel
class HomeResidencyQueueViewModel
    @Inject
    constructor(private val factory: HomeResidencyQueueFactory) : ViewModel() {
        private var lifetime: Job? = null
        private var scope: CoroutineScope? = null
        private var session: HomeClaimSessionScope? = null
        private var generation = 0L
        private var epoch = 0L
        private var visible = false
        private var homeId: String? = null
        private val mutable = MutableStateFlow(HomeResidencyQueueUiState())
        val state = mutable.asStateFlow()

        // Compose can still hold its last collected value when lifecycle collection resumes.
        // Consult current model state before rendering so that frame cannot restore retired rows.
        fun displayState(observed: HomeResidencyQueueUiState): HomeResidencyQueueUiState {
            val latest = if (observed == mutable.value) observed else mutable.value
            return if (visible && session?.isCurrent != true) {
                HomeResidencyQueueUiState(failure = HomeResidencyQueueFailureKind.SessionChanged)
            } else {
                latest
            }
        }

        fun pause() {
            epoch++
            generation++
            visible = false
            lifetime?.cancel()
            lifetime = null
            scope = null
            session = null
            mutable.value = HomeResidencyQueueUiState()
        }

        fun resume(homeId: String) {
            pause()
            this.homeId = homeId
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
                        mutable.value = HomeResidencyQueueUiState(failure = HomeResidencyQueueFailureKind.SessionChanged)
                    }
                }
            }
            reload()
        }

        fun beginReview(claimId: String): Boolean {
            if (!visible || session?.isCurrent != true) return false
            val current = displayState(mutable.value)
            if (!current.confirmed || current.failure != null || current.claims.none { it.id == claimId }) return false
            pause()
            return true
        }

        fun reload() {
            val scope = scope ?: return
            val session = session ?: return
            val home = homeId ?: return
            if (!visible) return
            val revision = ++generation
            mutable.value = HomeResidencyQueueUiState(working = true)
            scope.launch {
                try {
                    session.requireCurrent()
                    check(HomeResidencyQueueCodec.uuid(home))
                    val proof = factory.transport.session(factory.identity(session))
                    session.requireCurrent()
                    val page = factory.transport.list(home, proof)
                    session.requireCurrent()
                    if (current(revision)) mutable.value = HomeResidencyQueueUiState(confirmed = true, claims = page.claims)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (failure: HomeResidencyQueueFailure) {
                    if (current(revision)) mutable.value = HomeResidencyQueueUiState(failure = failure.kind)
                } catch (_: Exception) {
                    if (current(revision)) mutable.value = HomeResidencyQueueUiState(failure = HomeResidencyQueueFailureKind.Unavailable)
                }
            }
        }

        private fun current(revision: Long): Boolean = visible && generation == revision && session?.isCurrent == true
    }
