@file:Suppress("TooManyFunctions")

package app.pantopus.android.ui.screens.crewday.create

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayAddOnDto
import app.pantopus.android.data.api.models.crewday.CrewDayCenterDto
import app.pantopus.android.data.api.models.crewday.CrewDayCreateBody
import app.pantopus.android.data.api.models.crewday.CrewDayDto
import app.pantopus.android.data.api.models.crewday.CrewDayFeeDto
import app.pantopus.android.data.api.models.crewday.CrewDayServiceDto
import app.pantopus.android.data.api.models.crewday.CrewDayPriceOptionDto
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.geo.NormalizedAddress
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDayAddresses
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.ui.screens.crewday.CrewDayRoutes
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardSecondaryCta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime
import javax.inject.Inject

/** The four steps of New Crew Day (01-spec screen 14), then the "Waiting for Pantopus" page. */
enum class NewCrewDayStep(val number: Int) {
    Service(1),
    WhereWhen(2),
    Prices(3),
    Review(4),
    Sent(5),
}

/** A price row as typed: [price] is dollars ("180" or "180.50"); empty while [needsLook]. */
data class PriceOptionDraft(
    val id: String,
    val label: String,
    val price: String = "",
    val needsLook: Boolean = false,
)

data class AddOnDraft(
    val id: String,
    val label: String,
    val price: String = "",
)

/** How far a day reaches from its center (01-spec screen 14). */
enum class CrewDayReach(val meters: Int, val label: String) {
    Street(150, "Just this street (about 150 m)"),
    Blocks(400, "A few blocks (about 400 m)"),
    Neighborhood(800, "The neighborhood (about 800 m)"),
}

data class NewCrewDayState(
    val step: NewCrewDayStep = NewCrewDayStep.Service,
    val service: String = "gutter_cleaning",
    val included: List<String> = includedFor("gutter_cleaning"),
    val outsideOnly: Boolean = true,
    val streetLabel: String = "",
    val centerQuery: String = "",
    val centerSuggestions: List<GeoSuggestion> = emptyList(),
    val center: NormalizedAddress? = null,
    val reach: CrewDayReach = CrewDayReach.Street,
    val date: LocalDate? = null,
    val windowStart: LocalTime = LocalTime.of(9, 0),
    val windowEnd: LocalTime = LocalTime.of(13, 0),
    val capacity: Int = 10,
    val closesHoursBefore: Int = 48,
    val options: List<PriceOptionDraft> = optionsFor("gutter_cleaning"),
    val addOns: List<AddOnDraft> = addOnsFor("gutter_cleaning"),
    val prepNote: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
    val dirty: Boolean = false,
    /** The day once Pantopus has it: [sentForApproval] false means it was saved as a draft. */
    val created: CrewDayDto? = null,
    val sentForApproval: Boolean = false,
    /** The services the server offers, with the items each starts with; the built-in list until it answers. */
    val services: List<CrewDayServiceDto> = emptyList(),
    val fee: CrewDayFeeDto? = null,
) {
    /** What the step still needs, in words; null when it can go on. */
    val problem: String?
        get() =
            when (step) {
                NewCrewDayStep.Service -> serviceProblem()
                NewCrewDayStep.WhereWhen -> whereWhenProblem()
                NewCrewDayStep.Prices -> pricesProblem()
                NewCrewDayStep.Review, NewCrewDayStep.Sent -> null
            }

    private fun serviceProblem(): String? =
        when {
            included.none { it.isNotBlank() } -> "Add at least one thing the crew does."
            included.any { it.length > MAX_INCLUDED_LENGTH } -> "Keep each item under 120 characters."
            else -> null
        }

    private fun whereWhenProblem(): String? =
        when {
            streetLabel.isBlank() -> "Name the street or area."
            center == null -> "Pick the center from the suggestions."
            date == null -> "Pick a date."
            !windowEnd.isAfter(windowStart) -> "The arrival window has to end after it starts."
            closesAt()?.isAfter(ZonedDateTime.now()) != true -> "Booking would already be closed. Pick a later date."
            else -> null
        }

    private fun pricesProblem(): String? =
        when {
            options.isEmpty() -> "Add at least one price."
            options.any { it.label.isBlank() } -> "Give every price a name."
            options.any { !it.needsLook && cents(it.price) == null } -> "Give every price an amount, or check \"after a look\"."
            addOns.any { it.label.isBlank() || cents(it.price) == null } -> "Give every add-on a name and an amount."
            prepNote.length > MAX_NOTE_LENGTH -> "Keep the note under 500 characters."
            else -> null
        }

    /** The items [service] starts with: the server's list when it sent one, else the built-in one. */
    fun startingIncluded(service: String): List<String> =
        services.firstOrNull { it.key == service }?.included?.takeIf { it.isNotEmpty() } ?: includedFor(service)

    /** "Gutter cleaning": the server's label, else the built-in one. */
    fun serviceLabel(service: String): String = services.firstOrNull { it.key == service }?.label ?: CrewDayFormat.service(service)

    /** "Pantopus keeps 10% of each charge (founding business)." */
    val feeLine: String
        get() {
            val pct = fee?.ratePct?.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() }
            val why = if (fee?.founding == true) " (founding business)" else ""
            val keeps = pct?.let { "Pantopus keeps $it% of each charge$why." } ?: "Pantopus keeps its fee from each charge."
            return "$keeps Money reaches your bank 48 hours after each charge."
        }

    /** When booking closes: the window's start minus [closesHoursBefore], in the Crew Day's zone. */
    fun closesAt(): ZonedDateTime? = date?.atTime(windowStart)?.atZone(CrewDayFormat.DEFAULT_ZONE)?.minusHours(closesHoursBefore.toLong())

    companion object {
        const val MAX_INCLUDED = 6
        const val MAX_OPTIONS = 6
        const val MAX_ADD_ONS = 4
        const val MAX_INCLUDED_LENGTH = 120
        const val MAX_NOTE_LENGTH = 500

        /** "180" or "$180.50" → cents; null when it isn't a positive amount. */
        fun cents(price: String): Int? {
            val text = price.trim().removePrefix("$").replace(",", "")
            val value = text.toBigDecimalOrNull() ?: return null
            if (value <= BigDecimal.ZERO || value.scale() > 2) return null
            return value.movePointRight(2).toInt()
        }

        /** The included items a service starts with; the crew edits them. */
        fun includedFor(service: String): List<String> =
            when (service) {
                "gutter_cleaning" -> listOf("Cleans every gutter by hand", "Flushes each downspout", "Bags the debris and takes it away")
                "leaf_cleanup" -> listOf("Rakes and blows the lawn and beds", "Bags the leaves and takes them away")
                "roof_moss" -> listOf("Removes moss from the roof by hand", "Treats the roof to slow regrowth", "Cleans up the debris")
                "holiday_lights" -> listOf("Hangs the lights on the roofline", "Takes them down after the holidays")
                "window_washing" -> listOf("Washes every outside window", "Wipes the frames and sills")
                "pressure_washing" -> listOf("Pressure washes the driveway and walkways")
                else -> listOf("")
            }

        fun optionsFor(service: String): List<PriceOptionDraft> =
            when (service) {
                "gutter_cleaning", "roof_moss", "window_washing" ->
                    listOf(
                        PriceOptionDraft("o1", "One story"),
                        PriceOptionDraft("o2", "Two stories"),
                        PriceOptionDraft("o3", "Three or more stories", needsLook = true),
                    )
                else -> listOf(PriceOptionDraft("o1", "Standard home"))
            }

        fun addOnsFor(service: String): List<AddOnDraft> =
            when (service) {
                "gutter_cleaning" -> listOf(AddOnDraft("a1", "Clean the gutter guards"))
                else -> emptyList()
            }
    }
}

/** What the wizard asks its host to do. */
sealed interface NewCrewDayEvent {
    data object Close : NewCrewDayEvent
}

/**
 * New Crew Day (screen 14) on the existing Wizard archetype: service and what's included, where and when, prices,
 * and review. Send goes to Pantopus for approval (`POST /api/crew-days` with `submit`); Save draft keeps it as a
 * draft. `repeatOf` prefills it from a finished day ("Offer a Crew Day here again").
 */
@HiltViewModel
class NewCrewDayViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        private val addresses: CrewDayAddresses,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel(),
        WizardModel {
        private val businessId = savedStateHandle.get<String>(CrewDayRoutes.BUSINESS_ID_KEY).orEmpty()
        private val repeatOf = savedStateHandle.get<String>(CrewDayRoutes.REPEAT_OF_KEY)?.takeIf { it.isNotBlank() }
        private val _state = MutableStateFlow(NewCrewDayState())
        val state: StateFlow<NewCrewDayState> = _state.asStateFlow()
        private val _events = MutableStateFlow<NewCrewDayEvent?>(null)
        val events: StateFlow<NewCrewDayEvent?> = _events.asStateFlow()
        private var searchJob: Job? = null

        init {
            readBusiness()
            repeatOf?.let(::prefill)
        }

        /** The services (and the items each starts with) and the fee line come from the business's Crew Days read. */
        private fun readBusiness() {
            if (businessId.isBlank()) return
            viewModelScope.launch {
                val business = (repository.business(businessId) as? NetworkResult.Success)?.data ?: return@launch
                _state.update { state ->
                    val starting = business.services.firstOrNull { it.key == state.service }?.included
                    state.copy(
                        services = business.services,
                        fee = business.fee,
                        // Nothing typed yet: the server's starting items replace the built-in ones.
                        included = if (!state.dirty && repeatOf == null && !starting.isNullOrEmpty()) starting else state.included,
                    )
                }
            }
        }

        private fun prefill(dayId: String) {
            viewModelScope.launch {
                val day = (repository.crewDay(dayId) as? NetworkResult.Success)?.data ?: return@launch
                _state.update {
                    it.copy(
                        service = day.service ?: it.service,
                        included = day.included.ifEmpty { it.included },
                        outsideOnly = day.outsideOnly,
                        streetLabel = day.streetLabel.orEmpty(),
                        centerQuery = "",
                        windowStart = CrewDayFormat.time(day.windowStart) ?: it.windowStart,
                        windowEnd = CrewDayFormat.time(day.windowEnd) ?: it.windowEnd,
                        capacity = day.capacity.takeIf { c -> c in 1..MAX_CAPACITY } ?: it.capacity,
                        reach = day.radiusM?.let(::reachFor) ?: it.reach,
                        options =
                            day.priceOptions.mapIndexed { index, option ->
                                PriceOptionDraft(
                                    id = "o${index + 1}",
                                    label = option.label,
                                    price = option.priceCents?.let(::dollars).orEmpty(),
                                    needsLook = option.needsLook,
                                )
                            }.ifEmpty { it.options },
                        addOns =
                            day.addOns.mapIndexed { index, addOn ->
                                AddOnDraft("a${index + 1}", addOn.label, dollars(addOn.priceCents))
                            },
                        prepNote = day.prepNote.orEmpty(),
                    )
                }
            }
        }

        override val chrome: WizardChrome
            get() {
                val s = _state.value
                val sent = s.step == NewCrewDayStep.Sent
                return WizardChrome(
                    title = "New Crew Day",
                    progressLabel = if (sent) WizardProgressLabel.Hidden else WizardProgressLabel.StepOf(s.step.number, STEPS),
                    progressFraction = if (sent) null else s.step.number.toFloat() / STEPS,
                    leading = if (s.step == NewCrewDayStep.Service || sent) WizardLeadingControl.Close else WizardLeadingControl.Back,
                    primaryCtaLabel =
                        when (s.step) {
                            NewCrewDayStep.Review -> "Send to Pantopus for approval"
                            NewCrewDayStep.Sent -> "Done"
                            else -> "Continue"
                        },
                    primaryCtaEnabled = s.problem == null && !s.submitting,
                    secondaryCta = WizardSecondaryCta("Save draft", "crewDayNewSaveDraft").takeIf { s.step == NewCrewDayStep.Review },
                    isSubmitting = s.submitting,
                    footerHint = s.problem?.takeIf { s.dirty && s.step != NewCrewDayStep.Service } ?: s.error,
                    dirty = s.dirty && !sent,
                    showsProgressBar = !sent,
                    primaryCtaTestTag =
                        when (s.step) {
                            NewCrewDayStep.Review -> "crewDayNewSend"
                            NewCrewDayStep.Sent -> "crewDayNewDone"
                            else -> "crewDayNewContinue"
                        },
                )
            }

        override fun onLeading() {
            when (_state.value.step) {
                NewCrewDayStep.Service, NewCrewDayStep.Sent -> _events.value = NewCrewDayEvent.Close
                NewCrewDayStep.WhereWhen -> go(NewCrewDayStep.Service)
                NewCrewDayStep.Prices -> go(NewCrewDayStep.WhereWhen)
                NewCrewDayStep.Review -> go(NewCrewDayStep.Prices)
            }
        }

        override fun onDiscard() {
            _events.value = NewCrewDayEvent.Close
        }

        override fun onPrimary() {
            val s = _state.value
            if (s.problem != null || s.submitting) return
            when (s.step) {
                NewCrewDayStep.Service -> go(NewCrewDayStep.WhereWhen)
                NewCrewDayStep.WhereWhen -> go(NewCrewDayStep.Prices)
                NewCrewDayStep.Prices -> go(NewCrewDayStep.Review)
                NewCrewDayStep.Review -> save(submit = true)
                // Done: back to the crew's list, where the day now waits for Pantopus (or sits in Drafts).
                NewCrewDayStep.Sent -> _events.value = NewCrewDayEvent.Close
            }
        }

        override fun onSecondary() {
            if (_state.value.step == NewCrewDayStep.Review) save(submit = false)
        }

        fun eventHandled() {
            _events.value = null
        }

        private fun go(step: NewCrewDayStep) {
            _state.update { it.copy(step = step, error = null) }
        }

        private fun edit(change: (NewCrewDayState) -> NewCrewDayState) {
            _state.update { change(it).copy(dirty = true, error = null) }
        }

        // MARK: - Step 1

        fun setService(service: String) =
            edit {
                // A new service brings its own starting list, unless the crew already changed the old one.
                val keepIncluded = it.included != it.startingIncluded(it.service)
                val keepPrices = it.options != NewCrewDayState.optionsFor(it.service) || it.addOns != NewCrewDayState.addOnsFor(it.service)
                it.copy(
                    service = service,
                    included = if (keepIncluded) it.included else it.startingIncluded(service),
                    options = if (keepPrices) it.options else NewCrewDayState.optionsFor(service),
                    addOns = if (keepPrices) it.addOns else NewCrewDayState.addOnsFor(service),
                )
            }

        fun setIncluded(
            index: Int,
            text: String,
        ) = edit { it.copy(included = it.included.mapIndexed { i, old -> if (i == index) text else old }) }

        fun addIncluded() = edit { if (it.included.size < NewCrewDayState.MAX_INCLUDED) it.copy(included = it.included + "") else it }

        fun removeIncluded(index: Int) = edit { it.copy(included = it.included.filterIndexed { i, _ -> i != index }) }

        fun setOutsideOnly(on: Boolean) = edit { it.copy(outsideOnly = on) }

        // MARK: - Step 2

        fun setStreetLabel(text: String) = edit { it.copy(streetLabel = text.take(MAX_LABEL)) }

        fun setCenterQuery(text: String) {
            edit { it.copy(centerQuery = text, center = null) }
            searchJob?.cancel()
            searchJob =
                viewModelScope.launch {
                    delay(SEARCH_DEBOUNCE_MS)
                    val found = addresses.suggest(text)
                    _state.update { if (it.centerQuery == text) it.copy(centerSuggestions = found) else it }
                }
        }

        fun pickCenter(suggestion: GeoSuggestion) {
            searchJob?.cancel()
            _state.update { it.copy(centerQuery = suggestion.label, centerSuggestions = emptyList()) }
            viewModelScope.launch {
                when (val result = addresses.resolve(suggestion)) {
                    is NetworkResult.Success ->
                        edit {
                            it.copy(
                                center = result.data,
                                // "Maple Lane" from "123 Maple Lane" when the crew hasn't named the street yet.
                                streetLabel = it.streetLabel.ifBlank { streetOf(result.data.address) },
                            )
                        }
                    is NetworkResult.Failure -> _state.update { it.copy(error = "Couldn't find that address. Try another one.") }
                }
            }
        }

        fun setReach(reach: CrewDayReach) = edit { it.copy(reach = reach) }

        fun setDate(date: LocalDate) = edit { it.copy(date = date) }

        fun setWindowStart(time: LocalTime) = edit { it.copy(windowStart = time) }

        fun setWindowEnd(time: LocalTime) = edit { it.copy(windowEnd = time) }

        fun setCapacity(value: Int) = edit { it.copy(capacity = value.coerceIn(1, MAX_CAPACITY)) }

        fun setClosesHoursBefore(hours: Int) = edit { it.copy(closesHoursBefore = hours) }

        // MARK: - Step 3

        fun setOption(
            index: Int,
            option: PriceOptionDraft,
        ) = edit { it.copy(options = it.options.mapIndexed { i, old -> if (i == index) option else old }) }

        fun addOption() =
            edit {
                if (it.options.size >= NewCrewDayState.MAX_OPTIONS) {
                    it
                } else {
                    it.copy(options = it.options + PriceOptionDraft(nextId("o", it.options.map(PriceOptionDraft::id)), ""))
                }
            }

        fun removeOption(index: Int) = edit { it.copy(options = it.options.filterIndexed { i, _ -> i != index }) }

        fun setAddOn(
            index: Int,
            addOn: AddOnDraft,
        ) = edit { it.copy(addOns = it.addOns.mapIndexed { i, old -> if (i == index) addOn else old }) }

        fun addAddOn() =
            edit {
                if (it.addOns.size >= NewCrewDayState.MAX_ADD_ONS) {
                    it
                } else {
                    it.copy(addOns = it.addOns + AddOnDraft(nextId("a", it.addOns.map(AddOnDraft::id)), ""))
                }
            }

        fun removeAddOn(index: Int) = edit { it.copy(addOns = it.addOns.filterIndexed { i, _ -> i != index }) }

        fun setPrepNote(text: String) = edit { it.copy(prepNote = text) }

        // MARK: - Send

        private fun save(submit: Boolean) {
            val s = _state.value
            val center = s.center ?: return
            val latitude = center.latitude ?: return
            val longitude = center.longitude ?: return
            val date = s.date ?: return
            _state.update { it.copy(submitting = true, error = null) }
            viewModelScope.launch {
                val body =
                    CrewDayCreateBody(
                        businessId = businessId,
                        service = s.service,
                        streetLabel = s.streetLabel.trim(),
                        city = center.city,
                        state = center.state,
                        center = CrewDayCenterDto(latitude, longitude),
                        radiusM = s.reach.meters,
                        serviceDate = date.toString(),
                        windowStart = s.windowStart.toString(),
                        windowEnd = s.windowEnd.toString(),
                        capacity = s.capacity,
                        bookingClosesAt = s.closesAt()?.toInstant()?.toString(),
                        included = s.included.map(String::trim).filter(String::isNotEmpty),
                        outsideOnly = s.outsideOnly,
                        prepNote = s.prepNote.trim().ifEmpty { null },
                        priceOptions =
                            s.options.map {
                                CrewDayPriceOptionDto(
                                    id = it.id,
                                    label = it.label.trim(),
                                    priceCents = if (it.needsLook) null else NewCrewDayState.cents(it.price),
                                    needsLook = it.needsLook,
                                )
                            },
                        addOns = s.addOns.map { CrewDayAddOnDto(it.id, it.label.trim(), NewCrewDayState.cents(it.price) ?: 0) },
                        submit = submit,
                        repeatOf = repeatOf,
                    )
                when (val result = repository.create(body)) {
                    is NetworkResult.Success ->
                        _state.update {
                            it.copy(
                                submitting = false,
                                created = result.data,
                                sentForApproval = submit,
                                step = NewCrewDayStep.Sent,
                                dirty = false,
                            )
                        }
                    is NetworkResult.Failure -> _state.update { it.copy(submitting = false, error = result.error.crewDayMessage) }
                }
            }
        }

        private companion object {
            const val STEPS = 4
            const val MAX_CAPACITY = 60
            const val MAX_LABEL = 80
            const val SEARCH_DEBOUNCE_MS = 250L

            fun dollars(cents: Int): String = if (cents % 100 == 0) (cents / 100).toString() else "%d.%02d".format(cents / 100, cents % 100)

            fun nextId(
                prefix: String,
                taken: List<String>,
            ): String = generateSequence(1) { it + 1 }.map { "$prefix$it" }.first { it !in taken }

            /** The reach closest to a day's radius. */
            fun reachFor(meters: Int): CrewDayReach = CrewDayReach.entries.minBy { kotlin.math.abs(it.meters - meters) }

            /** "123 Maple Lane" → "Maple Lane". */
            fun streetOf(address: String?): String = address.orEmpty().trim().replace(Regex("^[0-9]+[A-Za-z]?\\s+"), "").take(MAX_LABEL)
        }
    }
