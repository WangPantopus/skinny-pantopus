@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.support_trains.detail

import app.pantopus.android.data.api.models.support_trains.SupportTrainCoarseLocationDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainContributionMode
import app.pantopus.android.data.api.models.support_trains.SupportTrainDetailDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainModesDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainMyReservationDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainOrganizerDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainSlotDto
import app.pantopus.android.ui.components.SlotCalendarDay
import app.pantopus.android.ui.components.SlotCalendarState
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Maps the shared `GET /api/support-trains/:id` payload onto the Detail
 * render model. Mirrors iOS `SupportTrainDetailViewModel.project`.
 *
 * PROJECTION GAPS (degrade gracefully): `/:id` omits the per-slot helper /
 * dish and the contributor roster, so covered rows render without a dish
 * author, the contributor strip is built from `organizers`, and the
 * recipient identity defaults to Home.
 */
object SupportTrainDetailProjection {
    private val CONTRIBUTOR_TONES =
        listOf(ContributorTone.Warning, ContributorTone.Primary, ContributorTone.Business, ContributorTone.Success)

    private const val MILLIS_PER_DAY = 1000L * 60 * 60 * 24

    fun project(dto: SupportTrainDetailDto): SupportTrainDetailContent {
        val slots = dto.slots ?: emptyList()
        val reservations = dto.myReservations ?: emptyList()
        val organizers = dto.organizers ?: emptyList()

        val covered = slots.count { it.isCovered }
        val total = slots.size
        val title = dto.title ?: dto.recipientSummary ?: "Support train"
        val primaryName = organizers.firstOrNull()?.user?.let { it.name ?: it.username }

        val typeDates =
            TypeDatesCardContent(
                kind = kind(dto.supportModes),
                title = title,
                dateRange = dateRange(slots),
                daysLeft = daysLeft(slots),
                slotsFilled = covered,
                slotsTotal = total,
                contributors = contributors(organizers),
                extraCount = maxOf(0, covered - minOf(organizers.size, 4)),
            )
        val isFull = typeDates.isFullyCovered
        val mineSlotIds = reservations.mapNotNull { it.slotId }.toSet()
        val openSlots =
            slots
                .filter { !it.isCovered && (it.status ?: "open") == "open" && it.id !in mineSlotIds }
                .sortedBy { it.slotDate ?: "" }

        return SupportTrainDetailContent(
            trainId = dto.id,
            recipient = recipient(dto, primaryName),
            typeDates = typeDates,
            calendarDays = calendar(slots, reservations),
            sections = sections(slots, reservations),
            hostedBy = hostedBy(primaryName),
            dock = if (isFull) SupportTrainDock.SendCardAndBackup else SupportTrainDock.SignUp("Sign up for a slot"),
            celebrationBanner =
                if (isFull) {
                    CelebrationBanner(
                        title = "Every slot is covered",
                        body = "Every slot is spoken for. Sign up as backup in case someone can't make it.",
                    )
                } else {
                    null
                },
            reserveOptions = openSlots.map { reserveOption(it) },
            reserveContext =
                ReserveSheetContext(
                    enabledModes = enabledModes(dto.supportModes),
                    restrictionChips = (dto.dietaryRestrictions ?: emptyList()) + (dto.dietaryPreferences ?: emptyList()),
                    contactlessPreferred = dto.contactlessPreferred == true,
                ),
            viewerRole = viewerRole(dto),
            exactAddress = dto.address?.singleLineLabel?.takeIf { it.isNotBlank() },
            deliveryInstructions = dto.deliveryInstructions,
        )
    }

    /**
     * `viewer_level` + `viewer_support_train_role` → the client-side
     * permission gate (`backend/routes/supportTrains.js:3693`).
     */
    fun viewerRole(dto: SupportTrainDetailDto): SupportTrainViewerRole =
        when (dto.viewerSupportTrainRole) {
            "primary" -> SupportTrainViewerRole.PRIMARY_ORGANIZER
            "co_organizer", "recipient_delegate" -> SupportTrainViewerRole.CO_ORGANIZER
            "recipient" -> SupportTrainViewerRole.RECIPIENT
            "helper" -> SupportTrainViewerRole.HELPER
            else ->
                if (dto.viewerLevel == "organizer") {
                    SupportTrainViewerRole.CO_ORGANIZER
                } else {
                    SupportTrainViewerRole.VIEWER
                }
        }

    private fun enabledModes(modes: SupportTrainModesDto?): List<SupportTrainContributionMode> {
        if (modes == null) return SupportTrainContributionMode.entries.toList()
        return buildList {
            if (modes.homeCookedMeals == true) add(SupportTrainContributionMode.COOK)
            if (modes.takeout == true) add(SupportTrainContributionMode.TAKEOUT)
            if (modes.groceries == true) add(SupportTrainContributionMode.GROCERIES)
        }
    }

    private fun reserveOption(slot: SupportTrainSlotDto): ReserveSlotOption {
        val date = parseDate(slot.slotDate)
        return ReserveSlotOption(
            id = slot.id,
            dateLabel = date?.let { format(it, "EEEE, MMMM d") } ?: (slot.slotDate ?: ""),
            slotLabel = slot.slotLabel ?: slot.supportMode?.replaceFirstChar { it.uppercase() } ?: "Slot",
            windowLabel = windowLabel(slot),
        )
    }

    private fun windowLabel(slot: SupportTrainSlotDto): String? {
        val start = slot.startTime
        if (start.isNullOrEmpty()) return null
        val end = slot.endTime
        return if (end.isNullOrEmpty()) "${shortTime(start)}+" else "${shortTime(start)} – ${shortTime(end)}"
    }

    private fun recipient(
        dto: SupportTrainDetailDto,
        primaryName: String?,
    ): RecipientCardContent {
        val name = dto.title ?: dto.recipientSummary ?: "Support train"
        return RecipientCardContent(
            initials = initials(name),
            householdName = name,
            identityTag = RecipientIdentityTag.Home,
            verified = false,
            address = locationLabel(dto.coarseLocation),
            proximity = null,
            quote = dto.story ?: dto.recipientSummary ?: "",
            quoteAttribution = primaryName,
        )
    }

    private fun hostedBy(primaryName: String?): HostedByFooter {
        val name = primaryName ?: "Organizer"
        return HostedByFooter(organizerInitials = initials(name), organizerDisplayName = name, neighborHint = null)
    }

    private fun locationLabel(loc: SupportTrainCoarseLocationDto?): String {
        if (loc == null) return ""
        val city = loc.city
        val state = loc.state
        return when {
            city != null && state != null -> "$city, $state"
            city != null -> city
            state != null -> state
            else -> ""
        }
    }

    private fun kind(modes: SupportTrainModesDto?): SupportTrainKind =
        when {
            modes == null -> SupportTrainKind.Generic
            modes.homeCookedMeals == true || modes.takeout == true -> SupportTrainKind.Meals
            modes.groceries == true -> SupportTrainKind.Errands
            else -> SupportTrainKind.Generic
        }

    private fun contributors(organizers: List<SupportTrainOrganizerDto>): List<ContributorBubble> =
        organizers.take(4).mapIndexed { index, organizer ->
            val display = organizer.user?.let { it.name ?: it.username } ?: "Helper"
            ContributorBubble(
                id = organizer.id,
                initials = initials(display),
                tone = CONTRIBUTOR_TONES[index % CONTRIBUTOR_TONES.size],
            )
        }

    private fun calendar(
        slots: List<SupportTrainSlotDto>,
        reservations: List<SupportTrainMyReservationDto>,
    ): List<SlotCalendarDay> {
        val coveredDates = slots.filter { it.isCovered }.mapNotNull { parseDate(it.slotDate)?.time }.toSet()
        val openDates = slots.filterNot { it.isCovered }.mapNotNull { parseDate(it.slotDate)?.time }.toSet()
        val slotById = slots.associateBy { it.id }
        val mineDates =
            reservations.mapNotNull { res -> res.slotId?.let { slotById[it] }?.let { parseDate(it.slotDate)?.time } }.toSet()

        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        val earliest = slots.mapNotNull { parseDate(it.slotDate) }.minByOrNull { it.time } ?: startOfTodayUtc()
        cal.time = earliest
        cal.add(Calendar.DAY_OF_MONTH, -(cal.get(Calendar.DAY_OF_WEEK) - 1))
        val start = cal.time
        val todayMillis = startOfTodayUtc().time

        return (0 until 28).map { idx ->
            cal.time = start
            cal.add(Calendar.DAY_OF_MONTH, idx)
            val date = cal.time
            val millis = date.time
            val state =
                when {
                    millis < todayMillis -> SlotCalendarState.Past
                    millis == todayMillis -> SlotCalendarState.Today
                    millis in mineDates -> SlotCalendarState.Mine
                    millis in coveredDates -> SlotCalendarState.Filled
                    millis in openDates -> SlotCalendarState.Open
                    else -> SlotCalendarState.Past // no slot that future day — inert/muted tile
                }
            SlotCalendarDay(id = "day-$idx", date = date, dayNumber = cal.get(Calendar.DAY_OF_MONTH), state = state)
        }
    }

    private fun sections(
        slots: List<SupportTrainSlotDto>,
        reservations: List<SupportTrainMyReservationDto>,
    ): List<SlotSection> {
        val out = mutableListOf<SlotSection>()
        val slotById = slots.associateBy { it.id }

        val mineRows = reservations.map { reservationRow(it, it.slotId?.let { id -> slotById[id] }) }
        if (mineRows.isNotEmpty()) {
            out += SlotSection(id = "mine", overline = "Your commitment", rows = mineRows)
        }

        val open = slots.filterNot { it.isCovered }.sortedBy { it.slotDate ?: "" }
        if (open.isNotEmpty()) {
            val shown = open.take(4).map { slotRow(it, covered = false) }
            val action = if (open.size > shown.size) "See all ${open.size}" else null
            out += SlotSection(id = "open", overline = "Open slots near you", actionLabel = action, rows = shown)
        }

        val covered = slots.filter { it.isCovered }.sortedBy { it.slotDate ?: "" }
        if (covered.isNotEmpty()) {
            val shown = covered.take(4).map { slotRow(it, covered = true) }
            val action = if (covered.size > shown.size) "See all ${covered.size}" else null
            out += SlotSection(id = "covered", overline = "Already on the train", actionLabel = action, rows = shown)
        }
        return out
    }

    private fun slotRow(
        slot: SupportTrainSlotDto,
        covered: Boolean,
    ): SlotRowContent {
        val date = parseDate(slot.slotDate)
        val label = slot.slotLabel ?: slot.supportMode?.replaceFirstChar { it.uppercase() } ?: "a slot"
        return SlotRowContent(
            id = slot.id,
            dayLabel = date?.let { format(it, "EEE") } ?: "",
            dateLabel = date?.let { format(it, "d") } ?: "",
            state = if (covered) SlotRowState.Covered else SlotRowState.Open,
            // Detail endpoint omits the per-slot helper.
            author = null,
            title = if (covered) label else "Open · $label",
            subtitle = dropWindow(slot.endTime),
            mine = false,
            slotId = slot.id,
        )
    }

    private fun reservationRow(
        reservation: SupportTrainMyReservationDto,
        slot: SupportTrainSlotDto?,
    ): SlotRowContent {
        val date = slot?.let { parseDate(it.slotDate) }
        val title =
            reservation.dishTitle
                ?: reservation.restaurantName
                ?: reservation.contributionMode?.replaceFirstChar { it.uppercase() }
                ?: "Your contribution"
        return SlotRowContent(
            id = reservation.id,
            dayLabel = date?.let { format(it, "EEE") } ?: "",
            dateLabel = date?.let { format(it, "d") } ?: "",
            state = SlotRowState.Covered,
            author = SlotRowAuthor(initials = "YO", displayName = "You", tone = ContributorTone.Primary),
            title = title,
            subtitle = arrivalLabel(reservation.estimatedArrivalAt) ?: reservation.noteToRecipient,
            mine = true,
            slotId = reservation.slotId,
            reservationId = reservation.id,
            reservationStatus = reservation.status,
        )
    }

    private fun dropWindow(end: String?): String? {
        if (end.isNullOrEmpty()) return null
        return "Drop off by ${shortTime(end)}"
    }

    private fun dateRange(slots: List<SupportTrainSlotDto>): String {
        val dates = slots.mapNotNull { parseDate(it.slotDate) }
        val min = dates.minByOrNull { it.time } ?: return ""
        val max = dates.maxByOrNull { it.time } ?: return ""
        return "${format(min, "EEE MMM d")} → ${format(max, "EEE MMM d")}"
    }

    private fun daysLeft(slots: List<SupportTrainSlotDto>): Int {
        val max = slots.mapNotNull { parseDate(it.slotDate) }.maxByOrNull { it.time } ?: return 0
        val diff = ((max.time - startOfTodayUtc().time) / MILLIS_PER_DAY).toInt()
        return maxOf(0, diff)
    }

    private fun arrivalLabel(iso: String?): String? {
        if (iso == null) return null
        val date =
            listOf("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ssXXX").firstNotNullOfOrNull { pattern ->
                runCatching { utcFormatter(pattern).parse(iso) }.getOrNull()
            } ?: return null
        return utcFormatter("h:mm a").format(date)
    }

    private fun shortTime(hhmm: String): String {
        val parsed =
            listOf("HH:mm:ss", "HH:mm").firstNotNullOfOrNull { pattern ->
                runCatching { utcFormatter(pattern).parse(hhmm) }.getOrNull()
            } ?: return hhmm
        return utcFormatter("h:mm a").format(parsed).lowercase(Locale.US)
    }

    private fun parseDate(value: String?): Date? {
        if (value == null) return null
        return runCatching { utcFormatter("yyyy-MM-dd").parse(value.take(10)) }.getOrNull()
    }

    private fun format(
        date: Date,
        pattern: String,
    ): String = utcFormatter(pattern).format(date)

    private fun utcFormatter(pattern: String): SimpleDateFormat =
        SimpleDateFormat(pattern, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }

    private fun startOfTodayUtc(): Date {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.time
    }

    private fun initials(name: String): String {
        val words = name.trim().split(" ").filter { it.isNotEmpty() }.take(2)
        val letters = words.mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("")
        return letters.ifEmpty { "ST" }
    }
}
