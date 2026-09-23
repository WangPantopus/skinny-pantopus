@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.security

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.HomePrivacyDto
import app.pantopus.android.data.api.models.homes.HomePrivacyResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomePrivacyRepository
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * P5.1 / A14.2 — projection tests for the per-home Security screen.
 * Locks the shape (only the enforced address-precision toggle is offered;
 * all nine stored toggles stay in the model) plus the helper-line copy —
 * the strings here MUST stay in sync with the iOS `HomeSecurityViewModel`
 * helpers so iOS+Android parity holds.
 *
 * P3F: the view-model now reads `GET /api/homes/:id/privacy` and PATCHes
 * each flip. The projection/helper tests drive the seed (via [setVariant]
 * or a failing GET), keeping them data-source-agnostic; the networked
 * happy-path + rollback are covered separately.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class HomeSecurityViewModelTest {
    private val repository: HomePrivacyRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        // Default: GET fails so `load()` keeps the seed; PATCH succeeds.
        coEvery { repository.getPrivacy(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
        coEvery { repository.updatePrivacy(any(), any()) } returns NetworkResult.Success(privacyResponse())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm() =
        HomeSecurityViewModel(
            repository = repository,
            savedStateHandle = SavedStateHandle(mapOf(HOME_SECURITY_HOME_ID_KEY to "home-1")),
        )

    private fun privacyResponse(mapOptOut: Boolean = false) =
        HomePrivacyResponse(
            HomePrivacyDto(
                homeId = "home-1",
                guestApproval = true,
                memberNameVisibility = true,
                addressPrecision = false,
                activityVisibility = true,
                mapOptOut = mapOptOut,
                notificationPreviews = true,
                docLock = true,
                photoBlur = false,
                vaultAutoLock = false,
            ),
        )

    @Test
    fun balanced_variant_has_five_toggles_on() {
        val vm = makeVm()
        vm.setVariant(HomeSecurityViewModel.Variant.Balanced)
        assertEquals(5, vm.toggles.values.count { it })
    }

    @Test
    fun strict_variant_has_nine_toggles_on() {
        val vm = makeVm()
        vm.setVariant(HomeSecurityViewModel.Variant.Strict)
        assertEquals(9, vm.toggles.size)
        assertTrue(vm.toggles.values.all { it })
    }

    @Test
    fun group_shape_matches_audit() =
        runTest {
            val vm = makeVm()
            vm.load() // GET fails → keeps Balanced seed
            val groups = (vm.state.value as GroupedListUiState.Loaded).groups
            assertEquals(listOf("accessControl"), groups.map { it.id })
            assertEquals(listOf(HomeSecurityToggles.ADDRESS_PRECISION), groups.first().rows.map { it.id })
            for (row in groups.flatMap { it.rows }) {
                assertTrue("Row ${row.id} should be a toggle", row.control is RowControl.Toggle)
            }
        }

    @Test
    fun balanced_helpers_use_mixed_state_copy() {
        val vm = makeVm()
        vm.setVariant(HomeSecurityViewModel.Variant.Balanced)
        val groups = (vm.state.value as GroupedListUiState.Loaded).groups
        val helpers = groups.associate { it.id to it.helper }
        assertEquals(
            "Place shows this Home's full street address, including the unit number.",
            helpers["accessControl"],
        )
    }

    @Test
    fun strict_helpers_shift_to_consequence_language() {
        val vm = makeVm()
        vm.setVariant(HomeSecurityViewModel.Variant.Strict)
        val groups = (vm.state.value as GroupedListUiState.Loaded).groups
        val helpers = groups.associate { it.id to it.helper }
        assertEquals(
            "Place shows this Home's street without the unit number.",
            helpers["accessControl"],
        )
    }

    @Test
    fun toggle_flip_updates_state() =
        runTest {
            val vm = makeVm()
            vm.setVariant(HomeSecurityViewModel.Variant.Balanced)
            vm.onToggle(HomeSecurityToggles.ADDRESS_PRECISION, true)
            assertEquals(true, vm.toggles[HomeSecurityToggles.ADDRESS_PRECISION])
            val groups = (vm.state.value as GroupedListUiState.Loaded).groups
            val row = groups.flatMap { it.rows }.first { it.id == HomeSecurityToggles.ADDRESS_PRECISION }
            val control = row.control as RowControl.Toggle
            assertTrue(control.isOn)
        }

    @Test
    fun load_applies_server_toggles() =
        runTest {
            coEvery { repository.getPrivacy("home-1") } returns NetworkResult.Success(privacyResponse(mapOptOut = true))
            val vm = makeVm()
            vm.load()
            assertEquals(true, vm.toggles[HomeSecurityToggles.MAP_OPT_OUT])
        }

    @Test
    fun toggle_rolls_back_on_patch_failure() =
        runTest {
            coEvery { repository.updatePrivacy(any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.setVariant(HomeSecurityViewModel.Variant.Balanced)
            vm.onToggle(HomeSecurityToggles.ADDRESS_PRECISION, true)
            assertEquals(
                "A failed PATCH must roll the toggle back",
                false,
                vm.toggles[HomeSecurityToggles.ADDRESS_PRECISION],
            )
        }
}
