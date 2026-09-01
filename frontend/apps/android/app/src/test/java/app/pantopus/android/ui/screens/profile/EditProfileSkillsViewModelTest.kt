@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile

import app.pantopus.android.data.ai.AIDraftRepository
import app.pantopus.android.data.api.models.ai.AIDraftPostRequest
import app.pantopus.android.data.api.models.ai.AIPostDraftDto
import app.pantopus.android.data.api.models.ai.AIPostDraftResponse
import app.pantopus.android.data.api.models.users.ProfileResponse
import app.pantopus.android.data.api.models.users.ProfileUpdateResponse
import app.pantopus.android.data.api.models.users.SocialLinks
import app.pantopus.android.data.api.models.users.UpdateSkillsResponse
import app.pantopus.android.data.api.models.users.UserProfile
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.data.upload.UploadRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
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
 * Parity coverage for the two Edit Profile legs that don't ride the
 * profile PATCH: the skills editor (`PUT /api/users/skills`,
 * `backend/routes/users.js:2246`) and the "Generate with AI" bio draft
 * (`POST /api/ai/draft/post`, `backend/routes/ai.js:218`). Mirrors
 * `PantopusTests/Features/Profile/EditProfileSkillsViewModelTests.swift`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class EditProfileSkillsViewModelTest {
    private val repo: ProfileRepository = mockk()
    private val uploads: UploadRepository = mockk(relaxed = true)
    private val authRepository: AuthRepository = mockk(relaxed = true)
    private val networkMonitor: NetworkMonitor = mockk()
    private val aiDraftRepository: AIDraftRepository = mockk()
    private val isOnline = MutableStateFlow(true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { networkMonitor.isOnline } returns isOnline
        isOnline.value = true
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(): EditProfileViewModel = EditProfileViewModel(repo, uploads, authRepository, networkMonitor, aiDraftRepository)

    private fun profile(
        firstName: String = "Alice",
        lastName: String = "Doe",
        tagline: String = "Builder of homes",
        city: String = "Portland",
        skills: List<String>? = listOf("Plumbing"),
    ): UserProfile =
        UserProfile(
            id = "u1",
            email = "alice@example.com",
            username = "alice",
            firstName = firstName,
            middleName = "Q",
            lastName = lastName,
            name = "Alice Q Doe",
            phoneNumber = "+15555550123",
            dateOfBirth = "1990-04-12",
            address = "123 Main St",
            city = city,
            state = "OR",
            zipcode = "97201",
            accountType = "personal",
            role = "user",
            verified = true,
            residency = null,
            avatarUrl = null,
            profilePictureUrl = null,
            profilePicture = null,
            bio = "Hello world",
            tagline = tagline,
            socialLinks =
                SocialLinks(
                    website = "https://alice.dev",
                    linkedin = null,
                    twitter = null,
                    instagram = null,
                    facebook = null,
                ),
            skills = skills,
            followersCount = 0,
            averageRating = 0.0,
            gigsPosted = 0,
            gigsCompleted = 0,
            profileVisibility = "public",
            createdAt = "2025-01-01T00:00:00Z",
            updatedAt = "2025-01-01T00:00:00Z",
        )

    private fun loaded(user: UserProfile = profile()): EditProfileViewModel {
        coEvery { repo.ownProfile() } returns
            NetworkResult.Success(ProfileResponse(user = user, inviteProgress = null))
        val vm = viewModel()
        vm.load()
        return vm
    }

    /** `PATCH /api/users/profile` echoes no `skills` key
     *  (`backend/routes/users.js:2194`), so the PATCH fixture must not
     *  carry one — otherwise the "PATCH doesn't blank the list"
     *  guarantee goes untested. */
    private fun patchEcho() = ProfileUpdateResponse(message = "ok", user = profile(skills = null))

    // MARK: - Hydration

    @Test fun loadSeedsSkillsFromProfileAndStartsClean() =
        runTest {
            val vm = loaded()
            assertEquals(listOf("Plumbing"), vm.skills.value)
            assertEquals(listOf("Plumbing"), vm.savedSkills.value)
            assertFalse(vm.isSkillsDirty)
            assertFalse(vm.isDirty)
            assertEquals(0, vm.dirtyFieldCount)
        }

    // MARK: - Skills editor

    @Test fun addSkillTrimsAndClearsTheDraftInput() =
        runTest {
            val vm = loaded()
            vm.updateSkillDraft("  Tutoring  ")
            vm.addSkill()
            assertEquals(listOf("Plumbing", "Tutoring"), vm.skills.value)
            assertEquals("", vm.skillDraft.value)
            assertTrue(vm.isSkillsDirty)
            assertEquals(1, vm.dirtyFieldCount)
        }

    @Test fun addSkillIgnoresBlankAndCaseInsensitiveDuplicates() =
        runTest {
            val vm = loaded()
            vm.updateSkillDraft("   ")
            vm.addSkill()
            assertEquals(listOf("Plumbing"), vm.skills.value)
            assertEquals("   ", vm.skillDraft.value)
            vm.updateSkillDraft("plumbing")
            vm.addSkill()
            assertEquals(listOf("Plumbing"), vm.skills.value)
            assertEquals("", vm.skillDraft.value)
        }

    @Test fun addSkillRejectsEntryOverTheServerLengthCap() =
        runTest {
            val vm = loaded()
            vm.updateSkillDraft("a".repeat(EditProfileViewModel.MAX_SKILL_LENGTH + 1))
            vm.addSkill()
            assertEquals(listOf("Plumbing"), vm.skills.value)
            assertTrue(vm.toast.value?.isError == true)
        }

    @Test fun canAddSkillGatesTheCta() =
        runTest {
            val vm = loaded()
            assertFalse(vm.canAddSkill)
            vm.updateSkillDraft("Tutoring")
            assertTrue(vm.canAddSkill)
        }

    @Test fun removeSkillMarksTheFormDirty() =
        runTest {
            val vm = loaded()
            vm.removeSkill("Plumbing")
            assertEquals(emptyList<String>(), vm.skills.value)
            assertTrue(vm.isDirty)
        }

    @Test fun discardChangesRestoresTheSavedSkillList() =
        runTest {
            val vm = loaded()
            vm.updateSkillDraft("Tutoring")
            vm.addSkill()
            vm.removeSkill("Plumbing")
            assertTrue(vm.isSkillsDirty)
            vm.discardChanges()
            assertEquals(listOf("Plumbing"), vm.skills.value)
            assertEquals("", vm.skillDraft.value)
            assertFalse(vm.isDirty)
        }

    // MARK: - Save

    @Test fun saveSendsSkillsPutAlongsideTheProfilePatch() =
        runTest {
            val vm = loaded()
            coEvery { repo.updateProfile(any()) } returns NetworkResult.Success(patchEcho())
            val sent = slot<List<String>>()
            coEvery { repo.updateSkills(capture(sent)) } returns
                NetworkResult.Success(UpdateSkillsResponse(skills = listOf("Plumbing", "Tutoring")))
            vm.update(EditProfileField.FirstName, "Alex")
            vm.updateSkillDraft("Tutoring")
            vm.addSkill()
            vm.save()

            assertTrue(vm.shouldDismiss.value)
            assertEquals("Profile updated.", vm.toast.value?.text)
            assertEquals(listOf("Plumbing", "Tutoring"), sent.captured)
            coVerify(exactly = 1) { repo.updateProfile(any()) }
            coVerify(exactly = 1) { repo.updateSkills(any()) }
        }

    @Test fun saveWithOnlySkillsDirtySkipsTheProfilePatch() =
        runTest {
            val vm = loaded()
            coEvery { repo.updateSkills(any()) } returns
                NetworkResult.Success(UpdateSkillsResponse(skills = emptyList()))
            vm.removeSkill("Plumbing")
            vm.save()

            assertTrue(vm.shouldDismiss.value)
            coVerify(exactly = 1) { repo.updateSkills(any()) }
            coVerify(exactly = 0) { repo.updateProfile(any()) }
        }

    @Test fun skillsBaselineAdoptsTheServerEcho() =
        runTest {
            val vm = loaded()
            // The route trims + dedupes before echoing; the baseline must
            // follow the server, not the locally typed list.
            coEvery { repo.updateSkills(any()) } returns
                NetworkResult.Success(UpdateSkillsResponse(skills = listOf("Plumbing")))
            vm.updateSkillDraft("Tutoring")
            vm.addSkill()
            vm.save()

            assertEquals(listOf("Plumbing"), vm.skills.value)
            assertEquals(listOf("Plumbing"), vm.savedSkills.value)
            assertFalse(vm.isSkillsDirty)
        }

    @Test fun failedProfilePatchStillCommitsSkillsAndLeavesOnlyTheFieldDirty() =
        runTest {
            val vm = loaded()
            coEvery { repo.updateProfile(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, body = "boom"))
            coEvery { repo.updateSkills(any()) } returns
                NetworkResult.Success(UpdateSkillsResponse(skills = listOf("Plumbing", "Tutoring")))
            vm.update(EditProfileField.FirstName, "Alex")
            vm.updateSkillDraft("Tutoring")
            vm.addSkill()
            vm.save()

            assertFalse(vm.shouldDismiss.value)
            assertTrue(vm.toast.value?.isError == true)
            coVerify(exactly = 1) { repo.updateSkills(any()) }
            assertFalse(vm.isSkillsDirty)
            assertTrue(vm.fields.value[EditProfileField.FirstName]?.isDirty == true)
        }

    @Test fun failedSkillsPutKeepsTheProfilePatchResult() =
        runTest {
            val vm = loaded()
            coEvery { repo.updateProfile(any()) } returns NetworkResult.Success(patchEcho())
            coEvery { repo.updateSkills(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, body = "boom"))
            vm.update(EditProfileField.FirstName, "Alex")
            vm.updateSkillDraft("Tutoring")
            vm.addSkill()
            vm.save()

            assertFalse(vm.shouldDismiss.value)
            assertTrue(vm.toast.value?.isError == true)
            assertFalse(vm.fields.value[EditProfileField.FirstName]?.isDirty == true)
            assertTrue(vm.isSkillsDirty)
            assertEquals(listOf("Plumbing", "Tutoring"), vm.skills.value)
        }

    @Test fun profilePatchEchoDoesNotBlankTheSkillList() =
        runTest {
            val vm = loaded()
            coEvery { repo.updateProfile(any()) } returns NetworkResult.Success(patchEcho())
            vm.update(EditProfileField.FirstName, "Alex")
            vm.save()

            assertEquals(listOf("Plumbing"), vm.skills.value)
            assertEquals(listOf("Plumbing"), vm.savedSkills.value)
        }

    // MARK: - Generate bio with AI

    @Test fun generateBioWritesTheDraftIntoTheBioField() =
        runTest {
            val vm = loaded()
            val request = slot<AIDraftPostRequest>()
            coEvery { aiDraftRepository.draftPost(capture(request)) } returns
                NetworkResult.Success(
                    AIPostDraftResponse(draft = AIPostDraftDto(content = "Neighborly plumber in Portland.")),
                )
            vm.generateBio()

            assertEquals("Neighborly plumber in Portland.", vm.fields.value[EditProfileField.Bio]?.value)
            assertTrue(vm.fields.value[EditProfileField.Bio]?.isDirty == true)
            assertEquals(EditProfileBioDraftState.Idle, vm.bioDraftState.value)
            val prompt = request.captured.text
            assertTrue(prompt.contains("Alice Doe"))
            assertTrue(prompt.contains("Builder of homes"))
            assertTrue(prompt.contains("Portland"))
            assertTrue(prompt.contains("Plumbing"))
        }

    @Test fun generateBioFailureSurfacesInlineErrorAndKeepsTheTypedBio() =
        runTest {
            val vm = loaded()
            coEvery { aiDraftRepository.draftPost(any()) } returns
                NetworkResult.Failure(NetworkError.Server(503, body = "AI_UNAVAILABLE"))
            vm.generateBio()

            assertEquals("Hello world", vm.fields.value[EditProfileField.Bio]?.value)
            assertTrue(vm.bioDraftState.value is EditProfileBioDraftState.Failed)
            vm.dismissBioDraftError()
            assertEquals(EditProfileBioDraftState.Idle, vm.bioDraftState.value)
        }

    @Test fun generateBioIsDisabledWhenThereIsNothingToPromptWith() =
        runTest {
            val vm =
                loaded(
                    profile(firstName = "", lastName = "", tagline = "", city = "", skills = emptyList()),
                )
            assertFalse(vm.canGenerateBio)
            vm.generateBio()
            coVerify(exactly = 0) { aiDraftRepository.draftPost(any()) }
            assertTrue(vm.bioDraftState.value is EditProfileBioDraftState.Failed)
        }

    @Test fun generateBioPromptIsClampedToTheRouteLimit() =
        runTest {
            val vm = loaded(profile(skills = List(50) { "skill-${"x".repeat(90)}-$it" }))
            assertTrue(vm.bioPrompt().length <= EditProfileViewModel.MAX_BIO_PROMPT_LENGTH)
        }
}
