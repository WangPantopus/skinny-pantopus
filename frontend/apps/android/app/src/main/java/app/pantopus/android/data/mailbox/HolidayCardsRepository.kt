package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivalsFor
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardRecipient
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardBody
import app.pantopus.android.data.api.models.mailbox.SentCard
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.data.api.models.mailbox.SentMailResponse
import app.pantopus.android.data.api.models.mailbox.TakeBackHolidayCardResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HolidayCardsApi
import app.pantopus.android.data.api.services.MailComposeApi
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
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

        /** `POST /api/mailbox/cards/preview`: the card as the other person will see it; nothing is sent. */
        suspend fun preview(
            design: String,
            message: String,
            arrival: String,
            toUserId: String?,
            toEmail: String?,
        ): NetworkResult<HolidayCardPreview> {
            val body = SendHolidayCardBody(design, message, arrival, HolidayCardRecipient(userId = toUserId, email = toEmail))
            return safeApiCall { api.preview(body) }
        }

        /** `POST /api/mailbox/cards`: today's card, to a person by their user id or by email. */
        suspend fun send(
            design: String,
            message: String,
            arrival: String,
            toUserId: String?,
            toEmail: String?,
        ): NetworkResult<SentHolidayCard> {
            val body = SendHolidayCardBody(design, message, arrival, HolidayCardRecipient(userId = toUserId, email = toEmail))
            return when (val result = safeApiCall { api.send(body) }) {
                is NetworkResult.Success -> {
                    latestFlow.update { it?.copy(today = result.data.card) }
                    cardSentFlow.tryEmit(result.data.card.id)
                    NetworkResult.Success(result.data.card)
                }
                is NetworkResult.Failure -> result
            }
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
        ): NetworkResult<SentMailResponse> = safeApiCall { api.sent(before, limit) }

        /** `GET /api/mailbox/sent/:id`: one card the person sent, with their note and its trail (Sent's row follows it). */
        suspend fun sentCard(id: String): NetworkResult<SentCard> =
            when (val result = safeApiCall { api.sentCard(id) }) {
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

            /** A take-back refused because the card moved on (picked up, opened) or is gone: Sent and the flag read again. */
            val movedOn: SharedFlow<String> = movedOnFlow.asSharedFlow()

            private val sentReadFlow = MutableSharedFlow<SentCard>(extraBufferCapacity = 8)

            /** A sent card as its page just read it: Sent's row says the same. */
            val sentRead: SharedFlow<SentCard> = sentReadFlow.asSharedFlow()

            private val showSentFlow = MutableSharedFlow<Unit>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)

            /** "See it in Sent": the Mailbox opens Sent. */
            val showSent: SharedFlow<Unit> = showSentFlow.asSharedFlow()

            fun announceShowSent() {
                showSentFlow.tryEmit(Unit)
            }

            /** Sign-out: nothing of this account's cards stays for the next one. */
            fun forgetAccount() {
                latestFlow.value = null
            }
        }
    }
