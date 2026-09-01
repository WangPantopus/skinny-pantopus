@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.accesscodes

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.HomeAccessSecretDto
import app.pantopus.android.data.api.models.homes.HomeAccessSecretsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
import app.pantopus.android.ui.theme.PantopusIcon
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Covers the Access codes VM (T6.4a):
 *  - four-state transitions (loading / empty / error / loaded)
 *  - card-style sections per category in display order
 *  - chip-strip filter rebuilds visible sections
 *  - tap-to-reveal flips the row subtitle mask ↔ value
 *  - copy emits the "Code copied" toast + writes to the bound clipboard
 *  - category fallback for unknown wire `access_type` strings
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AccessCodesViewModelTest {
    private val repo: HomesRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): AccessCodesViewModel =
        AccessCodesViewModel(
            repo = repo,
            savedStateHandle =
                SavedStateHandle(
                    mapOf(
                        AccessCodesViewModel.HOME_ID_KEY to "home-1",
                        AccessCodesViewModel.HOME_NAME_KEY to "412 Birch Ln",
                    ),
                ),
        )

    private fun makeSecret(
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
        visibility = "members",
    )

    private val mixedSecrets =
        listOf(
            makeSecret("s1", "wifi", "Main network", "MaplePan@2025!"),
            makeSecret("s2", "alarm", "Disarm — front panel", "184729"),
            makeSecret("s3", "lockbox", "Front porch lockbox", "4218"),
            makeSecret("s4", "smart_lock", "Front door", "SmartCode-9"),
        )

    // ─── Four states ───────────────────────────────────────────

    @Test fun empty_response_renders_empty_state() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = emptyList()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No access codes yet", empty.headline)
            assertEquals("Add your first code", empty.ctaTitle)
            assertEquals(PantopusIcon.KeyRound, empty.icon)
        }

    @Test fun failure_renders_error_state() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test fun loaded_response_groups_by_category_in_display_order() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = mixedSecrets))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val sections = (state as ListOfRowsUiState.Loaded).sections
            assertEquals(4, sections.size)
            assertEquals(
                listOf("category-wifi", "category-alarm", "category-lockbox", "category-smart_lock"),
                sections.map { it.id },
            )
            sections.forEach { assertEquals(SectionStyle.Card, it.style) }
            assertEquals("Main network", sections.first().rows.first().title)
        }

    // ─── Chip filter ───────────────────────────────────────────

    @Test fun chip_strip_includes_all_six_categories_plus_all() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = mixedSecrets))
            val vm = makeVm()
            vm.load()
            val chips = vm.chipStrip.value?.chips ?: emptyList()
            assertEquals(7, chips.size)
            assertEquals("all", chips.first().id)
            assertEquals(AccessCategory.displayOrder.map { it.wire }, chips.drop(1).map { it.id })
        }

    @Test fun selecting_chip_filters_to_one_section() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = mixedSecrets))
            val vm = makeVm()
            vm.load()
            vm.selectChip("alarm")
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, state.sections.size)
            assertEquals("category-alarm", state.sections.first().id)
        }

    @Test fun selecting_chip_with_no_matches_renders_filtered_empty() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = mixedSecrets))
            val vm = makeVm()
            vm.load()
            vm.selectChip("garage")
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No garage codes yet", empty.headline)
            assertEquals("Add Garage code", empty.ctaTitle)
        }

    // ─── Reveal toggle ─────────────────────────────────────────

    @Test fun toggle_reveal_flips_subtitle_between_mask_and_value() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = mixedSecrets))
            val vm = makeVm()
            vm.load()

            val wifi = mixedSecrets[0]
            val masked = vm.rowFor(wifi)
            assertEquals(AccessCodesViewModel.mask(wifi.secretValue), masked.subtitle)

            vm.toggleReveal("s1")
            assertTrue(vm.revealed.value.contains("s1"))
            val revealed = vm.rowFor(wifi)
            assertEquals("MaplePan@2025!", revealed.subtitle)

            vm.toggleReveal("s1")
            assertFalse(vm.revealed.value.contains("s1"))
        }

    // ─── Copy + toast ──────────────────────────────────────────

    @Test fun copy_writes_to_bound_clipboard_and_shows_toast() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = mixedSecrets))
            val vm = makeVm()
            vm.load()

            var copied: String? = null
            vm.bindClipboard { copied = it }
            vm.copyValue("s2")

            assertEquals("184729", copied)
            assertEquals("Code copied", vm.toast.value)
        }

    @Test fun copy_for_unknown_id_is_a_noop() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = mixedSecrets))
            val vm = makeVm()
            vm.load()
            var copied: String? = null
            vm.bindClipboard { copied = it }

            vm.copyValue("does-not-exist")

            assertNull(copied)
            assertNull(vm.toast.value)
        }

    // ─── Row trailing icon-pair ────────────────────────────────

    @Test fun row_trailing_is_icon_actions_pair_with_copy_and_kebab() =
        runTest {
            coEvery { repo.getHomeAccessSecrets(any()) } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = mixedSecrets))
            val vm = makeVm()
            vm.load()
            val row = vm.rowFor(mixedSecrets[0])
            assertTrue(row.trailing is RowTrailing.IconActions)
            val pair = row.trailing as RowTrailing.IconActions
            assertEquals(PantopusIcon.Copy, pair.primary.icon)
            assertEquals(PantopusIcon.MoreHorizontal, pair.secondary.icon)
            assertNotNull(pair.primary.accessibilityLabel)
        }

    // ─── Category fallback ─────────────────────────────────────

    @Test fun category_from_unknown_access_type_falls_back_to_lockbox() {
        assertEquals(AccessCategory.Lockbox, AccessCategory.from("totally_unknown_type"))
        assertEquals(AccessCategory.Lockbox, AccessCategory.from(null))
    }

    @Test fun category_from_fuzzy_access_type_matches_substring() {
        assertEquals(AccessCategory.Wifi, AccessCategory.from("guest_wifi_pool"))
        assertEquals(AccessCategory.Garage, AccessCategory.from("garage_opener_2"))
        assertEquals(AccessCategory.SmartLock, AccessCategory.from("smart_door"))
    }

    // ─── Mask geometry ─────────────────────────────────────────

    @Test fun mask_is_at_least_four_dots() {
        assertEquals(4, AccessCodesViewModel.mask("12").length)
        assertEquals(4, AccessCodesViewModel.mask("").length)
    }

    @Test fun mask_caps_at_twelve_dots() {
        val long = "A".repeat(50)
        assertEquals(12, AccessCodesViewModel.mask(long).length)
    }
}
