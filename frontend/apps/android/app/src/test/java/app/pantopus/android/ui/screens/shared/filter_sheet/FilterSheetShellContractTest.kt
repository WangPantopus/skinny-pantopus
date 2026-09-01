@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.filter_sheet

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * P5.1 — Contract tests for the shared FilterSheet scaffold's render
 * models. Locks the clear-behaviour of every control kind so callers
 * can rely on Reset producing the right shape.
 */
class FilterSheetShellContractTest {
    private val opts =
        listOf(
            FilterOption(id = "a", label = "A"),
            FilterOption(id = "b", label = "B"),
        )

    // ─── ChipGroup ──────────────────────────────────────

    @Test
    fun chipGroup_cleared_drops_selection() {
        val control = FilterControl.ChipGroup(options = opts, selectedIds = setOf("a"))
        val cleared = control.cleared() as FilterControl.ChipGroup
        assertTrue(cleared.selectedIds.isEmpty())
        assertEquals(opts, cleared.options)
    }

    // ─── Radio ──────────────────────────────────────────

    @Test
    fun radio_cleared_drops_selection() {
        val control = FilterControl.Radio(options = opts, selectedId = "a")
        val cleared = control.cleared() as FilterControl.Radio
        assertNull(cleared.selectedId)
    }

    // ─── MultiSelect ────────────────────────────────────

    @Test
    fun multiSelect_cleared_drops_selection() {
        val control = FilterControl.MultiSelect(options = opts, selectedIds = setOf("a", "b"))
        val cleared = control.cleared() as FilterControl.MultiSelect
        assertTrue(cleared.selectedIds.isEmpty())
    }

    // ─── Toggle ─────────────────────────────────────────

    @Test
    fun toggle_cleared_drops_selection() {
        val control = FilterControl.Toggle(options = opts, selectedIds = setOf("a", "b"))
        val cleared = control.cleared() as FilterControl.Toggle
        assertTrue(cleared.selectedIds.isEmpty())
        assertEquals(opts, cleared.options)
    }

    // ─── StepSlider ─────────────────────────────────────

    @Test
    fun stepSlider_cleared_resets_to_default_index() {
        val stops =
            listOf(
                FilterOption("0.5", "0.5 mi"),
                FilterOption("1", "1 mi"),
                FilterOption("3", "3 mi"),
            )
        val control = FilterControl.StepSlider(stops = stops, selectedIndex = 0, defaultIndex = 2)
        val cleared = control.cleared() as FilterControl.StepSlider
        assertEquals(2, cleared.selectedIndex)
        assertEquals(2, cleared.defaultIndex)
        assertEquals(stops, cleared.stops)
    }

    // ─── Range ──────────────────────────────────────────

    @Test
    fun range_cleared_resets_handles_to_bounds() {
        val range = FilterRange(min = 0f, max = 100f, lower = 25f, upper = 75f, step = 5f)
        val cleared = range.cleared()
        assertEquals(0f, cleared.lower)
        assertEquals(100f, cleared.upper)
        assertEquals(5f, cleared.step)
    }

    @Test
    fun range_create_swaps_crossed_handles() {
        val r = FilterRange.create(min = 0f, max = 100f, lower = 80f, upper = 20f, step = 1f)
        assertTrue("lower must be <= upper", r.lower <= r.upper)
        assertTrue("lower must be >= min", r.lower >= r.min)
        assertTrue("upper must be <= max", r.upper <= r.max)
    }

    // ─── Section / list helpers ─────────────────────────

    @Test
    fun section_cleared_replaces_control() {
        val section =
            FilterSection(
                id = "sort",
                title = "Sort by",
                control = FilterControl.Radio(options = opts, selectedId = "a"),
            )
        val cleared = section.cleared()
        assertEquals(section.id, cleared.id)
        assertEquals(section.title, cleared.title)
        val radio = cleared.control as FilterControl.Radio
        assertNull(radio.selectedId)
    }

    @Test
    fun list_cleared_maps_every_section() {
        val sections =
            listOf(
                FilterSection(
                    id = "s1",
                    title = "One",
                    control = FilterControl.ChipGroup(options = opts, selectedIds = setOf("a")),
                ),
                FilterSection(
                    id = "s2",
                    title = "Two",
                    control = FilterControl.MultiSelect(options = opts, selectedIds = setOf("a", "b")),
                ),
                FilterSection(
                    id = "s3",
                    title = "Three",
                    control = FilterControl.RangeSlider(FilterRange(0f, 10f, 2f, 8f)),
                ),
            )
        val cleared = sections.cleared()
        assertEquals(3, cleared.size)
        assertTrue((cleared[0].control as FilterControl.ChipGroup).selectedIds.isEmpty())
        assertTrue((cleared[1].control as FilterControl.MultiSelect).selectedIds.isEmpty())
        val range = (cleared[2].control as FilterControl.RangeSlider).range
        assertEquals(0f, range.lower)
        assertEquals(10f, range.upper)
    }

    @Test
    fun cleared_preserves_options_and_range_bounds() {
        val sections =
            listOf(
                FilterSection(
                    id = "category",
                    title = "Category",
                    control = FilterControl.ChipGroup(options = opts, selectedIds = setOf("a")),
                ),
                FilterSection(
                    id = "price",
                    title = "Price",
                    control =
                        FilterControl.RangeSlider(
                            FilterRange(min = 5f, max = 95f, lower = 20f, upper = 80f, step = 5f),
                        ),
                ),
            )
        val cleared = sections.cleared()
        // ChipGroup options preserved across clear.
        assertEquals(opts, (cleared[0].control as FilterControl.ChipGroup).options)
        // RangeSlider min/max/step preserved; handles snapped to bounds.
        val r = (cleared[1].control as FilterControl.RangeSlider).range
        assertEquals(5f, r.min)
        assertEquals(95f, r.max)
        assertEquals(5f, r.step)
        assertEquals(5f, r.lower)
        assertEquals(95f, r.upper)
    }

    @Test
    fun selected_chip_isOn_state_drives_set_membership() {
        val initial = setOf("a")
        // Tap "a" → remove.
        assertFalse((initial - "a").contains("a"))
        // Tap "b" → insert.
        assertTrue((initial + "b").contains("b"))
    }
}
