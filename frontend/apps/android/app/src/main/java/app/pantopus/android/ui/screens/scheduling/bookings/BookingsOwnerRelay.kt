@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookings

import app.pantopus.android.data.scheduling.SchedulingOwner
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Carries the resolved [SchedulingOwner] across the arg-less detail hop —
 * `BOOKING_DETAIL` only encodes `bookingId`, but `GET /bookings/:id` needs the
 * owner context (the `/api/scheduling` vs `/api/homes/{homeId}/scheduling`
 * mount + the Business `owner_type`/`owner_id`). The inbox sets [pending] to the
 * row's owner right before `onNavigate(bookingDetail(id))`; the detail
 * view-model consumes it (and persists a token in `SavedStateHandle` so it
 * survives process death). A process-scoped `@Singleton` — never a nav arg —
 * so it never touches the frozen A0 routing seam.
 */
@Singleton
class BookingsOwnerRelay
    @Inject
    constructor() {
        var pending: SchedulingOwner? = null

        fun consume(): SchedulingOwner? = pending.also { pending = null }
    }

/** Serialize an owner to a compact `SavedStateHandle` token (survives process death). */
fun SchedulingOwner.toToken(): String =
    when (this) {
        is SchedulingOwner.Personal -> "personal"
        is SchedulingOwner.Business -> "business:$businessUserId"
        is SchedulingOwner.Home -> "home:$homeId"
    }

/** Reconstruct an owner from a [toToken] string; null/blank/unknown → Personal. */
fun ownerFromToken(token: String?): SchedulingOwner =
    when {
        token == null || token == "personal" -> SchedulingOwner.Personal
        token.startsWith("business:") -> SchedulingOwner.Business(token.removePrefix("business:"))
        token.startsWith("home:") -> SchedulingOwner.Home(token.removePrefix("home:"))
        else -> SchedulingOwner.Personal
    }
