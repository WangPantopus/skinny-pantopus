@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.audience_profile.edit_persona

import app.pantopus.android.data.api.models.audience.PersonaCategoryPoliciesResponse
import app.pantopus.android.data.api.models.audience.PersonaCategoryPolicyDto
import app.pantopus.android.data.api.models.audience.PersonaMeResponse
import app.pantopus.android.data.api.models.audience.PersonaPublicLinkDto
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.models.audience.PersonaWriteBody
import app.pantopus.android.data.api.models.audience.PersonaWriteResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.audience.AudienceProfileRepository
import app.pantopus.android.data.audience.PersonaEditRepository
import app.pantopus.android.data.upload.UploadRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
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
 * Mirrors iOS `EditPersonaViewModelTests`: `GET /api/personas/me` decides
 * create vs. edit, and `save()` routes to `POST /api/personas` or
 * `PATCH /api/personas/:id`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class EditPersonaViewModelTest {
    private val audienceRepository: AudienceProfileRepository = mockk()
    private val personaEditRepository: PersonaEditRepository = mockk()
    private val uploadRepository: UploadRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { personaEditRepository.categoryPolicies() } returns
            NetworkResult.Success(
                PersonaCategoryPoliciesResponse(
                    categories =
                        listOf(
                            PersonaCategoryPolicyDto("creator", "creator", sensitive = false, enabled = true),
                            PersonaCategoryPolicyDto(
                                "community_leader",
                                "community leader",
                                sensitive = false,
                                enabled = true,
                            ),
                            PersonaCategoryPolicyDto(
                                "doctor",
                                "Doctor",
                                sensitive = true,
                                enabled = false,
                                requirements = listOf("credential_verification"),
                            ),
                        ),
                ),
            )
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): EditPersonaViewModel = EditPersonaViewModel(audienceRepository, personaEditRepository, uploadRepository)

    private fun persona(
        id: String = "p_1",
        handle: String = "elmpark.watch",
    ) = PersonaSummaryDto(
        id = id,
        handle = handle,
        displayName = "Elm Park Watch",
        bio = "Neighborhood updates.",
        category = "community_leader",
        audienceLabel = "members",
        audienceMode = "approval_required",
        publicLinks = listOf(PersonaPublicLinkDto("Site", "https://elmpark.org")),
        followerCount = 128,
        postCount = 9,
    )

    @Test
    fun `no persona opens the create form`() =
        runTest {
            coEvery { audienceRepository.me() } returns NetworkResult.Success(PersonaMeResponse())
            val vm = makeVm()
            vm.load()
            val state = vm.state.value as EditPersonaUiState.Editing
            assertTrue(state.mode.isCreate)
            assertEquals("", state.form.handle)
            assertEquals("creator", state.form.category)
            assertEquals("Publish Beacon", state.saveButtonLabel)
            assertFalse("An empty create form has no handle yet", state.isValid)
        }

    @Test
    fun `existing persona is projected into the form`() =
        runTest {
            coEvery { audienceRepository.me() } returns NetworkResult.Success(PersonaMeResponse(persona = persona()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value as EditPersonaUiState.Editing
            assertEquals(EditPersonaMode.Edit("p_1"), state.mode)
            assertEquals("elmpark.watch", state.form.handle)
            assertEquals("Neighborhood updates.", state.form.bio)
            assertEquals(PersonaAudienceLabel.Members, state.form.audienceLabel)
            assertEquals(PersonaAudienceMode.ApprovalRequired, state.form.audienceMode)
            assertEquals(1, state.form.links.size)
            assertEquals("https://pantopus.com/@elmpark.watch", state.form.shareUrl)
            assertEquals("Save Beacon", state.saveButtonLabel)
            assertFalse(state.isDirty)
            assertTrue(state.isValid)
        }

    @Test
    fun `load failure surfaces a retryable error`() =
        runTest {
            coEvery { audienceRepository.me() } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is EditPersonaUiState.Error)
        }

    @Test
    fun `category policies override the fallback ladder`() =
        runTest {
            coEvery { audienceRepository.me() } returns NetworkResult.Success(PersonaMeResponse(persona = persona()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value as EditPersonaUiState.Editing
            assertEquals(listOf("creator", "community_leader", "doctor"), state.categories.map { it.value })
            assertFalse("Sensitive categories stay gated", state.categories.last().enabled)
            assertEquals("Creator", state.categories.first().label)
        }

    @Test
    fun `incomplete link blocks save`() =
        runTest {
            coEvery { audienceRepository.me() } returns NetworkResult.Success(PersonaMeResponse(persona = persona()))
            val vm = makeVm()
            vm.load()
            vm.addLink()
            val newId = (vm.state.value as EditPersonaUiState.Editing).form.links.last().id
            vm.updateLink(newId, label = "Newsletter")
            assertTrue((vm.state.value as EditPersonaUiState.Editing).form.hasIncompleteLink)
            assertFalse((vm.state.value as EditPersonaUiState.Editing).isValid)

            vm.save()
            assertEquals(
                "Each public link needs both a label and a URL.",
                (vm.state.value as EditPersonaUiState.Editing).saveError,
            )
            coVerify(exactly = 0) { personaEditRepository.createPersona(any()) }
            coVerify(exactly = 0) { personaEditRepository.updatePersona(any(), any()) }
        }

    @Test
    fun `bare host gets an https scheme on the wire`() {
        val form =
            EditPersonaForm(
                handle = "@sourdough",
                displayName = "Sourdough Sat",
                links = listOf(PersonaLinkDraft(label = "Site", url = "sourdough.example")),
            )
        val body = form.wireBody()
        assertEquals("sourdough", body.handle)
        assertEquals("https://sourdough.example", body.publicLinks.first().url)
    }

    @Test
    fun `save creates when there is no persona yet`() =
        runTest {
            coEvery { audienceRepository.me() } returns NetworkResult.Success(PersonaMeResponse())
            val bodySlot = slot<PersonaWriteBody>()
            coEvery { personaEditRepository.createPersona(capture(bodySlot)) } returns
                NetworkResult.Success(
                    PersonaWriteResponse(persona = persona(id = "p_2", handle = "sourdough.sat")),
                )

            val vm = makeVm()
            vm.load()
            vm.setHandle("sourdough.sat")
            vm.setDisplayName("Sourdough Saturdays")

            var savedHandle: String? = null
            vm.save { savedHandle = it }

            assertEquals("sourdough.sat", bodySlot.captured.handle)
            assertEquals("Sourdough Saturdays", bodySlot.captured.displayName)
            assertEquals("sourdough.sat", savedHandle)
            val state = vm.state.value as EditPersonaUiState.Editing
            assertEquals("Beacon created.", state.statusMessage)
            assertEquals(EditPersonaMode.Edit("p_2"), state.mode)
            assertFalse(state.isDirty)
        }

    @Test
    fun `save updates an existing persona`() =
        runTest {
            coEvery { audienceRepository.me() } returns NetworkResult.Success(PersonaMeResponse(persona = persona()))
            coEvery { personaEditRepository.updatePersona("p_1", any()) } returns
                NetworkResult.Success(PersonaWriteResponse(persona = persona()))

            val vm = makeVm()
            vm.load()
            vm.setDisplayName("Elm Park Neighborhood Watch")
            vm.save()

            coVerify(exactly = 1) { personaEditRepository.updatePersona("p_1", any()) }
            val state = vm.state.value as EditPersonaUiState.Editing
            assertEquals("Beacon saved.", state.statusMessage)
            assertNull(state.saveError)
        }

    @Test
    fun `handle conflict surfaces the server message`() =
        runTest {
            coEvery { audienceRepository.me() } returns NetworkResult.Success(PersonaMeResponse())
            coEvery { personaEditRepository.createPersona(any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(409, "That Beacon handle is already taken."),
                )

            val vm = makeVm()
            vm.load()
            vm.setHandle("taken")
            vm.setDisplayName("Taken")
            vm.save()

            val state = vm.state.value as EditPersonaUiState.Editing
            assertEquals("That Beacon handle is already taken.", state.saveError)
            assertFalse(state.isSaving)
        }
}
