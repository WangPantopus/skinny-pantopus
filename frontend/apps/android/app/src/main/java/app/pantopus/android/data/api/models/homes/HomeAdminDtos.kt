@file:Suppress("ReturnCount")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the owner/admin home-administration surface. Route citations
 * live on [app.pantopus.android.data.api.services.HomeAdminApi]:
 *
 *  - `DELETE /api/homes/:id`                                — `home.js:3191`
 *  - `GET    /api/homes/:id/me`                             — `homeIam.js:51`
 *  - `POST   /api/homes/:id/members/:userId/role`           — `homeIam.js:212`
 *  - `GET    /api/homes/:id/household-access-requests`      — `home.js:2671`
 *  - `POST   …/household-access-requests/:id/approve`       — `home.js:2714`
 *  - `POST   …/household-access-requests/:id/reject`        — `home.js:2831`
 */

/** `{ message }` from `DELETE /api/homes/:id`. */
@JsonClass(generateAdapter = true)
data class DeleteHomeResponse(
    val message: String? = null,
)

/**
 * The viewer's own access record for a home (`GET /:id/me`). Only the
 * fields the Members screen needs are modelled; the handler emits more
 * (challenge/claim windows, postcard context) decoded elsewhere.
 */
@JsonClass(generateAdapter = true)
data class HomeAccessDto(
    val hasAccess: Boolean = false,
    /** Verified/legacy owner OR IAM `role_base == "owner"`. */
    @Json(name = "is_owner") val isOwner: Boolean = false,
    /** One of the `ROLE_RANK` keys, or null when access was denied. */
    @Json(name = "role_base") val roleBase: String? = null,
    /** Raw IAM permission strings; `members.manage` gates the roster. */
    val permissions: List<String> = emptyList(),
    @Json(name = "can_manage_home") val canManageHome: Boolean = false,
    @Json(name = "can_manage_access") val canManageAccess: Boolean = false,
    @Json(name = "can_manage_finance") val canManageFinance: Boolean = false,
    @Json(name = "can_manage_tasks") val canManageTasks: Boolean = false,
    @Json(name = "can_view_sensitive") val canViewSensitive: Boolean = false,
) {
    /**
     * Mirrors `canReviewHouseholdAccessRequests` (`home.js:219`) and the
     * `members.manage` gate on the change-role route (`homeIam.js:218`).
     */
    val canManageMembers: Boolean
        get() = isOwner || permissions.contains("members.manage")

    /**
     * RN's `can(perm)` helper (`src/app/homes/[id]/index.tsx:122`):
     * owners and admins see everything; a viewer whose record carries no
     * `permissions[]` at all falls through to "allow" so a partial
     * payload can't blank the dashboard; otherwise the IAM string list
     * decides. Permission vocabulary is the `home_permission` enum
     * (`backend/database/schema.sql:227-251`).
     */
    fun can(permission: String): Boolean {
        if (isOwner || roleBase == "owner" || roleBase == "admin") return true
        if (permissions.isEmpty()) return true
        return permissions.contains(permission)
    }
}

/**
 * Joined actor `User` on a `HomeAuditLog` row — the handler selects
 * `actor:actor_user_id (id, username, name, profile_picture_url)`.
 */
@JsonClass(generateAdapter = true)
data class HomeAuditActorDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/**
 * One `HomeAuditLog` row from `GET /:id/audit-log`. The handler
 * `select('*')`s the table, so the action verb, the target it was
 * applied to, and the timestamp are all present; `metadata` is
 * free-form jsonb we deliberately don't model.
 */
@JsonClass(generateAdapter = true)
data class HomeAuditEntryDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "actor_user_id") val actorUserId: String? = null,
    /** Screaming-snake verb, e.g. `OWNERSHIP_CLAIM_SUBMITTED`. */
    val action: String,
    /** Table name the action targeted, e.g. `HomeOccupancy`. */
    @Json(name = "target_type") val targetType: String? = null,
    @Json(name = "target_id") val targetId: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val actor: HomeAuditActorDto? = null,
)

/**
 * RN falls back to "System" when the row has no resolvable actor
 * (`src/app/homes/[id]/members/index.tsx:393`).
 */
fun HomeAuditEntryDto.actorDisplayName(): String {
    val who = actor ?: return "System"
    if (!who.name.isNullOrEmpty()) return who.name
    if (!who.username.isNullOrEmpty()) return "@${who.username}"
    return "System"
}

/** `OWNERSHIP_CLAIM_SUBMITTED` → "Ownership claim submitted". */
fun HomeAuditEntryDto.actionLabel(): String {
    val spaced =
        action
            .replace('_', ' ')
            .replace('.', ' ')
            .lowercase()
            .trim()
    if (spaced.isEmpty()) return action
    return spaced.replaceFirstChar { it.uppercase() }
}

/**
 * `HomeOccupancy` → "Home occupancy". Null when the row carries no
 * target, so the row never renders a dangling arrow.
 */
fun HomeAuditEntryDto.targetLabel(): String? {
    val raw = targetType
    if (raw.isNullOrEmpty()) return null
    val spaced =
        Regex("([a-z0-9])([A-Z])")
            .replace(raw) { "${it.groupValues[1]} ${it.groupValues[2]}" }
            .replace('_', ' ')
            .lowercase()
            .trim()
    if (spaced.isEmpty()) return null
    return spaced.replaceFirstChar { it.uppercase() }
}

/** `{ entries }` envelope from `GET /:id/audit-log`. */
@JsonClass(generateAdapter = true)
data class HomeAuditLogResponse(
    val entries: List<HomeAuditEntryDto> = emptyList(),
)

/**
 * Body for `POST /:id/members/:userId/role`. The handler accepts
 * `preset_key` or `role_base`; we always send `role_base` so the
 * assignable list is the backend's `ROLE_RANK` vocabulary rather than a
 * preset table that may be empty.
 */
@JsonClass(generateAdapter = true)
data class ChangeMemberRoleRequest(
    @Json(name = "role_base") val roleBase: String,
)

/** `{ message, role_base }` from the change-role route. */
@JsonClass(generateAdapter = true)
data class ChangeMemberRoleResponse(
    val message: String? = null,
    @Json(name = "role_base") val roleBase: String? = null,
)

/** Joined `User` record on a household-access request row. */
@JsonClass(generateAdapter = true)
data class HouseholdAccessRequesterDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "last_name") val lastName: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/**
 * One row from `GET /:id/household-access-requests`. The handler
 * `select('*')`s `HomeHouseholdAccessRequest` and joins the requester.
 */
@JsonClass(generateAdapter = true)
data class HouseholdAccessRequestDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "requester_user_id") val requesterUserId: String,
    /** `owner / resident / household_member / guest`. */
    @Json(name = "requested_identity") val requestedIdentity: String,
    /** `pending / approved / rejected / cancelled`. */
    val status: String,
    @Json(name = "created_at") val createdAt: String? = null,
    val requester: HouseholdAccessRequesterDto? = null,
)

/**
 * Title-case label for `requested_identity`, matching the RN vocabulary
 * in `src/app/homes/[id]/members/index.tsx:26`.
 */
fun HouseholdAccessRequestDto.requestedIdentityLabel(): String =
    when (requestedIdentity) {
        "owner" -> "Owner"
        "resident" -> "Resident"
        "household_member" -> "Household member"
        "guest" -> "Guest"
        else -> requestedIdentity
    }

/** Display-name resolution order mirrors RN's `requesterDisplayName`. */
fun HouseholdAccessRequestDto.requesterDisplayName(): String {
    val user = requester ?: return "Unknown user"
    if (!user.name.isNullOrEmpty()) return user.name
    val parts = listOfNotNull(user.firstName, user.lastName).filter { it.isNotEmpty() }
    if (parts.isNotEmpty()) return parts.joinToString(" ")
    if (!user.username.isNullOrEmpty()) return "@${user.username}"
    return "Unknown user"
}

/** `{ requests }` envelope. */
@JsonClass(generateAdapter = true)
data class HouseholdAccessRequestsResponse(
    val requests: List<HouseholdAccessRequestDto> = emptyList(),
)

/** `{ ok, message }` from approve / reject. */
@JsonClass(generateAdapter = true)
data class HouseholdAccessRequestActionResponse(
    val ok: Boolean = false,
    val message: String? = null,
)
