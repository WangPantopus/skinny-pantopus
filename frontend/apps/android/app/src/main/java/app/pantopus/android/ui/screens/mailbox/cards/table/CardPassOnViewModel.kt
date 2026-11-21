@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.CardPassOnBody
import app.pantopus.android.data.api.models.mailbox.HolidayCardRecipient
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.cards.CardRecipient
import app.pantopus.android.ui.screens.mailbox.cards.CardSearch
import app.pantopus.android.ui.screens.mailbox.cards.serverCode
import app.pantopus.android.ui.screens.mailbox.cards.takeLetters
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/** Passing a travelling card on (travelling card plan Part 4): the journey as read, and the pass-on being written or sent. */
data class CardPassOnState(
    /** This reader's card's journey as last read; null when it doesn't travel or the server's switch is off. */
    val travel: CardTravel? = null,
    /** The sheet is up over the table. */
    val open: Boolean = false,
    /** Who gets it next, once chosen. */
    val to: CardRecipient? = null,
    /** "Who gets it next" shows the email address field instead of the name search. */
    val byEmail: Boolean = false,
    val email: String = "",
    val query: String = "",
    val search: CardSearch = CardSearch.Idle,
    val message: String = "",
    /** "Send it on" is running the server's checks. */
    val checking: Boolean = false,
    /** Why it can't go, in the server's words, on the sheet. */
    val problem: String? = null,
    /** The checks passed: the table shows the sealing moment, as for a card. */
    val sealing: Boolean = false,
    val sending: Boolean = false,
    /** Refusals at the seal, so each is told once; and the last one's words. */
    val refusals: Int = 0,
    val refusal: String? = null,
    /** On its way. */
    val sent: SentHolidayCard? = null,
    val takingBack: Boolean = false,
    /** "Where does it start?" is up: the passer has no town yet (decision D4). */
    val askTown: Boolean = false,
    /** The postmark this pass-on strikes, from its checks: the sealing table strikes it last. */
    val postmark: CardTravelStop? = null,
) {
    /** Places left to pass it to (decision D1: two). */
    val placesLeft: Int get() = travel?.placesLeft ?: 0
}

/**
 * Pass it on (travelling card plan Part 4): the same card goes on, free, with a note from its reader, to a person, an
 * email address or by link. Checks with `POST /api/mailbox/cards/:id/pass-on/preview`, sends at the seal with
 * `POST …/pass-on` (one request ID per draft), takes back with `POST /api/mailbox/cards/:passed/pass-on/take-back`, and
 * reads the card's journey again (`GET /api/mailbox/:id`) after each, so the button knows the places left.
 */
@HiltViewModel
@Suppress("TooManyFunctions")
class CardPassOnViewModel
    @Inject
    constructor(
        private val cards: HolidayCardsRepository,
        private val mailbox: MailboxRepository,
        private val network: NetworkMonitor,
    ) : ViewModel() {
        private val _state = MutableStateFlow(CardPassOnState())
        val state: StateFlow<CardPassOnState> = _state.asStateFlow()

        private var cardId: String? = null
        private var requestId: String? = null
        private val typed = MutableStateFlow("")

        init {
            // The name search, a quarter second after the typing stops, as "Who it's for" does.
            viewModelScope.launch {
                typed.collectLatest { raw ->
                    val q = raw.trim()
                    if (q.length < 2) {
                        _state.update { it.copy(search = CardSearch.Idle) }
                        return@collectLatest
                    }
                    delay(SEARCH_PAUSE_MS)
                    _state.update { it.copy(search = CardSearch.Looking) }
                    val found =
                        when (val result = cards.searchPeople(q)) {
                            is NetworkResult.Success -> CardSearch.Found(result.data)
                            is NetworkResult.Failure -> CardSearch.Failed(result.error.mailMessage(online = online(), doing = "search"))
                        }
                    _state.update { it.copy(search = found) }
                }
            }
        }

        /** The card on this page and its journey as the piece came ([travel]); once per card. */
        fun load(
            id: String,
            travel: CardTravel?,
        ) {
            if (cardId == id) return
            cardId = id
            requestId = null
            _state.value = CardPassOnState(travel = travel)
        }

        /** "Pass it on": the sheet comes up; the sender's town is read for its line. */
        fun open() {
            _state.update { it.copy(open = true, problem = null) }
            viewModelScope.launch { cards.loadIfNeeded() }
        }

        /** ✕ or Back: the sheet goes; what's written stays for the next time on this visit. */
        fun close() {
            _state.update { it.copy(open = false, problem = null, sealing = false, askTown = false) }
        }

        fun onQuery(text: String) {
            _state.update { it.copy(query = text) }
            typed.value = text
        }

        fun showEmail(show: Boolean) {
            _state.update { it.copy(byEmail = show, problem = null) }
        }

        fun onEmail(text: String) {
            _state.update { it.copy(email = text.trim(), problem = null) }
        }

        /** Who gets it next: a person from the search, the address typed, or a link. A new choice is a new draft. */
        fun choose(to: CardRecipient) {
            if (_state.value.to != to) requestId = null
            _state.update { it.copy(to = to, problem = null, byEmail = false) }
        }

        /** "Change": back to choosing who gets it. */
        fun changeTo() {
            _state.update { it.copy(to = null, problem = null) }
        }

        fun onMessage(text: String) {
            _state.update { it.copy(message = text.takeLetters(PASS_ON_LIMIT), problem = null) }
        }

        /** "Send it on": the server's checks first; then the table seals it by hand. No town yet: it's asked for. */
        fun sendItOn() {
            val id = cardId ?: return
            val draft = _state.value
            val body = body(draft) ?: return
            if (draft.checking || draft.sending) return
            if (HolidayCardsRepository.latest.value?.travel?.let { it.town.isNullOrBlank() } == true) {
                _state.update { it.copy(askTown = true) }
                return
            }
            _state.update { it.copy(checking = true, problem = null) }
            viewModelScope.launch {
                when (val result = cards.passOnPreview(id, body)) {
                    is NetworkResult.Success -> {
                        val strikes = result.data.passOn.postmark?.let { CardTravelStop(it.town, it.state, it.on) }
                        _state.update { it.copy(checking = false, sealing = true, refusals = 0, refusal = null, postmark = strikes) }
                    }
                    is NetworkResult.Failure ->
                        if (result.error.serverCode() == NEEDS_TOWN) {
                            _state.update { it.copy(checking = false, askTown = true) }
                        } else {
                            _state.update { it.copy(checking = false, problem = words(result.error, "check your card")) }
                        }
                }
            }
        }

        /** The town was kept: "Send it on" goes on. */
        fun townKept() {
            _state.update { it.copy(askTown = false) }
            sendItOn()
        }

        /** "Where does it start?" closed without a town: nothing goes, the sheet stays. */
        fun townDismissed() {
            _state.update { it.copy(askTown = false) }
        }

        /** The seal is the send (the draft's request ID, so a second press sends nothing more). */
        fun seal() {
            val id = cardId ?: return
            val draft = _state.value
            val body = body(draft) ?: return
            if (draft.sending) return
            _state.update { it.copy(sending = true) }
            viewModelScope.launch {
                when (val result = cards.passOn(id, body)) {
                    is NetworkResult.Success -> {
                        requestId = null
                        _state.update { it.copy(sending = false, sent = result.data) }
                        readJourney(id)
                    }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(sending = false, refusals = it.refusals + 1, refusal = words(result.error, "pass your card on"))
                        }
                }
            }
        }

        /** Back from the sealing moment before it's sent: the sheet again, as it was. */
        fun backFromSeal() {
            _state.update { it.copy(sealing = false, refusals = 0, refusal = null) }
        }

        /** Done once it's gone: the table again, its button telling the places left. */
        fun finish() {
            _state.update {
                it.copy(open = false, sealing = false, sent = null, to = null, query = "", email = "", message = "", refusals = 0)
            }
        }

        /** "Take it back" before the pickup (by email or link: before it's opened): the place is free again. */
        fun takeBack() {
            val id = cardId ?: return
            val passed = _state.value.sent ?: return
            if (_state.value.takingBack) return
            _state.update { it.copy(takingBack = true) }
            viewModelScope.launch {
                when (val result = cards.takeBackPassOn(passed.id)) {
                    is NetworkResult.Success -> {
                        _state.update { it.copy(takingBack = false, sent = null, sealing = false, open = true) }
                        readJourney(id)
                    }
                    is NetworkResult.Failure ->
                        _state.update { it.copy(takingBack = false, refusal = words(result.error, "take your card back")) }
                }
            }
        }

        /** The card's journey read again: places left and who has it. */
        private suspend fun readJourney(id: String) {
            val read = mailbox.detail(id)
            if (read is NetworkResult.Success) {
                val travel = read.data.mail.card?.travel?.let(CardTravel::of)
                _state.update { it.copy(travel = travel ?: it.travel) }
            }
        }

        /** The pass-on as it goes: who, the note, the saved signature, this draft's request ID, and the next free place. */
        private fun body(draft: CardPassOnState): CardPassOnBody? {
            val to = draft.to ?: return null
            if (draft.message.isBlank()) return null
            val request = requestId ?: UUID.randomUUID().toString().also { requestId = it }
            return CardPassOnBody(
                to =
                    HolidayCardRecipient(
                        userId = (to as? CardRecipient.Person)?.userId,
                        email = (to as? CardRecipient.Email)?.email,
                        link = true.takeIf { to is CardRecipient.Link },
                    ),
                message = draft.message.trim(),
                signature = HolidayCardsRepository.latest.value?.signature?.saved?.takeIf { it.drawable },
                requestId = request,
                place = draft.travel?.nextPlace ?: 1,
            )
        }

        /** The server's plain words for a refusal, or what went wrong reaching it. */
        private fun words(
            error: NetworkError,
            doing: String,
        ): String =
            when (error) {
                is NetworkError.Forbidden -> error.reason ?: error.mailMessage(online = online(), doing = doing)
                else -> error.mailMessage(online = online(), doing = doing)
            }

        private fun online(): Boolean = network.isOnline.value

        private companion object {
            /** The note on the back: the card's own limit. */
            const val PASS_ON_LIMIT = 300
            const val SEARCH_PAUSE_MS = 250L
            const val NEEDS_TOWN = "CARD_TRAVEL_NEEDS_TOWN"
        }
    }
