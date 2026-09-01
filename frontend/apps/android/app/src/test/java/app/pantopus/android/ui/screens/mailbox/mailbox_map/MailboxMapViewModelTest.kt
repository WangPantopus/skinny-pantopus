@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_map

import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridDetent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Unit coverage for the A11.4 Mailbox map view-model state machine. */
class MailboxMapViewModelTest {
    @Test
    fun load_surfaces_populated_spots() {
        val vm = makeVm()
        vm.load()

        val state = vm.state.value
        assertTrue(state is MailboxMapUiState.Populated)
        assertEquals(12, (state as MailboxMapUiState.Populated).spots.size)
    }

    @Test
    fun select_moves_to_detail_without_changing_filter() {
        val vm = makeVm()
        vm.load()
        vm.select("hayes-valley-po")

        val state = vm.state.value
        assertTrue(state is MailboxMapUiState.Selected)
        val selected = state as MailboxMapUiState.Selected
        assertEquals("hayes-valley-po", selected.spot.id)
        assertEquals(MailboxSpotKind.Post, selected.spot.kind)
        assertEquals(12, selected.spots.size)
        assertNull(vm.activeKind.value)
    }

    @Test
    fun select_unknown_id_is_ignored() {
        val vm = makeVm()
        vm.load()
        vm.select("missing")

        assertTrue(vm.state.value is MailboxMapUiState.Populated)
    }

    @Test
    fun back_to_list_restores_filtered_populated_state() {
        val vm = makeVm()
        vm.load()
        vm.selectKind(MailboxSpotKind.Locker)
        vm.select("hayes-valley-po")
        vm.backToList()

        val state = vm.state.value
        assertTrue(state is MailboxMapUiState.Populated)
        val spots = (state as MailboxMapUiState.Populated).spots
        assertTrue(spots.all { it.kind == MailboxSpotKind.Locker })
    }

    @Test
    fun select_kind_filters_spots() {
        val vm = makeVm()
        vm.load()
        vm.selectKind(MailboxSpotKind.Post)

        val state = vm.state.value
        assertTrue(state is MailboxMapUiState.Populated)
        val spots = (state as MailboxMapUiState.Populated).spots
        assertEquals(2, spots.size)
        assertTrue(spots.all { it.kind == MailboxSpotKind.Post })
    }

    @Test
    fun seeded_error_survives_load() {
        val vm = makeVm(seededState = MailboxMapUiState.Error("Couldn't load mailbox spots."))
        vm.load()

        assertTrue(vm.state.value is MailboxMapUiState.Error)
    }

    @Test
    fun detent_defaults_to_standard_and_updates() {
        val vm = makeVm()

        assertEquals(MapListHybridDetent.Standard, vm.detent.value)
        vm.setDetent(MapListHybridDetent.Expanded)
        assertEquals(MapListHybridDetent.Expanded, vm.detent.value)
    }

    @Test
    fun sample_spots_have_week_hours_and_services() {
        MailboxMapSampleData.spots.forEach { spot ->
            assertEquals(7, spot.weekHours.size)
            assertTrue(spot.services.isNotEmpty())
        }
    }

    private fun makeVm(seededState: MailboxMapUiState? = null): MailboxMapViewModel =
        MailboxMapViewModel(
            spots = MailboxMapSampleData.spots,
            seededState = seededState,
            todayWeekday = 4,
        )
}
