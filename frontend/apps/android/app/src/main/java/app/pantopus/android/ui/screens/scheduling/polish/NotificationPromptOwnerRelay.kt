@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.polish

import app.pantopus.android.data.scheduling.SchedulingOwner
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Carries the resolved [SchedulingOwner] across the arg-less notification-prompt
 * hop — `NOTIFICATION_PERMISSION_PROMPT` has no `{owner}` segment, so the calling
 * surface (hub row, reminder toggle, etc.) sets [pending] immediately before calling
 * `onNavigate(SchedulingRoutes.NOTIFICATION_PERMISSION_PROMPT)`. The ViewModel
 * consumes it in `init` and falls back to [SchedulingOwner.Personal] when nothing
 * was set (e.g. deep-link cold-start). Mirrors [BookingsOwnerRelay] in the bookings
 * stream — never a nav arg, so the frozen A0 routing seam is untouched.
 *
 * **Call-site contract:** set `pending` before navigating; the ViewModel consumes
 * and clears it in one atomic step so no stale value bleeds to a subsequent open.
 */
@Singleton
class NotificationPromptOwnerRelay
    @Inject
    constructor() {
        var pending: SchedulingOwner? = null

        /** Atomically returns and clears [pending]; null when nothing was set. */
        fun consume(): SchedulingOwner? = pending.also { pending = null }
    }
