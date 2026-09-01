@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.insights

import app.pantopus.android.data.scheduling.SchedulingOwner
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Stream-local relay that hands the resolved [SchedulingOwner] (and, for H10,
 * the tapped event-type id) from the H9 dashboard to a pushed report screen,
 * since the A0 insights routes are arg-less (no owner/eventType segment).
 * Mirrors the packages stream's `PackagesOwnerRelay`, kept inside this stream's
 * folder.
 *
 *  - `InsightsDashboard` → `EventTypePerformance` (owner + selected eventTypeId).
 *  - `InsightsDashboard` → `NoShowReport` / `TeamPerformance` (owner only).
 *
 * Each consumer reads it once in its `init` and clears it; a `null` pending
 * value (deep link / process death) falls back to the signed-in owner.
 */
@Singleton
class InsightsNavRelay
    @Inject
    constructor() {
        /** Owner context to scope the next pushed insights screen. */
        var pendingOwner: SchedulingOwner? = null

        /** Event-type id to pre-select on the next [EventTypePerformanceScreen]. */
        var pendingEventTypeId: String? = null

        /** Read-and-clear the pending owner. */
        fun consumeOwner(): SchedulingOwner? {
            val value = pendingOwner
            pendingOwner = null
            return value
        }

        /** Read-and-clear the pending event-type id. */
        fun consumeEventTypeId(): String? {
            val value = pendingEventTypeId
            pendingEventTypeId = null
            return value
        }
    }
