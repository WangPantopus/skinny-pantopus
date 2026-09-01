@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homedashboard

import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Home dashboard aggregate and the Home Intelligence
 * endpoints under `backend/routes/home.js`:
 *  - `GET   /api/homes/:id/dashboard`                  (line 6224)
 *  - `GET   /api/homes/:id/health-score`               (line 7482)
 *  - `GET   /api/homes/:id/seasonal-checklist`         (line 7504)
 *  - `PATCH /api/homes/:id/seasonal-checklist/:itemId` (line 7577)
 *  - `GET   /api/homes/:id/bill-trends`                (line 7599)
 *  - `GET   /api/homes/:id/property-value`             (line 7752)
 *
 * The dashboard's sub-lists use the same column sets as the standalone
 * list endpoints (`backend/utils/columns.js`), so [HomeTaskDto],
 * [BillDto] and [CalendarEventDto] are reused rather than redeclared.
 */

// ── Dashboard aggregate ─────────────────────────────────────────────

/** Response of `GET /api/homes/:id/dashboard`. */
@JsonClass(generateAdapter = true)
data class HomeDashboardResponse(
    val home: HomeDashboardHomeDto? = null,
    val myAccess: HomeDashboardAccessDto? = null,
    val today: HomeDashboardTodayDto = HomeDashboardTodayDto(),
    val counts: HomeDashboardCountsDto = HomeDashboardCountsDto(),
    val members: List<HomeDashboardMemberDto> = emptyList(),
    @Json(name = "recent_activity") val recentActivity: List<HomeAuditLogEntryDto> = emptyList(),
    /** Only present when the caller passed `?include_health_score=true`. */
    @Json(name = "health_score") val healthScore: HomeHealthScoreDto? = null,
)

/**
 * The subset of the `Home` record the dashboard header needs. The backend
 * returns `select('*')`; every other column is ignored.
 */
@JsonClass(generateAdapter = true)
data class HomeDashboardHomeDto(
    val id: String? = null,
    val name: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    @Json(name = "home_type") val homeType: String? = null,
)

/** `myAccess` — the caller's permission bag for this home. */
@JsonClass(generateAdapter = true)
data class HomeDashboardAccessDto(
    val permissions: List<String>? = null,
    @Json(name = "role_base") val roleBase: String? = null,
    val isOwner: Boolean? = null,
) {
    /** Mirrors the backend's `canFinance` gate (`home.js:6238`). */
    val canViewFinance: Boolean
        get() =
            isOwner == true ||
                permissions.orEmpty().any { it == "finance.view" || it == "finance.manage" }
}

/** `today` block — the "what's happening now" slice. */
@JsonClass(generateAdapter = true)
data class HomeDashboardTodayDto(
    @Json(name = "next_events") val nextEvents: List<CalendarEventDto> = emptyList(),
    @Json(name = "tasks_due") val tasksDue: List<HomeTaskDto> = emptyList(),
    @Json(name = "next_bill") val nextBill: BillDto? = null,
    @Json(name = "unread_mail_count") val unreadMailCount: Int = 0,
    @Json(name = "active_guest_passes") val activeGuestPasses: Int = 0,
    @Json(name = "deliveries_arriving") val deliveriesArriving: Int = 0,
)

/** `counts` block — the hero-stat / quick-action badge source. */
@JsonClass(generateAdapter = true)
data class HomeDashboardCountsDto(
    @Json(name = "tasks_open") val tasksOpen: Int = 0,
    @Json(name = "issues_open") val issuesOpen: Int = 0,
    @Json(name = "bills_due") val billsDue: Int = 0,
    @Json(name = "packages_expected") val packagesExpected: Int = 0,
    val documents: Int = 0,
    @Json(name = "events_upcoming") val eventsUpcoming: Int = 0,
    @Json(name = "members_active") val membersActive: Int = 0,
    val pets: Int = 0,
)

/** One entry of the dashboard `members` array (HomeOccupancy + user join). */
@JsonClass(generateAdapter = true)
data class HomeDashboardMemberDto(
    @Json(name = "user_id") val userId: String? = null,
    val role: String? = null,
    @Json(name = "display_role") val displayRole: String? = null,
    val user: HomeDashboardMemberUserDto? = null,
)

/** Nested `user` join on a dashboard member row. */
@JsonClass(generateAdapter = true)
data class HomeDashboardMemberUserDto(
    val id: String? = null,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/** One `HomeAuditLog` row from `recent_activity`. */
@JsonClass(generateAdapter = true)
data class HomeAuditLogEntryDto(
    val id: String,
    @Json(name = "actor_user_id") val actorUserId: String? = null,
    val action: String = "",
    @Json(name = "target_type") val targetType: String? = null,
    @Json(name = "target_id") val targetId: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

// ── Health score ────────────────────────────────────────────────────

/**
 * Response of `GET /api/homes/:id/health-score`
 * (`backend/services/homeHealthService.js:253`). Field names are already
 * camelCase on the wire — the service builds the object by hand.
 */
@JsonClass(generateAdapter = true)
data class HomeHealthScoreDto(
    val score: Int = 0,
    val breakdown: Map<String, HomeHealthDimensionDto> = emptyMap(),
    val topIssue: String? = null,
    val topAction: HomeHealthActionDto? = null,
) {
    /**
     * True when the score is a "brand new home" zero — every dimension
     * scored nothing. Drives the onboarding variant of the ring.
     */
    val isBrandNewHome: Boolean
        get() = score == 0 && breakdown.isNotEmpty() && breakdown.values.all { it.score == 0 }
}

/** One dimension of the health-score breakdown. */
@JsonClass(generateAdapter = true)
data class HomeHealthDimensionDto(
    val score: Int = 0,
    val max: Int = 0,
    val issues: List<String> = emptyList(),
)

/** `topAction` — the single highest-leverage next step. */
@JsonClass(generateAdapter = true)
data class HomeHealthActionDto(
    val type: String = "navigate",
    val label: String = "",
    /** App route such as `/homes/<id>/maintenance`. */
    val route: String = "",
)

// ── Seasonal checklist ──────────────────────────────────────────────

/** Response of `GET /api/homes/:id/seasonal-checklist`. */
@JsonClass(generateAdapter = true)
data class SeasonalChecklistDto(
    val season: SeasonalChecklistSeasonDto = SeasonalChecklistSeasonDto(),
    val items: List<SeasonalChecklistItemDto> = emptyList(),
    val progress: SeasonalChecklistProgressDto = SeasonalChecklistProgressDto(),
    val carryover: SeasonalChecklistCarryoverDto? = null,
)

@JsonClass(generateAdapter = true)
data class SeasonalChecklistSeasonDto(
    val key: String = "",
    val label: String = "",
)

@JsonClass(generateAdapter = true)
data class SeasonalChecklistProgressDto(
    val total: Int = 0,
    val completed: Int = 0,
    val percentage: Int = 0,
)

@JsonClass(generateAdapter = true)
data class SeasonalChecklistCarryoverDto(
    val season: SeasonalChecklistSeasonDto = SeasonalChecklistSeasonDto(),
    val items: List<SeasonalChecklistItemDto> = emptyList(),
)

/**
 * One `HomeSeasonalChecklistItem` row. Also the response body of
 * `PATCH /api/homes/:id/seasonal-checklist/:itemId`.
 */
@JsonClass(generateAdapter = true)
data class SeasonalChecklistItemDto(
    val id: String,
    @Json(name = "season_key") val seasonKey: String? = null,
    val year: Int? = null,
    @Json(name = "item_key") val itemKey: String? = null,
    val title: String = "",
    val description: String? = null,
    @Json(name = "gig_category") val gigCategory: String? = null,
    @Json(name = "gig_title_suggestion") val gigTitleSuggestion: String? = null,
    /** `pending` / `completed` / `skipped` / `hired`. */
    val status: String = "pending",
    @Json(name = "completed_at") val completedAt: String? = null,
    @Json(name = "gig_id") val gigId: String? = null,
    @Json(name = "sort_order") val sortOrder: Int = 0,
) {
    /** Items that are done in any sense — completed, skipped, or hired out. */
    val isResolved: Boolean
        get() = status == "completed" || status == "skipped" || status == "hired"
}

/** Body for `PATCH /api/homes/:id/seasonal-checklist/:itemId`. */
@JsonClass(generateAdapter = true)
data class UpdateSeasonalChecklistItemRequest(
    /** Joi-validated: `completed` or `skipped` only (`home.js:7571`). */
    val status: String,
)

// ── Property value ──────────────────────────────────────────────────

/** Response of `GET /api/homes/:id/property-value`. */
@JsonClass(generateAdapter = true)
data class HomePropertyValueDto(
    @Json(name = "estimated_value") val estimatedValue: Double? = null,
    @Json(name = "value_range_low") val valueRangeLow: Double? = null,
    @Json(name = "value_range_high") val valueRangeHigh: Double? = null,
    @Json(name = "value_confidence") val valueConfidence: Double? = null,
    /** `up` / `down` / `flat` / null. */
    @Json(name = "zip_median_sale_price_trend") val zipMedianSalePriceTrend: String? = null,
    @Json(name = "year_built") val yearBuilt: Int? = null,
    val sqft: Int? = null,
    @Json(name = "last_updated") val lastUpdated: String? = null,
    /** `cache` / `unavailable` / `error` / null. */
    val source: String? = null,
)

// ── Bill trends ─────────────────────────────────────────────────────

/** Response of `GET /api/homes/:id/bill-trends`. */
@JsonClass(generateAdapter = true)
data class HomeBillTrendsDto(
    @Json(name = "bills_by_type") val billsByType: Map<String, HomeBillTrendSeriesDto> = emptyMap(),
    @Json(name = "benchmarks") val benchmarks: Map<String, HomeBillBenchmarkDto> = emptyMap(),
    @Json(name = "bill_benchmark_opt_in") val billBenchmarkOptIn: Boolean = false,
)

/**
 * One `bills_by_type` series. `months` are `YYYY-MM` keys, newest first
 * (the query orders `period_start` descending).
 */
@JsonClass(generateAdapter = true)
data class HomeBillTrendSeriesDto(
    val months: List<String> = emptyList(),
    val amounts: List<Double> = emptyList(),
)

/**
 * One `benchmarks` entry. The backend emits two shapes on the same key: a
 * full benchmark (household_count >= 10) or an insufficient-data flag
 * (3..9 households) — see `home.js:7665`.
 */
@JsonClass(generateAdapter = true)
data class HomeBillBenchmarkDto(
    val months: List<String> = emptyList(),
    /** Neighbourhood average in **cents** (`BillBenchmark.avg_amount_cents`). */
    @Json(name = "avg_amounts") val avgAmounts: List<Double> = emptyList(),
    @Json(name = "household_count") val householdCount: Int? = null,
    @Json(name = "insufficient_data") val insufficientData: Boolean = false,
    val needed: Int? = null,
    val message: String? = null,
)
