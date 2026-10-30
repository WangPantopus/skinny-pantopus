@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.identity.LocalProfileRepository
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The four steps, and the card on its way. */
enum class SendCardStep(
    val title: String,
) {
    To("Who it’s for"),
    Pick("Pick a card"),
    Write("Write on the back"),
    Seal("Seal it for the day"),
    Sent("On its way"),
    ;

    companion object {
        val steps = listOf(To, Pick, Write, Seal)
    }
}

/** Who a card goes to: a person found by name, or an email address for someone not on Pantopus. */
sealed interface CardRecipient {
    /** Their name, or the address. */
    val label: String

    data class Person(
        val userId: String,
        val name: String,
    ) : CardRecipient {
        override val label: String get() = name

        val firstName: String get() = name.trim().split(Regex("\\s+")).firstOrNull()?.takeIf { it.isNotEmpty() } ?: name
    }

    data class Email(
        val email: String,
    ) : CardRecipient {
        override val label: String get() = email
    }
}

/** Reading the cards: the season's pictures and today's card. */
sealed interface SendCardLoad {
    data object Loading : SendCardLoad

    data object Done : SendCardLoad

    data class Failed(
        val message: String,
    ) : SendCardLoad
}

/** The name search: under two letters, looking, what it found, or what went wrong. */
sealed interface CardSearch {
    data object Idle : CardSearch

    data object Looking : CardSearch

    data class Found(
        val people: List<MailRecipientDto>,
    ) : CardSearch

    data class Failed(
        val message: String,
    ) : CardSearch
}

/** Where the person is in sending today's card, and what they've chosen so far. */
data class SendCardForm(
    val step: SendCardStep = SendCardStep.To,
    /** Step 1 shows the email address field instead of the name search. */
    val byEmail: Boolean = false,
    val email: String = "",
    val to: CardRecipient? = null,
    val design: String? = null,
    val message: String = "",
    val arrival: String? = null,
    /** The card just sent ("On its way"). */
    val sent: SentHolidayCard? = null,
    val sending: Boolean = false,
    val sendError: String? = null,
    val takingBack: Boolean = false,
    val takeBackError: String? = null,
    /** "You took your card back. You can send a card again today." */
    val tookBack: Boolean = false,
)

/**
 * Send a Christmas card (launch keys `holiday_cards` + `mailbox`; Draft 1's flow around the founder's pictures): who
 * it's for → pick a card → write on the back → seal it for the day. One card a day: once it's sent, this shows today's
 * card, which can be taken back until the 7 a.m. pickup (by email: until they open it).
 *
 * Reads `GET /api/mailbox/cards`; searches `GET /api/mailbox/compose/recipients?people=1`; sends `POST
 * /api/mailbox/cards`; takes back `POST /api/mailbox/cards/:id/take-back`.
 */
@HiltViewModel
class SendCardViewModel
    @Inject
    constructor(
        private val repo: HolidayCardsRepository,
        private val auth: AuthRepository,
        private val network: NetworkMonitor,
        private val localProfiles: LocalProfileRepository,
    ) : ViewModel() {
        /** The season and today's card, as last read (shared with the Mailbox's row). */
        val cards: StateFlow<HolidayCardsResponse?> = repo.latest

        private val _load = MutableStateFlow<SendCardLoad>(SendCardLoad.Loading)
        val load: StateFlow<SendCardLoad> = _load.asStateFlow()

        private val _form = MutableStateFlow(SendCardForm())
        val form: StateFlow<SendCardForm> = _form.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _search = MutableStateFlow<CardSearch>(CardSearch.Idle)
        val search: StateFlow<CardSearch> = _search.asStateFlow()

        private val _fromName =
            MutableStateFlow(
                (auth.state.value as? AuthRepository.State.SignedIn)?.user?.displayName?.takeIf { it.isNotBlank() } ?: "You",
            )

        /**
         * Printed on the back ("FROM …") and on the envelope: the name neighbors see (the Local Profile's), which the card
         * carries to the person it's for; the account's name until that's read.
         */
        val fromName: StateFlow<String> = _fromName.asStateFlow()

        init {
            viewModelScope.launch {
                val profile = (localProfiles.me() as? NetworkResult.Success)?.data?.profile
                profile?.displayName?.takeIf { it.isNotBlank() }?.let { _fromName.value = it }
            }
            // The name search, a quarter second after the typing stops.
            viewModelScope.launch {
                _query.collectLatest { raw ->
                    val query = raw.trim()
                    if (query.length < 2) {
                        _search.value = CardSearch.Idle
                        return@collectLatest
                    }
                    delay(SEARCH_PAUSE_MS)
                    _search.value = CardSearch.Looking
                    _search.value =
                        when (val result = repo.searchPeople(query)) {
                            is NetworkResult.Success -> CardSearch.Found(result.data)
                            is NetworkResult.Failure ->
                                CardSearch.Failed(result.error.mailMessage(online = network.isOnline.value, doing = "search"))
                        }
                }
            }
            reload()
        }

        /** Read the cards again (and Try again). */
        fun reload() {
            if (cards.value == null) _load.value = SendCardLoad.Loading
            viewModelScope.launch {
                _load.value =
                    when (val result = repo.load()) {
                        is NetworkResult.Success -> SendCardLoad.Done
                        is NetworkResult.Failure ->
                            SendCardLoad.Failed(
                                if (result.error is NetworkError.NotFound) {
                                    "Christmas cards aren’t open right now."
                                } else {
                                    result.error.mailMessage(online = network.isOnline.value, doing = "load the Christmas cards")
                                },
                            )
                    }
            }
        }

        fun onQueryChange(text: String) {
            _query.value = text
        }

        fun showEmail(show: Boolean) {
            _form.update { it.copy(byEmail = show) }
        }

        fun onEmailChange(text: String) {
            _form.update { it.copy(email = text) }
        }

        /** Step 1 done: a person from the search, or the address typed. */
        fun choose(to: CardRecipient) {
            _form.update { it.copy(to = to, step = SendCardStep.Pick, tookBack = false, arrival = arrivalFor(to, it.arrival)) }
        }

        fun chooseEmail() {
            val email = _form.value.email.trim()
            if (EMAIL.matches(email)) choose(CardRecipient.Email(email))
        }

        fun chooseDesign(design: String) {
            _form.update { it.copy(design = design) }
        }

        /** The note, cut at the card's letter limit. */
        fun onMessageChange(text: String) {
            val limit = cards.value?.messageLimit ?: DEFAULT_LIMIT
            _form.update { it.copy(message = text.takeLetters(limit)) }
        }

        fun chooseArrival(arrival: String) {
            _form.update { it.copy(arrival = arrival, sendError = null) }
        }

        /** "Write on this card", "Seal it": the next step once this one is done. */
        fun next() {
            _form.update { form ->
                when {
                    form.step == SendCardStep.Pick && form.design != null -> form.copy(step = SendCardStep.Write)
                    form.step == SendCardStep.Write && form.message.isNotBlank() -> form.copy(step = SendCardStep.Seal)
                    else -> form
                }
            }
        }

        /** The back arrow: the step before; false when there's none (leave the flow). */
        fun back(): Boolean {
            val form = _form.value
            val index = SendCardStep.steps.indexOf(form.step)
            if (index <= 0) return false
            _form.value = form.copy(step = SendCardStep.steps[index - 1], sendError = null)
            return true
        }

        /** Seal and send. */
        fun send() {
            val form = _form.value
            val to = form.to ?: return
            val design = form.design ?: return
            val arrival = form.arrival ?: return
            if (form.sending || form.message.isBlank()) return
            _form.value = form.copy(sending = true, sendError = null)
            viewModelScope.launch {
                val result =
                    repo.send(
                        design = design,
                        message = form.message.trim(),
                        arrival = arrival,
                        toUserId = (to as? CardRecipient.Person)?.userId,
                        toEmail = (to as? CardRecipient.Email)?.email,
                    )
                _form.update {
                    when (result) {
                        is NetworkResult.Success -> it.copy(sending = false, sent = result.data, step = SendCardStep.Sent)
                        is NetworkResult.Failure -> it.copy(sending = false, sendError = sendMessage(result.error))
                    }
                }
            }
        }

        /** Take it back (confirmed by the screen): the day's card is free again, and the flow starts over. */
        fun takeBack() {
            val form = _form.value
            val card = form.sent ?: cards.value?.todaysCard ?: return
            if (form.takingBack) return
            _form.value = form.copy(takingBack = true, takeBackError = null)
            viewModelScope.launch {
                when (val result = repo.takeBack(card.id)) {
                    is NetworkResult.Success -> {
                        _query.value = ""
                        _form.value = SendCardForm(tookBack = true)
                    }
                    is NetworkResult.Failure ->
                        _form.update { it.copy(takingBack = false, takeBackError = takeBackMessage(result.error)) }
                }
            }
        }

        /** The arrival choices depend on who it's for; keep the chosen one when it's open, else the first. */
        private fun arrivalFor(
            to: CardRecipient,
            current: String?,
        ): String? {
            val arrivals = cards.value?.arrivals ?: return current
            val options = if (to is CardRecipient.Email) arrivals.email else arrivals.person
            return current?.takeIf { it in options } ?: options.firstOrNull()
        }

        /** The server's own sentence when it sent one (a card that can't go yet, a limit), else what went wrong. */
        private fun sendMessage(error: NetworkError): String =
            when (error) {
                is NetworkError.NotFound -> "We couldn’t find that person. Search for them again."
                is NetworkError.Forbidden -> error.reason ?: "You can’t send a card to this person."
                else -> error.mailMessage(online = network.isOnline.value, doing = "send your card")
            }

        private fun takeBackMessage(error: NetworkError): String =
            when (error) {
                is NetworkError.NotFound -> "This card isn’t here any more."
                else -> error.mailMessage(online = network.isOnline.value, doing = "take your card back")
            }

        companion object {
            /** An address that can take an email: the web's check, so the server's own check doesn't refuse it. */
            val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$")

            private const val SEARCH_PAUSE_MS = 250L
            private const val DEFAULT_LIMIT = 300
        }
    }

/** How many letters [this] has, counting an emoji or an accented letter once (the server counts the same way). */
fun String.letterCount(): Int = codePointCount(0, length)

/** The first [limit] letters of [this]. */
fun String.takeLetters(limit: Int): String = if (letterCount() <= limit) this else substring(0, offsetByCodePoints(0, limit))
