package app.pantopus.android.data.store

import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistDto
import app.pantopus.android.data.api.models.homes.GetHomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeAuditLogResponse
import app.pantopus.android.data.api.models.homes.HomeDetailResponse
import app.pantopus.android.data.api.models.homes.HomeIssuesResponse
import app.pantopus.android.data.api.models.homes.HomeOwnershipSecurityResponse
import app.pantopus.android.data.api.models.homes.HomePrivacyResponse
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.HouseholdAccessRequestsResponse
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.OwnersResponse
import app.pantopus.android.data.api.models.homes.PropertyDetailsResponse

/**
 * The Home screens' store keys (`ui/screens/homes/`, Instant Screens item 9), one per endpoint and parameters they
 * read, with their kind (contract §4) and change topics (§8). Kept apart from [StoreKeys] so the two sets grow
 * without merge conflicts.
 */
@Suppress("TooManyFunctions") // One function per stored endpoint.
object HomeStoreKeys {
    /**
     * The viewer's access to a Home (role, permissions, expiry). Founder decision 3: decides who may see a Home
     * screen's stored copy (owners and household roles without an expiry).
     */
    fun access(homeId: String) =
        StoreKey<HomeDashboardAuthorityDto>(
            "api/homes/$homeId/dashboard-access",
            kind = StoreKind.HOMES,
            topics = setOf("home:$homeId", StoreTopics.HOMES),
        )

    /** A Home as the viewer sees it. */
    fun detail(homeId: String) =
        StoreKey<HomeDetailResponse>(
            "api/homes/$homeId",
            kind = StoreKind.HOMES,
            topics = setOf("home:$homeId", StoreTopics.HOMES, "place:$homeId"),
        )

    /** The viewer's effective permissions in a Home. */
    fun me(homeId: String) = StoreKey<HomeAccessDto>("api/homes/$homeId/me", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's occupants and pending invitations. */
    fun occupants(homeId: String) =
        StoreKey<OccupantsResponse>("api/homes/$homeId/occupants", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's privacy toggles. */
    fun privacy(homeId: String) =
        StoreKey<HomePrivacyResponse>("api/homes/$homeId/privacy", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's ownership security policy. */
    fun security(homeId: String) =
        StoreKey<HomeOwnershipSecurityResponse>("api/homes/$homeId/security", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's property facts. */
    fun propertyDetails(homeId: String) =
        StoreKey<PropertyDetailsResponse>(
            "api/homes/$homeId/property-details",
            kind = StoreKind.HOMES,
            topics = setOf("home:$homeId", "place:$homeId"),
        )

    /** A Home's pending household access requests (managers). */
    fun accessRequests(homeId: String) =
        StoreKey<HouseholdAccessRequestsResponse>(
            "api/homes/$homeId/household-access-requests",
            mapOf("status" to "pending"),
            kind = StoreKind.HOMES,
            topics = setOf("home:$homeId"),
        )

    /** The first page of a Home's audit log (managers). */
    fun auditLog(homeId: String) =
        StoreKey<HomeAuditLogResponse>(
            "api/homes/$homeId/audit-log",
            mapOf("limit" to "50", "offset" to "0"),
            kind = StoreKind.HOMES,
            topics = setOf("home:$homeId"),
        )

    /** A Home's owners. */
    fun owners(homeId: String) =
        StoreKey<OwnersResponse>("api/homes/$homeId/owners", kind = StoreKind.HOMES, topics = setOf("home:$homeId", StoreTopics.HOMES))

    /** A Home's issues (every status and severity). */
    fun issues(homeId: String) =
        StoreKey<HomeIssuesResponse>("api/homes/$homeId/issues", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's maintenance log (every status). */
    fun maintenance(homeId: String) =
        StoreKey<GetHomeMaintenanceResponse>("api/homes/$homeId/maintenance", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's task list for the viewer (with its per-session task scope). */
    fun tasks(homeId: String) =
        StoreKey<GetHomeTasksResponse>("api/homes/$homeId/tasks", kind = StoreKind.HOMES, topics = setOf("home:$homeId", "today"))

    /** One household task for the viewer. */
    fun task(
        homeId: String,
        taskId: String,
    ) = StoreKey<HomeTaskResponse>("api/homes/$homeId/tasks/$taskId", kind = StoreKind.HOMES, topics = setOf("home:$homeId", "today"))

    /** A Home's health score, recomputed by the server (`force=true`, as the dashboard always asks). */
    fun healthScore(homeId: String) =
        StoreKey<HomeHealthScoreDto>(
            "api/homes/$homeId/health-score",
            mapOf("force" to "true"),
            kind = StoreKind.HOMES,
            topics = setOf("home:$homeId"),
        )

    /** A Home's current seasonal checklist. */
    fun seasonalChecklist(homeId: String) =
        StoreKey<SeasonalChecklistDto>("api/homes/$homeId/seasonal-checklist", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's estimated value. */
    fun propertyValue(homeId: String) =
        StoreKey<HomePropertyValueDto>("api/homes/$homeId/property-value", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's bill comparison in one currency (finance roles). */
    fun billTrends(
        homeId: String,
        currency: String,
    ) = StoreKey<HomeBillTrendsDto>(
        "api/homes/$homeId/bill-trends",
        mapOf("format" to "2", "currency" to currency),
        kind = StoreKind.HOMES,
        topics = setOf("home:$homeId"),
    )
}
