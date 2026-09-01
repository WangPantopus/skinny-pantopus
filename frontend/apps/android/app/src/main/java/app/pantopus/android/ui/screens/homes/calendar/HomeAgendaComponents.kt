@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.calendar

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

// ─── Projection models ────────────────────────────────────────────────────

/** One agenda row. `isBooking` rows are read-only (eventId is null). */
@Immutable
data class HomeAgendaItem(
    val id: String,
    val time: String,
    val ampm: String,
    val title: String,
    val category: CalendarEventCategory,
    val location: String?,
    val members: List<HomeMember>,
    val isBooking: Boolean,
    val bookingStatus: String?,
    val bookingId: String?,
    val eventId: String?,
    /**
     * Non-null for the read-only derived task / bill / package due-date
     * rows. Such a row's whole visual identity — label, icon, background,
     * foreground — comes from this kind and never from [category]: a bill
     * must read in the Home pillar's unpaid red, not the category
     * palette's paid-green. It is also the row's read-only marker, so the
     * screen renders it with `enabled = false` (no click, no ripple).
     *
     * Parity contract — mirrored in iOS `HomeAgendaItem.derived`.
     */
    val derived: HomeCalendarDerivedKind? = null,
    /**
     * Secondary line under the title. Derived rows carry
     * `detail ?: kind.label` here rather than folded into [title], which
     * is `maxLines = 1` and would ellipsise it away first.
     */
    val subtitle: String? = null,
)

/**
 * The derived task / bill / package due-dates riding along with a batch of
 * calendar-event DTOs, keyed by the synthetic DTO's id.
 *
 * The projection takes this as a side-table rather than re-deriving a kind
 * from an `event_type` string: a derived row's label, icon, background,
 * foreground and subtitle all come from its own
 * [HomeCalendarDerivedItem], and its presence in the table is what exempts
 * the row from the member filter and marks it read-only.
 *
 * Parity contract — mirrored in iOS `HomeAgendaBuilder`'s `derived:` map.
 */
typealias HomeAgendaDerivedIndex = Map<String, HomeCalendarDerivedItem>

/** A day-grouped agenda section. */
@Immutable
data class HomeAgendaSection(
    val id: String,
    val header: String,
    val items: List<HomeAgendaItem>,
)

/** The member-scoped agenda filter. */
sealed interface MemberFilter {
    data object All : MemberFilter

    data object Mine : MemberFilter

    data class Member(val id: String, val name: String) : MemberFilter
}

/** Empty-agenda reasons. */
sealed interface AgendaEmpty {
    data object FirstRun : AgendaEmpty

    data class FilteredMember(val name: String) : AgendaEmpty

    data object FilteredDay : AgendaEmpty
}

// ─── Pure projection ──────────────────────────────────────────────────────

/**
 * Pure agenda/month-strip projection. Mirrors iOS `HomeAgendaBuilder` —
 * zone-parameterised (callers pass their display zone; production uses the
 * device zone, tests pin UTC), Sunday-first, deterministic for unit tests.
 * For *timestamped* rows the all-day heuristic is always UTC-anchored (wire
 * stores 00:00Z); a bare wire date carries no zone at all and instead
 * anchors to midnight in the display zone (see [parseInstant]).
 */
object HomeAgendaBuilder {
    private val isoDate = DateTimeFormatter.ISO_DATE
    private val headerFmt = DateTimeFormatter.ofPattern("EEE MMM d", Locale.US)
    private val timeFmt = DateTimeFormatter.ofPattern("h:mm", Locale.US)
    private val ampmFmt = DateTimeFormatter.ofPattern("a", Locale.US)
    private val monthFmt = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.US)

    // Narrow weekday — single initial ("S M T W T F S"), matching the
    // home-shell `MonthStrip` design and iOS's `EEEEE` (NOT the 3-letter
    // `EEE` abbreviation).
    private val dowFmt = DateTimeFormatter.ofPattern("EEEEE", Locale.US)

    private val utcZone = ZoneId.of("UTC")

    /** Length of a bare wire date, `yyyy-MM-dd`. */
    private const val DATE_ONLY_LENGTH = 10

    private fun bareDate(iso: String): LocalDate? =
        if (iso.length == DATE_ONLY_LENGTH) runCatching { LocalDate.parse(iso) }.getOrNull() else null

    /**
     * True when [iso] is a bare wire date (`"2025-10-14"`) — a Postgres
     * `date` column such as a bill's `due_date`, which carries no time and
     * no zone. Mirrors iOS `HomeAgendaBuilder.isDateOnly`.
     */
    fun isDateOnly(iso: String?): Boolean = iso != null && bareDate(iso) != null

    /**
     * Resolve a wire date into an instant.
     *
     * A bare `yyyy-MM-dd` has no zone on the wire, so it anchors to
     * **midnight in the display [zone]**, not midnight UTC: pinning it to
     * UTC renders every date-only row one day early west of UTC and drops
     * an item due today out of the agenda's "not before today" window.
     * Timestamped values are unaffected. Mirrors iOS `parseInstant`.
     *
     * The default zone keeps the callers that only ever see timestamps
     * (event detail, the gated scheduler) on their previous behaviour.
     */
    fun parseInstant(
        iso: String?,
        zone: ZoneId = utcZone,
    ): Instant? {
        if (iso.isNullOrBlank()) return null
        bareDate(iso)?.let { return it.atStartOfDay(zone).toInstant() }
        return runCatching { Instant.parse(iso) }.getOrNull()
    }

    private fun isoDay(
        instant: Instant,
        zone: ZoneId,
    ): String = instant.atZone(zone).toLocalDate().format(isoDate)

    private fun isMidnight(zoned: ZonedDateTime): Boolean = zoned.hour == 0 && zoned.minute == 0 && zoned.second == 0

    /**
     * Project a single DTO into an agenda item. Pass [derived] for a
     * synthetic derived-due-date row so the row renders that kind's own
     * identity instead of a [CalendarEventCategory] swatch.
     */
    fun item(
        dto: CalendarEventDto,
        start: Instant,
        members: Map<String, HomeMember>,
        zone: ZoneId,
        derived: HomeCalendarDerivedItem? = null,
    ): HomeAgendaItem {
        val zoned = start.atZone(zone)
        // Timestamped all-day rows are stored at midnight UTC + nil end — that
        // heuristic stays pinned to UTC no matter which zone the agenda
        // displays in. A bare `yyyy-MM-dd` (a bill's Postgres `date`) is all-day
        // by definition, and says so explicitly rather than relying on the zone
        // its midnight happens to land in.
        val allDay = isDateOnly(dto.startAt) || (dto.endAt == null && isMidnight(start.atZone(utcZone)))
        val time = if (allDay) "All day" else timeFmt.format(zoned)
        val ampm = if (allDay) "" else ampmFmt.format(zoned)
        val assigned = dto.assignedTo.orEmpty().mapNotNull { members[it] }
        return HomeAgendaItem(
            id = dto.id,
            time = time,
            ampm = ampm,
            title = derived?.title ?: dto.title,
            category = CalendarEventCategory.from(dto.eventType),
            location = dto.locationNotes?.takeIf { it.isNotBlank() },
            members = assigned,
            isBooking = dto.isBooking,
            bookingStatus = dto.bookingStatus,
            bookingId = dto.bookingId,
            // Derived rows mirror surfaces that own their own screens: they
            // expose no id to route with, on top of being rendered disabled.
            eventId = if (dto.isBooking || derived != null) null else dto.id,
            derived = derived?.kind,
            // Master's documented fallback — "Null for empty statuses so the
            // row falls back to its type label".
            subtitle = derived?.let { it.detail?.takeIf(String::isNotBlank) ?: it.kind.label },
        )
    }

    /**
     * Day-grouped sections. `selectedIsoDate` pins one day; else past events
     * drop.
     *
     * Rows listed in [derived] are **exempt from [onlyUserId]**: a task /
     * bill / package due-date carries no household owner, so filtering it by
     * owner would hide it under "Mine" and under every per-member chip —
     * the empty-looking month the derived feed exists to prevent, and
     * self-inconsistent with the month strip, which counts its dots
     * unfiltered. Parity contract — iOS applies the same exemption.
     */
    fun sections(
        events: List<CalendarEventDto>,
        members: Map<String, HomeMember>,
        now: Instant,
        zone: ZoneId,
        selectedIsoDate: String? = null,
        onlyUserId: String? = null,
        derived: HomeAgendaDerivedIndex = emptyMap(),
    ): List<HomeAgendaSection> {
        val parsed =
            events
                .mapNotNull { dto -> parseInstant(dto.startAt, zone)?.let { dto to it } }
                .filter { (dto, _) ->
                    onlyUserId == null ||
                        dto.id in derived ||
                        dto.assignedTo.orEmpty().contains(onlyUserId)
                }.sortedBy { it.second }
        val todayStart = now.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant()
        val kept =
            if (selectedIsoDate != null) {
                parsed.filter { isoDay(it.second, zone) == selectedIsoDate }
            } else {
                parsed.filter { !it.second.isBefore(todayStart) }
            }
        return kept
            .groupBy { isoDay(it.second, zone) }
            .toSortedMap()
            .map { (iso, bucket) ->
                HomeAgendaSection(
                    id = iso,
                    header = header(iso, now, zone),
                    items = bucket.map { (dto, start) -> item(dto, start, members, zone, derived[dto.id]) },
                )
            }
    }

    private fun header(
        iso: String,
        now: Instant,
        zone: ZoneId,
    ): String {
        val date = runCatching { LocalDate.parse(iso) }.getOrNull() ?: return iso
        val stamp = headerFmt.format(date)
        val today = now.atZone(zone).toLocalDate()
        return when (java.time.temporal.ChronoUnit.DAYS.between(today, date)) {
            0L -> "Today · $stamp"
            1L -> "Tomorrow · $stamp"
            else -> stamp
        }
    }

    /** Sunday-anchored start-of-week ISO date for [now]. */
    fun weekAnchorIso(
        now: Instant,
        zone: ZoneId,
    ): String {
        val date = now.atZone(zone).toLocalDate()
        val back =
            when (date.dayOfWeek) {
                java.time.DayOfWeek.SUNDAY -> 0
                java.time.DayOfWeek.MONDAY -> 1
                java.time.DayOfWeek.TUESDAY -> 2
                java.time.DayOfWeek.WEDNESDAY -> 3
                java.time.DayOfWeek.THURSDAY -> 4
                java.time.DayOfWeek.FRIDAY -> 5
                java.time.DayOfWeek.SATURDAY -> 6
            }
        return date.minusDays(back.toLong()).format(isoDate)
    }

    /**
     * Build the 7-day month-strip state from the visible week anchor. Dots
     * are counted unfiltered — every dated thing the agenda can place,
     * derived due-dates included.
     */
    fun weekStrip(
        events: List<CalendarEventDto>,
        anchorIso: String,
        selectedIso: String?,
        now: Instant,
        zone: ZoneId,
    ): MonthStripState {
        val anchor = runCatching { LocalDate.parse(anchorIso) }.getOrNull() ?: now.atZone(zone).toLocalDate()
        val dotCounts = mutableMapOf<String, Int>()
        for (dto in events) {
            val start = parseInstant(dto.startAt, zone) ?: continue
            val iso = isoDay(start, zone)
            dotCounts[iso] = (dotCounts[iso] ?: 0) + 1
        }
        val days =
            (0 until 7).map { offset ->
                val date = anchor.plusDays(offset.toLong())
                val iso = date.format(isoDate)
                MonthStripState.Day(
                    id = iso,
                    dayOfWeek = dowFmt.format(date),
                    date = date.dayOfMonth,
                    eventCount = dotCounts[iso] ?: 0,
                )
            }
        return MonthStripState(
            monthLabel = monthFmt.format(anchor),
            days = days,
            selectedIsoDate = selectedIso,
            todayIsoDate = isoDay(now, zone),
        )
    }
}

// ─── Row components ───────────────────────────────────────────────────────

/** The agenda union row. Mirrors iOS `HomeAgendaRowCard`. */
@Composable
fun HomeAgendaRowCard(
    item: HomeAgendaItem,
    modifier: Modifier = Modifier,
    dimmed: Boolean = false,
    enabled: Boolean = true,
    onTap: () -> Unit = {},
) {
    val rowLabel =
        buildString {
            append("${item.time} ${item.ampm}, ${item.title}, ${item.derived?.label ?: item.category.label}")
            if (item.isBooking) append(", Booking")
            item.subtitle?.let { append(", $it") }
            item.location?.let { append(", $it") }
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                // A derived due-date row is read-only by construction, not by
                // call-site discipline: no clickable node at all, so no click
                // target and no ripple. Mirrors iOS, which drops the Button
                // wrapper for `item.derived != nil`.
                .then(
                    if (enabled && item.derived == null) Modifier.clickable(onClick = onTap) else Modifier,
                )
                .padding(horizontal = Spacing.s3, vertical = 11.dp)
                .alpha(if (dimmed) 0.55f else 1f)
                .testTag("homeAgendaRow_${item.id}")
                .semantics { contentDescription = rowLabel },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.width(42.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(text = item.time, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            if (item.ampm.isNotEmpty()) {
                Text(text = item.ampm, fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextMuted)
            }
        }
        Box(modifier = Modifier.width(1.dp).height(36.dp).background(PantopusColors.appBorder))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = item.title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 1,
            )
            item.subtitle?.let { subtitle ->
                Text(
                    text = subtitle,
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                val kind = item.derived
                if (kind != null) DerivedKindChipMini(kind = kind) else CategoryChipMini(category = item.category)
                if (item.isBooking) {
                    HomeBookingTag()
                    item.bookingStatus?.let { SchedulingStatusBadge(status = it) }
                }
                item.location?.let { loc ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.MapPin,
                            contentDescription = null,
                            size = 10.dp,
                            tint = PantopusColors.appTextSecondary,
                        )
                        Text(text = loc, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
                    }
                }
            }
        }
        if (item.members.isNotEmpty()) {
            HomeAvatarStack(members = item.members, size = 26.dp)
        }
    }
}

/** Mini category chip — dot + label. Mirrors iOS `CategoryChipMini`. */
@Composable
fun CategoryChipMini(
    category: CalendarEventCategory,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 7.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(category.dotColor))
        Text(text = category.label, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextStrong)
    }
}

/**
 * Mini chip for a derived task / bill / package due-date. Draws the kind's
 * OWN label / icon / background / foreground — the Home dashboard's
 * per-feature accents (tasks = warning, bills = error, deliveries =
 * business) — instead of a [CalendarEventCategory] swatch, which would
 * render an unpaid bill in the category palette's paid-green.
 *
 * Parity contract — mirrored in iOS `DerivedKindChipMini`.
 */
@Composable
fun DerivedKindChipMini(
    kind: HomeCalendarDerivedKind,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(kind.background)
                .padding(horizontal = 7.dp, vertical = 2.dp)
                .testTag("homeAgendaDerivedChip_${kind.name}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(icon = kind.icon, contentDescription = null, size = 10.dp, tint = kind.foreground)
        Text(text = kind.label, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = kind.foreground)
    }
}

/** Loading skeleton row mirroring the loaded geometry. */
@Composable
fun HomeAgendaSkeletonRow(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.width(42.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Shimmer(width = 30.dp, height = 11.dp, cornerRadius = Radii.xs)
            Shimmer(width = 20.dp, height = 8.dp, cornerRadius = Radii.xs)
        }
        Box(modifier = Modifier.width(1.dp).height(36.dp).background(PantopusColors.appBorder))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Shimmer(width = 150.dp, height = 11.dp, cornerRadius = Radii.xs)
            Shimmer(width = 90.dp, height = 9.dp, cornerRadius = Radii.xs)
        }
        Shimmer(width = 26.dp, height = 26.dp, cornerRadius = Radii.pill)
    }
}

/** Horizontal member-filter chip row. Mirrors iOS `FilterChipRow`. */
@Composable
fun FilterChipRow(
    chips: List<MemberFilter>,
    selected: MemberFilter,
    onSelect: (MemberFilter) -> Unit,
    modifier: Modifier = Modifier,
    scrollState: ScrollState = rememberScrollState(),
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .horizontalScroll(scrollState)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        chips.forEach { chip ->
            val label = filterLabel(chip)
            val active = chip == selected
            Row(
                modifier =
                    Modifier
                        .heightIn(min = 30.dp)
                        .clip(RoundedCornerShape(percent = 50))
                        .background(if (active) PantopusColors.homeBg else PantopusColors.appSurface)
                        .then(
                            if (active) {
                                Modifier
                            } else {
                                Modifier.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(percent = 50))
                            },
                        ).clickable { onSelect(chip) }
                        .padding(horizontal = 13.dp, vertical = 6.dp)
                        .testTag("homeCalendar_filter_$label")
                        .semantics { this.selected = active },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = label,
                    fontSize = 12.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (active) PantopusColors.homeDark else PantopusColors.appTextStrong,
                )
            }
        }
    }
}

/** Filter chip label: All / Mine / first word of a member's name. */
fun filterLabel(filter: MemberFilter): String =
    when (filter) {
        MemberFilter.All -> "All"
        MemberFilter.Mine -> "Mine"
        is MemberFilter.Member -> filter.name.split(' ').firstOrNull().orEmpty().ifEmpty { filter.name }
    }

/** Section header text for the bespoke agenda body. */
@Composable
fun AgendaSectionHeader(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appTextSecondary,
        modifier = modifier.padding(horizontal = Spacing.s1, vertical = Spacing.s1),
    )
}
