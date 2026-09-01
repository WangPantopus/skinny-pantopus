@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.gigs.quickpost

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.gigs.CreateGigBody
import app.pantopus.android.data.api.models.gigs.CreateGigResponse
import app.pantopus.android.data.api.models.gigs.GigDetailResponse
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.homes.FileUploadResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.screens.gigs.GigsCategory
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
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
 * A13.8 — covers the legacy gig composer's `submit()` now that it posts to
 * `POST /api/gigs` (`GigsRepository.create`). Parity with the iOS
 * `PostGigV1ViewModelTests`. P0.2/P0.3 add the real photo-upload pipeline
 * and the picker-driven date validation.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PostGigV1ViewModelTest {
    private val repo: GigsRepository = mockk()
    private val filesRepo: FilesRepository = mockk(relaxed = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun filledVm(): PostGigV1ViewModel {
        val vm = PostGigV1ViewModel(repo, filesRepo, SavedStateHandle())
        val form = PostGigV1SampleData.filledForm
        vm.updateCategory(form.category)
        vm.updateTitle(form.title)
        vm.updateDescription(form.description)
        vm.updatePrice(form.price)
        vm.updateScheduledAt(form.scheduledAt)
        vm.updateLocation(form.location)
        return vm
    }

    private fun pickedPhoto() = PostGigV1PickedPhoto(filename = "gig.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(1, 2))

    private fun stubUploadSuccess(url: String = "https://cdn.pantopus.app/gig.jpg") {
        coEvery {
            filesRepo.uploadFile(any(), any(), any(), any(), any())
        } returns NetworkResult.Success(FileUploadResponse(message = "ok", file = FileUploadResponse.FileRef("f1", url)))
    }

    @Test
    fun submit_valid_form_posts_and_emits_event() =
        runTest {
            coEvery { repo.create(any()) } returns
                NetworkResult.Success(CreateGigResponse(gig = GigDto(id = "server-gig", title = "Help moving a sofa")))
            val vm = filledVm()
            vm.submit(now = PostGigV1SampleData.referenceNow)
            val content = vm.state.value as PostGigV1UiState.Content
            assertTrue(content.validationErrors.isEmpty())
            assertFalse(content.isSubmitting)
            assertEquals("server-gig", content.postedGigId)
            assertEquals(PostGigV1Event.Posted("server-gig"), vm.pendingEvent.value)
        }

    @Test
    fun submit_invalid_form_surfaces_validation_and_skips_network() =
        runTest {
            val vm = PostGigV1ViewModel(repo, filesRepo, SavedStateHandle()) // empty default form
            vm.submit(now = PostGigV1SampleData.referenceNow)
            val content = vm.state.value as PostGigV1UiState.Content
            assertTrue(content.validationErrors.isNotEmpty())
            assertNull(content.postedGigId)
            coVerify(exactly = 0) { repo.create(any()) }
        }

    // MARK: - P0.3 Picker date validation

    @Test
    fun past_picked_date_surfaces_validation_error() =
        runTest {
            val vm = filledVm()
            // Picker restricts to today onward, but a today + past-time
            // combination still has to fail the validation frame.
            vm.updateScheduledAt(PostGigV1SampleData.referenceNow.minusHours(2))
            vm.submit(now = PostGigV1SampleData.referenceNow)
            val content = vm.state.value as PostGigV1UiState.Content
            assertEquals(
                listOf(PostGigV1Field.DateTime),
                content.validationErrors.map { it.field },
            )
            coVerify(exactly = 0) { repo.create(any()) }
        }

    // MARK: - P0.2 Photo upload pipeline

    @Test
    fun picked_photo_uploads_and_carries_url() =
        runTest {
            stubUploadSuccess(url = "https://cdn.pantopus.app/sofa.jpg")
            val vm = filledVm()
            vm.addPickedPhoto(pickedPhoto())
            advanceTimeBy(50)
            val photo = (vm.state.value as PostGigV1UiState.Content).form.photos.single()
            assertEquals(PostGigV1PhotoStatus.Uploaded, photo.status)
            assertEquals("https://cdn.pantopus.app/sofa.jpg", photo.url)
        }

    @Test
    fun failed_upload_marks_tile_and_retry_succeeds() =
        runTest {
            coEvery {
                filesRepo.uploadFile(any(), any(), any(), any(), any())
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = filledVm()
            vm.addPickedPhoto(pickedPhoto())
            advanceTimeBy(50)
            val failed = (vm.state.value as PostGigV1UiState.Content).form.photos.single()
            assertEquals(PostGigV1PhotoStatus.Failed, failed.status)

            stubUploadSuccess(url = "https://cdn.pantopus.app/retry.jpg")
            vm.retryPhotoUpload(failed.id)
            advanceTimeBy(50)
            val uploaded = (vm.state.value as PostGigV1UiState.Content).form.photos.single()
            assertEquals(PostGigV1PhotoStatus.Uploaded, uploaded.status)
            assertEquals("https://cdn.pantopus.app/retry.jpg", uploaded.url)
        }

    @Test
    fun uploads_in_flight_block_submit() =
        runTest {
            coEvery { filesRepo.uploadFile(any(), any(), any(), any(), any()) } coAnswers {
                kotlinx.coroutines.delay(1_000)
                NetworkResult.Success(
                    FileUploadResponse(message = "ok", file = FileUploadResponse.FileRef("f1", "https://cdn/x.jpg")),
                )
            }
            coEvery { repo.create(any()) } returns
                NetworkResult.Success(CreateGigResponse(gig = GigDto(id = "server-gig", title = "t")))
            val vm = filledVm()
            vm.addPickedPhoto(pickedPhoto())
            val midUpload = vm.state.value as PostGigV1UiState.Content
            assertFalse("Post CTA is disabled while uploading.", midUpload.canAttemptSubmit)
            vm.submit(now = PostGigV1SampleData.referenceNow)
            coVerify(exactly = 0) { repo.create(any()) }

            advanceTimeBy(1_100)
            assertTrue((vm.state.value as PostGigV1UiState.Content).canAttemptSubmit)
        }

    @Test
    fun uploaded_urls_ride_create_body_attachments() =
        runTest {
            stubUploadSuccess(url = "https://cdn.pantopus.app/cover.jpg")
            val bodySlot = slot<CreateGigBody>()
            coEvery { repo.create(capture(bodySlot)) } returns
                NetworkResult.Success(CreateGigResponse(gig = GigDto(id = "server-gig", title = "t")))
            val vm = filledVm()
            vm.addPickedPhoto(pickedPhoto())
            advanceTimeBy(50)
            vm.submit(now = PostGigV1SampleData.referenceNow)
            assertEquals(listOf("https://cdn.pantopus.app/cover.jpg"), bodySlot.captured.attachments)
        }

    @Test
    fun remove_photo_drops_tile() =
        runTest {
            stubUploadSuccess()
            val vm = filledVm()
            vm.addPickedPhoto(pickedPhoto())
            advanceTimeBy(50)
            val photo = (vm.state.value as PostGigV1UiState.Content).form.photos.single()
            vm.removePhoto(photo.id)
            assertTrue((vm.state.value as PostGigV1UiState.Content).form.photos.isEmpty())
        }

    // MARK: - P4 Free price type

    @Test
    fun free_price_type_clears_price_and_submits_offers_sentinel() =
        runTest {
            val bodySlot = slot<CreateGigBody>()
            coEvery { repo.create(capture(bodySlot)) } returns
                NetworkResult.Success(CreateGigResponse(gig = GigDto(id = "server-gig", title = "t")))
            val vm = filledVm()
            vm.updatePriceType(PostGigV1PriceType.Free)
            val form = (vm.state.value as PostGigV1UiState.Content).form
            assertEquals("", form.price)
            // Disabled field — stray edits are ignored while Free.
            vm.updatePrice("25")
            assertEquals("", (vm.state.value as PostGigV1UiState.Content).form.price)

            vm.submit(now = PostGigV1SampleData.referenceNow)
            // Free ships a true price 0 with pay_type `offers` (backend
            // schema accepts zero — gigs.js:428 Joi.number().min(0)).
            assertEquals(0.0, bodySlot.captured.price, 0.0)
            assertEquals("offers", bodySlot.captured.payType)
        }

    // MARK: - P4 Edit mode

    private fun editVm(gigId: String = "gig-9"): PostGigV1ViewModel =
        PostGigV1ViewModel(
            repo,
            filesRepo,
            SavedStateHandle(mapOf(PostGigV1ViewModel.EDIT_GIG_ID_KEY to gigId)),
        )

    private fun loadedGig() =
        GigDto(
            id = "gig-9",
            title = "Help moving a sofa up 3 flights",
            description = PostGigV1SampleData.filledForm.description,
            price = 80.0,
            category = "moving",
            payType = "fixed",
            scheduledStart = "2026-05-30T14:00:00Z",
            exactAddress = "Pearl District · NW 11th & Johnson",
            attachments = listOf("https://cdn.pantopus.app/sofa.jpg"),
        )

    @Test
    fun edit_mode_prefills_from_detail_and_saves_via_patch() =
        runTest {
            coEvery { repo.detail("gig-9") } returns NetworkResult.Success(GigDetailResponse(gig = loadedGig()))
            val updateSlot = slot<CreateGigBody>()
            coEvery { repo.update("gig-9", capture(updateSlot)) } returns
                NetworkResult.Success(CreateGigResponse(gig = GigDto(id = "gig-9", title = "t")))

            val vm = editVm()
            assertTrue(vm.isEditMode)
            val form = (vm.state.value as PostGigV1UiState.Content).form
            assertEquals(GigsCategory.Moving, form.category)
            assertEquals("Help moving a sofa up 3 flights", form.title)
            assertEquals("80", form.price)
            assertEquals(PostGigV1PriceType.Flat, form.priceType)
            assertEquals("Pearl District · NW 11th & Johnson", form.location)
            val photo = form.photos.single()
            assertEquals(PostGigV1PhotoStatus.Uploaded, photo.status)
            assertEquals("https://cdn.pantopus.app/sofa.jpg", photo.url)

            vm.submit(now = PostGigV1SampleData.referenceNow)
            assertEquals(PostGigV1Event.Posted("gig-9"), vm.pendingEvent.value)
            assertEquals(listOf("https://cdn.pantopus.app/sofa.jpg"), updateSlot.captured.attachments)
            coVerify(exactly = 1) { repo.update("gig-9", any()) }
            coVerify(exactly = 0) { repo.create(any()) }
        }

    @Test
    fun edit_mode_load_failure_flips_fatal_and_retry_refetches() =
        runTest {
            coEvery { repo.detail("gig-9") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = editVm()
            assertTrue(vm.state.value is PostGigV1UiState.FatalError)

            coEvery { repo.detail("gig-9") } returns NetworkResult.Success(GigDetailResponse(gig = loadedGig()))
            vm.retry()
            val restored = vm.state.value as PostGigV1UiState.Content
            assertEquals("Help moving a sofa up 3 flights", restored.form.title)
            coVerify(exactly = 2) { repo.detail("gig-9") }
        }

    @Test
    fun submit_server_error_flips_to_fatal_error_and_retry_restores_form() =
        runTest {
            coEvery { repo.create(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = filledVm()
            vm.submit(now = PostGigV1SampleData.referenceNow)
            assertTrue(vm.state.value is PostGigV1UiState.FatalError)
            // Form survives the failure so retry re-attempts without re-entry.
            vm.retry()
            val restored = vm.state.value as PostGigV1UiState.Content
            assertEquals(PostGigV1SampleData.filledForm.title, restored.form.title)
        }
}
