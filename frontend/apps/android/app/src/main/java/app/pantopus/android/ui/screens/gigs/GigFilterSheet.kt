@file:Suppress("CyclomaticComplexMethod", "MagicNumber", "PackageNaming", "ReturnCount")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.gigs

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.gigs.CreateGigSavedSearchBody
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterControl
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterRange
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSection
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSheetShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.util.Locale

/**
 * P5.3 — Gig filter bottom sheet. A thin projection over the shared
 * [FilterSheetShell]: [GigFilterCriteria] builds the [FilterSection]s
 * the shell renders and parses the applied sections back into a typed
 * value the feed view-model filters its already-fetched gigs against.
 * Mirrors the iOS `GigFilterSheet.swift`.
 */

/**
 * Schedule chip filter. Backend `schedule_type` is loosely typed
 * ("scheduled" / "flexible" / seed values), so matching is tolerant.
 */
enum class GigScheduleFilter(
    val key: String,
    val label: String,
) {
    OneTime("oneTime", "One-time"),
    Recurring("recurring", "Recurring"),
    Flexible("flexible", "Flexible"),
    ;

    /**
     * P0.4 — wire value sent as the `schedule_type` query param when this
     * bucket is the only one selected (the backend takes a single value).
     */
    val backendValue: String
        get() =
            when (this) {
                OneTime -> "scheduled"
                Recurring -> "recurring"
                Flexible -> "flexible"
            }

    companion object {
        fun fromKey(key: String?): GigScheduleFilter? = entries.firstOrNull { it.key == key }

        /** Map a backend `schedule_type` to a bucket; `null` when unknown. */
        fun fromBackendKey(raw: String?): GigScheduleFilter? {
            val key = (raw ?: "").lowercase().replace("_", "").replace("-", "")
            return when (key) {
                "onetime", "scheduled", "once" -> OneTime
                "recurring", "repeat", "repeating" -> Recurring
                "flexible", "flex", "anytime" -> Flexible
                else -> null
            }
        }
    }
}

/** "Posted within" radio filter. */
enum class GigPostedWithin(
    val key: String,
    val label: String,
) {
    Anytime("anytime", "Anytime"),
    Today("today", "Today"),
    Week("week", "This week"),
    Month("month", "This month"),
    ;

    /** Earliest acceptable post epoch-second, or `null` for [Anytime]. */
    fun cutoffEpochSeconds(nowEpochSeconds: Long): Long? =
        when (this) {
            Anytime -> null
            Today -> nowEpochSeconds - 86_400
            Week -> nowEpochSeconds - 604_800
            Month -> nowEpochSeconds - 2_592_000
        }

    companion object {
        fun fromKey(key: String?): GigPostedWithin = entries.firstOrNull { it.key == key } ?: Anytime
    }
}

/**
 * Distance radius chips — RN `FilterChipBar.DISTANCE_CHIPS`. The wire
 * value is **meters** on `max_distance`; selecting one also pins
 * `includeRemote=false` so location-less remote tasks drop out.
 */
enum class GigDistanceFilter(
    val key: String,
    val label: String,
    /** `max_distance` query value in meters — RN's exact constants. */
    val meters: Int,
) {
    OneMile("oneMile", "Under 1 mi", 1_609),
    ThreeMiles("threeMiles", "Under 3 mi", 4_828),
    FiveMiles("fiveMiles", "Under 5 mi", 8_047),
    ;

    companion object {
        fun fromKey(key: String?): GigDistanceFilter? = entries.firstOrNull { it.key == key }
    }
}

/**
 * Deadline window chips — RN `FilterChipBar.TIME_CHIPS`. Rides the
 * `deadline` query param the backend narrows on
 * (`backend/routes/gigs.js:2209`).
 */
enum class GigDeadlineFilter(
    val key: String,
    val label: String,
    val backendValue: String,
) {
    Today("today", "Today", "today"),
    ThisWeek("thisWeek", "This week", "this_week"),
    ;

    /**
     * Latest acceptable `deadline`, mirroring the backend's cutoff
     * arithmetic (`backend/routes/gigs.js:2213-2244`): end of today, or
     * end of the upcoming Sunday.
     */
    fun cutoffEpochSeconds(nowEpochSeconds: Long): Long {
        val zone = java.time.ZoneId.systemDefault()
        val today = Instant.ofEpochSecond(nowEpochSeconds).atZone(zone).toLocalDate()
        val target =
            when (this) {
                Today -> today
                // JS `getDay()` is 0=Sunday; java.time's is 7=Sunday.
                ThisWeek -> today.plusDays((7 - (today.dayOfWeek.value % 7)).toLong())
            }
        return target.plusDays(1).atStartOfDay(zone).toEpochSecond() - 1
    }

    companion object {
        fun fromKey(key: String?): GigDeadlineFilter? = entries.firstOrNull { it.key == key }
    }
}

/**
 * Task-archetype chips — RN `FilterChipBar.ARCHETYPE_CHIPS`. Values
 * match the backend's `task_archetype` enum
 * (`backend/routes/gigs.js:508`).
 */
enum class GigTaskArchetypeFilter(
    val key: String,
    val label: String,
    val backendValue: String,
) {
    QuickHelp("quickHelp", "Quick help", "quick_help"),
    DeliveryErrand("deliveryErrand", "Delivery", "delivery_errand"),
    HomeService("homeService", "Home service", "home_service"),
    ProServiceQuote("proServiceQuote", "Pro service", "pro_service_quote"),
    CareTask("careTask", "Care", "care_task"),
    EventShift("eventShift", "Event", "event_shift"),
    RemoteTask("remoteTask", "Remote", "remote_task"),
    ;

    companion object {
        fun fromKey(key: String?): GigTaskArchetypeFilter? = entries.firstOrNull { it.key == key }
    }
}

/**
 * The applied Gig filter selection. The default value is the
 * "everything passes" position — [activeCount] is 0 and [matches]
 * returns `true` for every gig.
 */
@Immutable
data class GigFilterCriteria(
    /** Empty == "all categories". */
    val categories: Set<GigsCategory> = emptySet(),
    /** Lower budget handle (dollars). [BUDGET_MIN] == no lower bound. */
    val budgetLower: Float = BUDGET_MIN,
    /** Upper budget handle. [BUDGET_MAX] == "no ceiling" ($500+). */
    val budgetUpper: Float = BUDGET_MAX,
    /** Empty == "any schedule". */
    val schedules: Set<GigScheduleFilter> = emptySet(),
    /** When `true`, keep only gigs still accepting bids (unassigned). */
    val openToBids: Boolean = false,
    val postedWithin: GigPostedWithin = GigPostedWithin.Anytime,
    /** Distance radius chip (`max_distance` + `includeRemote=false`). */
    val distance: GigDistanceFilter? = null,
    /** Deadline window chip (`deadline`). */
    val deadline: GigDeadlineFilter? = null,
    /** Task-archetype chip (`task_archetype`). */
    val archetype: GigTaskArchetypeFilter? = null,
) {
    val isBudgetActive: Boolean
        get() = budgetLower > BUDGET_MIN || budgetUpper < BUDGET_MAX

    /** Number of active dimensions — drives the "N filters" pill. */
    val activeCount: Int
        get() {
            var count = 0
            if (categories.isNotEmpty()) count++
            if (isBudgetActive) count++
            if (schedules.isNotEmpty()) count++
            if (openToBids) count++
            if (postedWithin != GigPostedWithin.Anytime) count++
            if (distance != null) count++
            if (deadline != null) count++
            if (archetype != null) count++
            return count
        }

    /** `max_distance` query value (meters) — `backend/routes/gigs.js:2112`. */
    val serverMaxDistanceMeters: Int?
        get() = distance?.meters

    /**
     * `includeRemote` query value. RN pins it to `false` while a distance
     * chip is on so location-less remote tasks drop out
     * (`app/(tabs)/gigs.tsx:88`); otherwise the param is omitted.
     */
    val serverIncludeRemote: Boolean?
        get() = if (distance == null) null else false

    /** `deadline` query value — `backend/routes/gigs.js:2209`. */
    val serverDeadline: String?
        get() = deadline?.backendValue

    /** `task_archetype` query value — `backend/routes/gigs.js:2205`. */
    val serverTaskArchetype: String?
        get() = archetype?.backendValue

    fun toSections(): List<FilterSection> =
        listOf(
            FilterSection(
                id = "category",
                title = "Category",
                control =
                    FilterControl.ChipGroup(
                        options = categoryOptions.map { FilterOption(it.key, it.label) },
                        selectedIds = categories.map { it.key }.toSet(),
                    ),
            ),
            FilterSection(
                id = "budget",
                title = "Budget ($0–$500+)",
                control =
                    FilterControl.RangeSlider(
                        FilterRange(BUDGET_MIN, BUDGET_MAX, budgetLower, budgetUpper, BUDGET_STEP),
                    ),
            ),
            FilterSection(
                id = "schedule",
                title = "Schedule",
                control =
                    FilterControl.ChipGroup(
                        options = GigScheduleFilter.entries.map { FilterOption(it.key, it.label) },
                        selectedIds = schedules.map { it.key }.toSet(),
                    ),
            ),
            FilterSection(
                id = "openToBids",
                title = "Bids",
                control =
                    FilterControl.ChipGroup(
                        options = listOf(FilterOption(OPEN_TO_BIDS_OPTION_ID, "Open to bids only")),
                        selectedIds = if (openToBids) setOf(OPEN_TO_BIDS_OPTION_ID) else emptySet(),
                    ),
            ),
            FilterSection(
                id = "postedWithin",
                title = "Posted within",
                control =
                    FilterControl.Radio(
                        options = GigPostedWithin.entries.map { FilterOption(it.key, it.label) },
                        selectedId = postedWithin.key,
                    ),
            ),
            FilterSection(
                id = "distance",
                title = "Distance",
                control =
                    FilterControl.ChipGroup(
                        options = GigDistanceFilter.entries.map { FilterOption(it.key, it.label) },
                        selectedIds = setOfNotNull(distance?.key),
                    ),
            ),
            FilterSection(
                id = "deadline",
                title = "Due by",
                control =
                    FilterControl.ChipGroup(
                        options = GigDeadlineFilter.entries.map { FilterOption(it.key, it.label) },
                        selectedIds = setOfNotNull(deadline?.key),
                    ),
            ),
            FilterSection(
                id = "archetype",
                title = "Task type",
                control =
                    FilterControl.ChipGroup(
                        options = GigTaskArchetypeFilter.entries.map { FilterOption(it.key, it.label) },
                        selectedIds = setOfNotNull(archetype?.key),
                    ),
            ),
        )

    fun matchesCategory(category: GigsCategory): Boolean = categories.isEmpty() || category in categories

    fun matchesBudget(price: Double?): Boolean {
        if (!isBudgetActive) return true
        if (price == null) return false
        val withinLower = price >= budgetLower
        val withinUpper = budgetUpper >= BUDGET_MAX || price <= budgetUpper
        return withinLower && withinUpper
    }

    fun matches(
        gig: GigDto,
        nowEpochSeconds: Long,
    ): Boolean =
        matches(
            category = GigsCategory.fromBackendKey(gig.category),
            price = gig.price,
            scheduleType = gig.scheduleType,
            acceptedBy = gig.acceptedBy,
            createdAt = gig.createdAt,
            nowEpochSeconds = nowEpochSeconds,
        ) &&
            matchesFeedChips(gig, nowEpochSeconds)

    /**
     * The three RN chip-bar dimensions applied locally, for surfaces that
     * filter an already-fetched list (Tasks map pins). The Gigs feed
     * sends them as query params instead.
     */
    fun matchesFeedChips(
        gig: GigDto,
        nowEpochSeconds: Long,
    ): Boolean {
        distance?.let { chip ->
            val miles = gig.distanceMiles ?: return false
            if (miles * METERS_PER_MILE > chip.meters) return false
        }
        deadline?.let { chip ->
            val due = parseEpochSeconds(gig.deadline)
            if (due == null) {
                // RN keeps urgent tasks in the "Today" bucket even without
                // an explicit deadline (`backend/routes/gigs.js:2250`).
                return chip == GigDeadlineFilter.Today && gig.isUrgent == true
            }
            if (due > chip.cutoffEpochSeconds(nowEpochSeconds)) return false
        }
        archetype?.let { chip ->
            if (gig.taskArchetype != chip.backendValue) return false
        }
        return true
    }

    /**
     * Primitive-field overload for surfaces that project away the DTO
     * (the Tasks map's `TaskMapItem` — seed/preview mode has no `GigDto`).
     */
    @Suppress("LongParameterList")
    fun matches(
        category: GigsCategory,
        price: Double?,
        scheduleType: String?,
        acceptedBy: String?,
        createdAt: String?,
        nowEpochSeconds: Long,
    ): Boolean {
        return matchesCategory(category) &&
            matchesBudget(price) &&
            matchesSchedule(scheduleType) &&
            matchesOpenToBids(acceptedBy) &&
            matchesPostedWithin(createdAt, nowEpochSeconds)
    }

    /**
     * P6a — the current selection as a `POST /api/gigs/saved-searches`
     * body. Server-expressible dimensions only: budget extremes are
     * omitted, exactly-one schedule rides as `schedule_type` (when the
     * create schema accepts its wire value — `recurring` stays
     * client-side), and open-to-bids maps to `pay_type=offers`. The
     * derived [savedSearchLabel] doubles as the default `name`.
     */
    @Suppress("LongParameterList")
    fun toSavedSearchBody(
        category: GigsCategory?,
        search: String?,
        latitude: Double,
        longitude: Double,
        radiusMiles: Double,
    ): CreateGigSavedSearchBody {
        val categoryLabel = category?.takeIf { it != GigsCategory.All }?.label
        val schedule = schedules.singleOrNull()
        val cleanSearch = search?.trim()?.takeIf { it.isNotEmpty() }
        return CreateGigSavedSearchBody(
            name =
                savedSearchLabel(
                    categoryLabel = categoryLabel,
                    search = cleanSearch,
                    minPrice = savedSearchMinPrice,
                    maxPrice = savedSearchMaxPrice,
                    scheduleLabel = schedule?.label,
                    openToBids = openToBids,
                    radiusMiles = radiusMiles,
                ),
            category = category?.takeIf { it != GigsCategory.All }?.key,
            search = cleanSearch,
            minPrice = savedSearchMinPrice,
            maxPrice = savedSearchMaxPrice,
            scheduleType = schedule?.backendValue?.takeIf { it in SAVED_SEARCH_SCHEDULE_TYPES },
            payType = if (openToBids) "offers" else null,
            latitude = latitude,
            longitude = longitude,
            radiusMiles = radiusMiles,
        )
    }

    /** P6a — `min_price` wire value; `null` at the slider floor. */
    val savedSearchMinPrice: Double?
        get() = budgetLower.toDouble().takeIf { budgetLower > BUDGET_MIN }

    /** P6a — `max_price` wire value; `null` at the "$500+" ceiling handle. */
    val savedSearchMaxPrice: Double?
        get() = budgetUpper.toDouble().takeIf { budgetUpper < BUDGET_MAX }

    private fun matchesSchedule(scheduleType: String?): Boolean {
        if (schedules.isEmpty()) return true
        val bucket = GigScheduleFilter.fromBackendKey(scheduleType) ?: return false
        return bucket in schedules
    }

    private fun matchesOpenToBids(acceptedBy: String?): Boolean = !openToBids || acceptedBy.isNullOrEmpty()

    private fun matchesPostedWithin(
        createdAt: String?,
        nowEpochSeconds: Long,
    ): Boolean {
        val cutoff = postedWithin.cutoffEpochSeconds(nowEpochSeconds) ?: return true
        val posted = parseEpochSeconds(createdAt) ?: return false
        return posted >= cutoff
    }

    companion object {
        const val BUDGET_MIN = 0f
        const val BUDGET_MAX = 500f
        const val BUDGET_STEP = 25f
        const val OPEN_TO_BIDS_OPTION_ID = "openToBids"

        /** Meters per statute mile — converts `distance_miles` for the chips. */
        const val METERS_PER_MILE = 1_609.344

        /** Concrete categories the chip group offers (`All` is a sentinel). */
        val categoryOptions: List<GigsCategory> = GigsCategory.entries.filter { it != GigsCategory.All }

        /**
         * P6a — `schedule_type` values the saved-search create schema
         * accepts (`backend/routes/gigSavedSearches.js:27`). The feed's
         * `recurring` bucket isn't storable, so it's filtered client-side
         * only and never rides the POST.
         */
        val SAVED_SEARCH_SCHEDULE_TYPES: Set<String> = setOf("asap", "today", "scheduled", "flexible")

        fun fromSections(sections: List<FilterSection>): GigFilterCriteria {
            var categories = emptySet<GigsCategory>()
            var budgetLower = BUDGET_MIN
            var budgetUpper = BUDGET_MAX
            var schedules = emptySet<GigScheduleFilter>()
            var openToBids = false
            var postedWithin = GigPostedWithin.Anytime
            var distance: GigDistanceFilter? = null
            var deadline: GigDeadlineFilter? = null
            var archetype: GigTaskArchetypeFilter? = null
            sections.forEach { section ->
                val control = section.control
                when (section.id) {
                    "category" ->
                        if (control is FilterControl.ChipGroup) {
                            categories =
                                control.selectedIds
                                    .mapNotNull { key -> GigsCategory.entries.firstOrNull { it.key == key } }
                                    .toSet()
                        }
                    "budget" ->
                        if (control is FilterControl.RangeSlider) {
                            budgetLower = control.range.lower
                            budgetUpper = control.range.upper
                        }
                    "schedule" ->
                        if (control is FilterControl.ChipGroup) {
                            schedules = control.selectedIds.mapNotNull { GigScheduleFilter.fromKey(it) }.toSet()
                        }
                    "openToBids" ->
                        if (control is FilterControl.ChipGroup) {
                            openToBids = control.selectedIds.contains(OPEN_TO_BIDS_OPTION_ID)
                        }
                    "postedWithin" ->
                        if (control is FilterControl.Radio) {
                            postedWithin = GigPostedWithin.fromKey(control.selectedId)
                        }
                    // Single-valued dimensions: the backend takes one
                    // `max_distance` / `deadline` / `task_archetype`, so
                    // the last chip the user turned on wins.
                    "distance" ->
                        if (control is FilterControl.ChipGroup) {
                            distance = control.selectedIds.firstNotNullOfOrNull { GigDistanceFilter.fromKey(it) }
                        }
                    "deadline" ->
                        if (control is FilterControl.ChipGroup) {
                            deadline = control.selectedIds.firstNotNullOfOrNull { GigDeadlineFilter.fromKey(it) }
                        }
                    "archetype" ->
                        if (control is FilterControl.ChipGroup) {
                            archetype = control.selectedIds.firstNotNullOfOrNull { GigTaskArchetypeFilter.fromKey(it) }
                        }
                }
            }
            return GigFilterCriteria(
                categories = categories,
                budgetLower = budgetLower,
                budgetUpper = budgetUpper,
                schedules = schedules,
                openToBids = openToBids,
                postedWithin = postedWithin,
                distance = distance,
                deadline = deadline,
                archetype = archetype,
            )
        }

        private fun parseEpochSeconds(iso: String?): Long? {
            if (iso.isNullOrEmpty()) return null
            return runCatching { Instant.parse(iso).epochSecond }.getOrNull()
        }
    }
}

/**
 * P6a — derived saved-search display label and default `name`
 * ("Cleaning · under $100 · 5 mi"). Pure and shared by the POST body
 * builder and the manage-sheet row fallback so the two never drift.
 * Mirrors iOS `savedSearchLabel`.
 */
@Suppress("LongParameterList")
fun savedSearchLabel(
    categoryLabel: String? = null,
    search: String? = null,
    minPrice: Double? = null,
    maxPrice: Double? = null,
    scheduleLabel: String? = null,
    openToBids: Boolean = false,
    radiusMiles: Double? = null,
): String {
    val budget =
        when {
            minPrice != null && maxPrice != null -> "${dollars(minPrice)}–${dollars(maxPrice)}"
            maxPrice != null -> "under ${dollars(maxPrice)}"
            minPrice != null -> "over ${dollars(minPrice)}"
            else -> null
        }
    val criteriaParts =
        listOfNotNull(
            categoryLabel?.takeIf { it.isNotBlank() },
            search?.trim()?.takeIf { it.isNotEmpty() }?.let { "“$it”" },
            budget,
            scheduleLabel?.takeIf { it.isNotBlank() },
            "open to bids".takeIf { openToBids },
        ).ifEmpty { listOf("All tasks") }
    val radiusPart = radiusMiles?.let { listOf("${wholeMiles(it)} mi") } ?: emptyList()
    return (criteriaParts + radiusPart).joinToString(" · ")
}

/** "$100" for whole dollars, "$87.50" otherwise. */
private fun dollars(amount: Double): String = if (amount % 1.0 == 0.0) "$${amount.toInt()}" else String.format(Locale.US, "$%.2f", amount)

/** "5" for whole miles, "2.5" otherwise. */
private fun wholeMiles(miles: Double): String = if (miles % 1.0 == 0.0) "${miles.toInt()}" else String.format(Locale.US, "%.1f", miles)

/**
 * Gig filter bottom sheet. Host renders it conditionally; [onApply]
 * fires with the parsed criteria and the shell dismisses via [onDismiss].
 *
 * P6a — when [onSaveSearch] / [onManageSearches] are wired (the Gigs
 * feed host), the footer grows a "Save this search" button acting on the
 * live working sections plus a "Saved searches" link to the manage
 * sheet. The Tasks map host passes neither and keeps the stock footer.
 *
 * @param hasExternalCriteria `true` when a dimension outside the sheet
 *     (the feed's active category chip or search text) is active, so the
 *     save button enables even with a pristine sheet.
 */
@Composable
fun GigFilterSheet(
    criteria: GigFilterCriteria,
    onApply: (GigFilterCriteria) -> Unit,
    onDismiss: () -> Unit,
    hasExternalCriteria: Boolean = false,
    onSaveSearch: ((GigFilterCriteria) -> Unit)? = null,
    onManageSearches: (() -> Unit)? = null,
) {
    FilterSheetShell(
        sections = criteria.toSections(),
        onApply = { sections -> onApply(GigFilterCriteria.fromSections(sections)) },
        onDismiss = onDismiss,
        title = "Filters",
        footerAccessory =
            if (onSaveSearch == null && onManageSearches == null) {
                null
            } else {
                { sections ->
                    GigSaveSearchFooter(
                        criteria = GigFilterCriteria.fromSections(sections),
                        hasExternalCriteria = hasExternalCriteria,
                        onSaveSearch = onSaveSearch,
                        onManageSearches = onManageSearches,
                    )
                }
            },
    )
}

/**
 * P6a — footer accessory: "Save this search" (enabled when any criteria
 * dimension is active, in the sheet or outside it) + "Saved searches".
 */
@Composable
private fun GigSaveSearchFooter(
    criteria: GigFilterCriteria,
    hasExternalCriteria: Boolean,
    onSaveSearch: ((GigFilterCriteria) -> Unit)?,
    onManageSearches: (() -> Unit)?,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (onSaveSearch != null) {
            GhostButton(
                title = "Save this search",
                onClick = { onSaveSearch(criteria) },
                isEnabled = hasExternalCriteria || criteria.activeCount > 0,
                modifier = Modifier.weight(1f).testTag("gigFilters.saveSearch"),
            )
        }
        if (onManageSearches != null) {
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .clickable(onClick = onManageSearches)
                        .heightIn(min = 44.dp)
                        .padding(horizontal = Spacing.s2)
                        .testTag("gigFilters.manageSearches"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Saved searches",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
        }
    }
}
