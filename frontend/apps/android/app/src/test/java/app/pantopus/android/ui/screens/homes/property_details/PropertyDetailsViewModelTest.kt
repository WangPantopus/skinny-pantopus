@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.property_details

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PropertyDetailsViewModelTest {
    private fun savedStateHandle(): SavedStateHandle = SavedStateHandle(mapOf(PROPERTY_DETAILS_HOME_ID_KEY to "home-1"))

    private val homesRepository: HomesRepository = mockk(relaxed = true)

    @Test
    fun load_cleanHome_projectsCleanState() {
        val vm = PropertyDetailsViewModel(savedStateHandle(), homesRepository) { _ -> PropertyDetailsSampleData.clean }
        vm.load()

        val state = vm.state.value
        assertTrue(state is PropertyDetailsUiState.Clean)
        val content = (state as PropertyDetailsUiState.Clean).content
        assertTrue(content.banner == null)
        assertFalse(content.propertyFacts.any { it.mismatch })
    }

    @Test
    fun load_mismatchHome_projectsMismatchState() {
        val vm = PropertyDetailsViewModel(savedStateHandle(), homesRepository) { _ -> PropertyDetailsSampleData.mismatch }
        vm.load()

        val state = vm.state.value
        assertTrue(state is PropertyDetailsUiState.Mismatch)
        val content = (state as PropertyDetailsUiState.Mismatch).content
        assertNotNull(content.banner)
        assertTrue(content.propertyFacts.any { it.id == "beds" && it.mismatch })
        assertEquals(1, content.propertyFacts.count { it.mismatch })
    }

    @Test
    fun load_failure_projectsErrorState() {
        val vm =
            PropertyDetailsViewModel(savedStateHandle(), homesRepository) { _ ->
                error("boom")
            }
        vm.load()

        assertTrue(vm.state.value is PropertyDetailsUiState.Error)
    }

    @Test
    fun load_isNoOpOnceResolved() {
        var calls = 0
        val vm =
            PropertyDetailsViewModel(savedStateHandle(), homesRepository) { _ ->
                calls += 1
                PropertyDetailsSampleData.mismatch
            }

        vm.load()
        vm.load()

        assertEquals(1, calls)
    }

    @Test
    fun refresh_reappliesLoaderAndRecoversFromError() {
        var calls = 0
        var fail = true
        val vm =
            PropertyDetailsViewModel(savedStateHandle(), homesRepository) { _ ->
                calls += 1
                if (fail) error("boom")
                PropertyDetailsSampleData.clean
            }

        vm.load()
        assertTrue(vm.state.value is PropertyDetailsUiState.Error)
        fail = false
        vm.refresh()

        assertTrue(vm.state.value is PropertyDetailsUiState.Clean)
        assertEquals(2, calls)
    }

    @Test
    fun sampleData_monoFlagsOnExpectedRowsOnly() {
        val monoIds = setOf("year", "beds", "baths", "interior", "lot", "parcel", "zoning", "assessed")
        val rows = PropertyDetailsSampleData.clean.propertyFacts + PropertyDetailsSampleData.clean.records

        rows.filter { it.id in monoIds }.forEach { row ->
            assertTrue("Row ${row.id} should render monospaced", row.mono)
        }
        assertFalse(rows.first { it.id == "type" }.mono)
        assertFalse(rows.first { it.id == "class" }.mono)
    }
}
