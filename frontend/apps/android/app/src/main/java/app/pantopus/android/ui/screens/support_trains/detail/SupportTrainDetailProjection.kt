@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.support_trains.detail

import app.pantopus.android.core.identity.MadeUpUsername
import app.pantopus.android.data.api.models.support_trains.SupportTrainCoarseLocationDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainContributionMode
import app.pantopus.android.data.api.models.support_trains.SupportTrainDetailDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainModesDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainMyReservationDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainOrganizerDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainSlotDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainUpdateDto
import app.pantopus.android.ui.components.SlotCalendarDay
import app.pantopus.android.ui.components.SlotCalendarState
import java.text.SimpleDateFormat
import java.time.OffsetDateTime
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
 * author, the contributor strip shows the signup count without faces
 * (organizers aren't helpers), and the recipient identity defaults to Home.
 */
object SupportTrainDetailProjection {
    private const val MILLIS_PER_DAY = 1000L * 60 * 60 * 24

    fun project(dto: SupportTrainDetailDto): SupportTrainDetailContent {
        val slots = dto.slots ?: emptyList()
        val reservations = dto.myReservations ?: emptyList()
        val organizers = dto.organizers ?: emptyList()

        val covered = slots.count { it.isCovered }
        val total = slots.size
        val title = dto.title ?: dto.recipientSummary ?: "Support train"
        val primaryName = organizers.firstOrNull()?.user?.let { it.name ?: MadeUpUsername.chosen(it.username) }

        val typeDates =
            TypeDatesCardContent(
                kind = kind(dto.supportModes),
                title = title,
                dateRange = dateRange(slots),
                daysLeft = daysLeft(slots, dto.status),
                slotsFilled = covered,
                slotsTotal = total,
                contributors = emptyList(),
                extraCount = 0,
                status = dto.status,
            )
        val isFull = typeDates.isFullyCovered
        val mineSlotIds = reservations.mapNotNull { it.slotId }.toSet()
        val openSlots =
            slots
                .filter {
                    !it.isCovered && (it.status ?: "open") == "open" && it.id !in mineSlotIds && !isOver(it.slotDate)
                }
                .sortedBy { it.slotDate ?: "" }

        return SupportTrainDetailContent(
            trainId = dto.id,
            recipient = recipient(dto, primaryName),
            typeDates = typeDates,
            calendarDays = calendar(slots, reservations),
            sections = sections(slots, reservations),
            hostedBy = hostedBy(primaryName, organizers.firstOrNull()?.user?.id),
            dock = dock(dto.status, isFull),
            celebrationBanner =
                if (isFull) {
                    CelebrationBanner(
                        title = "Every slot is covered",
                        // No backup sign-up exists yet (see the dock), so don't offer one,
                        // and don't repeat the title.
                        body = "Thanks, neighbors. No more sign-ups are needed right now.",
                    )
                } else {
                    null
                },
            reserveOptions = openSlots.map { reserveOption(it) },
            reserveContext =
                ReserveSheetContext(
                    enabledModes = enabledModes(dto.supportModes),
                    restrictionChips =
                        ((dto.dietaryRestrictions ?: emptyList()) + (dto.dietaryPreferences ?: emptyList()))
                            .map(::dietaryLabel),
                    contactlessPreferred = dto.contactlessPreferred == true,
                ),
            viewerRole = viewerRole(dto),
            exactAddress = dto.address?.singleLineLabel?.takeIf { it.isNotBlank() },
            deliveryInstructions = dto.deliveryInstructions,
            updates = updateCards(dto.updates.orEmpty(), organizers),
        )
    }

    /**
     * The organizers' updates in the API's order (newest first), each signed by the organizer
     * who posted it. A made-up username is never shown; "Organizer" stands in, as on the web.
     */
    fun updateCards(
        updates: List<SupportTrainUpdateDto>,
        organizers: List<SupportTrainOrganizerDto>,
    ): List<TrainUpdateCard> {
        val names = mutableMapOf<String, String>()
        organizers.mapNotNull { it.organizerUser }.forEach { user ->
            val name = user.name?.takeIf { it.isNotBlank() } ?: MadeUpUsername.chosen(user.username)
            if (name != null && user.id !in names) names[user.id] = name
        }
        return updates.mapNotNull { update ->
            val body = update.body?.trim().orEmpty()
            if (body.isEmpty()) return@mapNotNull null
            TrainUpdateCard(
                id = update.id,
                author = update.authorUserId?.let { names[it] } ?: "Organizer",
                timeLabel = updateTimeLabel(update.createdAt),
                body = body,
            )
        }
    }

    /** "just now", "5m ago", "2h ago", then "Oct 3", as the web train page's Updates tab. */
    fun updateTimeLabel(
        iso: String?,
        nowMillis: Long = System.currentTimeMillis(),
    ): String? {
        if (iso.isNullOrBlank()) return null
        val posted = runCatching { OffsetDateTime.parse(iso).toInstant().toEpochMilli() }.getOrNull() ?: return null
        val minutes = ((nowMillis - posted).coerceAtLeast(0) / 60_000).toInt()
        return when {
            minutes < 1 -> "just now"
            minutes < 60 -> "${minutes}m ago"
            minutes < 60 * 24 -> "${minutes / 60}h ago"
            else -> SimpleDateFormat("MMM d", Locale.US).format(Date(posted))
        }
    }

    private fun dock(
        status: String?,
        isFull: Boolean,
    ): SupportTrainDock =
        signupsClosedReason(status)?.let { SupportTrainDock.Closed(it) }
            ?: if (isFull) SupportTrainDock.SendCardAndBackup else SupportTrainDock.SignUp("Sign up for a slot")

    /**
     * Reservations only open on a published or active train; the server
     * refuses the rest, so the dock says why instead of offering a sign-up.
     */
    fun signupsClosedReason(status: String?): String? =
        when (status) {
            "paused" -> "Signups paused"
            "completed", "archived" -> "This train has ended"
            "draft" -> "Not published yet"
            else -> null
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

    private fun hostedBy(
        primaryName: String?,
        primaryUserId: String?,
    ): HostedByFooter {
        val name = primaryName ?: "Organizer"
        return HostedByFooter(
            organizerInitials = initials(name),
            organizerDisplayName = name,
            neighborHint = null,
            organizerUserId = primaryUserId,
        )
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
                    else -> SlotCalendarState.Unscheduled // no slot that future day — inert/muted tile
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

        val open = slots.filter { !it.isCovered && !isOver(it.slotDate) }.sortedBy { it.slotDate ?: "" }
        if (open.isNotEmpty()) {
            val shown = open.take(4).map { slotRow(it, covered = false) }
            val action = if (open.size > shown.size) "See all ${open.size}" else null
            out +=
                SlotSection(
                    id = "open",
                    overline = "Open slots near you",
                    actionLabel = action,
                    rows = shown,
                    moreRows = open.drop(shown.size).map { slotRow(it, covered = false) },
                )
        }

        // The viewer's own signups are listed under "Your commitment". A slot only
        // they fill isn't repeated here, where it would read as a neighbor's.
        val mineCountBySlot = reservations.mapNotNull { it.slotId }.groupingBy { it }.eachCount()
        val covered =
            slots
                .filter { slot ->
                    val mine = mineCountBySlot[slot.id] ?: 0
                    slot.isCovered && (mine == 0 || (slot.filledCount ?: 0) > mine)
                }.sortedBy { it.slotDate ?: "" }
        if (covered.isNotEmpty()) {
            val shown = covered.take(4).map { slotRow(it, covered = true) }
            val action = if (covered.size > shown.size) "See all ${covered.size}" else null
            out +=
                SlotSection(
                    id = "covered",
                    overline = "Already on the train",
                    actionLabel = action,
                    rows = shown,
                    moreRows = covered.drop(shown.size).map { slotRow(it, covered = true) },
                )
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
            isBeforeSlotDay = date?.let { it.time > startOfTodayUtc().time } ?: false,
            slotDayLabel = date?.let { format(it, "EEE, MMM d") },
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

    // Days until the last slot. A closed Train has none left, whatever its last date.
    private fun daysLeft(
        slots: List<SupportTrainSlotDto>,
        status: String?,
    ): Int {
        if (status == "completed" || status == "archived") return 0
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
        // An arrival is an instant (the sign-up sheets send one), so it reads in the helper's own
        // time zone, as the Edit signup form shows it; in UTC a 5:30 pm drop-off read 12:30 AM.
        return SimpleDateFormat("h:mm a", Locale.US).format(date)
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

    // Today as the person sees it (their own calendar day), as that date at UTC midnight, which is how slot dates are
    // read. A UTC "today" runs ahead of a US evening and marked the day's own slot as over.
    private fun startOfTodayUtc(): Date {
        val local = Calendar.getInstance()
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.clear()
        cal.set(local.get(Calendar.YEAR), local.get(Calendar.MONTH), local.get(Calendar.DAY_OF_MONTH))
        return cal.time
    }

    // A slot whose date is before today can't take a signup. One without a readable date is never over.
    private fun isOver(slotDate: String?): Boolean = parseDate(slotDate)?.let { it.time < startOfTodayUtc().time } ?: false

    private fun initials(name: String): String {
        val words = name.trim().split(" ").filter { it.isNotEmpty() }.take(2)
        val letters = words.mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("")
        return letters.ifEmpty { "ST" }
    }
}

/** Stored dietary values are keys ("tree_nut_allergy"); helpers read "Tree nut allergy", as the web shows them. */
internal fun dietaryLabel(value: String): String = value.replace('_', ' ').trim().replaceFirstChar { it.uppercase() }
