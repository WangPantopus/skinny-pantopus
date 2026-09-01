@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.settings

import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.core.security.StepUpCoordinator
import app.pantopus.android.data.account.AccountDeletionRepository
import app.pantopus.android.data.account.AccountRepository
import app.pantopus.android.data.api.models.settings.AuthMethodsResponse
import app.pantopus.android.data.api.models.settings.PrivacySettingsDto
import app.pantopus.android.data.api.models.settings.PrivacySettingsResponse
import app.pantopus.android.data.api.models.settings.PrivacySettingsUpdate
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.privacy.PrivacyRepository
import app.pantopus.android.ui.components.FuzzStop
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListBanner
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import app.pantopus.android.ui.theme.PantopusIcon
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
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
 * P7.6 / A14.7 — the reshaped Privacy matrix. Covers the defaults +
 * stealth frames, the RadioCard / fuzz / activity / data projection,
 * the stealth banner, optimistic radio / toggle / fuzz mutations, and
 * the helper-line parity contract (mirrored on iOS).
 *
 * T1 adds the backend-backed surfaces: the search-privacy card wired to
 * `GET/PATCH /api/privacy/settings`, and the delete-account gate in front
 * of `DELETE /api/users/account`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PrivacyViewModelTest {
    private val privacy: PrivacyRepository = mockk()
    private val accountDeletion: AccountDeletionRepository = mockk()
    private val stepUp: StepUpCoordinator = mockk()
    private val account: AccountRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { privacy.settings() } returns NetworkResult.Success(settingsResponse())
        coEvery { account.authMethods() } returns NetworkResult.Success(AuthMethodsResponse(hasPassword = true))
        // Mirrors the real coordinator: no host Activity → nothing can be verified.
        coEvery { stepUp.obtainToken(any(), any(), isNull(), any()) } returns
            StepUpCoordinator.Outcome.Failed(StepUpCoordinator.NO_ACTIVITY_MESSAGE)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun settingsResponse(
        searchVisibility: String = "everyone",
        findableByName: Boolean = false,
    ) = PrivacySettingsResponse(
        settings =
            PrivacySettingsDto(
                userId = "u1",
                searchVisibility = searchVisibility,
                findableByName = findableByName,
            ),
    )

    @Test fun populated_produces_eight_groups_in_design_order() {
        val vm = privacyVm().apply { load() }
        assertEquals(
            listOf(
                "biometricSecurity",
                "searchPrivacy",
                "visibility",
                "address",
                "fuzz",
                "activity",
                "data",
                "delete",
            ),
            vm.groups().map { it.id },
        )
        assertNull(vm.banner.value)
    }

    @Test fun visibility_and_address_are_four_option_radio_cards() {
        val groups = privacyVm().loadedGroups()
        val visibility = groups.group("visibility")
        val address = groups.group("address")
        assertEquals(4, visibility?.rows?.size)
        assertEquals(4, address?.rows?.size)
        assertEquals("visibility.verified", selectedRadioId(visibility))
        assertEquals("address.street", selectedRadioId(address))
        visibility?.rows?.forEach { assertTrue("${it.id} radio", it.control is RowControl.Radio) }
    }

    @Test fun fuzz_group_defaults_to_half_mile() {
        val fuzz = privacyVm().loadedGroups().group("fuzz")
        assertEquals(FuzzStop.HalfMile, fuzz?.fuzz?.stop)
        assertEquals("How exact your task and listing pins appear on the map.", fuzz?.fuzz?.leadIn)
        assertTrue(fuzz?.rows?.isEmpty() ?: false)
    }

    @Test fun activity_has_four_toggles_all_on() {
        val activity = privacyVm().loadedGroups().group("activity")
        assertEquals(listOf("online", "recent", "nearby", "ratings"), activity?.rows?.map { it.id })
        activity?.rows?.forEach {
            val control = it.control
            assertTrue("${it.id} toggle", control is RowControl.Toggle && control.isOn)
        }
    }

    @Test fun data_rows_carry_leading_icons_and_delete_is_destructive() {
        val groups = privacyVm().loadedGroups()
        val data = groups.group("data")
        assertEquals(PantopusIcon.Download, data?.rows?.first { it.id == "downloadData" }?.leadingIcon)
        assertEquals(PantopusIcon.FileText, data?.rows?.first { it.id == "whatWeCollect" }?.leadingIcon)
        val delete = groups.group("delete")?.rows?.first()
        assertEquals("deleteAccount", delete?.id)
        assertTrue(delete?.destructive ?: false)
    }

    @Test fun select_radio_updates_selection() {
        val vm = privacyVm()
        vm.load()
        vm.onRadio("visibility.connections")
        assertEquals("visibility.connections", selectedRadioId(vm.groups().group("visibility")))
    }

    @Test fun toggle_activity_flips_local_state() {
        val vm = privacyVm()
        vm.load()
        vm.onToggle("online", isOn = false)
        val control = vm.groups().group("activity")?.rows?.first { it.id == "online" }?.control
        assertTrue(control is RowControl.Toggle && !control.isOn)
    }

    @Test fun set_fuzz_updates_stop() {
        val vm = privacyVm()
        vm.load()
        vm.onSetFuzz(PrivacyCatalog.FUZZ, FuzzStop.Exact)
        assertEquals(FuzzStop.Exact, vm.groups().group("fuzz")?.fuzz?.stop)
    }

    // ---- Search privacy (GET / PATCH /api/privacy/settings) ----

    @Test fun search_privacy_card_reflects_loaded_settings() {
        coEvery { privacy.settings() } returns
            NetworkResult.Success(settingsResponse("mutuals", findableByName = true))
        val card = privacyVm().loadedGroups().group("searchPrivacy")
        assertEquals(
            listOf(
                "searchVisibility.everyone",
                "searchVisibility.mutuals",
                "searchVisibility.nobody",
                "findableByName",
            ),
            card?.rows?.map { it.id },
        )
        assertEquals("searchVisibility.mutuals", selectedRadioId(card))
        val toggle = card?.rows?.first { it.id == "findableByName" }?.control
        assertTrue(toggle is RowControl.Toggle && toggle.isOn)
        assertEquals("Only connected people can find your profile in search.", card?.helper)
        assertEquals(
            "search-visibility-everyone",
            card?.rows?.first { it.id == "searchVisibility.everyone" }?.testTag,
        )
        assertEquals(
            "findable-by-name-switch",
            card?.rows?.first { it.id == "findableByName" }?.testTag,
        )
    }

    @Test fun selecting_search_visibility_patches_and_adopts_server_value() {
        coEvery { privacy.updateSettings(any()) } returns
            NetworkResult.Success(settingsResponse("nobody"))
        val vm = privacyVm()
        vm.load()
        vm.onRadio("searchVisibility.nobody")
        assertEquals("searchVisibility.nobody", selectedRadioId(vm.groups().group("searchPrivacy")))
        assertEquals("Search privacy updated.", vm.toast.value?.text)
        coVerify { privacy.updateSettings(PrivacySettingsUpdate(searchVisibility = "nobody")) }
    }

    @Test fun failed_search_visibility_patch_rolls_back() {
        coEvery { privacy.updateSettings(any()) } returns
            NetworkResult.Failure(NetworkError.Server(500, null))
        val vm = privacyVm()
        vm.load()
        vm.onRadio("searchVisibility.nobody")
        assertEquals("searchVisibility.everyone", selectedRadioId(vm.groups().group("searchPrivacy")))
        assertEquals(ToastKind.Error, vm.toast.value?.kind)
    }

    @Test fun failed_findable_by_name_patch_rolls_back() {
        coEvery { privacy.updateSettings(any()) } returns
            NetworkResult.Failure(NetworkError.Server(500, null))
        val vm = privacyVm()
        vm.load()
        vm.onToggle("findableByName", isOn = true)
        val toggle = vm.groups().group("searchPrivacy")?.rows?.first { it.id == "findableByName" }?.control
        assertTrue(toggle is RowControl.Toggle && !toggle.isOn)
        assertEquals(ToastKind.Error, vm.toast.value?.kind)
    }

    @Test fun search_privacy_load_failure_keeps_screen_and_swaps_helper() {
        coEvery { privacy.settings() } returns NetworkResult.Failure(NetworkError.Server(500, null))
        val groups = privacyVm().loadedGroups()
        assertEquals("a failed settings fetch must not blank the screen", 8, groups.size)
        assertEquals(
            "Search privacy could not load. Pull to refresh before changing this setting.",
            groups.group("searchPrivacy")?.helper,
        )
    }

    // ---- Delete account (DELETE /api/users/account) ----

    @Test fun tapping_delete_row_opens_the_confirm_sheet() {
        val vm = privacyVm()
        vm.load()
        assertFalse(vm.deleteSheetVisible.value)
        vm.onTapRow("deleteAccount")
        assertTrue(vm.deleteSheetVisible.value)
    }

    @Test fun no_host_activity_means_no_delete() {
        val vm = privacyVm()
        vm.load()
        vm.onTapRow("deleteAccount")
        vm.confirmDeleteAccount(hostActivity = null)
        assertNotNull(vm.deleteAccountError.value)
        assertTrue(vm.deleteSheetVisible.value)
        coVerify(exactly = 0) { accountDeletion.deleteAccount(any()) }
    }

    @Test fun dismiss_clears_the_error_and_closes_the_sheet() {
        val vm = privacyVm()
        vm.load()
        vm.onTapRow("deleteAccount")
        vm.confirmDeleteAccount(hostActivity = null)
        vm.dismissDeleteSheet()
        assertFalse(vm.deleteSheetVisible.value)
        assertNull(vm.deleteAccountError.value)
    }

    // ---- Persistent login: DELETE /account carries X-Step-Up ----

    @Test fun delete_uses_the_password_step_up_when_the_account_has_one_and_sends_the_token() {
        val activity = mockk<androidx.fragment.app.FragmentActivity>(relaxed = true)
        coEvery { stepUp.obtainToken(StepUpCoordinator.PURPOSE_DELETE_ACCOUNT, listOf("password"), activity, any()) } returns
            StepUpCoordinator.Outcome.Token("tok-1", "password")
        coEvery { accountDeletion.deleteAccount("tok-1") } returns NetworkResult.Success(Unit)
        val auth =
            mockk<AuthRepository>(relaxed = true) {
                every { state } returns MutableStateFlow(AuthRepository.State.SignedOut)
            }
        val vm = privacyVm(auth)
        vm.load()
        vm.onTapRow("deleteAccount")
        vm.confirmDeleteAccount(hostActivity = activity)

        coVerify(exactly = 1) { accountDeletion.deleteAccount("tok-1") }
        coVerify(exactly = 1) { auth.eraseAllLocalState() }
        assertTrue(vm.accountDeleted.value)
        assertFalse(vm.deleteSheetVisible.value)
    }

    @Test fun delete_for_an_oauth_only_account_asks_for_the_device_key_method() {
        val activity = mockk<androidx.fragment.app.FragmentActivity>(relaxed = true)
        coEvery { account.authMethods() } returns NetworkResult.Success(AuthMethodsResponse(hasPassword = false))
        coEvery { stepUp.obtainToken(StepUpCoordinator.PURPOSE_DELETE_ACCOUNT, listOf("device_key"), activity, any()) } returns
            StepUpCoordinator.Outcome.Failed(StepUpCoordinator.NO_METHOD_MESSAGE)
        val vm = privacyVm()
        vm.load()
        vm.onTapRow("deleteAccount")
        vm.confirmDeleteAccount(hostActivity = activity)

        coVerify(exactly = 0) { accountDeletion.deleteAccount(any()) }
        assertEquals(PASSWORDLESS_DELETE_HELP, vm.deleteAccountError.value)
        assertTrue(vm.deleteSheetVisible.value)
    }

    @Test fun cancelled_step_up_is_silent_and_keeps_the_sheet() {
        val activity = mockk<androidx.fragment.app.FragmentActivity>(relaxed = true)
        coEvery { stepUp.obtainToken(any(), any(), activity, any()) } returns StepUpCoordinator.Outcome.Cancelled
        val vm = privacyVm()
        vm.load()
        vm.onTapRow("deleteAccount")
        vm.confirmDeleteAccount(hostActivity = activity)

        coVerify(exactly = 0) { accountDeletion.deleteAccount(any()) }
        assertNull(vm.deleteAccountError.value)
        assertTrue(vm.deleteSheetVisible.value)
        assertFalse(vm.deletingAccount.value)
    }

    @Test fun backend_409_copy_is_surfaced_verbatim_and_nothing_is_erased() {
        val activity = mockk<androidx.fragment.app.FragmentActivity>(relaxed = true)
        coEvery { stepUp.obtainToken(any(), any(), activity, any()) } returns
            StepUpCoordinator.Outcome.Token("tok-2", "password")
        coEvery { accountDeletion.deleteAccount("tok-2") } returns
            NetworkResult.Failure(NetworkError.ClientError(409, "{\"error\":\"Finish your gigs first.\"}"))
        val auth =
            mockk<AuthRepository>(relaxed = true) {
                every { state } returns MutableStateFlow(AuthRepository.State.SignedOut)
            }
        val vm = privacyVm(auth)
        vm.load()
        vm.onTapRow("deleteAccount")
        vm.confirmDeleteAccount(hostActivity = activity)

        assertEquals("Finish your gigs first.", vm.deleteAccountError.value)
        coVerify(exactly = 0) { auth.eraseAllLocalState() }
        assertFalse(vm.accountDeleted.value)
    }

    @Test fun stealth_shows_banner_and_strictest_controls() {
        val vm = privacyVm()
        vm.setVariant(PrivacySettingsViewModel.Variant.Stealth)
        val groups = vm.groups()
        val banner = vm.banner.value
        assertNotNull(banner)
        assertEquals("Stealth mode is on", banner?.title)
        assertEquals("Your profile is hidden from search. Existing connections still see you.", banner?.subtitle)
        assertEquals(PantopusIcon.EyeOff, banner?.icon)
        assertEquals(GroupedListBanner.Style.Stealth, banner?.style)
        assertEquals("visibility.hidden", selectedRadioId(groups.group("visibility")))
        assertEquals("address.hidden", selectedRadioId(groups.group("address")))
        assertEquals(FuzzStop.Neighborhood, groups.group("fuzz")?.fuzz?.stop)
        groups.group("activity")?.rows?.forEach {
            val control = it.control
            if (control is RowControl.Toggle) assertFalse("${it.id} off", control.isOn)
        }
        assertEquals("Stealth · auto-applied May 26, 2026", vm.footerCaption)
    }

    @Test fun footer_default() {
        assertEquals("Last updated · Mar 12, 2024", privacyVm().footerCaption)
    }

    @Test fun helper_copy_matches_design() {
        val populated = privacyVm().loadedGroups()
        assertEquals(
            "Verified neighbors can find you and start a conversation.",
            populated.group("visibility")?.helper,
        )
        assertEquals(
            "Street name shows on your profile; full address only to people you hire or sell to.",
            populated.group("address")?.helper,
        )
        assertEquals(
            "Pins drop within a block of you. Exact address only shared after a task is accepted.",
            populated.group("fuzz")?.helper,
        )
        assertNull("Activity card has no helper", populated.group("activity")?.helper)

        val stealthVm = privacyVm().apply { setVariant(PrivacySettingsViewModel.Variant.Stealth) }
        val stealth = stealthVm.groups()
        assertEquals(
            "Hidden — your profile won't show in search or recommendations.",
            stealth.group("visibility")?.helper,
        )
        assertEquals(
            "Address hidden everywhere. Deliveries still route correctly.",
            stealth.group("address")?.helper,
        )
        assertEquals(
            "Pins fuzz to your neighborhood — buyers see only \"Park Slope\", never your block.",
            stealth.group("fuzz")?.helper,
        )
    }

    // MARK: - Helpers

    private fun privacyVm(
        auth: AuthRepository =
            mockk<AuthRepository>(relaxed = true) {
                every { state } returns MutableStateFlow(AuthRepository.State.SignedOut)
            },
    ): PrivacySettingsViewModel {
        val appLock =
            mockk<AppLockManager>(relaxed = true) {
                every { preferenceEnabled } returns MutableStateFlow(false)
                every { capability } returns MutableStateFlow(AppLockManager.Capability.Available)
                every { biometricLabel } returns MutableStateFlow("Biometric")
                every { lastError } returns MutableStateFlow(null)
                every { isLocked } returns MutableStateFlow(false)
            }
        return PrivacySettingsViewModel(appLock, auth, privacy, accountDeletion, stepUp, account)
    }

    private fun PrivacySettingsViewModel.loadedGroups(): List<GroupedListGroup> {
        load()
        return groups()
    }

    private fun PrivacySettingsViewModel.groups(): List<GroupedListGroup> = (state.value as GroupedListUiState.Loaded).groups

    private fun List<GroupedListGroup>.group(id: String): GroupedListGroup? = firstOrNull { it.id == id }

    private fun selectedRadioId(group: GroupedListGroup?): String? =
        group?.rows?.firstOrNull { row ->
            val control = row.control
            control is RowControl.Radio && control.isSelected
        }?.id
}
