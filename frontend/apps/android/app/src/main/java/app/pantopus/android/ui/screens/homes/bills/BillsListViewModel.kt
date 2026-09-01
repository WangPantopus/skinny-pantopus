@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.bills

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * Canonical chip status for a bill, derived from `BillDto.status` +
 * `due_date`. T6.0a adds [DueSoon] (≤ 7 days from now) and [Cancelled]
 * (soft-deleted).
 */
enum class BillChipStatus { Due, DueSoon, Overdue, Scheduled, Paid, Cancelled }

/** Tab identifiers — kept as strings so they survive the
 *  `ListOfRowsScreen` selectedTab contract. */
enum class BillsTab(val id: String) {
    Upcoming("upcoming"),
    Paid("paid"),
    All("all"),
    ;

    companion object {
        fun fromId(id: String): BillsTab = entries.firstOrNull { it.id == id } ?: Upcoming
    }
}

/**
 * Pure projection of one bill into a row's display fields. Tested
 * directly via [BillsListViewModel.project].
 */
data class BillRowProjection(
    val payee: String,
    val subtitle: String,
    val amount: String,
    val chipText: String,
    val chipVariant: StatusChipVariant,
    val chipIcon: PantopusIcon?,
    val status: BillChipStatus,
    val category: UtilityCategory,
    val inlineChip: RowChip?,
    val highlight: RowHighlight?,
)

private data class BillProjectionStyle(
    val subtitle: String,
    val chipText: String,
    val chipVariant: StatusChipVariant,
    val chipIcon: PantopusIcon?,
    val inlineChip: RowChip?,
    val highlight: RowHighlight?,
)

/**
 * Banner data for the Bills summary banner. Pure projection from the
 * loaded bills + clock — exposed as a top-level value so tests can
 * exercise it without standing the VM up.
 */
data class BillsBannerSummary(
    /**
     * Pre-formatted USD string for the 30-day total
     * (e.g. `"$1,248.19"`). `null` when zero bills are due.
     */
    val totalDueLabel: String?,
    /** Count of overdue, non-cancelled, unpaid bills. */
    val overdueCount: Int,
    /**
     * Pre-formatted next-bill subtitle when nothing is overdue, e.g.
     * `"All current · next bill in 4 days"`.
     */
    val nextBillSubtitle: String?,
) {
    /**
     * Whether the banner has anything to render. The shell hides the
     * banner when this returns `false` so empty-state surfaces don't
     * carry a "0 due in the next 30 days" preamble.
     */
    val hasContent: Boolean
        get() = totalDueLabel != null || overdueCount > 0
}

/** Nav arg key for the Bills list route. */
const val BILLS_HOME_ID_KEY = "homeId"

/**
 * ViewModel for the Bills list (T6.0a re-skin of T5.2.2). Wraps
 * `GET /api/homes/:id/bills` and projects each bill into the
 * `RowTrailing.AmountWithChip` template + a utility-tinted
 * `RowLeading.TypeIcon` (utility category derived client-side from
 * the payee string — see [UtilityCategory]).
 *
 * Drift from T5.2.2:
 *  - 8 utility-tinted category tiles + `generic`.
 *  - 6-status chip palette (added `DueSoon` for due-in-7d and
 *    `Cancelled` for soft-deleted rows).
 *  - Summary banner above the list — 30-day total + overdue count.
 *  - Optional inline "Auto-pay" chip on scheduled rows.
 *  - FAB shrunk to 56dp [FabVariant.CanonicalCreate] + [FabTint.Home].
 *  - Top-bar action is `null` by design — the FAB owns the create
 *    intent and the design's filter glyph isn't wired to a real filter
 *    sheet yet.
 *
 * Splits: [SplitStackData] is wired on `RowModel` (shell extension
 * T6.0a) but stays `null` on every row today — the backend list
 * endpoint doesn't surface split membership on bills yet.
 */
@HiltViewModel
class BillsListViewModel
    internal constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
        private val clock: () -> Instant = Instant::now,
    ) : ViewModel() {
        @Inject
        constructor(
            repo: HomesRepository,
            savedStateHandle: SavedStateHandle,
        ) : this(repo, savedStateHandle, Instant::now)

        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(BILLS_HOME_ID_KEY)) {
                "BillsListViewModel requires a $BILLS_HOME_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(BillsTab.Upcoming.id)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(initialTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        private var bills: List<BillDto>? = null
        private var onOpenBill: (String) -> Unit = {}
        private var onAddBill: () -> Unit = {}

        fun configureNavigation(
            onOpenBill: (String) -> Unit = {},
            onAddBill: () -> Unit = {},
        ) {
            this.onOpenBill = onOpenBill
            this.onAddBill = onAddBill
        }

        fun load() {
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getHomeBills(homeId)) {
                    is NetworkResult.Success -> applySuccess(result.data.bills)
                    is NetworkResult.Failure -> {
                        bills = null
                        _banner.value = null
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                    }
                }
            }
        }

        fun selectTab(id: String) {
            _selectedTab.value = id
            bills?.let(::renderForCurrentTab)
        }

        fun fab(): FabAction =
            FabAction(
                icon = PantopusIcon.Plus,
                contentDescription = "Add a bill",
                variant = FabVariant.CanonicalCreate,
                tint = FabTint.Home,
                onClick = { onAddBill() },
            )

        /**
         * T6.0a: top-bar action is `null` by design. The design's filter
         * glyph isn't wired to a real filter sheet yet; the 3 tabs cover
         * the design's filter intent. The FAB owns the canonical "Add a
         * bill" action so we don't need a duplicate entry point in the
         * top bar. Tracked for a follow-up if a filter sheet ships.
         */
        val topBarAction: TopBarAction? = null

        /**
         * Compute the banner summary for the currently-loaded bills.
         * Exposed `internal` so tests can exercise it without going
         * through the Compose layer.
         */
        fun currentBannerSummary(): BillsBannerSummary {
            val loaded = bills ?: return BillsBannerSummary(null, 0, null)
            return summarize(loaded, clock())
        }

        private fun applySuccess(loaded: List<BillDto>) {
            bills = loaded
            _tabs.value = tabsWithCounts(loaded)
            renderForCurrentTab(loaded)
        }

        private fun renderForCurrentTab(loaded: List<BillDto>) {
            val now = clock()
            val tab = BillsTab.fromId(_selectedTab.value)
            val active = loaded.filter { passes(it, tab, now) }
            if (active.isEmpty()) {
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Receipt,
                        headline = "No bills tracked yet",
                        subcopy =
                            "Add the utilities, insurance, and HOA dues for this home. " +
                                "Schedule auto-pay or split between household members.",
                        ctaTitle = "Add a bill",
                        onCta = { onAddBill() },
                    )
                return
            }
            val rows = active.map { rowFor(it, now) }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "bills", rows = rows)),
                    hasMore = false,
                )
            _banner.value = bannerFor(tab, loaded, now)
        }

        private fun bannerFor(
            tab: BillsTab,
            loaded: List<BillDto>,
            now: Instant,
        ): BannerConfig? {
            // Only show the banner on the Upcoming tab (matches iOS).
            if (tab != BillsTab.Upcoming) return null
            val summary = summarize(loaded, now)
            if (!summary.hasContent) return null
            return BannerConfig(
                icon = PantopusIcon.Wallet,
                title = bannerTitle(summary),
                subtitle = bannerSubtitle(summary),
                tint = BannerCtaTint.Home,
            )
        }

        private fun bannerTitle(summary: BillsBannerSummary): String =
            summary.totalDueLabel?.let { "$it due in the next 30 days" } ?: "No upcoming bills"

        private fun bannerSubtitle(summary: BillsBannerSummary): String? {
            if (summary.overdueCount > 0) {
                val count = summary.overdueCount
                return if (count == 1) {
                    "1 overdue · pay or schedule today"
                } else {
                    "$count overdue · pay or schedule today"
                }
            }
            return summary.nextBillSubtitle
        }

        private fun rowFor(
            bill: BillDto,
            now: Instant,
        ): RowModel {
            val projection = project(bill, now)
            val category = projection.category
            return RowModel(
                id = bill.id,
                title = projection.payee,
                subtitle = projection.subtitle,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.TypeIcon(
                        icon = category.icon,
                        background = category.background,
                        foreground = category.foreground,
                    ),
                trailing =
                    RowTrailing.AmountWithChip(
                        amount = projection.amount,
                        chipText = projection.chipText,
                        chipVariant = projection.chipVariant,
                        chipIcon = projection.chipIcon,
                    ),
                onTap = { onOpenBill(bill.id) },
                inlineChip = projection.inlineChip,
                highlight = projection.highlight,
            )
        }

        private fun passes(
            bill: BillDto,
            tab: BillsTab,
            now: Instant,
        ): Boolean {
            val chip = chipStatus(bill, now)
            return when (tab) {
                BillsTab.Upcoming ->
                    // Upcoming excludes cancelled + paid; everything else
                    // (due, dueSoon, overdue, scheduled) is upcoming.
                    chip != BillChipStatus.Cancelled && chip != BillChipStatus.Paid
                BillsTab.Paid -> chip == BillChipStatus.Paid
                BillsTab.All -> chip != BillChipStatus.Cancelled
            }
        }

        private fun tabsWithCounts(loaded: List<BillDto>): List<ListOfRowsTab> {
            val now = clock()
            var upcoming = 0
            var paid = 0
            var all = 0
            for (b in loaded) {
                val chip = chipStatus(b, now)
                if (chip == BillChipStatus.Cancelled) continue
                all += 1
                if (chip == BillChipStatus.Paid) {
                    paid += 1
                } else {
                    upcoming += 1
                }
            }
            return listOf(
                ListOfRowsTab(BillsTab.Upcoming.id, "Upcoming", upcoming),
                ListOfRowsTab(BillsTab.Paid.id, "Paid", paid),
                ListOfRowsTab(BillsTab.All.id, "All", all),
            )
        }

        private fun initialTabs(): List<ListOfRowsTab> =
            listOf(
                ListOfRowsTab(BillsTab.Upcoming.id, "Upcoming"),
                ListOfRowsTab(BillsTab.Paid.id, "Paid"),
                ListOfRowsTab(BillsTab.All.id, "All"),
            )

        companion object {
            /** Pure mapping from a bill + clock to display strings. */
            @JvmStatic
            fun project(
                bill: BillDto,
                now: Instant,
            ): BillRowProjection {
                val chip = chipStatus(bill, now)
                val category = UtilityCategory.from(bill.providerName)
                val payee = bill.providerName ?: category.label
                val amount = formatCurrency(bill.displayAmount)
                val dueShort = formatDateShort(bill.dueDate)
                val paidShort = formatDateShort(bill.paidAt)
                val style = projectionStyle(chip, dueShort, paidShort)

                return BillRowProjection(
                    payee = payee,
                    subtitle = style.subtitle,
                    amount = amount,
                    chipText = style.chipText,
                    chipVariant = style.chipVariant,
                    chipIcon = style.chipIcon,
                    status = chip,
                    category = category,
                    inlineChip = style.inlineChip,
                    highlight = style.highlight,
                )
            }

            private fun projectionStyle(
                chip: BillChipStatus,
                dueShort: String?,
                paidShort: String?,
            ): BillProjectionStyle =
                when (chip) {
                    BillChipStatus.Paid ->
                        BillProjectionStyle(
                            subtitle = paidShort?.let { "Paid $it" } ?: "Paid",
                            chipText = "Paid",
                            chipVariant = StatusChipVariant.Success,
                            chipIcon = PantopusIcon.Check,
                            inlineChip = null,
                            highlight = null,
                        )
                    BillChipStatus.Cancelled ->
                        BillProjectionStyle(
                            subtitle = "Cancelled",
                            chipText = "Cancelled",
                            chipVariant = StatusChipVariant.Neutral,
                            chipIcon = PantopusIcon.X,
                            inlineChip = null,
                            highlight = RowHighlight.Muted,
                        )
                    BillChipStatus.Overdue ->
                        BillProjectionStyle(
                            subtitle = dueShort?.let { "Overdue · was due $it" } ?: "Overdue",
                            chipText = "Overdue",
                            chipVariant = StatusChipVariant.ErrorVariant,
                            chipIcon = PantopusIcon.AlertCircle,
                            inlineChip = null,
                            highlight = null,
                        )
                    BillChipStatus.DueSoon ->
                        BillProjectionStyle(
                            subtitle = dueShort?.let { "Due $it" } ?: "Due soon",
                            chipText = "Due soon",
                            chipVariant = StatusChipVariant.Warning,
                            chipIcon = PantopusIcon.Clock,
                            inlineChip = null,
                            highlight = null,
                        )
                    BillChipStatus.Scheduled ->
                        BillProjectionStyle(
                            subtitle = dueShort?.let { "Auto-pays $it" } ?: "Auto-pay scheduled",
                            chipText = "Scheduled",
                            chipVariant = StatusChipVariant.Info,
                            chipIcon = PantopusIcon.Calendar,
                            inlineChip =
                                RowChip(
                                    text = "Auto-pay",
                                    icon = PantopusIcon.ArrowsRepeat,
                                    tint = RowChip.Tint.Status(StatusChipVariant.Info),
                                ),
                            highlight = null,
                        )
                    BillChipStatus.Due ->
                        BillProjectionStyle(
                            subtitle = dueShort?.let { "Due $it" } ?: "No due date",
                            chipText = "Due",
                            chipVariant = StatusChipVariant.Warning,
                            chipIcon = PantopusIcon.Clock,
                            inlineChip = null,
                            highlight = null,
                        )
                }

            /**
             * Derive the chip status per the T6.0a contract:
             *  - [BillChipStatus.Cancelled]  when status is "cancelled"
             *  - [BillChipStatus.Paid]       when status is "paid"
             *  - [BillChipStatus.Scheduled]  when status is "scheduled"
             *  - [BillChipStatus.Overdue]    when due_date is in the past
             *  - [BillChipStatus.DueSoon]    when due_date is within 7 days
             *  - [BillChipStatus.Due]        otherwise
             */
            @JvmStatic
            fun chipStatus(
                bill: BillDto,
                now: Instant,
            ): BillChipStatus {
                val due = bill.dueDate?.let(::parseInstant)
                val sevenDaysOut = now.plus(Duration.ofDays(7))
                return when {
                    bill.status == "cancelled" -> BillChipStatus.Cancelled
                    bill.status == "paid" -> BillChipStatus.Paid
                    bill.status == "scheduled" -> BillChipStatus.Scheduled
                    due?.isBefore(now) == true -> BillChipStatus.Overdue
                    due != null && !due.isAfter(sevenDaysOut) -> BillChipStatus.DueSoon
                    else -> BillChipStatus.Due
                }
            }

            /** Pure summary projection. Public-static for tests. */
            @JvmStatic
            fun summarize(
                bills: List<BillDto>,
                now: Instant,
            ): BillsBannerSummary {
                val thirtyDaysOut = now.plus(Duration.ofDays(30))
                var totalDue: BigDecimal = BigDecimal.ZERO
                var overdueCount = 0
                var totalCount = 0
                var nextDue: Pair<Instant, BillDto>? = null
                for (bill in bills) {
                    val chip = chipStatus(bill, now)
                    if (chip == BillChipStatus.Cancelled || chip == BillChipStatus.Paid) continue
                    totalCount += 1
                    val due = bill.dueDate?.let(::parseInstant)
                    if (due == null) {
                        // No due date — still surface in the total when the
                        // bill is upcoming (scheduled with no date, etc.).
                        totalDue = totalDue + bill.displayAmount
                    } else {
                        // Sum due in next 30 days (overdue counts too — user owes it).
                        totalDue = totalDue + dueAmountInWindow(bill, due, thirtyDaysOut)
                        nextDue = nextDueCandidate(nextDue, due, bill, now)
                    }
                    if (chip == BillChipStatus.Overdue) overdueCount += 1
                }
                val totalLabel = if (totalCount > 0) formatCurrency(totalDue) else null
                val nextSubtitle =
                    nextDue?.let { (date, _) ->
                        val days = Duration.between(now, date).toDays().toInt()
                        when {
                            days <= 0 -> "Next bill due today"
                            days == 1 -> "All current · next bill tomorrow"
                            else -> "All current · next bill in $days days"
                        }
                    }
                return BillsBannerSummary(
                    totalDueLabel = totalLabel,
                    overdueCount = overdueCount,
                    nextBillSubtitle = nextSubtitle,
                )
            }

            private fun dueAmountInWindow(
                bill: BillDto,
                due: Instant,
                thirtyDaysOut: Instant,
            ): BigDecimal = if (!due.isAfter(thirtyDaysOut)) bill.displayAmount else BigDecimal.ZERO

            private fun nextDueCandidate(
                current: Pair<Instant, BillDto>?,
                due: Instant,
                bill: BillDto,
                now: Instant,
            ): Pair<Instant, BillDto>? =
                when {
                    due.isBefore(now) -> current
                    current == null || due.isBefore(current.first) -> due to bill
                    else -> current
                }

            @JvmStatic
            fun formatCurrency(amount: BigDecimal): String =
                NumberFormat.getCurrencyInstance(Locale.US).apply {
                    maximumFractionDigits = 2
                    minimumFractionDigits = 2
                }.format(amount)

            @JvmStatic
            fun formatDateShort(iso: String?): String? {
                if (iso.isNullOrBlank()) return null
                val instant = parseInstant(iso) ?: return null
                val local = instant.atZone(ZoneId.of("UTC"))
                return DateTimeFormatter.ofPattern("MMM d", Locale.US).format(local)
            }

            private fun parseInstant(iso: String): Instant? =
                runCatching { Instant.parse(iso) }
                    .recoverCatching {
                        // Fallback to bare date strings (`yyyy-MM-dd`).
                        DateTimeFormatter
                            .ofPattern("yyyy-MM-dd")
                            .parse(iso, java.time.LocalDate::from)
                            .atStartOfDay(ZoneId.of("UTC"))
                            .toInstant()
                    }.getOrNull()
        }
    }
