@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.PublicWaitlistJoinRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Seed for the invitee waitlist-join sheet (public, host-branded). */
data class WaitlistJoinArgs(
    val slug: String,
    val eventTypeSlug: String,
    val hostName: String,
    val windowLabel: String,
    val timezoneLabel: String,
)

data class WaitlistJoinUiState(
    val hostName: String = "",
    val windowLabel: String = "",
    val timezoneLabel: String = "",
    val name: String = "",
    val email: String = "",
    val preferredTime: String = "",
    val joining: Boolean = false,
    val didJoin: Boolean = false,
    /** True when the backend returns 409 — the invitee is already on the waitlist. */
    val alreadyJoined: Boolean = false,
    val error: String? = null,
) {
    val canJoin: Boolean get() = email.isNotBlank() && !joining
}

/**
 * E13 (invitee) Waitlist Join. The public, unauthenticated join surface: when an
 * event type/slot is full, the invitee leaves an email and we text/email them
 * when a spot opens (`POST /api/public/book/:slug/:eventTypeSlug/waitlist`). The
 * backend keys on email and returns no queue position.
 */
@HiltViewModel
class WaitlistJoinViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(WaitlistJoinUiState())
        val state: StateFlow<WaitlistJoinUiState> = _state.asStateFlow()

        private var slug: String = ""
        private var eventTypeSlug: String = ""
        private var started = false

        companion object {
            private const val HTTP_CONFLICT = 409
        }

        fun start(args: WaitlistJoinArgs) {
            if (started) return
            started = true
            slug = args.slug
            eventTypeSlug = args.eventTypeSlug
            _state.update {
                it.copy(hostName = args.hostName, windowLabel = args.windowLabel, timezoneLabel = args.timezoneLabel)
            }
        }

        fun setName(value: String) {
            _state.update { it.copy(name = value) }
        }

        fun setEmail(value: String) {
            _state.update { it.copy(email = value) }
        }

        fun setPreferredTime(value: String) {
            _state.update { it.copy(preferredTime = value) }
        }

        fun join() {
            val current = _state.value
            if (!current.canJoin) return
            _state.update { it.copy(joining = true, error = null) }
            viewModelScope.launch {
                val body =
                    PublicWaitlistJoinRequest(
                        email = current.email.trim(),
                        name = current.name.trim().ifBlank { null },
                    )
                when (val r = repo.publicJoinWaitlist(slug, eventTypeSlug, body)) {
                    is NetworkResult.Success -> _state.update { it.copy(joining = false, didJoin = true) }
                    is NetworkResult.Failure ->
                        if (r.error is NetworkError.ClientError && r.error.code == HTTP_CONFLICT) {
                            // 409: invitee is already on the waitlist (backend returns
                            // this when the phone/email matches an existing entry).
                            _state.update { it.copy(joining = false, alreadyJoined = true) }
                        } else {
                            _state.update { it.copy(joining = false, error = "Couldn't join the waitlist — try again.") }
                        }
                }
            }
        }
    }
