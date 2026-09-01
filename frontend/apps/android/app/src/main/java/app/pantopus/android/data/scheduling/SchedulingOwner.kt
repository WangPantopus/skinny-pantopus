package app.pantopus.android.data.scheduling

/**
 * The one owner-context pattern every scheduling call internalizes.
 *
 * The backend exposes the same scheduling router under two mounts and resolves
 * "whose schedule" three ways:
 *  - **Personal** → `/api/scheduling/…`, no owner fields (defaults to the
 *    signed-in user).
 *  - **Business** → `/api/scheduling/…` with `owner_type=business` +
 *    `owner_id=<businessUserId>` (query on reads, body on writes — we send it
 *    as a query universally, which the `owner_type+owner_id in query/body`
 *    middleware reads on every method).
 *  - **Home** → the `/api/homes/{homeId}/scheduling/…` alias (owner implied by
 *    the path; no owner fields).
 *
 * [basePath] is the encoded segment fed to `SchedulingApi`'s `{base}` path
 * param; [ownerType]/[ownerId] are the nullable query/body owner fields.
 *
 * Note: a few endpoints are *always personal* regardless of owner
 * (`availability*`, `notification-preferences`, `connected-calendars`,
 * `my-bookings`, `my-packages`) and use the fixed `api/scheduling/...` path —
 * they ignore [SchedulingOwner]. Home-only coordination reads (`find-a-time`,
 * `whos-free`) and business-only `team-availability` take the owner id directly
 * on the repository method per the backend's documented query form.
 */
sealed interface SchedulingOwner {
    /** Personal — the signed-in user. */
    data object Personal : SchedulingOwner

    /** A business the user can manage. */
    data class Business(val businessUserId: String) : SchedulingOwner

    /** A home the user belongs to. */
    data class Home(val homeId: String) : SchedulingOwner

    /** The `{base}` path segment: `"scheduling"` or `"homes/{homeId}/scheduling"`. */
    val basePath: String
        get() =
            when (this) {
                is Personal -> SCHEDULING_BASE
                is Business -> SCHEDULING_BASE
                is Home -> "homes/$homeId/scheduling"
            }

    /** `owner_type` query/body value — `"business"` for Business, else null. */
    val ownerType: String?
        get() = (this as? Business)?.let { OWNER_TYPE_BUSINESS }

    /** `owner_id` query/body value — the business user id for Business, else null. */
    val ownerId: String?
        get() = (this as? Business)?.businessUserId

    /** Route-arg discriminator — pairs with [ownerRouteId]. See `SchedulingRoutes.ARG_OWNER_KIND`. */
    val routeKind: String
        get() =
            when (this) {
                is Personal -> "personal"
                is Business -> OWNER_TYPE_BUSINESS
                is Home -> OWNER_TYPE_HOME
            }

    /** Route-arg id — null for Personal, which needs no id. */
    val ownerRouteId: String?
        get() =
            when (this) {
                is Personal -> null
                is Business -> businessUserId
                is Home -> homeId
            }

    companion object {
        const val SCHEDULING_BASE = "scheduling"
        const val OWNER_TYPE_BUSINESS = "business"
        const val OWNER_TYPE_HOME = "home"

        /**
         * Rebuild an owner from nav args. Falls back to [Personal] only when the kind is
         * absent or genuinely personal — a Business/Home kind with a missing id yields
         * Personal too, since acting on the wrong owner is worse than showing the default.
         */
        fun fromRoute(
            kind: String?,
            id: String?,
        ): SchedulingOwner =
            when {
                kind.isNullOrBlank() -> Personal
                kind == OWNER_TYPE_BUSINESS && !id.isNullOrBlank() -> Business(id)
                kind == OWNER_TYPE_HOME && !id.isNullOrBlank() -> Home(id)
                else -> Personal
            }
    }
}
