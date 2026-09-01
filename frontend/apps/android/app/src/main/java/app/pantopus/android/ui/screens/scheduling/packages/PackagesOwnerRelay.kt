@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.packages

import app.pantopus.android.data.scheduling.SchedulingOwner
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Stream-local relay that hands the resolved [SchedulingOwner] from a list
 * screen to a pushed editor / checkout screen, since the A0 routes are arg-less
 * (no owner segment). Mirrors the eventtypes `SchedulingEditorOwnerRelay`
 * pattern but kept inside this stream's folder (the eventtypes one is owned by
 * another stream).
 *
 *  - `PackagesList` → `PackageEditor` / `BuyPackage` (Business owner).
 *  - `MyPackages` → `BuyPackage` (owner derived from the credit's package meta).
 *
 * The consumer reads it once in its `init` and clears it; a `null` pending owner
 * (deep link / process death) falls back to the signed-in business owner.
 */
@Singleton
class PackagesOwnerRelay
    @Inject
    constructor() {
        var pending: SchedulingOwner? = null

        /** Read-and-clear the pending owner. */
        fun consume(): SchedulingOwner? {
            val value = pending
            pending = null
            return value
        }
    }
