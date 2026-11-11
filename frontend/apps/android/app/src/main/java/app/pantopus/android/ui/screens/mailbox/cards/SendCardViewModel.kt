@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mailbox.CardMediaFile
import app.pantopus.android.data.api.models.mailbox.CardSignature
import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivalsFor
import app.pantopus.android.data.api.models.mailbox.HolidayCardListPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardListRecipient
import app.pantopus.android.data.api.models.mailbox.HolidayCardListResult
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardRecipient
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardListBody
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardResponse
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.identity.LocalProfileRepository
import app.pantopus.android.data.mailbox.CardLook
import app.pantopus.android.data.mailbox.CardMediaUploads
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.cards.table.CardSignatureJson
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
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

    /** By a link: the first person to open it keeps the card (launch key `card_table`). */
    data object Link : CardRecipient {
        override val label: String = "whoever opens your link"
    }

    /** Two or more people or addresses (digital stamps on): a card each (`POST /api/mailbox/cards/batch`). */
    data class Several(
        val entries: List<CardRecipient>,
    ) : CardRecipient {
        override val label: String get() = listNames(entries.map { it.label })
    }
}

/** The same person or address, however it was typed. */
val CardRecipient.key: String
    get() =
        when (this) {
            is CardRecipient.Person -> "person:$userId"
            is CardRecipient.Email -> "email:${email.trim().lowercase()}"
            CardRecipient.Link -> "link"
            is CardRecipient.Several -> entries.joinToString(",") { it.key }
        }

/** "Maya and Theo", "Maya, Theo and 2 others". */
internal fun listNames(names: List<String>): String {
    if (names.size <= 2) return names.joinToString(" and ")
    val rest = names.size - 2
    return "${names[0]}, ${names[1]} and $rest ${if (rest == 1) "other" else "others"}"
}

/** The stamp books opened because a list's cards need more stamps than are left: "These 4 cards need 2 more stamps." */
data class StampShort(
    val cards: Int,
    val missing: Int,
)

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
    /** Signed beside FROM (plan 8.2); null: the first name typed in the pen. Sent with every look and retry. */
    val signature: CardSignature? = null,
    /** The card's own photo (memories plan step 4): uploading, stored, or refused; its stored file is saved with the screen. */
    val photo: CardPhotoDraft? = null,
    val arrival: String? = null,
    /** When a card to the person chosen can come, by their clock; null until read (the sender's next morning stands in). */
    val theirs: HolidayCardArrivalsFor? = null,
    /** Step 5: the card exactly as the other person will see it. */
    val preview: HolidayCardPreview? = null,
    /** Step 4's "Look it over" is reading the preview. */
    val previewing: Boolean = false,
    /**
     * Why step 4 couldn't go on: the preview's refusal, a choice that closed while the card was being looked over, or
     * why a card sent from step 4 didn't go.
     */
    val sealError: String? = null,
    /**
     * The server can't show the look (it doesn't have Look it over yet, or its answer can't be read): step 4 says so and
     * seals and sends itself. Each visit to step 4 asks for the look again.
     */
    val lookUnavailable: Boolean = false,
    /** The card just sent ("On its way"). */
    val sent: SentHolidayCard? = null,
    val sending: Boolean = false,
    /** Why "Seal and send" didn't send it (shown on step 5). */
    val sendError: String? = null,
    val takingBack: Boolean = false,
    val takeBackError: String? = null,
    /** "You took your card back. You can send a card again today." (with digital stamps: its stamp is back) */
    val tookBack: Boolean = false,
    /** A retry of a card that was taken back meanwhile: the server's sentence, on a new card's first step. */
    val takenBackNote: String? = null,
    /**
     * One request ID per card, sent with every look and retry of it (saved with the screen), so a send whose answer was
     * lost, or that OkHttp sent again by itself, is answered with the card it stored, never a second one. A new card
     * starts once this one is sent or taken back.
     */
    val requestId: String? = null,
    /** A list (digital stamps on): who's on it, in the order they were added. */
    val listed: List<CardRecipient> = emptyList(),
    /**
     * One request ID per person or address on the list (by [key]), kept for the whole card and saved with the screen,
     * so every look and retry of the list finds the cards it already sent.
     */
    val listIds: Map<String, String> = emptyMap(),
    /** The list's look (step 5): every card's line, and the first card as its person will see it. */
    val listPreview: HolidayCardListPreview? = null,
    /** What sending the list did, card by card (On its way). */
    val listResults: List<HolidayCardListResult>? = null,
    /** Cards taken back from On its way: their stamps came back. */
    val listTakenBack: Set<String> = emptySet(),
    val listTakingBack: String? = null,
    /** Why a card on the list couldn't be taken back: its id and the sentence. */
    val listTakeBackError: Pair<String, String>? = null,
) {
    /** The person or address on the list whose card has this request ID. */
    fun listEntry(requestId: String): CardRecipient? {
        val entries = (to as? CardRecipient.Several)?.entries ?: return null
        return entries.firstOrNull { listIds[it.key] == requestId }
    }

    /** What step 4 says under its choices: why the card didn't go, or that the look can't be shown. */
    val sealNotice: String? get() = sealError ?: LOOK_UNAVAILABLE.takeIf { lookUnavailable }

    /** What step 1 says about a card taken back, if anything; with digital stamps on ([postage]), its stamp came back. */
    fun backNote(postage: Boolean): String? = takenBackNote ?: (if (postage) TOOK_BACK_STAMP else TOOK_BACK).takeIf { tookBack }

    /** This form with its card's request ID, made now if it has none yet. */
    fun withRequestId(): SendCardForm = if (requestId != null) this else copy(requestId = UUID.randomUUID().toString())
}

/**
 * The card's own photo while the card is written (memories plan step 4): it uploads as soon as it's chosen. [local] is the
 * prepared picture on this phone, shown while it uploads (never kept after a relaunch); [stored] is the server's file once
 * it's there; [failed] is why it didn't upload (Try again or Remove: a card never goes without it by itself).
 */
data class CardPhotoDraft(
    val local: File? = null,
    val width: Int? = null,
    val height: Int? = null,
    val stored: CardMediaFile? = null,
    val progress: Float = 0f,
    val failed: String? = null,
    /** The description screen readers read, up to [PHOTO_ALT_LIMIT] letters. */
    val alt: String = "",
) {
    val ready: Boolean get() = stored != null
    val uploading: Boolean get() = stored == null && failed == null

    /** The photo as it goes with a look or a send; null until it's stored. */
    val fileId: String? get() = stored?.fileId

    /** The description as it goes: trimmed, or null when there's none. */
    val sentAlt: String? get() = alt.trim().takeIf { it.isNotEmpty() && stored != null }
}

/** The longest photo description the server takes. */
const val PHOTO_ALT_LIMIT = 200

/** Step 1 once a card was taken back from this flow. */
private const val TOOK_BACK = "You took your card back. You can send a card again today."

/** Step 1 once a card was taken back, with digital stamps on: the stamp it used is back. */
private const val TOOK_BACK_STAMP = "You took your card back, and its stamp is back with you."

/** Step 4 when the server can't show the look; "Seal and send" is then on step 4. */
private const val LOOK_UNAVAILABLE = "Pantopus can’t show how your card will look yet. You can still seal and send it."

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
        private val media: CardMediaUploads,
    ) : ViewModel() {
        /** The season and today's card, as last read (shared with the Mailbox's row). */
        val cards: StateFlow<HolidayCardsResponse?> = repo.latest

        private val _load = MutableStateFlow<SendCardLoad>(SendCardLoad.Loading)
        val load: StateFlow<SendCardLoad> = _load.asStateFlow()

        private val _form = MutableStateFlow(restoredForm())
        val form: StateFlow<SendCardForm> = _form.asStateFlow()

        /** "Send another card" under a card just sent (digital stamps on): a new card from the first step. */
        fun startAnotherCard() {
            _query.value = ""
            _form.value = SendCardForm()
        }

        private val _stampsNeeded = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

        /** The server refused a card for a stamp (they were spent on another device meanwhile): the stamp books open. */
        val stampsNeeded: SharedFlow<Unit> = _stampsNeeded.asSharedFlow()

        private val _stampShort = MutableStateFlow<StampShort?>(null)

        /** The stamp books opened for a list whose cards need more stamps than are left. */
        val stampShort: StateFlow<StampShort?> = _stampShort.asStateFlow()

        /** The stamp books closed: the next time they open, it's not for a list unless it says so again. */
        fun clearStampShort() {
            _stampShort.value = null
        }

        /** How many one card can go to at once; more than one (digital stamps on): a list. */
        val maxRecipients: Int get() = cards.value?.maxRecipients ?: 1

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

        /** "Send it by link": there's no one to choose, so step 1 is done. */
        fun chooseLink() {
            choose(CardRecipient.Link)
        }

        fun chooseDesign(design: String) {
            _form.update { it.copy(design = design) }
        }

        /** The note, cut at the card's letter limit. */
        fun onMessageChange(text: String) {
            val limit = cards.value?.messageLimit ?: DEFAULT_LIMIT
            _form.update { it.copy(message = text.takeLetters(limit)) }
        }

        /** Signed beside FROM, or null for the typed first name again (plan 8.2). */
        fun onSignature(signature: CardSignature?) {
            _form.update { it.copy(signature = signature?.takeIf { s -> s.drawable }) }
        }

        private var photoJob: Job? = null

        /**
         * "Add a photo" or "Replace" (memories plan step 4): the picked photo, prepared on the phone (upright, at most
         * 1600 px, no EXIF), uploads at once with its progress. A failure keeps the note and says why.
         */
        fun addPhoto(uri: Uri) {
            photoJob?.cancel()
            val before = _form.value.photo
            media.forget(before?.local)
            _form.update { it.copy(photo = CardPhotoDraft(alt = before?.alt.orEmpty())) }
            photoJob =
                viewModelScope.launch {
                    val prepared = media.preparePhoto(uri)
                    if (prepared == null) {
                        _form.update {
                            it.copy(photo = it.photo?.copy(failed = "We couldn’t read this photo. Try another one."))
                        }
                        return@launch
                    }
                    _form.update {
                        it.copy(photo = it.photo?.copy(local = prepared.file, width = prepared.width, height = prepared.height))
                    }
                    uploadPhoto(prepared.file)
                }
        }

        /** "Try again" after a failed upload: the same prepared photo. */
        fun retryPhoto() {
            val local = _form.value.photo?.local ?: return
            photoJob?.cancel()
            _form.update { it.copy(photo = it.photo?.copy(failed = null, progress = 0f)) }
            photoJob = viewModelScope.launch { uploadPhoto(local) }
        }

        private suspend fun uploadPhoto(file: File) {
            val result =
                media.upload("photo", file, "image/jpeg") { done ->
                    _form.update { form -> if (form.photo?.local == file) form.copy(photo = form.photo.copy(progress = done)) else form }
                }
            _form.update { form ->
                val photo = form.photo?.takeIf { it.local == file } ?: return@update form
                when (result) {
                    is NetworkResult.Success ->
                        form.copy(
                            photo = photo.copy(stored = result.data, progress = 1f, width = result.data.width, height = result.data.height),
                        )
                    is NetworkResult.Failure ->
                        form.copy(photo = photo.copy(failed = sendMessage(result.error, doing = "upload your photo")))
                }
            }
        }

        /** "Remove": the card goes without a photo, on purpose. */
        fun removePhoto() {
            photoJob?.cancel()
            media.forget(_form.value.photo?.local)
            _form.update { it.copy(photo = null) }
        }

        /** The photo's description for screen readers, cut at [PHOTO_ALT_LIMIT] letters. */
        fun onPhotoAlt(text: String) {
            // One line, as the server keeps it (it folds spaces): a return in the keyboard doesn't break it.
            val line = text.replace(Regex("\\s*[\\r\\n]+\\s*"), " ")
            _form.update { it.copy(photo = it.photo?.copy(alt = line.takeLetters(PHOTO_ALT_LIMIT))) }
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
                    form.step == SendCardStep.Write && form.message.isNotBlank() && form.photo?.ready != false ->
                        form.copy(step = SendCardStep.Seal, lookUnavailable = false)
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
            _form.value =
                form.copy(step = SendCardStep.steps[index - 1], preview = null, listPreview = null, sendError = null, sealError = null)
            return true
        }

        // ---- A list (digital stamps on) ----

        /** A person from the search onto the list, or off it again (also a chip's ×). */
        fun toggle(entry: CardRecipient) {
            _form.update {
                when {
                    it.listed.any { on -> on.key == entry.key } -> it.copy(listed = it.listed.filterNot { on -> on.key == entry.key })
                    it.listed.size >= maxRecipients -> it
                    else -> it.copy(listed = it.listed + entry, tookBack = false)
                }
            }
        }

        /** The address typed onto the list, and back to the name search. */
        fun addEmail() {
            val email = _form.value.email.trim()
            if (!EMAIL.matches(email)) return
            val entry = CardRecipient.Email(email)
            _form.update {
                val skip = it.listed.any { on -> on.key == entry.key } || it.listed.size >= maxRecipients
                it.copy(listed = if (skip) it.listed else it.listed + entry, email = "", byEmail = false)
            }
        }

        /** Step 1 done: one on the list goes as today's single card, two or more as a list. */
        fun continueWithList() {
            val listed = _form.value.listed
            val first = listed.firstOrNull() ?: return
            choose(if (listed.size == 1) first else CardRecipient.Several(listed))
        }

        /** The list as it stands (every card with its own request ID, made here the first time), and the form that keeps them. */
        private fun listToSend(form: SendCardForm): Pair<SendCardForm, SendHolidayCardListBody>? {
            val entries = (form.to as? CardRecipient.Several)?.entries ?: return null
            val design = form.design ?: return null
            val arrival = form.arrival ?: return null
            val ids = form.listIds.toMutableMap()
            val recipients =
                entries.mapNotNull { entry ->
                    val id = ids.getOrPut(entry.key) { UUID.randomUUID().toString() }
                    when (entry) {
                        is CardRecipient.Person -> HolidayCardListRecipient(HolidayCardRecipient(userId = entry.userId), id)
                        is CardRecipient.Email -> HolidayCardListRecipient(HolidayCardRecipient(email = entry.email), id)
                        else -> null
                    }
                }
            return form.copy(listIds = ids) to
                SendHolidayCardListBody(design, form.message.trim(), arrival, recipients, signature = form.signature)
        }

        /**
         * "Look it over" for a list: every card's line, and the first card that can go as its person will see it. A
         * refusal of the whole list (the season closed, say) stays on step 4 with the server's sentence.
         */
        private fun lookOverList() {
            val form = _form.value
            if (form.previewing || form.sending || form.message.isBlank()) return
            val (started, body) = listToSend(form) ?: return
            _form.value = started.copy(previewing = true, sealError = null)
            viewModelScope.launch {
                val result = repo.previewList(body)
                _form.update {
                    when {
                        it.step != SendCardStep.Seal || it.to != started.to -> it.copy(previewing = false)
                        result is NetworkResult.Success ->
                            it.copy(previewing = false, listPreview = result.data, step = SendCardStep.Look, sendError = null)
                        result is NetworkResult.Failure ->
                            it.copy(previewing = false, sealError = sendMessage(result.error, doing = "show how your cards will look"))
                        else -> it
                    }
                }
            }
        }

        /**
         * "Seal and send" for a list, card by card; again ("Send the rest") with the same request IDs, so only the cards
         * that didn't go can go. Too few stamps: nothing went, and the stamp books open saying how many more these cards
         * need.
         */
        fun sendList() {
            val form = _form.value
            if (form.sending || form.previewing) return
            val (started, body) = listToSend(form) ?: return
            _form.value = started.copy(sending = true, sendError = null)
            viewModelScope.launch {
                val result = repo.sendList(body)
                if (result is NetworkResult.Failure && result.error.serverCode() == STAMPS_REQUIRED) {
                    val (needed, available) = result.error.stampCounts()
                    val cards = needed ?: body.recipients.size
                    _stampShort.value = StampShort(cards, maxOf(1, cards - (available ?: 0)))
                    _form.update { it.copy(sending = false) }
                    _stampsNeeded.tryEmit(Unit)
                    return@launch
                }
                _form.update {
                    when (result) {
                        is NetworkResult.Success ->
                            it.copy(
                                sending = false,
                                listResults = result.data.results,
                                listPreview = null,
                                step = SendCardStep.Sent,
                                tookBack = false,
                            )
                        is NetworkResult.Failure ->
                            it.copy(sending = false, sendError = sendMessage(result.error, doing = "send your cards"))
                    }
                }
            }
        }

        /** "Get stamps to send" on a list's look: the stamp books, saying how many more these cards need. */
        fun getStampsForList(available: Int) {
            val needed = _form.value.listPreview?.needed ?: return
            _stampShort.value = StampShort(needed, maxOf(1, needed - available))
            _stampsNeeded.tryEmit(Unit)
        }

        /** One card on a sent list taken back (confirmed by the screen): its stamp comes back. */
        fun takeBackFromList(card: SentHolidayCard) {
            if (_form.value.listTakingBack != null) return
            _form.update { it.copy(listTakingBack = card.id, listTakeBackError = null) }
            viewModelScope.launch {
                val result = repo.takeBack(card.id)
                _form.update {
                    when (result) {
                        is NetworkResult.Success -> it.copy(listTakingBack = null, listTakenBack = it.listTakenBack + card.id)
                        is NetworkResult.Failure ->
                            it.copy(listTakingBack = null, listTakeBackError = card.id to takeBackMessage(result.error))
                    }
                }
            }
        }

        /**
         * Step 4's "Look it over": the card exactly as the other person will see it, after every check sending runs
         * (nothing is sent). A refusal stays on step 4 with the server's sentence; a server that can't show the look
         * leaves "Seal and send" on step 4.
         */
        fun look() {
            if (_form.value.to is CardRecipient.Several) lookOverList() else lookOverOne()
        }

        /** [look] for one card. */
        private fun lookOverOne() {
            val form = _form.value
            val to = form.to ?: return
            val design = form.design ?: return
            val arrival = form.arrival ?: return
            if (form.previewing || form.sending || form.message.isBlank()) return
            val started = form.withRequestId()
            _form.value = started.copy(previewing = true, sealError = null)
            viewModelScope.launch {
                val look =
                    repo.preview(
                        design = design,
                        message = form.message.trim(),
                        signature = form.signature,
                        photo = form.photo?.fileId,
                        photoAlt = form.photo?.sentAlt,
                        arrival = arrival,
                        toUserId = (to as? CardRecipient.Person)?.userId,
                        toEmail = (to as? CardRecipient.Email)?.email,
                        requestId = started.requestId,
                        toLink = to is CardRecipient.Link,
                    )
                if (!wentEarlier(look)) showLook(look, form)
            }
        }

        /** Step 5 from the look's answer, when it's for what's still chosen; step 4 says why it couldn't be shown. */
        private fun showLook(
            look: CardLook,
            asked: SendCardForm,
        ) {
            _form.update {
                val same = it.step == SendCardStep.Seal && it.to == asked.to && it.design == asked.design && it.arrival == asked.arrival
                when {
                    // Back, or another choice, while it was read: only an answer for what's chosen now counts.
                    !same || it.message != asked.message || it.signature != asked.signature || it.photo != asked.photo ->
                        it.copy(previewing = false)
                    look is CardLook.Shown ->
                        it.copy(previewing = false, preview = look.preview, step = SendCardStep.Look, sendError = null)
                    look is CardLook.Unavailable -> it.copy(previewing = false, lookUnavailable = true)
                    look is CardLook.Failed ->
                        it.copy(previewing = false, sealError = sendMessage(look.error, doing = "show how your card will look"))
                    else -> it
                }
            }
            if ((look as? CardLook.Failed)?.error?.serverCode() == ARRIVAL_CLOSED) readTheirs()
        }

        /**
         * "Seal and send", on step 5 (or on step 4 when the look can't be shown). A refusal stays there with the server's
         * sentence; a choice that closed meanwhile (their 7 a.m. came) goes back to step 4 with why, and their day is
         * read again.
         */
        fun send() {
            val form = _form.value
            val to = form.to ?: return
            val design = form.design ?: return
            val arrival = form.arrival ?: return
            if (form.sending || form.previewing || form.message.isBlank()) return
            val started = form.withRequestId()
            _form.value = started.copy(sending = true, sendError = null, sealError = null)
            viewModelScope.launch {
                val result =
                    repo.send(
                        design = design,
                        message = form.message.trim(),
                        signature = form.signature,
                        photo = form.photo?.fileId,
                        photoAlt = form.photo?.sentAlt,
                        arrival = arrival,
                        toUserId = (to as? CardRecipient.Person)?.userId,
                        toEmail = (to as? CardRecipient.Email)?.email,
                        requestId = started.requestId,
                        toLink = to is CardRecipient.Link,
                    )
                if (result is NetworkResult.Failure && wentEarlier(result.error)) return@launch
                // The stamps ran out meanwhile (another device sent a card): the stamp books open; the card stays as it is.
                if ((result as? NetworkResult.Failure)?.error?.serverCode() == STAMPS_REQUIRED) {
                    _form.update { it.copy(sending = false) }
                    _stampsNeeded.tryEmit(Unit)
                    return@launch
                }
                val closed = (result as? NetworkResult.Failure)?.error?.serverCode() == ARRIVAL_CLOSED
                _form.update {
                    when {
                        result is NetworkResult.Success ->
                            it.copy(sending = false, sent = result.data, step = SendCardStep.Sent, preview = null, requestId = null)
                        // Sent from step 4, or a choice that closed: step 4 says why, under its choices.
                        result is NetworkResult.Failure && (closed || it.step == SendCardStep.Seal) ->
                            it.copy(sending = false, step = SendCardStep.Seal, preview = null, sealError = sendMessage(result.error))
                        result is NetworkResult.Failure -> it.copy(sending = false, sendError = sendMessage(result.error))
                        else -> it
                    }
                }
                if (closed) readTheirs()
            }
        }

        /** [wentEarlier] for a look that couldn't be shown. */
        private fun wentEarlier(look: CardLook): Boolean = look is CardLook.Failed && wentEarlier(look.error)

        /**
         * This card already went with an earlier try whose answer was lost (or that OkHttp sent again by itself): show
         * the card it sent, or, once it was taken back, say so and start a new card. True when it was one of those.
         */
        private fun wentEarlier(error: NetworkError): Boolean {
            when (error.serverCode()) {
                REQUEST_SENT -> {
                    val card = error.storedCard() ?: return false
                    _form.update {
                        it.copy(
                            sending = false,
                            previewing = false,
                            sent = card,
                            step = SendCardStep.Sent,
                            preview = null,
                            sendError = null,
                            sealError = null,
                            requestId = null,
                            tookBack = false,
                        )
                    }
                }
                TAKEN_BACK -> {
                    _query.value = ""
                    _form.value = SendCardForm(takenBackNote = sendMessage(error))
                }
                else -> return false
            }
            return true
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
            val options = if (to is CardRecipient.Person) (theirs?.arrivals ?: arrivals.person) else arrivals.email
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

        /** "Send Hazel a card" on a card she sent names her (on first opening only), and the flow opens at Pick a card. */
        private fun sendBackPerson(): CardRecipient.Person? {
            if (saved.get<String>(KEY_STEP) != null) return null
            val userId = saved.get<String>(SEND_CARD_TO_USER_KEY)?.takeIf { it.isNotBlank() } ?: return null
            return CardRecipient.Person(userId, saved.get<String>(SEND_CARD_TO_NAME_KEY).orEmpty())
        }

        /** The step saved with the screen (step 5 is read again from step 4); none saved: the first, or [opensAtPick]. */
        private fun savedStep(opensAtPick: Boolean): SendCardStep =
            when (saved.get<String>(KEY_STEP)) {
                null -> if (opensAtPick) SendCardStep.Pick else SendCardStep.To
                SendCardStep.Pick.name -> SendCardStep.Pick
                SendCardStep.Write.name -> SendCardStep.Write
                SendCardStep.Seal.name, SendCardStep.Look.name -> SendCardStep.Seal
                else -> SendCardStep.To
            }

        /**
         * The flow as it was saved with the screen: the same step, or the step before it when that step needs what isn't
         * saved (step 5 is read again from step 4; a card just sent shows as today's card).
         */
        private fun restoredForm(): SendCardForm {
            val email = saved.get<String>(KEY_EMAIL).orEmpty()
            val list = saved.get<String>(KEY_LIST)?.let(::readList)
            val sendBack = sendBackPerson()
            val to =
                sendBack
                    ?: saved.get<String>(KEY_TO_USER)?.let { CardRecipient.Person(it, saved.get<String>(KEY_TO_NAME).orEmpty()) }
                    ?: saved.get<String>(KEY_TO_EMAIL)?.let { CardRecipient.Email(it) }
                    ?: CardRecipient.Link.takeIf { saved.get<Boolean>(KEY_TO_LINK) == true }
                    ?: list?.first?.takeIf { saved.get<Boolean>(KEY_TO_LIST) == true && it.size > 1 }?.let { CardRecipient.Several(it) }
            // "Send this card to someone" on a public card page names the picture.
            val design = saved.get<String>(KEY_DESIGN) ?: saved.get<String>(SEND_CARD_DESIGN_KEY)?.takeIf { LaunchFeatures.cardTable }
            val message = saved.get<String>(KEY_MESSAGE).orEmpty()
            val signature = saved.get<String>(KEY_SIGNATURE)?.let(CardSignatureJson::fromJson)
            val photo = saved.get<String>(KEY_PHOTO)?.let { readPhoto(it, saved.get<String>(KEY_PHOTO_ALT).orEmpty()) }
            val step = savedStep(opensAtPick = sendBack != null)
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
                signature = signature,
                photo = photo,
                arrival = saved.get<String>(KEY_ARRIVAL),
                requestId = saved.get<String>(KEY_REQUEST_ID),
                listed = list?.first.orEmpty(),
                listIds = list?.second.orEmpty(),
            )
        }

        /** The photo as saved: its stored file (still sendable for 72 hours) and its description. */
        private fun readPhoto(
            json: String,
            alt: String,
        ): CardPhotoDraft? =
            runCatching {
                val saved = JSONObject(json)
                val width = saved.optInt("w").takeIf { it > 0 }
                val height = saved.optInt("h").takeIf { it > 0 }
                CardPhotoDraft(
                    width = width,
                    height = height,
                    stored = CardMediaFile(saved.getString("id"), "photo", width, height),
                    progress = 1f,
                    alt = alt,
                )
            }.getOrNull()

        /** The list as saved: who's on it and their cards' request IDs. */
        private fun readList(json: String): Pair<List<CardRecipient>, Map<String, String>>? =
            runCatching {
                val saved = JSONObject(json)
                val entries = saved.getJSONArray("entries")
                val listed =
                    (0 until entries.length()).map { at ->
                        val entry = entries.getJSONObject(at)
                        if (entry.has("u")) {
                            CardRecipient.Person(entry.getString("u"), entry.optString("n"))
                        } else {
                            CardRecipient.Email(entry.getString("e"))
                        }
                    }
                val ids = saved.getJSONObject("ids")
                listed to ids.keys().asSequence().map { it.toString() }.associateWith { ids.getString(it) }
            }.getOrNull()

        /** The list for the screen's saved state; null when there's none. */
        private fun listJson(form: SendCardForm): String? {
            if (form.listed.isEmpty()) return null
            val entries = JSONArray()
            form.listed.forEach { entry ->
                when (entry) {
                    is CardRecipient.Person -> entries.put(JSONObject().put("u", entry.userId).put("n", entry.name))
                    is CardRecipient.Email -> entries.put(JSONObject().put("e", entry.email))
                    else -> Unit
                }
            }
            return JSONObject().put("entries", entries).put("ids", JSONObject(form.listIds)).toString()
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
            saved[KEY_TO_LINK] = form.to is CardRecipient.Link
            saved[KEY_TO_LIST] = form.to is CardRecipient.Several
            saved[KEY_LIST] = listJson(form).takeIf { form.step != SendCardStep.Sent }
            saved[KEY_DESIGN] = form.design.takeIf { form.step != SendCardStep.Sent }
            saved[KEY_MESSAGE] = form.message.takeIf { form.step != SendCardStep.Sent }
            saved[KEY_SIGNATURE] = form.signature?.takeIf { form.step != SendCardStep.Sent }?.let(CardSignatureJson::toJson)
            // The photo's stored file and its words, never the picture itself (the plan: raw media isn't kept).
            saved[KEY_PHOTO] =
                form.photo?.stored?.takeIf { form.step != SendCardStep.Sent }?.let {
                    JSONObject().put("id", it.fileId).put("w", it.width ?: 0).put("h", it.height ?: 0).toString()
                }
            saved[KEY_PHOTO_ALT] = form.photo?.alt?.takeIf { form.step != SendCardStep.Sent && form.photo.ready }
            saved[KEY_ARRIVAL] = form.arrival.takeIf { form.step != SendCardStep.Sent }
            saved[KEY_REQUEST_ID] = form.requestId.takeIf { form.step != SendCardStep.Sent }
        }

        private fun takeBackMessage(error: NetworkError): String =
            when (error) {
                is NetworkError.NotFound -> "This card isn’t here any more."
                else -> error.mailMessage(online = network.isOnline.value, doing = "take your card back")
            }

        companion object {
            /** The nav argument naming a picture to start with (`mailbox/cards?design=`). */
            const val SEND_CARD_DESIGN_KEY = "design"

            /** The nav arguments naming the person it's for ("Send Hazel a card"): their user id and their name. */
            const val SEND_CARD_TO_USER_KEY = "toUser"
            const val SEND_CARD_TO_NAME_KEY = "toName"

            /** An address that can take an email: the web's check, so the server's own check doesn't refuse it. */
            val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$")

            private const val SEARCH_PAUSE_MS = 250L
            private const val DEFAULT_LIMIT = 300

            /** The arrival chosen closed meanwhile (their 7 a.m. came): step 4 offers what's open now. */
            private const val ARRIVAL_CLOSED = "CARD_ARRIVAL_CLOSED"

            /** This draft's card already went (its answer was lost) and the draft changed since: the answer carries it. */
            private const val REQUEST_SENT = "CARD_REQUEST_SENT"

            /** This draft's card was taken back meanwhile: it never sends again. */
            private const val TAKEN_BACK = "CARD_TAKEN_BACK"

            /** Digital stamps on and none left (402): the card waits while the person gets a stamp book. */
            private const val STAMPS_REQUIRED = "STAMPS_REQUIRED"

            private const val KEY_STEP = "sendCard.step"
            private const val KEY_BY_EMAIL = "sendCard.byEmail"
            private const val KEY_EMAIL = "sendCard.email"
            private const val KEY_TO_USER = "sendCard.toUser"
            private const val KEY_TO_NAME = "sendCard.toName"
            private const val KEY_TO_EMAIL = "sendCard.toEmail"
            private const val KEY_TO_LINK = "sendCard.toLink"
            private const val KEY_DESIGN = "sendCard.design"
            private const val KEY_MESSAGE = "sendCard.message"
            private const val KEY_SIGNATURE = "sendCard.signature"
            private const val KEY_PHOTO = "sendCard.photo"
            private const val KEY_PHOTO_ALT = "sendCard.photoAlt"
            private const val KEY_ARRIVAL = "sendCard.arrival"
            private const val KEY_REQUEST_ID = "sendCard.requestId"
            private const val KEY_TO_LIST = "sendCard.toList"
            private const val KEY_LIST = "sendCard.list"
        }
    }

/** The card a `CARD_REQUEST_SENT` refusal carries: the one an earlier try of this draft sent. */
private fun NetworkError.storedCard(): SentHolidayCard? {
    val body = (this as? NetworkError.ClientError)?.body ?: return null
    return runCatching { Moshi.Builder().build().adapter(SendHolidayCardResponse::class.java).fromJson(body)?.card }.getOrNull()
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

/** `needed` and `available` from a list's 402 `STAMPS_REQUIRED` answer. */
private fun NetworkError.stampCounts(): Pair<Int?, Int?> {
    val body = (this as? NetworkError.ClientError)?.body ?: return null to null
    val json = runCatching { JSONObject(body) }.getOrNull() ?: return null to null
    return json.optInt("needed", -1).takeIf { it >= 0 } to json.optInt("available", -1).takeIf { it >= 0 }
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
