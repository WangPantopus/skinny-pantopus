@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.legal

import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LegalIndexViewModelTest {
    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test fun loadProducesPoliciesAndCreditsGroups() =
        runTest {
            val vm = LegalIndexViewModel()
            vm.load()
            val loaded = vm.state.value as GroupedListUiState.Loaded
            assertEquals(listOf("policies", "credits"), loaded.groups.map { it.id })
            assertEquals(
                listOf("terms", "privacy", "acceptableuse", "cookies"),
                loaded.groups[0].rows.map { it.id },
            )
            assertEquals(listOf("opensource"), loaded.groups[1].rows.map { it.id })
        }

    @Test fun onRowDispatchesMatchingDocument() =
        runTest {
            val vm = LegalIndexViewModel()
            vm.load()
            vm.onRow("privacy")
            assertEquals(LegalDocument.Privacy, vm.navigation.value)
            vm.consumeNavigation()
            assertEquals(null, vm.navigation.value)
        }

    @Test fun onUnknownRowDoesNothing() =
        runTest {
            val vm = LegalIndexViewModel()
            vm.load()
            vm.onRow("nope")
            assertEquals(null, vm.navigation.value)
        }
}
