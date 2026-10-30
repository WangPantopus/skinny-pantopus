@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_sent

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.SentCard
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The nav argument: the sent card's id. */
const val MAIL_SENT_CARD_ID_KEY = "mailSentCardId"

/** A sent card's page. */
sealed interface MailSentCardState {
    data object Loading : MailSentCardState

    data class Loaded(
        val card: SentCard,
    ) : MailSentCardState

    /** Not the person's card, or taken back: it isn't in Sent. */
    data class Gone(
        val message: String,
    ) : MailSentCardState

    data class Error(
        val message: String,
    ) : MailSentCardState
}

/**
 * A card the person sent, from Sent (launch key `mailbox`; drawings `M3-SentCard`, `M4-SentEmail`): its envelope, both
 * sides with their own note (also while it's sealed), its trail, and Take it back while it can be. Reads
 * `GET /api/mailbox/sent/:id`; takes back `POST /api/mailbox/cards/:id/take-back`, then the page closes.
 */
@HiltViewModel
class MailSentCardViewModel
    @Inject
    constructor(
        private val cards: HolidayCardsRepository,
        private val network: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val id: String = savedStateHandle.get<String>(MAIL_SENT_CARD_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<MailSentCardState>(MailSentCardState.Loading)
        val state: StateFlow<MailSentCardState> = _state.asStateFlow()

        private val _takingBack = MutableStateFlow(false)
        val takingBack: StateFlow<Boolean> = _takingBack.asStateFlow()

        private val _takeBackError = MutableStateFlow<String?>(null)

        /** Why it couldn't be taken back (too late: the server's sentence); the card stays. */
        val takeBackError: StateFlow<String?> = _takeBackError.asStateFlow()

        private val closes = Channel<Unit>(Channel.CONFLATED)

        /** Taken back: the page closes, back to Sent, where it's gone. */
        val closed: Flow<Unit> = closes.receiveAsFlow()

        fun load() {
            if (_state.value is MailSentCardState.Loaded) return
            read()
        }

        /** Try again, and after a take-back that came too late (its trail and status moved on). */
        fun read() {
            if (_state.value !is MailSentCardState.Loaded) _state.value = MailSentCardState.Loading
            viewModelScope.launch {
                _state.value =
                    when (val result = cards.sentCard(id)) {
                        is NetworkResult.Success -> MailSentCardState.Loaded(result.data)
                        is NetworkResult.Failure ->
                            if (result.error is NetworkError.NotFound) {
                                MailSentCardState.Gone("This card isn’t here any more.")
                            } else {
                                MailSentCardState.Error(result.error.mailMessage(online = network.isOnline.value, doing = "load your card"))
                            }
                    }
            }
        }

        /** Take it back (confirmed by the screen). */
        fun takeBack() {
            if (_takingBack.value) return
            _takingBack.value = true
            _takeBackError.value = null
            viewModelScope.launch {
                when (val result = cards.takeBack(id)) {
                    is NetworkResult.Success -> closes.trySend(Unit)
                    is NetworkResult.Failure -> {
                        _takeBackError.value =
                            when (result.error) {
                                is NetworkError.NotFound -> "This card isn’t here any more."
                                else -> result.error.mailMessage(online = network.isOnline.value, doing = "take your card back")
                            }
                        read()
                    }
                }
                _takingBack.value = false
            }
        }
    }
