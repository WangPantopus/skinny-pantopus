@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.ui.screens.scheduling._shared.MoneyAndFlag
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar

/** Slug shape the backend enforces: `^[a-z0-9][a-z0-9-]{0,60}$`. */
internal val SLUG_REGEX = Regex("^[a-z0-9][a-z0-9-]{0,60}$")
internal const val DURATION_MIN = 5
internal const val DURATION_MAX = 480
internal val DURATION_PRESETS = listOf(15, 30, 45, 60, 90)

/** Turn a display name into a backend-valid slug (or "" if it can't). */
internal fun slugify(name: String): String =
    name
        .lowercase()
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
        .take(61)

/** The full editable surface of an event type, mirrored from [EventTypeDto]. */
data class EditorForm(
    val name: String = "",
    val description: String = "",
    val color: String = DEFAULT_COLOR,
    val durations: List<Int> = listOf(30),
    val defaultDuration: Int = 30,
    val multiple: Boolean = false,
    val locationMode: String = "video",
    val locationDetail: String = "",
    val requiresApproval: Boolean = false,
    val visibilitySecret: Boolean = false,
    val isActive: Boolean = true,
    val bufferBeforeMin: Int = 0,
    val bufferAfterMin: Int = 0,
    val minNoticeMin: Int = 0,
    val maxHorizonDays: Int = 60,
    val dailyCap: Int? = null,
    val assignmentMode: String = "one_on_one",
    val chargeEnabled: Boolean = false,
    val priceCents: Int = 0,
    /** Raw text in the Price field; kept so decimals survive typing (parsed into [priceCents]). */
    val priceText: String = "",
    val currency: String = "USD",
    // Collect = Full amount vs Deposit (design PricingCard "Collect" segmented).
    // A non-null deposit (carried from the DTO's `deposit_cents`) means the
    // booker pays a deposit up front rather than the full price.
    val depositCents: Int? = null,
) {
    /** Whether the "Deposit" Collect mode is selected (vs "Full amount"). */
    val collectDeposit: Boolean get() = depositCents != null && depositCents > 0

    val nameValid: Boolean get() = name.trim().isNotEmpty() && slugify(name).matches(SLUG_REGEX)
    val durationValid: Boolean
        get() = defaultDuration in DURATION_MIN..DURATION_MAX && durations.isNotEmpty() && defaultDuration in durations
    val isValid: Boolean get() = nameValid && durationValid && (!chargeEnabled || priceCents > 0)

    companion object {
        val DEFAULT_COLOR = EVENT_TYPE_SWATCHES[1]
    }
}

internal fun EventTypeDto.toForm(): EditorForm {
    val durs = durations.ifEmpty { listOf(defaultDuration ?: 30) }.distinct().sorted()
    val def = defaultDuration ?: durs.firstOrNull() ?: 30
    return EditorForm(
        name = name,
        description = description.orEmpty(),
        color = color?.takeIf { it.isNotBlank() } ?: EditorForm.DEFAULT_COLOR,
        durations = durs,
        defaultDuration = def,
        multiple = durs.size > 1,
        locationMode = locationMode ?: "video",
        locationDetail = locationDetail.orEmpty(),
        requiresApproval = requiresApproval,
        visibilitySecret = visibility == "secret",
        isActive = isActive != false,
        bufferBeforeMin = bufferBeforeMin ?: 0,
        bufferAfterMin = bufferAfterMin ?: 0,
        minNoticeMin = minNoticeMin ?: 0,
        maxHorizonDays = maxHorizonDays ?: 60,
        dailyCap = dailyCap,
        assignmentMode = assignmentMode ?: "one_on_one",
        chargeEnabled = (priceCents ?: 0) > 0,
        priceCents = priceCents ?: 0,
        priceText = MoneyAndFlag.editText(priceCents ?: 0),
        currency = currency ?: "USD",
        depositCents = depositCents,
    )
}

/**
 * B2 Event Type / Service editor. One form for create + edit; the pillar
 * (Personal sky / Business violet) drives the header pill + overlines and
 * reveals the business-only Assignment + Pricing cards. Pricing sits behind
 * the paid feature flag; assignee *configuration* links out to A13.
 */
sealed interface EventTypeEditorUiState {
    data object Loading : EventTypeEditorUiState

    data class Content(
        val pillar: SchedulingPillar,
        val isCreate: Boolean,
        val form: EditorForm,
        val original: EditorForm,
        val nameError: String?,
        val durationError: String?,
        val advancedOpen: Boolean,
        val paidEnabled: Boolean,
        val stripeConnected: Boolean,
        val questionCount: Int?,
        val isSaving: Boolean,
    ) : EventTypeEditorUiState {
        val isDirty: Boolean get() = form != original
        val canSave: Boolean get() = form.isValid && (isCreate || isDirty) && !isSaving
    }

    data class Error(
        val message: String,
    ) : EventTypeEditorUiState
}
