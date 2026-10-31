@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivalsFor
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreview
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
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject

/** The five steps, and the card on its way. */
enum class SendCardStep(
    val title: String,
) {
    To("Who it’s for"),
    Pick("Pick a card"),
    Write("Write on the back"),
    Seal("Seal it for the day"),
    Look("Look it over"),
    Sent("On its way"),
    ;

    companion object {
        val steps = listOf(To, Pick, Write, Seal, Look)
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
    /** When a card to the person chosen can come, by their clock; null until read (the sender's next morning stands in). */
    val theirs: HolidayCardArrivalsFor? = null,
    /** Step 5: the card exactly as the other person will see it. */
    val preview: HolidayCardPreview? = null,
    /** Step 4's "Look it over" is reading the preview. */
    val previewing: Boolean = false,
    /** Why step 4 couldn't go on: the preview's refusal, or a choice that closed while the card was being looked over. */
    val sealError: String? = null,
    /** The card just sent ("On its way"). */
    val sent: SentHolidayCard? = null,
    val sending: Boolean = false,
    /** Why "Seal and send" didn't send it (shown on step 5). */
    val sendError: String? = null,
    val takingBack: Boolean = false,
    val takeBackError: String? = null,
    /** "You took your card back. You can send a card again today." */
    val tookBack: Boolean = false,
)

/**
 * Send a Christmas card (launch keys `holiday_cards` + `mailbox`; Draft 1's flow around the founder's pictures): who
 * it's for → pick a card → write on the back → seal it for the day → look it over, exactly as the other person will see
 * it, and seal and send it from there. One card a day: once it's sent, this shows today's card, which can be taken back
 * until the 7 a.m. pickup (by email: until they open it). What's chosen so far outlives the screen (Android letting go
 * of it in the background, or of the whole app): the flow comes back on the same step.
 *
 * Reads `GET /api/mailbox/cards`; searches `GET /api/mailbox/compose/recipients?people=1`; looks it over with `POST
 * /api/mailbox/cards/preview`; sends `POST /api/mailbox/cards`; takes back `POST /api/mailbox/cards/:id/take-back`.
 */
@HiltViewModel
@Suppress("TooManyFunctions")
class SendCardViewModel
    @Inject
    constructor(
        private val repo: HolidayCardsRepository,
        private val auth: AuthRepository,
        private val network: NetworkMonitor,
        private val localProfiles: LocalProfileRepository,
        private val saved: SavedStateHandle,
    ) : ViewModel() {
        /** The season and today's card, as last read (shared with the Mailbox's row). */
        val cards: StateFlow<HolidayCardsResponse?> = repo.latest

        private val _load = MutableStateFlow<SendCardLoad>(SendCardLoad.Loading)
        val load: StateFlow<SendCardLoad> = _load.asStateFlow()

        private val _form = MutableStateFlow(restoredForm())
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

        private var theirsJob: Job? = null

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
            // Back after Android let go of the screen on step 5: it's read again from step 4.
            val lookAgain = saved.get<String>(KEY_STEP) == SendCardStep.Look.name
            // What's chosen so far, kept with the screen's saved state.
            viewModelScope.launch { _form.collect { save(it) } }
            reload()
            readTheirs()
            if (lookAgain) look()
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
            _form.update {
                val theirs = it.theirs.takeIf { _ -> it.to == to }
                it.copy(to = to, step = SendCardStep.Pick, tookBack = false, theirs = theirs, arrival = arrivalFor(to, it.arrival, theirs))
            }
            readTheirs()
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

        /** When a card to the person chosen can come, by their clock. A failure keeps the sender's next morning. */
        private fun readTheirs() {
            val person = _form.value.to as? CardRecipient.Person ?: return
            theirsJob?.cancel()
            theirsJob =
                viewModelScope.launch {
                    val theirs = (repo.arrivalsFor(person.userId) as? NetworkResult.Success)?.data ?: return@launch
                    _form.update { form ->
                        if (form.to != person) {
                            form
                        } else {
                            form.copy(theirs = theirs, arrival = arrivalFor(person, form.arrival, theirs))
                        }
                    }
                }
        }

        fun chooseArrival(arrival: String) {
            _form.update { it.copy(arrival = arrival, sendError = null, sealError = null) }
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
            // Read their day again on the last step: it moves on at 7 a.m. where they live.
            if (_form.value.step == SendCardStep.Seal) readTheirs()
        }

        /** The back arrow: the step before, with everything chosen kept; false when there's none (leave the flow). */
        fun back(): Boolean {
            val form = _form.value
            val index = SendCardStep.steps.indexOf(form.step)
            if (index <= 0) return false
            _form.value = form.copy(step = SendCardStep.steps[index - 1], preview = null, sendError = null, sealError = null)
            return true
        }

        /**
         * Step 4's "Look it over": the card exactly as the other person will see it, after every check sending runs
         * (nothing is sent). A refusal stays on step 4 with the server's sentence.
         */
        fun look() {
            val form = _form.value
            val to = form.to ?: return
            val design = form.design ?: return
            val arrival = form.arrival ?: return
            if (form.previewing || form.sending || form.message.isBlank()) return
            _form.value = form.copy(previewing = true, sealError = null)
            viewModelScope.launch {
                val result =
                    repo.preview(
                        design = design,
                        message = form.message.trim(),
                        arrival = arrival,
                        toUserId = (to as? CardRecipient.Person)?.userId,
                        toEmail = (to as? CardRecipient.Email)?.email,
                    )
                _form.update {
                    val same = it.step == SendCardStep.Seal && it.to == to && it.design == design && it.arrival == arrival
                    when {
                        // Back, or another choice, while it was read: only an answer for what's chosen now counts.
                        !same || it.message != form.message -> it.copy(previewing = false)
                        result is NetworkResult.Success ->
                            it.copy(previewing = false, preview = result.data, step = SendCardStep.Look, sendError = null)
                        result is NetworkResult.Failure ->
                            it.copy(previewing = false, sealError = sendMessage(result.error, doing = "show how your card will look"))
                        else -> it
                    }
                }
                if ((result as? NetworkResult.Failure)?.error?.serverCode() == ARRIVAL_CLOSED) readTheirs()
            }
        }

        /**
         * Step 5's "Seal and send". A refusal stays on step 5 with the server's sentence; a choice that closed meanwhile
         * (their 7 a.m. came) goes back to step 4 with why, and their day is read again.
         */
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
                val closed = (result as? NetworkResult.Failure)?.error?.serverCode() == ARRIVAL_CLOSED
                _form.update {
                    when {
                        result is NetworkResult.Success ->
                            it.copy(sending = false, sent = result.data, step = SendCardStep.Sent, preview = null)
                        result is NetworkResult.Failure && closed ->
                            it.copy(sending = false, step = SendCardStep.Seal, preview = null, sealError = sendMessage(result.error))
                        result is NetworkResult.Failure -> it.copy(sending = false, sendError = sendMessage(result.error))
                        else -> it
                    }
                }
                if (closed) readTheirs()
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

        /**
         * The arrival choices depend on who it's for (a person's by their clock once read); keep the chosen one when it's
         * open, else the first.
         */
        private fun arrivalFor(
            to: CardRecipient,
            current: String?,
            theirs: HolidayCardArrivalsFor?,
        ): String? {
            val arrivals = cards.value?.arrivals ?: return current
            val options = if (to is CardRecipient.Email) arrivals.email else (theirs?.arrivals ?: arrivals.person)
            return current?.takeIf { it in options } ?: options.firstOrNull()
        }

        /** The server's own sentence when it sent one (a card that can't go yet, a limit), else what went wrong. */
        private fun sendMessage(
            error: NetworkError,
            doing: String = "send your card",
        ): String =
            when (error) {
                is NetworkError.NotFound -> "We couldn’t find that person. Search for them again."
                is NetworkError.Forbidden -> error.reason ?: "You can’t send a card to this person."
                // The server's own check of the address is stricter than ours (it knows which endings an address can
                // have), and the address isn't on this step: say where to fix it, as the web does.
                else ->
                    if (error.refusedField() == "to.email") {
                        "That email address doesn’t look right. Go back to “Who it’s for” and check it."
                    } else {
                        error.mailMessage(online = network.isOnline.value, doing = doing)
                    }
            }

        /**
         * The flow as it was saved with the screen: the same step, or the step before it when that step needs what isn't
         * saved (step 5 is read again from step 4; a card just sent shows as today's card).
         */
        private fun restoredForm(): SendCardForm {
            val email = saved.get<String>(KEY_EMAIL).orEmpty()
            val to =
                saved.get<String>(KEY_TO_USER)?.let { CardRecipient.Person(it, saved.get<String>(KEY_TO_NAME).orEmpty()) }
                    ?: saved.get<String>(KEY_TO_EMAIL)?.let { CardRecipient.Email(it) }
            val design = saved.get<String>(KEY_DESIGN)
            val message = saved.get<String>(KEY_MESSAGE).orEmpty()
            val step =
                when (saved.get<String>(KEY_STEP)) {
                    SendCardStep.Pick.name -> SendCardStep.Pick
                    SendCardStep.Write.name -> SendCardStep.Write
                    SendCardStep.Seal.name, SendCardStep.Look.name -> SendCardStep.Seal
                    else -> SendCardStep.To
                }
            val reachable =
                when {
                    to == null -> SendCardStep.To
                    design == null -> minOf(step, SendCardStep.Pick)
                    message.isBlank() -> minOf(step, SendCardStep.Write)
                    else -> step
                }
            return SendCardForm(
                step = reachable,
                byEmail = saved.get<Boolean>(KEY_BY_EMAIL) == true,
                email = email,
                to = to.takeIf { reachable != SendCardStep.To },
                design = design,
                message = message,
                arrival = saved.get<String>(KEY_ARRIVAL),
            )
        }

        private fun save(form: SendCardForm) {
            // A card on its way isn't a draft any more: the server's today's card shows it.
            val step = if (form.step == SendCardStep.Sent) SendCardStep.To else form.step
            saved[KEY_STEP] = step.name
            saved[KEY_BY_EMAIL] = form.byEmail
            saved[KEY_EMAIL] = form.email
            saved[KEY_TO_USER] = (form.to as? CardRecipient.Person)?.userId
            saved[KEY_TO_NAME] = (form.to as? CardRecipient.Person)?.name
            saved[KEY_TO_EMAIL] = (form.to as? CardRecipient.Email)?.email
            saved[KEY_DESIGN] = form.design.takeIf { form.step != SendCardStep.Sent }
            saved[KEY_MESSAGE] = form.message.takeIf { form.step != SendCardStep.Sent }
            saved[KEY_ARRIVAL] = form.arrival.takeIf { form.step != SendCardStep.Sent }
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

            /** The arrival chosen closed meanwhile (their 7 a.m. came): step 4 offers what's open now. */
            private const val ARRIVAL_CLOSED = "CARD_ARRIVAL_CLOSED"

            private const val KEY_STEP = "sendCard.step"
            private const val KEY_BY_EMAIL = "sendCard.byEmail"
            private const val KEY_EMAIL = "sendCard.email"
            private const val KEY_TO_USER = "sendCard.toUser"
            private const val KEY_TO_NAME = "sendCard.toName"
            private const val KEY_TO_EMAIL = "sendCard.toEmail"
            private const val KEY_DESIGN = "sendCard.design"
            private const val KEY_MESSAGE = "sendCard.message"
            private const val KEY_ARRIVAL = "sendCard.arrival"
        }
    }

/** The machine code a refusal carried (`{ error, code }`), when the server sent one. */
private fun NetworkError.serverCode(): String? {
    val body =
        when (this) {
            is NetworkError.ClientError -> body
            is NetworkError.Server -> body
            else -> null
        } ?: return null
    return runCatching { JSONObject(body).optString("code") }.getOrNull()?.takeIf { it.isNotBlank() }
}

/** The field a refused request names first (`{ error, details: [{ field, message }] }`), when the server sent one. */
private fun NetworkError.refusedField(): String? {
    val body = (this as? NetworkError.ClientError)?.body ?: return null
    val detail = runCatching { JSONObject(body).optJSONArray("details")?.optJSONObject(0) }.getOrNull()
    return detail?.optString("field")?.takeIf { it.isNotBlank() }
}

/** How many letters [this] has, counting an emoji or an accented letter once (the server counts the same way). */
fun String.letterCount(): Int = codePointCount(0, length)

/** The first [limit] letters of [this]. */
fun String.takeLetters(limit: Int): String = if (letterCount() <= limit) this else substring(0, offsetByCodePoints(0, limit))
