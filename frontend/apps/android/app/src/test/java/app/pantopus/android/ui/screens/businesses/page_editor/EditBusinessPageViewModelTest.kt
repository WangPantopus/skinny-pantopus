@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.businesses.page_editor

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.network.NetworkMonitor
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * P4.2 — A13.10 Edit Business Page. Preview-seeded local-persistence
 * behaviour (snapshots + unit coverage of dirty/discard).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class EditBusinessPageViewModelTest {
    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private val networkMonitor: NetworkMonitor =
        mockk { every { isOnline } returns MutableStateFlow(true) }

    private fun makeVm(): EditBusinessPageViewModel =
        EditBusinessPageViewModel(
            SavedStateHandle(mapOf(EDIT_BUSINESS_PAGE_BUSINESS_ID_KEY to "biz-1")),
            mockk<BusinessesRepository>(relaxed = true),
            networkMonitor,
        )

    @Test
    fun seedForPreview_landsInLoaded() {
        val vm = makeVm()
        vm.seedForPreview(EditBusinessPageSampleData.publishedRoostCafe)
        val state = vm.state.value
        assertTrue(state is EditBusinessPageUiState.Loaded)
    }

    @Test
    fun save_clearsDirtyFieldsAndZeroesUnsavedCount() =
        runTest {
            val seed =
                EditBusinessPageSampleData.publishedRoostCafe.copy(
                    name =
                        EditBusinessPageField(
                            original = "Roost Café",
                            current = "Roost Café & Bakery",
                        ),
                )
            val vm = makeVm()
            vm.seedForPreview(seed)
            assertTrue(loadedName(vm).isDirty)

            vm.save()

            assertFalse(loadedName(vm).isDirty)
            val mode = (vm.state.value as EditBusinessPageUiState.Loaded).content.mode
            assertTrue(mode is EditBusinessPageMode.Published)
            assertEquals(0, (mode as EditBusinessPageMode.Published).unsavedCount)
            assertEquals("Saved", vm.toast.value)
        }

    @Test
    fun update_marksFieldDirty() {
        val vm = makeVm()
        vm.seedForPreview(EditBusinessPageSampleData.publishedRoostCafe)
        vm.update(EditBusinessPageFieldKey.Name, "Roost Café & Bakery")
        assertTrue(loadedName(vm).isDirty)
        assertEquals("Roost Café & Bakery", loadedName(vm).current)
    }

    @Test
    fun discardConfirmed_revertsCurrentToOriginal() =
        runTest {
            val seed =
                EditBusinessPageSampleData.publishedRoostCafe.copy(
                    name =
                        EditBusinessPageField(
                            original = "Roost Café",
                            current = "Roost Café & Bakery",
                        ),
                )
            val vm = makeVm()
            vm.seedForPreview(seed)
            assertTrue(loadedName(vm).isDirty)

            vm.discardConfirmed()

            assertFalse(loadedName(vm).isDirty)
            assertEquals("Roost Café", loadedName(vm).current)
            assertEquals("Edits discarded", vm.toast.value)
        }

    @Test
    fun setupMode_publishUpdatesToast() =
        runTest {
            val vm = makeVm()
            vm.seedForPreview(EditBusinessPageSampleData.setupPatchAndPaw)
            vm.publish()
            assertEquals("Published", vm.toast.value)
        }

    @Test
    fun setupMode_saveDraftUpdatesToast() =
        runTest {
            val vm = makeVm()
            vm.seedForPreview(EditBusinessPageSampleData.setupPatchAndPaw)
            vm.saveDraft()
            assertEquals("Draft saved", vm.toast.value)
        }

    private fun loadedName(vm: EditBusinessPageViewModel): EditBusinessPageField =
        (vm.state.value as EditBusinessPageUiState.Loaded).content.name
}
