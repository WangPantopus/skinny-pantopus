@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.compose.gig

import app.pantopus.android.data.api.models.gigs.CareDetailsDto
import app.pantopus.android.data.api.models.gigs.EventDetailsDto
import app.pantopus.android.data.api.models.gigs.LogisticsDetailsDto
import app.pantopus.android.data.api.models.gigs.MagicTaskItemDto
import app.pantopus.android.data.api.models.gigs.RemoteDetailsDto

/**
 * A12.8 — the describe-first Post-a-Task wizard: four steps + a success
 * terminal. Step 1 renders either the Magic describe surface (default)
 * or the manual category grid, toggled by [ComposeMode].
 */
enum class GigComposeStep(
    val ordinal0: Int,
) {
    Describe(0),
    FillGaps(1),
    BudgetMode(2),
    Review(3),
    Success(4),
    ;

    /**
     * One-indexed position used in the "N of 4" top-bar readout, or
     * `null` for the success terminal.
     */
    val stepNumber: Int?
        get() =
            when (this) {
                Describe -> 1
                FillGaps -> 2
                BudgetMode -> 3
                Review -> 4
                Success -> null
            }

    companion object {
        /** Total number of "step N of M" steps shown in the readout. */
        const val PROGRESS_TOTAL: Int = 4

        fun fromOrdinal(value: Int): GigComposeStep = entries.firstOrNull { it.ordinal0 == value } ?: Describe
    }
}

/**
 * One-of-nine category the user picks (or Magic detects). Mirrors the
 * chip palette in `gigs-frames.jsx` CATS plus an `Other` bucket that is
 * surfaced in the composer but not in the feed filter.
 */
enum class GigComposeCategory(
    val key: String,
    val label: String,
) {
    Handyman("handyman", "Handyman"),
    Cleaning("cleaning", "Cleaning"),
    Moving("moving", "Moving"),
    PetCare("petcare", "Pet care"),
    ChildCare("childcare", "Child care"),
    Tutoring("tutoring", "Tutoring"),
    Delivery("delivery", "Delivery"),
    Tech("tech", "Tech"),
    Other("other", "Other"),
    ;

    companion object {
        /**
         * Maps a `GigsCategory.key` (or any unrecognised string) into
         * the compose enum. Used so the Hub's category-specific entry
         * preselects the right tile.
         */
        fun fromRawKey(raw: String?): GigComposeCategory? {
            val key = raw?.lowercase().orEmpty()
            if (key.isEmpty() || key == "all") return null
            return entries.firstOrNull { it.key == key }
        }
    }
}

/**
 * A12.8 — entry mode for step 1. `Magic` is the default AI-assisted
 * describe path; `Manual` is the category-grid alternate reachable via
 * the "Pick category" ghost CTA.
 */
enum class ComposeMode { Magic, Manual }

/**
 * A12.8 — describe-step engagement tiles (One-time "Done once" /
 * Recurring "Weekly +" / Open-ended "Until done"). They prefill the
 * schedule downstream; the wire `engagement_mode` is a separate control
 * on the Budget & mode step ([GigEngagementMode]).
 */
enum class GigComposeEngagementMode { OneTime, Recurring, OpenEnded }

/**
 * A12.8 — backend `engagement_mode` on `POST /api/gigs/magic-post`.
 * Defaulted by [GigComposeViewModel.inferEngagementMode] and overridable
 * on the Budget & mode step's segmented control.
 */
enum class GigEngagementMode(
    val wireValue: String,
    val label: String,
) {
    InstantAccept("instant_accept", "Instant accept"),
    CuratedOffers("curated_offers", "Curated offers"),
    Quotes("quotes", "Quotes"),
    ;

    companion object {
        fun fromWire(raw: String?): GigEngagementMode? = entries.firstOrNull { it.wireValue == raw }
    }
}

/** Budget-type radio on the Budget & mode step. */
enum class GigComposeBudgetType(
    val wireValue: String,
    val label: String,
) {
    Fixed("fixed", "Fixed price"),
    Hourly("hourly", "Hourly"),
    Offers("offers", "Open to bids"),
    ;

    fun subcopy(): String =
        when (this) {
            Fixed -> "One total price for the whole job."
            Hourly -> "Pay by the hour worked."
            Offers -> "Helpers send their own price and you pick."
        }
}

/** Schedule-type radio in the Fill-gaps "When" section. */
enum class GigComposeScheduleType(
    val label: String,
) {
    OneTime("One-time"),
    Recurring("Recurring"),
    Flexible("Flexible"),
    ;

    /**
     * Wire value forwarded as `schedule_type` on magic-post. `OneTime`
     * with a date is `scheduled`; everything else maps to `flexible`
     * (urgent posts override to `asap` at body-build time).
     */
    val wireValue: String
        get() =
            when (this) {
                OneTime -> "scheduled"
                Recurring -> "flexible"
                Flexible -> "flexible"
            }

    fun subcopy(): String =
        when (this) {
            OneTime -> "A single date and time."
            Recurring -> "Repeats on a regular cadence."
            Flexible -> "Whenever works for both of you."
        }
}

/** Location-mode radio in the Fill-gaps "Where" section. */
enum class GigComposeLocationMode(
    val label: String,
) {
    YourAddress("Your address"),
    APlace("A place"),
    Virtual("Virtual"),
    ;

    val wireMode: String
        get() =
            when (this) {
                YourAddress -> "home"
                APlace -> "address"
                Virtual -> "custom"
            }

    fun subcopy(): String =
        when (this) {
            YourAddress -> "Helpers come to the address on your account."
            APlace -> "Helpers come to a different address you'll enter."
            Virtual -> "Done over phone, video, or messages — no on-site visit."
        }
}

/**
 * E.1 — cancellation-policy tier surfaced by the composer's policy picker
 * sheet. The mid tier reads **Moderate** in the design but maps to the
 * backend's `standard` value (`backend/routes/gigs.js:438`).
 */
enum class GigCancellationPolicy(
    val label: String,
    val detail: String,
    val wireValue: String,
) {
    Flexible("Flexible", "Full refund up to 24 hours before the start time.", "flexible"),
    Moderate("Moderate", "50% refund up to 48 hours before. No refund after.", "standard"),
    Strict("Strict", "No refund within 7 days of the start time.", "strict"),
}

/** E.1 — the composer picker sheets, presented one-at-a-time over the wizard. */
enum class GigPickerSheet { Attachment, Category, Deadline, Policy, Urgency, Tags, Identity }

/**
 * P6c — one business the user can post on behalf of, projected from
 * `GET /api/businesses/my-businesses` (`backend/routes/businesses.js:680`).
 * [id] is the membership row's `business_user_id` — the business's
 * postable User id that rides magic-post as `beneficiary_user_id`.
 * Personal has no option object (it's the null selection).
 */
data class GigComposeIdentityOption(
    val id: String,
    val name: String,
)

/**
 * P0.2 — one in-flight (or failed) photo upload tile. Uploaded photos
 * graduate into [GigComposeFormState.photoIds] as URLs; these transient
 * tiles are never persisted (raw bytes can't survive process death anyway).
 */
data class GigComposePhotoUpload(
    val id: String,
    val failed: Boolean = false,
)

/**
 * P1.G — projected price-benchmark hint shown under the budget fields.
 * Built from `GET /api/gigs/price-benchmark`; absent (null on the UI
 * state) when the fetch failed or there are no comparable tasks.
 */
data class GigComposePriceBenchmark(
    /** "Similar handyman tasks nearby: $40–$120 · median $75" */
    val hintText: String,
    /** Humanised `basis` sub-caption, e.g. "completed tasks". */
    val basis: String?,
)

/**
 * P0.2 — raw bytes of a picked attachment, held by the view-model for
 * upload + retry. Not a data class — [bytes] is an array, so structural
 * equality would be misleading.
 */
class GigComposePickedPhoto(
    val filename: String,
    val mimeType: String,
    val bytes: ByteArray,
)

/** Plain-old-data address fields collected for `APlace`. */
data class GigComposePlaceAddress(
    val line1: String = "",
    val city: String = "",
    val state: String = "",
    val zip: String = "",
) {
    val isComplete: Boolean
        get() =
            line1.trim().isNotEmpty() &&
                city.trim().isNotEmpty() &&
                state.trim().isNotEmpty() &&
                zip.trim().isNotEmpty()
}

/** A12.8 — projected smart-template chip for the empty describe state. */
data class GigComposeTemplate(
    val id: String,
    val label: String,
    /** Emoji glyph (may be empty). */
    val icon: String,
    /** Text seeded into the describe field on tap. */
    val seedText: String,
)

/**
 * A12.8 — post-submit success metadata from magic-post: undo window +
 * notified counts for the success step.
 */
data class GigComposePostResult(
    val gigId: String,
    /** Epoch millis when the undo window closes. */
    val undoDeadlineEpochMs: Long,
    val nearbyHelpers: Int,
    val notifiedCount: Int,
)

/**
 * Validation constants enforced at the UI layer. The backend also
 * validates (`backend/routes/magicTask.js:57`); these mirror the
 * prompt's stricter UI rules.
 */
object GigComposeLimits {
    const val TITLE_MIN: Int = 5
    const val TITLE_MAX: Int = 100
    const val DESCRIPTION_MIN: Int = 20
    const val DESCRIPTION_MAX: Int = 2000
    const val MAX_PHOTOS: Int = 6

    /** E.1 — gig tag cap. Mirrors `tags` `.max(5)` in the backend schema. */
    const val MAX_TAGS: Int = 5

    /** Magic Task describe textarea cap (matches A12.8 "184 / 500"). */
    const val DESCRIBE_MAX: Int = 500

    /** delivery_errand items cap — mirrors `items` `.max(20)`. */
    const val MAX_ITEMS: Int = 20
}

/**
 * delivery_errand route fields. Unlike the archetype JSONB modules these
 * ride as flat snake_case gig columns — `pickup_address`,
 * `pickup_notes`, `dropoff_address`, `dropoff_notes`,
 * `delivery_proof_required` (`backend/routes/gigs.js:481-486`; the read
 * side is `GigDto.pickupAddress`).
 */
data class GigDeliveryDetails(
    val pickupAddress: String = "",
    val pickupNotes: String = "",
    val dropoffAddress: String = "",
    val dropoffNotes: String = "",
    val proofRequired: Boolean = false,
) {
    val hasAnyData: Boolean
        get() =
            pickupAddress.isNotBlank() ||
                pickupNotes.isNotBlank() ||
                dropoffAddress.isNotBlank() ||
                dropoffNotes.isNotBlank() ||
                proofRequired
}

/**
 * pro_service_quote requirements — flat columns again
 * (`requires_license`, `license_type`, `requires_insurance`,
 * `scope_description`, `deposit_required`, `deposit_amount`;
 * `backend/routes/gigs.js:499-505`). [depositAmount] is held as text
 * like the budget fields and parsed at send time.
 */
data class GigProServiceDetails(
    val requiresLicense: Boolean = false,
    val licenseType: String = "",
    val requiresInsurance: Boolean = false,
    val scopeDescription: String = "",
    val depositRequired: Boolean = false,
    val depositAmount: String = "",
) {
    /**
     * A deposit toggle with no (positive) amount blocks the step —
     * mirrors RN's "amount required when the deposit toggle is on".
     */
    val isDepositAmountMissing: Boolean
        get() = depositRequired && (depositAmount.toDoubleOrNull() ?: 0.0) <= 0.0

    val hasAnyData: Boolean
        get() =
            requiresLicense ||
                licenseType.isNotBlank() ||
                requiresInsurance ||
                scopeDescription.isNotBlank() ||
                depositRequired ||
                depositAmount.isNotBlank()
}

/**
 * Snapshot of all wizard form state. Scalar fields mirror into
 * [androidx.lifecycle.SavedStateHandle] so the wizard survives config
 * changes and process death (module objects + items are kept in-memory
 * only — see [GigComposeViewModel]).
 */
data class GigComposeFormState(
    val step: Int = GigComposeStep.Describe.ordinal0,
    /** A12.8 — step-1 entry mode (Magic describe vs manual picker). */
    val composeMode: ComposeMode = ComposeMode.Magic,
    /** A12.8 — plain-English Magic Task input. */
    val describeText: String = "",
    /** Archetype-category parsed from [describeText] (debounced), mirrored into [category]. */
    val detectedArchetype: GigComposeCategory? = null,
    /** Backend `task_archetype` (e.g. "home_service") from the magic draft. */
    val taskArchetype: String? = null,
    val category: GigComposeCategory? = null,
    val title: String = "",
    val description: String = "",
    val photoIds: List<String> = emptyList(),
    val budgetType: GigComposeBudgetType? = null,
    val budgetMin: String = "",
    val budgetMax: String = "",
    /** A12.8 — optional effort estimate (hours, decimal string). */
    val estimatedHours: String = "",
    val scheduleType: GigComposeScheduleType? = null,
    val scheduledStartISO: String? = null,
    val locationMode: GigComposeLocationMode? = null,
    val placeAddress: GigComposePlaceAddress = GigComposePlaceAddress(),
    /** E.1 — optional hard deadline (`deadline`), ISO-8601. null ⇒ flexible. */
    val deadlineISO: String? = null,
    /** E.1 — cancellation policy (`cancellation_policy`). null ⇒ backend default. */
    val cancellationPolicy: GigCancellationPolicy? = null,
    /** E.1 — boost flag (`is_urgent`). */
    val isUrgent: Boolean = false,
    /** E.1 — freeform tags (`tags`), stored without the leading `#`. */
    val tags: List<String> = emptyList(),
    /** A12.8 — user override of the inferred wire `engagement_mode`. */
    val engagementOverride: GigEngagementMode? = null,
    /** P6c — selected business identity (`beneficiary_user_id`). null = Personal. */
    val beneficiaryUserId: String? = null,
    /** P6c — display name of the selected business (chip label). */
    val beneficiaryLabel: String? = null,
    // Archetype module objects — prefilled from the magic draft, edited
    // in Fill gaps, forwarded verbatim on magic-post. In-memory only.
    val careDetails: CareDetailsDto? = null,
    val logisticsDetails: LogisticsDetailsDto? = null,
    val remoteDetails: RemoteDetailsDto? = null,
    val eventDetails: EventDetailsDto? = null,
    /** delivery_errand shopping list (≤[GigComposeLimits.MAX_ITEMS]). */
    val items: List<MagicTaskItemDto> = emptyList(),
    /** delivery_errand route (flat `pickup_*` / `dropoff_*` columns). */
    val deliveryDetails: GigDeliveryDetails? = null,
    /** pro_service_quote requirements (flat `requires_*` columns). */
    val proServiceDetails: GigProServiceDetails? = null,
) {
    val currentStep: GigComposeStep
        get() = GigComposeStep.fromOrdinal(step)

    /** Describe-step tile selection, derived from the schedule prefill. */
    val engagementMode: GigComposeEngagementMode
        get() =
            when (scheduleType) {
                GigComposeScheduleType.Recurring -> GigComposeEngagementMode.Recurring
                GigComposeScheduleType.Flexible -> GigComposeEngagementMode.OpenEnded
                else -> GigComposeEngagementMode.OneTime
            }

    /** True when any user-visible field carries data — drives the close-confirm gate. */
    val hasAnyData: Boolean
        get() =
            describeText.isNotEmpty() ||
                category != null ||
                title.isNotEmpty() ||
                description.isNotEmpty() ||
                photoIds.isNotEmpty() ||
                budgetType != null ||
                budgetMin.isNotEmpty() ||
                budgetMax.isNotEmpty() ||
                estimatedHours.isNotEmpty() ||
                scheduleType != null ||
                scheduledStartISO != null ||
                locationMode != null ||
                placeAddress.isComplete ||
                placeAddress.line1.isNotEmpty() ||
                deadlineISO != null ||
                cancellationPolicy != null ||
                isUrgent ||
                tags.isNotEmpty() ||
                items.isNotEmpty() ||
                deliveryDetails?.hasAnyData == true ||
                proServiceDetails?.hasAnyData == true

    companion object {
        val EMPTY = GigComposeFormState()
    }
}

/** Outbound navigation events the screen consumes. */
sealed interface GigComposeOutboundEvent {
    /** Pop the wizard with no further navigation. */
    data object Dismiss : GigComposeOutboundEvent

    /** Pop the wizard and route to the newly-created gig's detail. */
    data class OpenGigDetail(
        val gigId: String,
    ) : GigComposeOutboundEvent
}
