@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.routing_queue

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.PendingItemDto
import app.pantopus.android.data.api.models.mailbox.v2.ResolveRoutingRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.screens.homes.invite_owner.ToastPayload
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The three drawers `POST /api/mailbox/v2/resolve` accepts
 * (`resolveRoutingSchema`, `backend/routes/mailboxV2.js:12`; privacy map at
 * `:568`). Labels / subtitles mirror RN `src/app/mailbox/disambiguate.tsx:86-88`.
 */
enum class MailRoutingDrawerOption(
    val backendKey: String,
    val label: String,
    val subtitle: String,
    val icon: PantopusIcon,
) {
    Personal("personal", "Me", "This is my personal mail", PantopusIcon.User),
    Home("home", "My Household", "Shared household mail", PantopusIcon.Home),
    Business("business", "My Business", "Business or company mail", PantopusIcon.Briefcase),
}

/** One queued item projected for the card. */
data class MailRoutingQueueEntry(
    val mailId: String,
    /** `MailRoutingQueue.recipient_name_raw` — the name the mail carries. */
    val recipientName: String,
    val senderDisplay: String,
    /** Subject / preview line. Empty → the preview row is hidden. */
    val previewText: String,
)

/** Render state for the routing queue. */
sealed interface MailRoutingQueueUiState {
    data object Loading : MailRoutingQueueUiState

    /** Nothing left to route — RN's "All clear" frame. */
    data object Empty : MailRoutingQueueUiState

    data class Loaded(
        val entry: MailRoutingQueueEntry,
        /** 1-based position of the current card. */
        val position: Int,
        val total: Int,
        val selection: MailRoutingDrawerOption? = null,
        val addAlias: Boolean = false,
        val isSubmitting: Boolean = false,
    ) : MailRoutingQueueUiState {
        /** "2 of 5" header counter. */
        val counterLabel: String get() = "$position of $total"

        /**
         * The alias row is only offered when routing to the personal drawer,
         * matching RN (`disambiguate.tsx:154`) and the backend, which only
         * writes a `MailAlias` row for the caller (`mailboxV2.js:589`).
         */
        val showsAliasToggle: Boolean get() = selection == MailRoutingDrawerOption.Personal

        /** Alias-toggle copy — RN `disambiguate.tsx:159`. */
        val aliasLabel: String get() = "Add “${entry.recipientName}” as my alias"

        val canSubmit: Boolean get() = selection != null && !isSubmitting

        fun isSelected(option: MailRoutingDrawerOption): Boolean = selection == option
    }

    data class Error(val message: String) : MailRoutingQueueUiState
}

/**
 * Mail routing queue — the disambiguation lane the Mailbox root's
 * "N items need routing" banner opens.
 *
 * Mail addressed to a name the auto-router can't map to a resident lands in
 * `MailRoutingQueue` (`backend/routes/mailboxV2.js:530`). This screen walks
 * that queue one item at a time:
 *  • `GET /api/mailbox/v2/pending` (`mailboxV2.js:612`) — the queue
 *  • `POST /api/mailbox/v2/resolve` (`mailboxV2.js:555`) — the answer
 *
 * Behaviour mirrors RN `src/app/mailbox/disambiguate.tsx`. This is a
 * different surface from [app.pantopus.android.ui.screens.mailbox.disambiguate.DisambiguateMailFormScreen]
 * (A13.15), which resolves a single already-known mail id from a scanned
 * envelope; this one owns the queue.
 */
@HiltViewModel
class MailRoutingQueueViewModel
    @Inject
    constructor(
        private val repo: MailboxRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<MailRoutingQueueUiState>(MailRoutingQueueUiState.Loading)
        val state: StateFlow<MailRoutingQueueUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<ToastPayload?>(null)
        val toast: StateFlow<ToastPayload?> = _toast.asStateFlow()

        private val _shouldDismiss = MutableStateFlow(false)

        /** Flips true once the queue is drained so the host can pop. */
        val shouldDismiss: StateFlow<Boolean> = _shouldDismiss.asStateFlow()

        private var queue: List<PendingItemDto> = emptyList()
        private var index: Int = 0

        fun load() {
            _state.value = MailRoutingQueueUiState.Loading
            fetch()
        }

        fun refresh() = fetch()

        private fun fetch() {
            viewModelScope.launch {
                when (val result = repo.pending()) {
                    is NetworkResult.Success -> {
                        queue = result.data.pending
                        index = 0
                        applyCurrent()
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            MailRoutingQueueUiState.Error(
                                result.error.displayMessage("Couldn't load the routing queue."),
                            )
                }
            }
        }

        fun select(option: MailRoutingDrawerOption) {
            _state.update { current ->
                if (current !is MailRoutingQueueUiState.Loaded) {
                    current
                } else {
                    current.copy(
                        selection = option,
                        addAlias = if (option == MailRoutingDrawerOption.Personal) current.addAlias else false,
                    )
                }
            }
        }

        fun setAddAlias(value: Boolean) {
            _state.update { current ->
                if (current is MailRoutingQueueUiState.Loaded) current.copy(addAlias = value) else current
            }
        }

        fun dismissToast() {
            _toast.value = null
        }

        fun acknowledgeDismiss() {
            _shouldDismiss.value = false
        }

        /**
         * Resolve the current item, then advance to the next one (or signal
         * dismissal once the queue is drained) — RN `disambiguate.tsx:34-56`.
         */
        fun submit() {
            val current = _state.value as? MailRoutingQueueUiState.Loaded ?: return
            val selection = current.selection ?: return
            if (current.isSubmitting) return
            _state.value = current.copy(isSubmitting = true)
            val wantsAlias = selection == MailRoutingDrawerOption.Personal && current.addAlias
            val request =
                ResolveRoutingRequest(
                    mailId = current.entry.mailId,
                    drawer = selection.backendKey,
                    addAlias = if (wantsAlias) true else null,
                    aliasString = if (wantsAlias) current.entry.recipientName else null,
                )
            viewModelScope.launch {
                when (val result = repo.resolve(request)) {
                    is NetworkResult.Success -> advance()
                    is NetworkResult.Failure -> {
                        _state.value = current.copy(isSubmitting = false)
                        _toast.value =
                            ToastPayload(
                                result.error.displayMessage("Failed to resolve routing"),
                                isError = true,
                            )
                    }
                }
            }
        }

        private fun advance() {
            if (index < queue.size - 1) {
                index += 1
                applyCurrent()
            } else {
                // Last item resolved — RN pops back to the mailbox.
                _shouldDismiss.value = true
            }
        }

        private fun applyCurrent() {
            val item = queue.getOrNull(index)
            _state.value =
                if (item == null) {
                    MailRoutingQueueUiState.Empty
                } else {
                    MailRoutingQueueUiState.Loaded(
                        entry = project(item),
                        position = index + 1,
                        total = queue.size,
                    )
                }
        }

        companion object {
            internal fun project(item: PendingItemDto): MailRoutingQueueEntry {
                val mail = item.mail
                val preview =
                    listOfNotNull(mail?.previewText, mail?.content, mail?.subject)
                        .map { it.trim() }
                        .firstOrNull { it.isNotEmpty() }
                        .orEmpty()
                val sender =
                    listOfNotNull(mail?.senderDisplay, mail?.senderBusinessName)
                        .map { it.trim() }
                        .firstOrNull { it.isNotEmpty() }
                        ?: "Unknown sender"
                return MailRoutingQueueEntry(
                    mailId = item.mailId,
                    recipientName = item.recipientNameRaw?.trim()?.takeIf { it.isNotEmpty() } ?: "this address",
                    senderDisplay = sender,
                    previewText = preview,
                )
            }
        }
    }
