@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.filter_sheet

import androidx.compose.runtime.Immutable

/**
 * Render models for the shared FilterSheet archetype — every filter
 * / sort bottom sheet in the app uses this shape. Sections are an
 * ordered list of headers + controls; the shell owns the working
 * copy and emits the applied selection back through `onApply`.
 *
 * Mirrors the iOS `FilterSection.swift` API.
 */

/** One selectable option in a chip-group / radio / multi-select. */
@Immutable
data class FilterOption(
    val id: String,
    val label: String,
)

/** A bounded numeric range with movable lower / upper handles. */
@Immutable
data class FilterRange(
    /** Domain lower bound. */
    val min: Float,
    /** Domain upper bound. */
    val max: Float,
    /** Current lower handle position. */
    val lower: Float,
    /** Current upper handle position. */
    val upper: Float,
    /** Step size — handles snap to multiples of `step` from `min`. */
    val step: Float = 1f,
) {
    /**
     * Returns a copy with `lower = min` and `upper = max` — the
     * "no filter" position used when the user taps Reset.
     */
    fun cleared(): FilterRange = copy(lower = min, upper = max)

    companion object {
        /** Order-correcting factory. */
        fun create(
            min: Float,
            max: Float,
            lower: Float,
            upper: Float,
            step: Float = 1f,
        ): FilterRange {
            val safeLower = kotlin.math.max(min, kotlin.math.min(lower, upper))
            val safeUpper = kotlin.math.min(max, kotlin.math.max(upper, lower))
            return FilterRange(min, max, safeLower, safeUpper, step)
        }
    }
}

/** The right-side / inline control on one section. */
sealed interface FilterControl {
    /** Horizontal flow of selectable pill chips. Multi-select. */
    @Immutable
    data class ChipGroup(
        val options: List<FilterOption>,
        val selectedIds: Set<String>,
    ) : FilterControl

    /**
     * Horizontal flow of selectable pill chips. Single-select —
     * `null` = "no selection". Reads as chips but only allows one value
     * (e.g. a date-range preset).
     */
    @Immutable
    data class SingleChip(
        val options: List<FilterOption>,
        val selectedId: String?,
    ) : FilterControl

    /** Stack of rows, single selection only. `null` = "no selection". */
    @Immutable
    data class Radio(
        val options: List<FilterOption>,
        val selectedId: String?,
    ) : FilterControl

    /** Stack of rows with checkboxes, multiple selection. */
    @Immutable
    data class MultiSelect(
        val options: List<FilterOption>,
        val selectedIds: Set<String>,
    ) : FilterControl

    /**
     * Stack of rows, each a labeled switch. `selectedIds` are the "on"
     * switches — same selection shape as [MultiSelect] but renders as
     * toggles. Used for boolean filter dimensions (verified-only,
     * newest-first, open-now).
     */
    @Immutable
    data class Toggle(
        val options: List<FilterOption>,
        val selectedIds: Set<String>,
    ) : FilterControl

    /**
     * Single-thumb slider that snaps to a fixed set of labelled [stops].
     * [selectedIndex] indexes into [stops]; [defaultIndex] is the stop
     * Reset returns to. Used for the distance-radius dimension.
     */
    @Immutable
    data class StepSlider(
        val stops: List<FilterOption>,
        val selectedIndex: Int,
        val defaultIndex: Int,
    ) : FilterControl

    /** Dual-thumb range slider. */
    @Immutable
    data class RangeSlider(
        val range: FilterRange,
    ) : FilterControl
}

/**
 * The default / "no selection" form per control kind. Drives the
 * shell's Reset button — every section is mapped to its cleared
 * equivalent without dismissing the sheet.
 */
fun FilterControl.cleared(): FilterControl =
    when (this) {
        is FilterControl.ChipGroup -> copy(selectedIds = emptySet())
        is FilterControl.SingleChip -> copy(selectedId = null)
        is FilterControl.Radio -> copy(selectedId = null)
        is FilterControl.MultiSelect -> copy(selectedIds = emptySet())
        is FilterControl.Toggle -> copy(selectedIds = emptySet())
        is FilterControl.StepSlider -> copy(selectedIndex = defaultIndex)
        is FilterControl.RangeSlider -> copy(range = range.cleared())
    }

/** One section in the sheet — a header label + a single control. */
@Immutable
data class FilterSection(
    val id: String,
    val title: String,
    val control: FilterControl,
) {
    /** Returns a copy with the control reset to its default / empty form. */
    fun cleared(): FilterSection = copy(control = control.cleared())
}

/** Map every section to its cleared form. */
fun List<FilterSection>.cleared(): List<FilterSection> = map { it.cleared() }
