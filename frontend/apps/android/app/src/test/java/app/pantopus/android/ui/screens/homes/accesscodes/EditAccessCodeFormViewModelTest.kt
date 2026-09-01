@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.accesscodes

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CreateAccessSecretRequest
import app.pantopus.android.data.api.models.homes.HomeAccessSecretDto
import app.pantopus.android.data.api.models.homes.HomeAccessSecretResponse
import app.pantopus.android.data.api.models.homes.HomeAccessSecretsResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.UpdateAccessSecretRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * P3.1 — VM-level coverage for the Add / Edit Access Code form. Mirrors
 * the iOS `EditAccessCodeFormViewModelTests` and covers:
 *  - default add pose (no secretId) seeds Wi-Fi + members visibility
 *  - hydrate from list on edit pose
 *  - per-category selection
 *  - reveal toggle flips state
 *  - copy emits the "Copied" toast + forwards to bound clipboard handler
 *  - validation gates submit on empty label / value
 *  - POST + PUT happy paths emit "Code added" / "Code updated"
 *  - failure surfaces an error toast
 *  - roster-aware visibility summaries
 *  - backend wire mapping respects the schema CHECK list
 */
@OptIn(ExperimentalCoroutinesApi::class)
class EditAccessCodeFormViewModelTest {
    private val homes: HomesRepository = mockk()
    private val members: HomeMembersRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(
        secretId: String? = null,
        category: String? = null,
    ): EditAccessCodeFormViewModel =
        EditAccessCodeFormViewModel(
            homes = homes,
            members = members,
            savedStateHandle =
                SavedStateHandle(
                    buildMap<String, Any?> {
                        put(EDIT_ACCESS_CODE_HOME_ID_KEY, "home_1")
                        if (secretId != null) put(EDIT_ACCESS_CODE_SECRET_ID_KEY, secretId)
                        if (category != null) put(EDIT_ACCESS_CODE_CATEGORY_KEY, category)
                    },
                ),
        )

    private fun roster(): OccupantsResponse =
        OccupantsResponse(
            occupants =
                listOf(
                    OccupantDto(
                        id = "occ_1",
                        userId = "u_owner",
                        role = "owner",
                        isActive = true,
                        displayName = "Maria",
                        canManageAccess = true,
                        canViewSensitive = true,
                    ),
                    OccupantDto(
                        id = "occ_2",
                        userId = "u_manager",
                        role = "manager",
                        isActive = true,
                        displayName = "Jose",
                        canManageAccess = true,
                        canViewSensitive = false,
                    ),
                    OccupantDto(
                        id = "occ_3",
                        userId = "u_member",
                        role = "member",
                        isActive = true,
                        displayName = "Sam",
                        canManageAccess = false,
                        canViewSensitive = false,
                    ),
                    OccupantDto(
                        id = "occ_4",
                        userId = "u_inactive",
                        role = "member",
                        isActive = false,
                        displayName = "Inactive",
                        canManageAccess = false,
                        canViewSensitive = false,
                    ),
                ),
            pendingInvites = emptyList(),
        )

    private val sampleSecret =
        HomeAccessSecretDto(
            id = "s1",
            homeId = "home_1",
            accessType = "wifi",
            label = "Main network",
            secretValue = "MaplePan@2025!",
            notes = "Guests use the other one",
            visibility = "members",
        )

    // ── Defaults ──────────────────────────────────────────────────

    @Test fun add_pose_seeds_wifi_category_and_members_visibility() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val vm = makeVm()
            vm.load()
            runCurrent()

            val state = vm.state.value
            assertEquals(AccessCategory.Wifi, state.category)
            assertEquals(AccessVisibility.Members, state.visibility)
            assertEquals("Add access code", state.title)
            assertFalse(state.isEditing)
        }

    @Test fun add_pose_respects_initial_category_nav_arg() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val vm = makeVm(category = "alarm")
            vm.load()
            runCurrent()

            assertEquals(AccessCategory.Alarm, vm.state.value.category)
            assertEquals("alarm", vm.state.value.fields[EditAccessCodeField.Category]?.value)
        }

    // ── Edit hydration ────────────────────────────────────────────

    @Test fun edit_pose_hydrates_from_secrets_list() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            coEvery { homes.getHomeAccessSecrets("home_1") } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = listOf(sampleSecret)))
            val vm = makeVm(secretId = "s1")
            vm.load()
            runCurrent()

            val state = vm.state.value
            assertTrue(state.isEditing)
            assertEquals("Edit access code", state.title)
            assertEquals(AccessCategory.Wifi, state.category)
            assertEquals(AccessVisibility.Members, state.visibility)
            assertEquals("Main network", state.fields[EditAccessCodeField.Label]?.value)
            assertEquals("MaplePan@2025!", state.fields[EditAccessCodeField.Value]?.value)
            assertEquals("Guests use the other one", state.fields[EditAccessCodeField.Notes]?.value)
            assertFalse(state.isDirty)
            assertTrue(state.isValid)
        }

    @Test fun edit_pose_missing_secret_surfaces_load_error() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            coEvery { homes.getHomeAccessSecrets("home_1") } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = emptyList()))
            val vm = makeVm(secretId = "missing")
            vm.load()
            runCurrent()

            assertEquals("Couldn't find that access code.", vm.state.value.loadError)
        }

    // ── Category projection ───────────────────────────────────────

    @Test fun each_category_selects_cleanly() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val vm = makeVm()
            vm.load()
            runCurrent()

            for (category in AccessCategory.entries) {
                vm.selectCategory(category)
                assertEquals(category, vm.state.value.category)
                assertEquals(category.wire, vm.state.value.fields[EditAccessCodeField.Category]?.value)
            }
        }

    // ── Reveal ────────────────────────────────────────────────────

    @Test fun toggle_reveal_flips_state() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val vm = makeVm()
            vm.load()
            runCurrent()

            assertFalse(vm.state.value.isRevealed)
            vm.toggleReveal()
            assertTrue(vm.state.value.isRevealed)
            vm.toggleReveal()
            assertFalse(vm.state.value.isRevealed)
        }

    // ── Copy ──────────────────────────────────────────────────────

    @Test fun copy_value_writes_clipboard_and_shows_copied_toast() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val captured = mutableListOf<String>()
            val vm = makeVm()
            vm.bindClipboard { captured.add(it) }
            vm.load()
            runCurrent()

            vm.update(EditAccessCodeField.Label, "Main")
            vm.update(EditAccessCodeField.Value, "Hunter2!")
            vm.copyValue()

            assertEquals(listOf("Hunter2!"), captured)
            assertEquals("Copied", vm.state.value.toast?.text)
            assertFalse(vm.state.value.toast?.isError ?: true)
        }

    @Test fun copy_with_empty_value_is_noop() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val captured = mutableListOf<String>()
            val vm = makeVm()
            vm.bindClipboard { captured.add(it) }
            vm.load()
            runCurrent()

            vm.copyValue()

            assertTrue(captured.isEmpty())
            assertNull(vm.state.value.toast)
        }

    // ── Validation ────────────────────────────────────────────────

    @Test fun validation_blocks_submit_on_empty_label() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val vm = makeVm()
            vm.load()
            runCurrent()

            vm.update(EditAccessCodeField.Value, "Hunter2!")
            assertFalse(vm.state.value.isValid)

            vm.submit()
            runCurrent()
            assertEquals("Label is required.", vm.state.value.fields[EditAccessCodeField.Label]?.error)
        }

    @Test fun validation_blocks_submit_on_empty_value() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val vm = makeVm()
            vm.load()
            runCurrent()

            vm.update(EditAccessCodeField.Label, "Main")
            assertFalse(vm.state.value.isValid)
        }

    // ── Submit ────────────────────────────────────────────────────

    @Test fun submit_post_happy_path_sets_added_toast() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val captured = slot<CreateAccessSecretRequest>()
            coEvery {
                homes.createHomeAccessSecret(homeId = "home_1", request = capture(captured))
            } returns
                NetworkResult.Success(
                    HomeAccessSecretResponse(
                        secret =
                            sampleSecret.copy(
                                id = "s_new",
                                label = "Main",
                                secretValue = "Hunter2!",
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            runCurrent()

            vm.update(EditAccessCodeField.Label, "Main")
            vm.update(EditAccessCodeField.Value, "Hunter2!")
            vm.submit()
            runCurrent()

            assertEquals("Code added.", vm.state.value.toast?.text)
            assertFalse(vm.state.value.toast?.isError ?: true)
            assertEquals("wifi", captured.captured.accessType)
            assertEquals("Main", captured.captured.label)
            assertEquals("Hunter2!", captured.captured.secretValue)
            assertEquals("members", captured.captured.visibility)
            // Dismiss flips after the 800ms hold.
            advanceTimeBy(900)
            runCurrent()
            assertTrue(vm.state.value.shouldDismiss)
            coVerify { homes.createHomeAccessSecret(any(), any()) }
        }

    @Test fun submit_put_happy_path_sets_updated_toast() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            coEvery { homes.getHomeAccessSecrets("home_1") } returns
                NetworkResult.Success(HomeAccessSecretsResponse(secrets = listOf(sampleSecret)))
            val captured = slot<UpdateAccessSecretRequest>()
            coEvery {
                homes.updateHomeAccessSecret(
                    homeId = "home_1",
                    secretId = "s1",
                    request = capture(captured),
                )
            } returns
                NetworkResult.Success(
                    HomeAccessSecretResponse(secret = sampleSecret.copy(secretValue = "Different!")),
                )
            val vm = makeVm(secretId = "s1")
            vm.load()
            runCurrent()

            vm.update(EditAccessCodeField.Value, "Different!")
            vm.submit()
            runCurrent()

            assertEquals("Code updated.", vm.state.value.toast?.text)
            assertEquals("Different!", captured.captured.secretValue)
        }

    @Test fun submit_failure_surfaces_error_toast() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            coEvery { homes.createHomeAccessSecret(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, body = null))
            val vm = makeVm()
            vm.load()
            runCurrent()

            vm.update(EditAccessCodeField.Label, "Main")
            vm.update(EditAccessCodeField.Value, "Hunter2!")
            vm.submit()
            runCurrent()

            assertTrue(vm.state.value.toast?.isError ?: false)
        }

    // ── Roster-aware visibility ───────────────────────────────────

    @Test fun roster_summaries_reflect_member_counts() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val vm = makeVm()
            vm.load()
            runCurrent()

            assertEquals("All household members (3)", vm.rosterSummary(AccessVisibility.Members))
            assertEquals("Owners & managers (2)", vm.rosterSummary(AccessVisibility.Managers))
            assertEquals("Owners only (1)", vm.rosterSummary(AccessVisibility.Sensitive))
            assertEquals("Everyone (3 members + guests)", vm.rosterSummary(AccessVisibility.Everyone))
        }

    @Test fun shared_with_names_narrows_by_scope() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns NetworkResult.Success(roster())
            val vm = makeVm()
            vm.load()
            runCurrent()

            vm.selectVisibility(AccessVisibility.Members)
            assertEquals(listOf("Maria", "Jose", "Sam"), vm.sharedWithNames())

            vm.selectVisibility(AccessVisibility.Managers)
            assertEquals(listOf("Maria", "Jose"), vm.sharedWithNames())

            vm.selectVisibility(AccessVisibility.Sensitive)
            assertEquals(listOf("Maria"), vm.sharedWithNames())
        }

    @Test fun roster_fetch_failure_falls_back_to_scope_only_labels() =
        runTest {
            coEvery { members.listOccupants("home_1") } returns
                NetworkResult.Failure(NetworkError.Server(500, body = null))
            val vm = makeVm()
            vm.load()
            runCurrent()

            assertTrue(vm.state.value.roster.isEmpty())
            assertEquals("All household members", vm.rosterSummary(AccessVisibility.Members))
            assertTrue(vm.sharedWithNames().isEmpty())
        }

    // ── Backend wire format ───────────────────────────────────────

    @Test fun category_backend_wire_matches_schema_allowed_list() {
        // CHECK constraint: ('wifi','door_code','gate_code','lockbox','garage','alarm','other').
        assertEquals("wifi", AccessCategory.Wifi.backendAccessType)
        assertEquals("alarm", AccessCategory.Alarm.backendAccessType)
        assertEquals("gate_code", AccessCategory.Gate.backendAccessType)
        assertEquals("lockbox", AccessCategory.Lockbox.backendAccessType)
        assertEquals("garage", AccessCategory.Garage.backendAccessType)
        assertEquals("other", AccessCategory.SmartLock.backendAccessType)
    }
}
