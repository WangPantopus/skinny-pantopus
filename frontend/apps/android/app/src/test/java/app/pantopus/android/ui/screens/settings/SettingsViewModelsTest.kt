@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.settings

import app.pantopus.android.data.api.models.settings.PrivacyBlocksResponse
import app.pantopus.android.data.api.models.users.ProfileResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.models.users.UserProfile
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.privacy.PrivacyRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Covers the Settings index VM: load produces the expected groups +
 * destructive sign-out card.
 *
 * A14.5 notification preferences and A14.7 privacy moved to
 * [NotificationSettingsViewModelTest] / [PrivacyViewModelTest].
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelsTest {
    private val privacy: PrivacyRepository = mockk()
    private val auth: AuthRepository = mockk()
    private val profile: ProfileRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val signedInUser =
            AuthRepository.State.SignedIn(
                user = UserDto(id = "u_test_12345678", email = "maria@pantopus.app", displayName = "Maria", avatarUrl = null),
            )
        every { auth.state } returns MutableStateFlow<AuthRepository.State>(signedInUser)
        coEvery { auth.signOut() } returns Unit
        coEvery { profile.ownProfile() } returns NetworkResult.Failure(NetworkError.NotFound)
    }

    /** Minimal `GET /api/users/profile` envelope with a chosen `verified`. */
    private fun profileResponse(
        verified: Boolean,
        visibility: String? = null,
    ) = ProfileResponse(
        user =
            UserProfile(
                id = "u_test_12345678",
                email = "maria@pantopus.app",
                username = "maria",
                firstName = "Maria",
                middleName = null,
                lastName = "K",
                name = "Maria K",
                phoneNumber = null,
                dateOfBirth = null,
                address = null,
                city = null,
                state = null,
                zipcode = null,
                accountType = "personal",
                role = "user",
                verified = verified,
                residency = null,
                avatarUrl = null,
                profilePictureUrl = null,
                profilePicture = null,
                bio = null,
                tagline = null,
                socialLinks = null,
                skills = null,
                followersCount = null,
                averageRating = null,
                gigsPosted = null,
                gigsCompleted = null,
                profileVisibility = visibility,
                createdAt = "2026-01-01T00:00:00Z",
                updatedAt = "2026-01-01T00:00:00Z",
            ),
        inviteProgress = null,
    )

    private fun verificationControl(state: GroupedListUiState.Loaded): RowControl =
        state.groups
            .first { it.id == "account" }
            .rows
            .first { it.id == "verification" }
            .control

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    // MARK: - Index

    @Test fun index_load_produces_all_expected_groups() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Success(PrivacyBlocksResponse(emptyList()))
            val vm = SettingsIndexViewModel(auth, privacy, profile)
            vm.load()
            val state = vm.state.value as GroupedListUiState.Loaded
            assertEquals(
                listOf("account", "privacy", "notifications", "payments", "support", "session"),
                state.groups.map { it.id },
            )
            assertNull(state.groups.last().overline)
            val logOut = state.groups.last().rows.first()
            assertEquals("signOut", logOut.id)
            assertTrue(logOut.destructive)
        }

    @Test fun verification_chip_reads_real_profile_verified_flag() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Success(PrivacyBlocksResponse(emptyList()))
            coEvery { profile.ownProfile() } returns NetworkResult.Success(profileResponse(verified = true))
            val vm = SettingsIndexViewModel(auth, privacy, profile)
            vm.load()
            val control = verificationControl(vm.state.value as GroupedListUiState.Loaded)
            assertEquals(
                RowControl.ChipStatus("Verified", RowControl.ChipTone.Success, includesChevron = true),
                control,
            )
        }

    @Test fun verification_chip_never_claims_verified_for_an_unverified_account() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Success(PrivacyBlocksResponse(emptyList()))
            coEvery { profile.ownProfile() } returns NetworkResult.Success(profileResponse(verified = false))
            val vm = SettingsIndexViewModel(auth, privacy, profile)
            vm.load()
            val control = verificationControl(vm.state.value as GroupedListUiState.Loaded)
            assertEquals(
                RowControl.ChipStatus("Unverified", RowControl.ChipTone.Warning, includesChevron = true),
                control,
            )
        }

    @Test fun visibility_subtext_is_derived_from_profile_visibility_and_omitted_when_unknown() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Success(PrivacyBlocksResponse(emptyList()))
            coEvery { profile.ownProfile() } returns
                NetworkResult.Success(profileResponse(verified = true, visibility = "private"))
            val vm = SettingsIndexViewModel(auth, privacy, profile)
            vm.load()
            val row =
                (vm.state.value as GroupedListUiState.Loaded)
                    .groups
                    .first { it.id == "privacy" }
                    .rows
                    .first { it.id == "visibility" }
            assertEquals("Only you", row.subtext)
            assertEquals("Anyone", SettingsIndexViewModel.visibilitySubtext("public"))
            assertEquals("Signed-in neighbors", SettingsIndexViewModel.visibilitySubtext("registered"))
            assertNull(SettingsIndexViewModel.visibilitySubtext(null))
            assertNull(SettingsIndexViewModel.visibilitySubtext("something-new"))
        }

    @Test fun verification_chip_falls_back_to_chevron_when_state_is_unknown() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Success(PrivacyBlocksResponse(emptyList()))
            coEvery { profile.ownProfile() } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = SettingsIndexViewModel(auth, privacy, profile)
            vm.load()
            assertEquals(RowControl.Chevron, verificationControl(vm.state.value as GroupedListUiState.Loaded))
        }
}
