@file:Suppress("TooManyFunctions")

package app.pantopus.android.ui.screens.crewday.book

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayAddressDto
import app.pantopus.android.data.api.models.crewday.CrewDayBookingBody
import app.pantopus.android.data.api.models.crewday.CrewDayBookingDto
import app.pantopus.android.data.api.models.crewday.CrewDayPublicDto
import app.pantopus.android.data.api.models.crewday.CrewDayQuoteBody
import app.pantopus.android.data.api.models.crewday.CrewDayQuoteDto
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.payments.PaymentMethodDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDayAddresses
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayCode
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PendingCardSetupStore
import app.pantopus.android.ui.screens.crewday.CrewDayRoutes
import app.pantopus.android.ui.screens.settings.payments.AddCardOutcome
import app.pantopus.android.ui.screens.settings.payments.AddCardPhase
import app.pantopus.android.ui.screens.settings.payments.PaymentsCardSetup
import app.pantopus.android.ui.screens.settings.payments.PaymentsEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/** Your price (screen 2), Review and book (3), then You're on the route (4). */
enum class CrewDayBookStep { Price, Review, Booked }

/** The home being priced: one of the person's homes in Pantopus, or an address they typed. */
data class CrewDayBookHome(
    val line: String,
    val city: String?,
    val state: String?,
    val zip: String?,
    val latitude: Double,
    val longitude: Double,
    /** Set for a home in Pantopus ("From your home in Pantopus"). */
    val homeId: String? = null,
)

data class CrewDayBookState(
    val day: CrewDayPublicDto? = null,
    val loadError: String? = null,
    val step: CrewDayBookStep = CrewDayBookStep.Price,
    val home: CrewDayBookHome? = null,
    val changingHome: Boolean = false,
    val addressQuery: String = "",
    val suggestions: List<GeoSuggestion> = emptyList(),
    val optionId: String? = null,
    val addOnIds: Set<String> = emptySet(),
    val quote: CrewDayQuoteDto? = null,
    val quoting: Boolean = false,
    val quoteError: String? = null,
    val accessNote: String = "",
    val methods: List<PaymentMethodDto> = emptyList(),
    val methodsLoaded: Boolean = false,
    /** The chosen saved card (its Stripe id, as the booking stores it). */
    val methodId: String? = null,
    val approved: Boolean = false,
    val booking: Boolean = false,
    val bookError: String? = null,
    val booked: CrewDayBookingDto? = null,
) {
    val option get() = day?.priceOptions?.firstOrNull { it.id == optionId }

    /** A look-first option: the crew confirms the price before anything is booked. */
    val needsLook: Boolean get() = option?.needsLook == true || quote?.needsLook == true

    /** The total as this screen adds it up; the server's quote wins once it answers. */
    val totalCents: Int?
        get() {
            if (needsLook) return null
            quote?.priceCents?.let { return it }
            val base = option?.priceCents ?: return null
            return base + (day?.addOns.orEmpty().filter { it.id in addOnIds }.sumOf { it.priceCents })
        }

    val method: PaymentMethodDto? get() = methods.firstOrNull { it.stripeId == methodId }

    val canContinue: Boolean get() = home != null && option != null && quote?.inArea == true && !quoting

    val canBook: Boolean get() = canContinue && approved && methodId != null && !booking
}

/** The Stripe id a booking stores for a saved card (`pm_…`); older rows carry it as their id. */
val PaymentMethodDto.stripeId: String get() = stripePaymentMethodId ?: id

/**
 * The household's booking flow from an invitation: the home (from Pantopus or typed), the option and add-ons, the
 * quote (`POST /public/:code/quote`, which also checks the address is inside the day's area), the note for the crew,
 * the saved card (the existing add-card flow), the terms, and `POST /api/crew-days/:id/bookings` with one
 * `client_request_id` for the whole flow, so a retry or a double tap books once.
 */
@HiltViewModel
class CrewDayBookViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        private val addresses: CrewDayAddresses,
        private val homes: HomesRepository,
        private val payments: PaymentsRepository,
        pendingSetups: PendingCardSetupStore,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val code: String = savedStateHandle.get<String>(CrewDayRoutes.CODE_KEY).orEmpty()
        private val clientRequestId: String =
            savedStateHandle.get<String>(KEY_REQUEST) ?: UUID.randomUUID().toString().also { savedStateHandle[KEY_REQUEST] = it }
        private val _state = MutableStateFlow(CrewDayBookState())
        val state: StateFlow<CrewDayBookState> = _state.asStateFlow()
        private val _events = Channel<PaymentsEvent>(Channel.BUFFERED)

        /** The add-card sheet to present, and messages from the card setup. */
        val events: Flow<PaymentsEvent> = _events.receiveAsFlow()
        private var searchJob: Job? = null
        private var quoteJob: Job? = null

        /** The existing add-card flow (Settings → Payments), driven from here. */
        private val cardSetup =
            PaymentsCardSetup(
                repository = payments,
                pendingSetups = pendingSetups,
                scope = viewModelScope,
                events = _events,
                canStart = { !_state.value.booking },
                onFreshMethods = { _, methods -> showMethods(methods, preferNewest = true) },
                onSavedReceipt = { _, method -> showMethods(_state.value.methods + method, preferNewest = true) },
            )
        val addCardPhase: StateFlow<AddCardPhase> = cardSetup.phase

        fun load() {
            if (_state.value.day != null) return
            viewModelScope.launch {
                when (val result = repository.invitation(code)) {
                    is NetworkResult.Success -> {
                        val day = result.data
                        _state.update {
                            it.copy(
                                day = day,
                                loadError = null,
                                // One price option: it's already chosen.
                                optionId = it.optionId ?: day.priceOptions.singleOrNull()?.id,
                            )
                        }
                        prefillHome()
                    }
                    is NetworkResult.Failure -> _state.update { it.copy(loadError = result.error.crewDayMessage) }
                }
            }
            viewModelScope.launch { cardSetup.restorePendingSetup() }
        }

        /** The person's home in Pantopus, when they have one with an address and a point. */
        private suspend fun prefillHome() {
            if (_state.value.home != null) return
            val mine = homes.myHomesCopy() ?: (homes.myHomes() as? NetworkResult.Success)?.data
            val home =
                mine?.homes.orEmpty().filter { it.isOpenablePlace && it.location != null && !it.address.isNullOrBlank() }.let { list ->
                    list.firstOrNull { it.id == mine?.defaultHomeId } ?: list.firstOrNull()
                } ?: return
            val point = home.location ?: return
            setHome(
                CrewDayBookHome(
                    line = home.address.orEmpty(),
                    city = home.city,
                    state = home.state,
                    zip = home.zipcode,
                    latitude = point.latitude,
                    longitude = point.longitude,
                    homeId = home.id,
                ),
            )
        }

        // MARK: - Your price

        fun changeHome() {
            _state.update { it.copy(changingHome = true, addressQuery = "", suggestions = emptyList()) }
        }

        fun setAddressQuery(text: String) {
            _state.update { it.copy(addressQuery = text) }
            searchJob?.cancel()
            searchJob =
                viewModelScope.launch {
                    delay(SEARCH_DEBOUNCE_MS)
                    val found = addresses.suggest(text)
                    _state.update { if (it.addressQuery == text) it.copy(suggestions = found) else it }
                }
        }

        fun pickAddress(suggestion: GeoSuggestion) {
            searchJob?.cancel()
            _state.update { it.copy(addressQuery = suggestion.label, suggestions = emptyList()) }
            viewModelScope.launch {
                when (val result = addresses.resolve(suggestion)) {
                    is NetworkResult.Success -> {
                        val address = result.data
                        val latitude = address.latitude
                        val longitude = address.longitude
                        if (latitude == null || longitude == null) {
                            _state.update { it.copy(quoteError = "Couldn't place that address. Try another one.") }
                            return@launch
                        }
                        setHome(
                            CrewDayBookHome(
                                line = address.address ?: suggestion.primaryText,
                                city = address.city,
                                state = address.state,
                                zip = address.zipcode,
                                latitude = latitude,
                                longitude = longitude,
                            ),
                        )
                    }
                    is NetworkResult.Failure -> _state.update { it.copy(quoteError = "Couldn't find that address. Try another one.") }
                }
            }
        }

        private fun setHome(home: CrewDayBookHome) {
            _state.update { it.copy(home = home, changingHome = false, quote = null, quoteError = null) }
            requote()
        }

        fun chooseOption(id: String) {
            _state.update { it.copy(optionId = id, quote = null) }
            requote()
        }

        fun toggleAddOn(id: String) {
            _state.update { it.copy(addOnIds = if (id in it.addOnIds) it.addOnIds - id else it.addOnIds + id, quote = null) }
            requote()
        }

        /** The server's price and area check for what's chosen now. */
        private fun requote() {
            val s = _state.value
            val home = s.home ?: return
            val optionId = s.optionId ?: return
            quoteJob?.cancel()
            _state.update { it.copy(quoting = true, quoteError = null) }
            quoteJob =
                viewModelScope.launch {
                    delay(QUOTE_DEBOUNCE_MS)
                    val body = CrewDayQuoteBody(home.latitude, home.longitude, home.line, optionId, s.addOnIds.toList())
                    when (val result = repository.quote(code, body)) {
                        is NetworkResult.Success -> _state.update { it.copy(quote = result.data, quoting = false) }
                        is NetworkResult.Failure ->
                            _state.update { it.copy(quoting = false, quoteError = result.error.crewDayMessage) }
                    }
                }
        }

        fun toReview() {
            if (!_state.value.canContinue) return
            _state.update { it.copy(step = CrewDayBookStep.Review, bookError = null) }
            loadMethods()
        }

        // MARK: - Review and book

        fun backToPrice() {
            _state.update { it.copy(step = CrewDayBookStep.Price, bookError = null) }
        }

        private fun loadMethods() {
            viewModelScope.launch {
                (payments.paymentMethods() as? NetworkResult.Success)?.data?.paymentMethods?.let { showMethods(it, preferNewest = false) }
                _state.update { it.copy(methodsLoaded = true) }
            }
        }

        private fun showMethods(
            methods: List<PaymentMethodDto>,
            preferNewest: Boolean,
        ) {
            val cards = methods.filter { it.paymentMethodType == null || it.paymentMethodType == "card" }.distinctBy { it.stripeId }
            _state.update { state ->
                val keep = state.methodId?.takeIf { id -> cards.any { it.stripeId == id } && !preferNewest }
                val newest = cards.lastOrNull()?.takeIf { preferNewest }?.stripeId
                val fallback = (cards.firstOrNull { it.isDefault } ?: cards.firstOrNull())?.stripeId
                state.copy(methods = cards, methodId = keep ?: newest ?: fallback, methodsLoaded = true)
            }
        }

        fun chooseMethod(stripeId: String) {
            _state.update { it.copy(methodId = stripeId, bookError = null) }
        }

        fun addCard() = cardSetup.tapAddMethod()

        fun onAddCardOutcome(outcome: AddCardOutcome) = cardSetup.onAddCardOutcome(outcome)

        suspend fun canPresentAddCardSheet(params: app.pantopus.android.data.api.models.payments.AddCardSheetParamsDto): Boolean =
            cardSetup.canPresentAddCardSheet(params)

        fun setAccessNote(text: String) {
            _state.update { it.copy(accessNote = text.take(MAX_NOTE)) }
        }

        fun setApproved(on: Boolean) {
            _state.update { it.copy(approved = on, bookError = null) }
        }

        fun book() {
            val s = _state.value
            val day = s.day ?: return
            val home = s.home ?: return
            val optionId = s.optionId ?: return
            val methodId = s.methodId ?: return
            if (!s.canBook) return
            _state.update { it.copy(booking = true, bookError = null) }
            viewModelScope.launch {
                val body =
                    CrewDayBookingBody(
                        clientRequestId = clientRequestId,
                        homeId = home.homeId,
                        address = CrewDayAddressDto(home.line, home.city, home.state, home.zip, home.latitude, home.longitude),
                        optionId = optionId,
                        addOnIds = s.addOnIds.toList(),
                        accessNote = s.accessNote.trim().ifEmpty { null },
                        paymentMethodId = methodId,
                    )
                when (val result = repository.book(day.id, body)) {
                    is NetworkResult.Success ->
                        _state.update { it.copy(booking = false, booked = result.data, step = CrewDayBookStep.Booked) }
                    is NetworkResult.Failure -> _state.update { it.copy(booking = false, bookError = bookMessage(day, result.error)) }
                }
            }
        }

        /** The refusal in the spec's words (screen 3, Errors), else the server's own sentence. */
        private fun bookMessage(
            day: CrewDayPublicDto,
            error: app.pantopus.android.data.api.net.NetworkError,
        ): String {
            val zone = CrewDayFormat.zone(day.timezone)
            val closes = CrewDayFormat.instant(day.bookingClosesAt)
            return when (error.crewDayCode) {
                "DAY_FULL" -> "This Crew Day filled up while you were booking."
                "BOOKING_CLOSED" -> closes?.let { "Booking closed on ${CrewDayFormat.shortDate(it, zone)}." } ?: "Booking is closed."
                "PAYMENT_METHOD_INVALID" -> "Your card couldn't be saved. Try another card."
                "OUT_OF_AREA" -> "This address is outside the Crew Day."
                else -> error.crewDayMessage
            }
        }

        private companion object {
            const val KEY_REQUEST = "crewDayClientRequestId"
            const val SEARCH_DEBOUNCE_MS = 250L
            const val QUOTE_DEBOUNCE_MS = 200L
            const val MAX_NOTE = 500
        }
    }
