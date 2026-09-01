@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.accesscodes.search

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.HomeAccessSecretDto
import app.pantopus.android.data.api.models.homes.HomeAccessSecretsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.homes.accesscodes.AccessCodesViewModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * P4.6 — Access codes search VM. Mirrors iOS
 * `AccessCodesSearchViewModelTests`: drives the per-home access-secret
 * roster through a mocked repository and asserts the client-side filter
 * (label / notes / category — never the secret value), the masked row
 * template, and the open-code callback.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AccessCodesSearchViewModelTest {
    private val repo: HomesRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun secret(
        id: String,
        accessType: String,
        label: String,
        value: String,
        notes: String? = null,
    ) = HomeAccessSecretDto(
        id = id,
        homeId = "home-1",
        accessType = accessType,
        label = label,
        secretValue = value,
        notes = notes,
    )

    private fun corpus() =
        listOf(
            secret("s1", "wifi", "Main network", "MaplePan@2025!", notes = "Household · 4 members"),
            secret("s2", "alarm", "Disarm — front panel", "184729"),
            secret("s3", "lockbox", "Front porch lockbox", "4218"),
            secret("s4", "smart_lock", "Front door", "SmartCode-9"),
        )

    private fun loadedVm(rows: List<HomeAccessSecretDto> = corpus()): AccessCodesSearchViewModel {
        coEvery { repo.getHomeAccessSecrets(any()) } returns
            NetworkResult.Success(HomeAccessSecretsResponse(secrets = rows))
        return AccessCodesSearchViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(AccessCodesSearchViewModel.HOME_ID_KEY to "home-1")),
        ).also { it.load() }
    }

    @Test
    fun empty_query_yields_no_results() =
        runTest {
            val vm = loadedVm()
            assertTrue(vm.results.value.isEmpty())
            assertFalse(vm.isLoading.value)
        }

    @Test
    fun query_filters_by_label() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("network")
            assertEquals(listOf("s1"), vm.results.value.map { it.id })
        }

    @Test
    fun query_filters_by_notes() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("household")
            assertEquals(listOf("s1"), vm.results.value.map { it.id })
        }

    @Test
    fun query_filters_by_category_label() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("smart lock")
            assertEquals(listOf("s4"), vm.results.value.map { it.id })
        }

    @Test
    fun secret_value_is_not_searchable() =
        runTest {
            val vm = loadedVm()
            // Typing the literal code must not surface its row.
            vm.setQuery("184729")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test
    fun no_matches_yields_empty() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("zzzzzz")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test
    fun load_failure_degrades_to_empty_corpus() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm =
                AccessCodesSearchViewModel(
                    repo = repo,
                    savedStateHandle = SavedStateHandle(mapOf(AccessCodesSearchViewModel.HOME_ID_KEY to "home-1")),
                )
            vm.load()
            vm.setQuery("network")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test
    fun row_mapping_masks_value_and_uses_chevron() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("network")
            val target = vm.results.value.first()
            val row = vm.rowFor(target)
            assertEquals("Main network", row.title)
            assertEquals(AccessCodesViewModel.mask(target.secretValue), row.subtitle)
            assertNotEquals(target.secretValue, row.subtitle)
            assertTrue(row.leading is RowLeading.TypeIcon)
            assertTrue(row.trailing is RowTrailing.Chevron)
        }

    @Test
    fun row_tap_fires_open_code_callback() =
        runTest {
            val vm = loadedVm()
            var captured: String? = null
            vm.onOpenCode = { captured = it }
            vm.setQuery("front door")
            vm.rowFor(vm.results.value.first()).onTap()
            assertEquals("s4", captured)
        }
}
