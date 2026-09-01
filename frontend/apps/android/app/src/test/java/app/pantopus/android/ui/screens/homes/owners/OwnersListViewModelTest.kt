@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.owners

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.homes.OwnerDto
import app.pantopus.android.data.api.models.homes.OwnerUser
import app.pantopus.android.data.api.models.homes.OwnersResponse
import app.pantopus.android.data.api.models.homes.RemoveOwnerResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeOwnersRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusIcon
import io.mockk.coEvery
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class OwnersListViewModelTest {
    private val repo: HomeOwnersRepository = mockk()
    private val authRepository: AuthRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        // Default: viewer is Maria — drives the "You" chip on row o1.
        every { authRepository.state } returns
            MutableStateFlow(
                AuthRepository.State.SignedIn(
                    UserDto(
                        id = "user_1",
                        email = "maria@example.com",
                        displayName = "Maria Kovács",
                        avatarUrl = null,
                    ),
                ),
            )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): OwnersListViewModel =
        OwnersListViewModel(
            repo = repo,
            authRepository = authRepository,
            savedStateHandle = SavedStateHandle(mapOf(OWNERS_LIST_HOME_ID_KEY to "home_1")),
        )

    private fun owner(
        id: String,
        subjectId: String,
        name: String,
        username: String,
        status: String = "verified",
        tier: String = "legal",
        isPrimary: Boolean = false,
    ): OwnerDto =
        OwnerDto(
            id = id,
            subjectType = "user",
            subjectId = subjectId,
            ownerStatus = status,
            isPrimaryOwner = isPrimary,
            addedVia = "claim",
            verificationTier = tier,
            createdAt = "2022-03-12T10:00:00Z",
            user = OwnerUser(id = subjectId, username = username, name = name),
        )

    private val threeOwners =
        listOf(
            owner("o1", "user_1", "Maria Kovács", "maria", isPrimary = true, tier = "legal"),
            owner("o2", "user_2", "Jamie Patel", "jamie", tier = "standard"),
            owner("o3", "user_3", "Ana Kovács", "ana", status = "pending", tier = "weak"),
        )

    // MARK: - Lifecycle

    @Test
    fun load_empty_response_surfaces_empty_state() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = emptyList()))
            val vm = makeVm()
            vm.state.test {
                assertEquals(ListOfRowsUiState.Loading, awaitItem())
                vm.load()
                val empty = awaitItem() as ListOfRowsUiState.Empty
                assertEquals("No owners yet", empty.headline)
                assertEquals("Invite an owner", empty.ctaTitle)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun load_populated_response_surfaces_loaded_rows() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = threeOwners))
            val vm = makeVm()
            vm.state.test {
                awaitItem() // Loading
                vm.load()
                val loaded = awaitItem() as ListOfRowsUiState.Loaded
                val rows = loaded.sections.first().rows
                assertEquals(3, rows.size)
                assertEquals("Maria Kovács", rows[0].title)
                assertEquals("Jamie Patel", rows[1].title)
                assertEquals("Ana Kovács", rows[2].title)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun load_failure_surfaces_error_state() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.state.test {
                awaitItem() // Loading
                vm.load()
                val error = awaitItem() as ListOfRowsUiState.Error
                assertTrue(
                    "Expected user-readable error copy, got '${error.message}'",
                    error.message.contains("Server error", ignoreCase = true),
                )
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun load_is_idempotent_after_loaded() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = threeOwners))
            val vm = makeVm()
            vm.state.test {
                awaitItem() // Loading
                vm.load()
                awaitItem() // Loaded
                vm.load() // No new emit
                expectNoEvents()
                cancelAndConsumeRemainingEvents()
            }
        }

    // MARK: - Row mapping

    @Test
    fun primary_owner_renders_with_deed_and_you_chip() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = threeOwners))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val maria = loaded.sections.first().rows.first()
            assertEquals("Maria Kovács", maria.title)
            assertEquals("Primary owner", maria.subtitle)
            assertEquals("Deed on file", maria.body)
            assertEquals(PantopusIcon.ShieldCheck, maria.bodyIcon)
            assertEquals("You", maria.inlineChip?.text)
            assertTrue(maria.trailing is RowTrailing.Kebab)
            val leading = maria.leading as RowLeading.AvatarWithBadge
            assertEquals(AvatarBadgeSize.Medium, leading.size)
            assertTrue(leading.verified)
            assertTrue(leading.background is AvatarBackground.Gradient)
        }

    @Test
    fun secondary_owner_renders_as_coowner_with_title_proof() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = threeOwners))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val jamie = loaded.sections.first().rows.first { it.id == "o2" }
            assertEquals("Jamie Patel", jamie.title)
            assertEquals("Co-owner", jamie.subtitle)
            assertEquals("Title on file", jamie.body)
            assertEquals(PantopusIcon.File, jamie.bodyIcon)
            assertNull(jamie.inlineChip)
        }

    @Test
    fun pending_owner_renders_as_invited_with_unverified_avatar() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = threeOwners))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val ana = loaded.sections.first().rows.first { it.id == "o3" }
            assertEquals("Invited · awaiting verification", ana.subtitle)
            assertEquals("Pending review", ana.body)
            assertEquals(PantopusIcon.Clock, ana.bodyIcon)
            val leading = ana.leading as RowLeading.AvatarWithBadge
            assertFalse(leading.verified)
        }

    @Test
    fun sole_owner_subtitle_reads_sole_owner() =
        runTest {
            val solo = listOf(threeOwners.first())
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = solo))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("Sole owner", loaded.sections.first().rows.first().subtitle)
        }

    @Test
    fun proof_resolver_covers_all_tier_combinations() {
        // Status precedence wins over verification tier.
        assertEquals(OwnerProof.Pending, OwnerProof.resolve("pending", "legal"))
        // disputed / revoked map to Document (rejected proof on file).
        assertEquals(OwnerProof.Document, OwnerProof.resolve("disputed", "legal"))
        assertEquals(OwnerProof.Document, OwnerProof.resolve("revoked", "strong"))
        // Verified rows hit the tier table.
        assertEquals(OwnerProof.Deed, OwnerProof.resolve("verified", "legal"))
        assertEquals(OwnerProof.Deed, OwnerProof.resolve("verified", "strong"))
        assertEquals(OwnerProof.Title, OwnerProof.resolve("verified", "standard"))
        assertEquals(OwnerProof.Document, OwnerProof.resolve("verified", "weak"))
        // Casing tolerance.
        assertEquals(OwnerProof.Deed, OwnerProof.resolve("VERIFIED", "LEGAL"))
    }

    @Test
    fun display_name_falls_back_to_username_then_subject_id_suffix() =
        runTest {
            val rows =
                listOf(
                    OwnerDto(
                        id = "o1",
                        subjectType = "user",
                        subjectId = "user_alpha_long",
                        ownerStatus = "verified",
                        isPrimaryOwner = true,
                        addedVia = "claim",
                        verificationTier = "legal",
                        createdAt = "2022-03-12T10:00:00Z",
                        user = OwnerUser(id = "user_alpha_long", username = "alpha", name = null),
                    ),
                    OwnerDto(
                        id = "o2",
                        subjectType = "business",
                        subjectId = "biz_beta_1234",
                        ownerStatus = "verified",
                        isPrimaryOwner = false,
                        addedVia = "transfer",
                        verificationTier = "legal",
                        createdAt = "2022-04-12T10:00:00Z",
                        user = null,
                    ),
                )
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = rows))
            // Re-stub auth to return a non-matching user so no "You" chip
            // contaminates the assertion set.
            every { authRepository.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("@alpha", loaded.sections.first().rows.first().title)
            assertEquals("Business · 1234", loaded.sections.first().rows.last().title)
        }

    // MARK: - Mutations

    @Test
    fun remove_owner_optimistically_drops_row() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = threeOwners))
            coEvery { repo.remove("home_1", "o2") } returns
                NetworkResult.Success(RemoveOwnerResponse(message = "Owner removed"))
            val vm = makeVm()
            vm.load()
            vm.removeOwner("o2")
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(2, loaded.sections.first().rows.size)
            assertNull(loaded.sections.first().rows.firstOrNull { it.id == "o2" })
        }

    @Test
    fun remove_failure_rolls_back() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = threeOwners))
            coEvery { repo.remove("home_1", "o2") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.removeOwner("o2")
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(3, loaded.sections.first().rows.size)
            assertNotNull(loaded.sections.first().rows.firstOrNull { it.id == "o2" })
        }

    @Test
    fun cached_owner_lookup_after_load() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = threeOwners))
            val vm = makeVm()
            vm.load()
            assertEquals("Maria Kovács", vm.cachedOwner("o1")?.user?.name)
            assertNull(vm.cachedOwner("missing"))
        }

    // MARK: - Chrome

    @Test
    fun fab_is_home_tinted_secondary_create_with_user_plus() {
        val vm = makeVm()
        val fab = vm.fab
        assertEquals(PantopusIcon.UserPlus, fab.icon)
        assertEquals("Invite an owner", fab.contentDescription)
        assertTrue(fab.variant is FabVariant.SecondaryCreate)
        assertEquals(FabTint.Home, fab.tint)
    }

    @Test
    fun pending_event_is_open_invite_when_fab_clicks() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(OwnersResponse(owners = threeOwners))
            val vm = makeVm()
            vm.load()
            vm.fab.onClick()
            assertEquals(OwnersListEvent.OpenInvite, vm.pendingEvent.value)
            vm.acknowledgeEvent()
            assertNull(vm.pendingEvent.value)
        }
}
