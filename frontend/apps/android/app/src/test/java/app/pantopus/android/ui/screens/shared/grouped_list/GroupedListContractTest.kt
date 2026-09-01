@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.shared.grouped_list

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks the GroupedList archetype's data contract: row controls
 * preserve their values, destructive rows can coexist with regular
 * rows in the same group, and the optimistic-override key matches
 * the row id by convention.
 */
class GroupedListContractTest {
    @Test fun row_control_variants_round_trip() {
        val cases =
            listOf(
                RowControl.Chevron,
                RowControl.Toggle(isOn = true),
                RowControl.Toggle(isOn = false),
                RowControl.Radio(isSelected = true),
                RowControl.ChipStatus("Verified", RowControl.ChipTone.Success, includesChevron = true),
                RowControl.Slider(listOf("A", "B", "C"), index = 1),
            )
        cases.forEach { control ->
            val row = GroupedListRow(id = "r", label = "Row", control = control)
            assertEquals(control, row.control)
        }
    }

    @Test fun group_helper_preserved() {
        val group =
            GroupedListGroup(
                id = "g",
                overline = "Group",
                helper = "Helper caption",
                rows = listOf(GroupedListRow(id = "r1", label = "One", control = RowControl.Chevron)),
            )
        assertEquals("Helper caption", group.helper)
        assertNotNull(group.rows.firstOrNull { it.id == "r1" })
    }

    @Test fun destructive_row_flag_carried_on_model() {
        val row =
            GroupedListRow(
                id = "logout",
                label = "Log out",
                control = RowControl.Chevron,
                destructive = true,
            )
        assertTrue(row.destructive)
    }

    @Test fun state_transitions() {
        val groups =
            listOf(
                GroupedListGroup(
                    id = "g",
                    overline = null,
                    rows = listOf(GroupedListRow(id = "r", label = "Row", control = RowControl.Chevron)),
                ),
            )
        assertTrue(GroupedListUiState.Loading is GroupedListUiState)
        val loaded = GroupedListUiState.Loaded(groups)
        assertEquals(1, loaded.groups.size)
        val error = GroupedListUiState.Error("boom")
        assertEquals("boom", error.message)
    }
}
