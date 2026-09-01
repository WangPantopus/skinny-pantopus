@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Steps the A12.10 Create Business wizard advances through.
 * - Step 1: designed A12.10 category picker
 * - Steps 2–4: Form/Wizard token composition (basic info → location/hours → confirm)
 */
enum class CreateBusinessStep {
    PickCategory,
    LegalInfo,
    Profile,
    Confirm,
    ;

    /** 1-indexed position used by the wizard's "N of M" readout. */
    val stepNumber: Int
        get() =
            when (this) {
                PickCategory -> 1
                LegalInfo -> 2
                Profile -> 3
                Confirm -> 4
            }

    companion object {
        /** Total number of steps in the wizard. Matches the audit's `1 of 4`. */
        const val TOTAL_STEPS: Int = 4
    }
}

/**
 * Category tiles rendered in the 2×4 picker grid. Order is meaningful —
 * the grid renders row-major in this order, with [Other] always last so
 * the "Something else" tile sits in the bottom-right.
 */
enum class BusinessCategory(
    val label: String,
    val subcopy: String,
    val icon: PantopusIcon,
    /** Backend `categories[]` slug for create-full. */
    val backendSlug: String,
    /**
     * Sensible `business_type` entity for create-full. Home maps to
     * `home_service`; everything else defaults to `for_profit`.
     */
    val entityType: String,
) {
    Home(
        label = "Home services",
        subcopy = "Handyman · cleaning · moving",
        icon = PantopusIcon.Wrench,
        backendSlug = "home_services",
        entityType = "home_service",
    ),
    Personal(
        label = "Personal services",
        subcopy = "Tutoring · childcare · pet care",
        icon = PantopusIcon.GraduationCap,
        backendSlug = "personal_services",
        entityType = "for_profit",
    ),
    Tech(
        label = "Tech & repair",
        subcopy = "Devices · networks · break-fix",
        icon = PantopusIcon.Cpu,
        backendSlug = "tech_repair",
        entityType = "for_profit",
    ),
    Delivery(
        label = "Delivery & errands",
        subcopy = "Last-mile · courier · grocery",
        icon = PantopusIcon.Truck,
        backendSlug = "delivery_errands",
        entityType = "for_profit",
    ),
    Goods(
        label = "Goods & retail",
        subcopy = "Selling new or pre-loved items",
        icon = PantopusIcon.ShoppingBag,
        backendSlug = "goods_retail",
        entityType = "for_profit",
    ),
    Rentals(
        label = "Rentals",
        subcopy = "Short or long-term · gear · vehicles",
        icon = PantopusIcon.KeyRound,
        backendSlug = "rentals",
        entityType = "for_profit",
    ),
    Vehicles(
        label = "Vehicles & rideshare",
        subcopy = "Driving · towing · fleet",
        icon = PantopusIcon.Car,
        backendSlug = "vehicles_rideshare",
        entityType = "for_profit",
    ),
    Other(
        label = "Something else",
        subcopy = "Tell us what you do",
        icon = PantopusIcon.Sparkles,
        backendSlug = "other",
        entityType = "for_profit",
    ),
    ;

    /**
     * Per-category accent color used for the icon tile bg, the selected
     * ring, the check disc, and the selected-tile shadow. Tokens-only —
     * every value here is a [PantopusColors] swatch.
     */
    val accent: Color
        get() =
            when (this) {
                Home -> PantopusColors.handyman
                Personal -> PantopusColors.tutoring
                Tech -> PantopusColors.tech
                Delivery -> PantopusColors.delivery
                Goods -> PantopusColors.goods
                Rentals -> PantopusColors.rentals
                Vehicles -> PantopusColors.vehicles
                Other -> PantopusColors.business
            }
}

/** One row inside the "What you'll get" preview strip. */
data class WhatYouGetItem(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val subcopy: String,
)

/**
 * One typeahead match returned by the search frame's filter. Carries the
 * owning category plus a sub-area sentence — what the audit calls the
 * "tutoring · K-12, test prep, music" line under each result.
 */
data class CategorySearchHit(
    val id: String,
    val category: BusinessCategory,
    val label: String,
)

/**
 * A logo picked in the wizard, held in memory until create-full returns a
 * business id (`POST /api/upload/business-media/:businessId` needs one).
 * The filename is randomised at pick time so the photo picker's `IMG_xxxx`
 * name never reaches S3 — the same firewall RN applies in
 * `src/utils/mediaFirewall.ts`.
 */
data class CreateBusinessLogoPick(
    val bytes: ByteArray,
    val fileName: String,
    val mimeType: String,
) {
    override fun equals(other: Any?): Boolean =
        this === other ||
            (
                other is CreateBusinessLogoPick &&
                    fileName == other.fileName &&
                    mimeType == other.mimeType &&
                    bytes.contentEquals(other.bytes)
            )

    override fun hashCode(): Int {
        var result = fileName.hashCode()
        result = 31 * result + mimeType.hashCode()
        result = 31 * result + bytes.contentHashCode()
        return result
    }
}

/** Live username-availability state for the basic-info step. */
sealed interface UsernameCheckStatus {
    data object Idle : UsernameCheckStatus

    data object Checking : UsernameCheckStatus

    data object Available : UsernameCheckStatus

    data class Unavailable(val reason: String?) : UsernameCheckStatus
}

/**
 * One weekday row in the create-business hours editor (Sun=0 … Sat=6).
 * Weekdays default to 09:00–17:00; weekends closed — matches RN.
 */
data class BusinessHoursDay(
    val dayOfWeek: Int,
    val openTime: String,
    val closeTime: String,
    val isClosed: Boolean,
) {
    val shortLabel: String
        get() = SHORT_LABELS.getOrElse(dayOfWeek) { "?" }

    companion object {
        private val SHORT_LABELS = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

        fun defaultWeek(): List<BusinessHoursDay> =
            (0..6).map { day ->
                val weekday = day in 1..5
                BusinessHoursDay(
                    dayOfWeek = day,
                    openTime = if (weekday) "09:00" else "",
                    closeTime = if (weekday) "17:00" else "",
                    isClosed = !weekday,
                )
            }
    }
}

/** Outbound navigation events the screen reacts to. */
sealed interface CreateBusinessOutboundEvent {
    /** Pop the wizard with no further navigation. */
    data object Dismiss : CreateBusinessOutboundEvent

    /** Pop the wizard and open the newly-created business dashboard. */
    data class OpenBusinessDashboard(val businessId: String) : CreateBusinessOutboundEvent
}
