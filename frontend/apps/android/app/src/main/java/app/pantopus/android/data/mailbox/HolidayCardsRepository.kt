package app.pantopus.android.data.mailbox

import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mailbox.CardSignature
import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivalsFor
import app.pantopus.android.data.api.models.mailbox.HolidayCardListPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardRecipient
import app.pantopus.android.data.api.models.mailbox.HolidayCardSharedBody
import app.pantopus.android.data.api.models.mailbox.HolidayCardStamps
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardBody
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardListBody
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardListResponse
import app.pantopus.android.data.api.models.mailbox.SentCard
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.data.api.models.mailbox.SentMailResponse
import app.pantopus.android.data.api.models.mailbox.TakeBackHolidayCardResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HolidayCardsApi
import app.pantopus.android.data.api.services.MailComposeApi
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Christmas cards (launch keys `holiday_cards` + `mailbox`): the season's pictures and today's card, sending one card a
 * day, taking it back, and the people a card can go to. [latest] is what the Mailbox's "Send a Christmas card" row and
 * the send screens show, so a card sent or taken back shows on both at once.
 */
@Singleton
class HolidayCardsRepository
    @Inject
    constructor(
        private val api: HolidayCardsApi,
        private val composeApi: MailComposeApi,
    ) {
        /** The cards as last read; null until read, and while cards are off (the server answers 404). */
        val latest: StateFlow<HolidayCardsResponse?> get() = Companion.latest

        /** `GET /api/mailbox/cards`. A failure other than 404 keeps what was read before. */
        suspend fun load(): NetworkResult<HolidayCardsResponse> {
            val result = safeApiCall { api.cards() }
            when (result) {
                is NetworkResult.Success -> latestFlow.value = result.data
                is NetworkResult.Failure -> if (result.error is NetworkError.NotFound) latestFlow.value = null
            }
            return result
        }

        /** `GET /api/mailbox/cards/arrivals?to=`: when a card to this person can come, by their clock. */
        suspend fun arrivalsFor(userId: String): NetworkResult<HolidayCardArrivalsFor> = safeApiCall { api.arrivals(userId) }

        /**
         * `POST /api/mailbox/cards/preview`: the card as the other person will see it; nothing is sent. [CardLook.Unavailable]
         * when the server can't show it: it has no Look it over yet (a 404 without the server's code, as a server from
         * before it answers), or its answer can't be read. Sending still works there.
         */
        @Suppress("LongParameterList") // The card's choices, its request ID and its signature (plan 8.2), as the body has them.
        suspend fun preview(
            design: String,
            message: String,
            arrival: String,
            toUserId: String?,
            toEmail: String?,
            requestId: String? = null,
            toLink: Boolean = false,
            signature: CardSignature? = null,
        ): CardLook {
            val body =
                SendHolidayCardBody(
                    design,
                    message,
                    arrival,
                    recipient(toUserId, toEmail, toLink),
                    requestId,
                    useStamp =
                        true.takeIf {
                            latest.value?.postageEnabled == true
                        },
                    signature = signature,
                )
            val response =
                when (val result = safeApiCall { api.preview(body) }) {
                    is NetworkResult.Success -> result.data
                    is NetworkResult.Failure ->
                        return if (result.error is NetworkError.Decoding) CardLook.Unavailable else CardLook.Failed(result.error)
                }
            if (response.isSuccessful) return response.body()?.let { CardLook.Shown(it) } ?: CardLook.Unavailable
            val error = runCatching { response.errorBody()?.string() }.getOrNull()
            val code = runCatching { JSONObject(error.orEmpty()).optString("code") }.getOrNull().orEmpty()
            return when (response.code()) {
                HTTP_NOT_FOUND -> if (code.isBlank()) CardLook.Unavailable else CardLook.Failed(NetworkError.NotFound)
                HTTP_UNAUTHORIZED -> CardLook.Failed(NetworkError.Unauthorized)
                HTTP_FORBIDDEN -> CardLook.Failed(NetworkError.Forbidden(error))
                in HTTP_SERVER_ERRORS -> CardLook.Failed(NetworkError.Server(response.code(), error))
                else -> CardLook.Failed(NetworkError.ClientError(response.code(), error))
            }
        }

        /** A person, an email address or a link: one of the three. */
        private fun recipient(
            toUserId: String?,
            toEmail: String?,
            toLink: Boolean,
        ) = HolidayCardRecipient(userId = toUserId, email = toEmail, link = true.takeIf { toLink })

        /** `GET /api/mailbox/cards/:id/link`: the link of a card by link that's still waiting for someone. */
        suspend fun cardLink(id: String): NetworkResult<String> =
            when (val result = safeApiCall { api.cardLink(id) }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.link)
                is NetworkResult.Failure -> result
            }

        /** `POST /api/mailbox/cards/shared`: counts what was shared; whether it worked changes nothing for the person. */
        suspend fun cardShared(
            design: String,
            kind: String,
            format: String,
            withNote: Boolean,
        ) {
            safeApiCall { api.shared(HolidayCardSharedBody(design, kind, format, withNote)) }
        }

        /** `POST /api/mailbox/cards`: today's card, to a person by their user id or by email. */
        @Suppress("LongParameterList") // The card's choices, its request ID and its signature (plan 8.2), as the body has them.
        suspend fun send(
            design: String,
            message: String,
            arrival: String,
            toUserId: String?,
            toEmail: String?,
            requestId: String? = null,
            toLink: Boolean = false,
            signature: CardSignature? = null,
        ): NetworkResult<SentHolidayCard> {
            val body =
                SendHolidayCardBody(
                    design,
                    message,
                    arrival,
                    recipient(toUserId, toEmail, toLink),
                    requestId,
                    useStamp =
                        true.takeIf {
                            latest.value?.postageEnabled == true
                        },
                    signature = signature,
                )
            return when (val result = safeApiCall { api.send(body) }) {
                is NetworkResult.Success -> {
                    latestFlow.update { if (it?.postageEnabled == true) it else it?.copy(today = result.data.card) }
                    cardSentFlow.tryEmit(result.data.card.id)
                    NetworkResult.Success(result.data.card.copy(link = result.data.link))
                }
                is NetworkResult.Failure -> result
            }
        }

        /** `POST /api/mailbox/cards/batch/preview`: a list's look; nothing is stored or sent. */
        suspend fun previewList(body: SendHolidayCardListBody): NetworkResult<HolidayCardListPreview> =
            safeApiCall { api.previewList(body) }

        /** `POST /api/mailbox/cards/batch`: the list, card by card. Sent reads again once any card went. */
        suspend fun sendList(body: SendHolidayCardListBody): NetworkResult<SendHolidayCardListResponse> {
            val result = safeApiCall { api.sendList(body) }
            if (result is NetworkResult.Success) {
                val sent = result.data.results.firstOrNull { it.status == "sent" }?.card
                sent?.let { cardSentFlow.tryEmit(it.id) }
                result.data.stamps?.let { noteStamps(it) }
            }
            return result
        }

        /** `POST /api/mailbox/cards/:id/take-back`: the day's card is free again, and it leaves Sent. */
        suspend fun takeBack(cardId: String): NetworkResult<TakeBackHolidayCardResponse> {
            val result = safeApiCall { api.takeBack(cardId) }
            when (result) {
                is NetworkResult.Success -> {
                    latestFlow.update { cards -> if (cards?.today?.id == cardId) cards.copy(today = null) else cards }
                    takenBackFlow.tryEmit(cardId)
                }
                // Refused: it was picked up or opened meanwhile, or it's gone. Sent and the flag read where it is now.
                is NetworkResult.Failure ->
                    if (result.error is NetworkError.ClientError || result.error is NetworkError.NotFound) movedOnFlow.tryEmit(cardId)
            }
            return result
        }

        /** `GET /api/mailbox/sent`: a page of the cards the person sent, newest first, after [before] (the last `next`). */
        suspend fun sent(
            before: String?,
            limit: Int = SENT_PAGE,
        ): NetworkResult<SentMailResponse> = safeApiCall { api.sent(before, limit, notDelivered()) }

        /**
         * Sent asks for the cards a block withdrew (the founder's B, memories contract section 8) only with card memories
         * on: older apps would read their `not_delivered` status as delivered.
         */
        private fun notDelivered(): String? = "not_delivered".takeIf { LaunchFeatures.holidayCardMemories }

        /** `GET /api/mailbox/sent/:id`: one card the person sent, with their note and its trail (Sent's row follows it). */
        suspend fun sentCard(id: String): NetworkResult<SentCard> =
            when (val result = safeApiCall { api.sentCard(id, notDelivered()) }) {
                is NetworkResult.Success -> {
                    sentReadFlow.tryEmit(result.data.item)
                    NetworkResult.Success(result.data.item)
                }
                is NetworkResult.Failure -> result
            }

        /** People a card can go to, by name (two letters or more): no businesses. */
        suspend fun searchPeople(query: String): NetworkResult<List<MailRecipientDto>> =
            when (val result = safeApiCall { composeApi.recipients(query, people = "1") }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.recipients)
                is NetworkResult.Failure -> result
            }

        companion object {
            /** Sent reads 25 cards at a time. */
            const val SENT_PAGE = 25

            private val latestFlow = MutableStateFlow<HolidayCardsResponse?>(null)

            val latest: StateFlow<HolidayCardsResponse?> = latestFlow.asStateFlow()

            private val cardSentFlow = MutableSharedFlow<String>(extraBufferCapacity = 8)

            /** A card just sent: Sent reads again, and the Mailbox's flag goes up for a card to a person. */
            val cardSent: SharedFlow<String> = cardSentFlow.asSharedFlow()

            private val takenBackFlow = MutableSharedFlow<String>(extraBufferCapacity = 8)

            /** A card taken back, from the send screens or from Sent: Sent drops it and the flag comes down. */
            val takenBack: SharedFlow<String> = takenBackFlow.asSharedFlow()

            private val movedOnFlow = MutableSharedFlow<String>(extraBufferCapacity = 8)

            /**
             * A sent card moved on (picked up or opened) or is gone: a take-back was refused, or its page read it in another
             * state than Sent shows. Sent and the Mailbox's flag read again.
             */
            val movedOn: SharedFlow<String> = movedOnFlow.asSharedFlow()

            fun announceMovedOn(cardId: String) {
                movedOnFlow.tryEmit(cardId)
            }

            /** The digital stamps as a balance read just found them (a card sent, taken back, or a book bought): the row's line. */
            fun noteStamps(stamps: HolidayCardStamps) {
                latestFlow.update { cards -> if (cards?.postageEnabled == true) cards.copy(stamps = stamps) else cards }
            }

            private val sentReadFlow = MutableSharedFlow<SentCard>(extraBufferCapacity = 8)

            /** A sent card as its page just read it (Sent compares it with what it shows). */
            val sentRead: SharedFlow<SentCard> = sentReadFlow.asSharedFlow()

            // Kept until a Mailbox opens Sent: a card notice opens the card's page over a Mailbox that isn't open yet.
            private val showSentFlow = MutableSharedFlow<Unit>(replay = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)

            /** "See it in Sent", or a card notice: the Mailbox opens Sent. */
            val showSent: SharedFlow<Unit> = showSentFlow.asSharedFlow()

            fun announceShowSent() {
                showSentFlow.tryEmit(Unit)
            }

            /** A Mailbox opened Sent for the last [announceShowSent]. */
            @OptIn(ExperimentalCoroutinesApi::class)
            fun showSentHandled() {
                showSentFlow.resetReplayCache()
            }

            /** Sign-out: nothing of this account's cards stays for the next one. */
            fun forgetAccount() {
                showSentHandled()
                latestFlow.value = null
            }
        }
    }

/** Step 4's "Look it over": the card as they'll see it, a server that can't show it (sending still works), or why not. */
sealed interface CardLook {
    data class Shown(
        val preview: HolidayCardPreview,
    ) : CardLook

    /** No Look it over on this server yet, or an answer that can't be read. */
    data object Unavailable : CardLook

    data class Failed(
        val error: NetworkError,
    ) : CardLook
}

private const val HTTP_UNAUTHORIZED = 401
private const val HTTP_FORBIDDEN = 403
private const val HTTP_NOT_FOUND = 404
private val HTTP_SERVER_ERRORS = 500..599
