package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivalsFor
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardRecipient
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SendHolidayCardBody
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.data.api.models.mailbox.TakeBackHolidayCardResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HolidayCardsApi
import app.pantopus.android.data.api.services.MailComposeApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
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
                    NetworkResult.Success(result.data.card)
                }
                is NetworkResult.Failure -> result
            }
        }

        /** `POST /api/mailbox/cards/:id/take-back`: the day's card is free again. */
        suspend fun takeBack(cardId: String): NetworkResult<TakeBackHolidayCardResponse> {
            val result = safeApiCall { api.takeBack(cardId) }
            if (result is NetworkResult.Success) {
                latestFlow.update { cards -> if (cards?.today?.id == cardId) cards.copy(today = null) else cards }
            }
            return result
        }

        /** People a card can go to, by name (two letters or more): no businesses. */
        suspend fun searchPeople(query: String): NetworkResult<List<MailRecipientDto>> =
            when (val result = safeApiCall { composeApi.recipients(query, people = "1") }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.recipients)
                is NetworkResult.Failure -> result
            }

        companion object {
            private val latestFlow = MutableStateFlow<HolidayCardsResponse?>(null)

            val latest: StateFlow<HolidayCardsResponse?> = latestFlow.asStateFlow()

            /** Sign-out: nothing of this account's cards stays for the next one. */
            fun forgetAccount() {
                latestFlow.value = null
            }
        }
    }
