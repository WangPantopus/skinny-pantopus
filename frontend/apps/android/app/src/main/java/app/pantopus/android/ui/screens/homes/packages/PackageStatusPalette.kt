@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.packages

import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.3d (P14) — Packages status taxonomy + chip mapping.
 *
 * The backend (`HomePackage.status`, `schema.sql:6552`) enforces the
 * 6-value CHECK constraint:
 *     expected · out_for_delivery · delivered · picked_up · lost · returned
 *
 * The design (`packages-frames.jsx:66-74`) speaks a richer display
 * vocabulary (with `held` and `exception` as extra display buckets).
 * For T6.3d we collapse to the backend's 6, mapping `lost → exception`
 * (alert-circle, error tint) so the visual reads as "needs attention".
 *
 * Tab buckets — match the design's Expected / Delivered / Archived:
 *     Expected  = expected, out_for_delivery
 *     Delivered = delivered, picked_up
 *     Archived  = lost, returned
 */
enum class PackageChipStatus(val rawValue: String) {
    Expected("expected"),
    OutForDelivery("out_for_delivery"),
    Delivered("delivered"),
    PickedUp("picked_up"),
    Lost("lost"),
    Returned("returned"),
    ;

    /** Display label for the chip. */
    val label: String
        get() =
            when (this) {
                Expected -> "In transit"
                OutForDelivery -> "Out for delivery"
                Delivered -> "Delivered"
                PickedUp -> "Picked up"
                Lost -> "Exception"
                Returned -> "Returned"
            }

    /** Status-chip variant for the trailing chip. */
    val chipVariant: StatusChipVariant
        get() =
            when (this) {
                Expected -> StatusChipVariant.Info
                OutForDelivery -> StatusChipVariant.Info
                Delivered -> StatusChipVariant.Success
                PickedUp -> StatusChipVariant.Success
                Lost -> StatusChipVariant.ErrorVariant
                Returned -> StatusChipVariant.Neutral
            }

    /** Leading-glyph for the chip. */
    val chipIcon: PantopusIcon
        get() =
            when (this) {
                Expected -> PantopusIcon.Package
                OutForDelivery -> PantopusIcon.Send
                Delivered -> PantopusIcon.CheckCircle
                PickedUp -> PantopusIcon.Check
                Lost -> PantopusIcon.AlertCircle
                Returned -> PantopusIcon.ArrowsRepeat
            }

    /** Bucket → tab id (see [PackagesTab]). */
    val tab: PackagesTab
        get() =
            when (this) {
                Expected, OutForDelivery -> PackagesTab.Expected
                Delivered, PickedUp -> PackagesTab.Delivered
                Lost, Returned -> PackagesTab.Archived
            }

    /** True when the status is in flight (still expected to be
     *  delivered). Drives banner counts + drop-location visibility. */
    val isInFlight: Boolean
        get() = this == Expected || this == OutForDelivery

    /** True when the package's lifecycle is closed. */
    val isTerminal: Boolean
        get() =
            when (this) {
                Delivered, PickedUp, Lost, Returned -> true
                Expected, OutForDelivery -> false
            }

    companion object {
        /** Map from the backend's raw string. Unknown values land on
         *  [Expected] (the schema default). */
        @JvmStatic
        fun from(raw: String?): PackageChipStatus =
            when (raw) {
                "expected" -> Expected
                "out_for_delivery" -> OutForDelivery
                "delivered" -> Delivered
                "picked_up" -> PickedUp
                "lost" -> Lost
                "returned" -> Returned
                else -> Expected
            }
    }
}

/** Tab identifiers for the Packages shell. */
enum class PackagesTab(val id: String) {
    Expected("expected"),
    Delivered("delivered"),
    Archived("archived"),
    ;

    val label: String
        get() =
            when (this) {
                Expected -> "Expected"
                Delivered -> "Delivered"
                Archived -> "Archived"
            }

    companion object {
        fun fromId(id: String): PackagesTab = entries.firstOrNull { it.id == id } ?: Expected
    }
}
