@file:Suppress("PackageNaming", "LargeClass")

package app.pantopus.android.ui.screens.compose.gig

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.ai.AiTranscriptionRepository
import app.pantopus.android.data.api.models.businesses.BusinessMembership
import app.pantopus.android.data.api.models.businesses.BusinessUserDto
import app.pantopus.android.data.api.models.businesses.MyBusinessesResponse
import app.pantopus.android.data.api.models.gigs.MagicPostBody
import app.pantopus.android.data.api.models.gigs.MagicPostGigDto
import app.pantopus.android.data.api.models.gigs.MagicPostResponse
import app.pantopus.android.data.api.models.gigs.MagicUndoResponse
import app.pantopus.android.data.api.models.homes.FileUploadResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigDraftQueue
import app.pantopus.android.data.gigs.GigQueuedDraft
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
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
import java.time.Instant

/**
 * A12.8 — describe-first 4-step wizard: chrome, validation gates per
 * step, the magic-post submission for both paths, and the undo flow.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GigComposeViewModelTest {
    /** P6c — in-memory [GigDraftQueue] standing in for the prefs store. */
    private class FakeGigDraftQueue : GigDraftQueue {
        private val _drafts = MutableStateFlow<List<GigQueuedDraft>>(emptyList())
        override val drafts: StateFlow<List<GigQueuedDraft>> = _drafts

        override fun enqueue(draft: GigQueuedDraft) {
            _drafts.value =
                (_drafts.value.filterNot { it.id == draft.id } + draft)
                    .takeLast(GigDraftQueue.MAX_DRAFTS)
        }

        override fun remove(id: String) {
            _drafts.value = _drafts.value.filterNot { it.id == id }
        }
    }

    private val repo: GigsRepository = mockk(relaxed = true)
    private val filesRepo: FilesRepository = mockk(relaxed = true)
    private val transcriptionRepo: AiTranscriptionRepository = mockk(relaxed = true)
    private val draftQueue = FakeGigDraftQueue()
    private val businessesRepo: BusinessesRepository = mockk(relaxed = true)
    private val networkMonitor: NetworkMonitor =
        mockk<NetworkMonitor>(relaxed = true).also {
            every { it.isOnline } returns MutableStateFlow(true)
        }

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(savedStateHandle: SavedStateHandle = SavedStateHandle()) =
        GigComposeViewModel(repo, savedStateHandle, networkMonitor, filesRepo, transcriptionRepo, draftQueue, businessesRepo)

    private fun pickedPhoto(name: String = "photo.jpg") =
        GigComposePickedPhoto(filename = name, mimeType = "image/jpeg", bytes = byteArrayOf(1, 2, 3))

    private fun stubUploadSuccess(url: String = "https://cdn.pantopus.app/gig.jpg") {
        coEvery {
            filesRepo.uploadFile(any(), any(), any(), any(), any())
        } returns NetworkResult.Success(FileUploadResponse(message = "ok", file = FileUploadResponse.FileRef("f1", url)))
    }

    private val magicPostResponse =
        MagicPostResponse(
            message = "Task posted",
            gig = MagicPostGigDto(id = "gig_42", title = "Hang 3 shelves", undoWindowMs = 10_000, canUndo = true),
            nearbyHelpers = 7,
            notifiedCount = 5,
        )

    private fun seedReviewReady(vm: GigComposeViewModel) {
        vm.selectCategory(GigComposeCategory.Handyman)
        vm.setTitle("Hang 3 shelves in the living room")
        vm.setDescription("Need three IKEA Lack shelves mounted on drywall. Studs marked.")
        vm.selectBudgetType(GigComposeBudgetType.Fixed)
        vm.setBudgetMin("60")
        vm.selectScheduleType(GigComposeScheduleType.OneTime)
        vm.setScheduledStart(Instant.now().plusSeconds(86_400).toString())
        vm.selectLocationMode(GigComposeLocationMode.YourAddress)
    }

    /** Seed a VM that's already parked on the Review step. */
    private fun makeVmAtReview(): GigComposeViewModel {
        val isoFuture = Instant.now().plusSeconds(86_400).toString()
        val handle =
            SavedStateHandle(
                mapOf(
                    "composeGig2.step" to GigComposeStep.Review.ordinal0,
                    "composeGig2.category" to "Handyman",
                    "composeGig2.title" to "Hang 3 shelves in the living room",
                    "composeGig2.description" to "Need three IKEA Lack shelves mounted on drywall. Studs marked.",
                    "composeGig2.budgetType" to "Fixed",
                    "composeGig2.budgetMin" to "60",
                    "composeGig2.scheduleType" to "OneTime",
                    "composeGig2.scheduledStart" to isoFuture,
                    "composeGig2.locationMode" to "YourAddress",
                ),
            )
        return GigComposeViewModel(repo, handle, networkMonitor, filesRepo, transcriptionRepo, draftQueue, businessesRepo)
    }

    // MARK: - Initial chrome

    @Test
    fun initial_chrome_reflects_describe_step() {
        val vm = makeVm()
        val chrome = vm.chrome
        assertEquals("Post a task", chrome.title)
        assertEquals("Review & post →", chrome.primaryCtaLabel)
        assertFalse(
            "Primary must be disabled until an archetype is detected.",
            chrome.primaryCtaEnabled,
        )
        assertEquals(WizardLeadingControl.Close, chrome.leading)
        assertEquals(
            WizardProgressLabel.StepOf(current = 1, total = 4),
            chrome.progressLabel,
        )
        assertTrue(chrome.showsProgressBar)
        assertEquals("gigCompose.cta.reviewPost", chrome.primaryCtaTestTag)
    }

    @Test
    fun manual_mode_chrome_uses_pick_category_cta() {
        val vm = makeVm()
        vm.setComposeMode(ComposeMode.Manual)
        assertEquals("Pick a category to continue", vm.chrome.primaryCtaLabel)
        assertFalse(vm.chrome.primaryCtaEnabled)
        vm.selectCategory(GigComposeCategory.Handyman)
        assertTrue(vm.chrome.primaryCtaEnabled)
    }

    @Test
    fun preselect_from_route_argument() {
        val vm = makeVm()
        vm.preselectCategoryIfNeeded(GigComposeCategory.Cleaning)
        assertEquals(GigComposeCategory.Cleaning, vm.state.value.form.category)
        assertEquals(ComposeMode.Manual, vm.state.value.form.composeMode)
    }

    @Test
    fun category_from_raw_key_parses_values() {
        assertEquals(GigComposeCategory.Handyman, GigComposeCategory.fromRawKey("handyman"))
        assertEquals(GigComposeCategory.PetCare, GigComposeCategory.fromRawKey("petcare"))
        assertNull(GigComposeCategory.fromRawKey(null))
        assertNull(GigComposeCategory.fromRawKey(""))
        assertNull(GigComposeCategory.fromRawKey("all"))
        assertNull(GigComposeCategory.fromRawKey("nope"))
    }

    // MARK: - Fill-gaps validation

    @Test
    fun fill_gaps_requires_basics_when_and_where() =
        runTest {
            val vm = makeVm()
            vm.setComposeMode(ComposeMode.Manual)
            vm.selectCategory(GigComposeCategory.Handyman)
            vm.onPrimary()
            advanceTimeBy(10)
            assertEquals(GigComposeStep.FillGaps, vm.state.value.form.currentStep)
            assertFalse(vm.chrome.primaryCtaEnabled)
            vm.setTitle("Hang shelves")
            vm.setDescription("Long enough description to clear the 20 char floor.")
            assertFalse("When/Where still missing.", vm.chrome.primaryCtaEnabled)
            vm.selectScheduleType(GigComposeScheduleType.Flexible)
            assertFalse(vm.chrome.primaryCtaEnabled)
            vm.selectLocationMode(GigComposeLocationMode.YourAddress)
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    @Test
    fun title_cannot_exceed_max() {
        val vm = makeVm()
        val over = "a".repeat(GigComposeLimits.TITLE_MAX + 50)
        vm.setTitle(over)
        assertEquals(GigComposeLimits.TITLE_MAX, vm.state.value.form.title.length)
    }

    @Test
    fun photo_cap_enforced_on_add() =
        runTest {
            stubUploadSuccess()
            val vm = makeVm()
            repeat(GigComposeLimits.MAX_PHOTOS + 3) { vm.addPickedPhoto(pickedPhoto()) }
            advanceTimeBy(50)
            assertEquals(GigComposeLimits.MAX_PHOTOS, vm.state.value.form.photoIds.size)
            assertTrue(vm.state.value.photoUploads.isEmpty())
        }

    // MARK: - P0.2 Photo upload pipeline

    @Test
    fun picked_photo_uploads_and_lands_as_url() =
        runTest {
            stubUploadSuccess(url = "https://cdn.pantopus.app/abc.jpg")
            val vm = makeVm()
            vm.addPickedPhoto(pickedPhoto())
            advanceTimeBy(50)
            assertEquals(listOf("https://cdn.pantopus.app/abc.jpg"), vm.state.value.form.photoIds)
            assertTrue("Tile graduates out of the upload list.", vm.state.value.photoUploads.isEmpty())
        }

    @Test
    fun failed_upload_marks_tile_and_retry_succeeds() =
        runTest {
            coEvery {
                filesRepo.uploadFile(any(), any(), any(), any(), any())
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.addPickedPhoto(pickedPhoto())
            advanceTimeBy(50)
            val failedTile = vm.state.value.photoUploads.single()
            assertTrue("Tile flips to failed on upload error.", failedTile.failed)
            assertTrue(vm.state.value.form.photoIds.isEmpty())

            stubUploadSuccess(url = "https://cdn.pantopus.app/retry.jpg")
            vm.retryPhotoUpload(failedTile.id)
            advanceTimeBy(50)
            assertEquals(listOf("https://cdn.pantopus.app/retry.jpg"), vm.state.value.form.photoIds)
            assertTrue(vm.state.value.photoUploads.isEmpty())
        }

    @Test
    fun remove_failed_upload_drops_tile() =
        runTest {
            coEvery {
                filesRepo.uploadFile(any(), any(), any(), any(), any())
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.addPickedPhoto(pickedPhoto())
            advanceTimeBy(50)
            val tile = vm.state.value.photoUploads.single()
            vm.removePhotoUpload(tile.id)
            assertTrue(vm.state.value.photoUploads.isEmpty())
        }

    @Test
    fun uploads_in_flight_disable_continue_on_fill_gaps() =
        runTest {
            coEvery { filesRepo.uploadFile(any(), any(), any(), any(), any()) } coAnswers {
                kotlinx.coroutines.delay(1_000)
                NetworkResult.Success(
                    FileUploadResponse(message = "ok", file = FileUploadResponse.FileRef("f1", "https://cdn/x.jpg")),
                )
            }
            val vm = makeVm()
            vm.setComposeMode(ComposeMode.Manual)
            vm.selectCategory(GigComposeCategory.Handyman)
            vm.onPrimary()
            advanceTimeBy(10)
            vm.setTitle("Hang 3 shelves")
            vm.setDescription("Need three IKEA Lack shelves mounted on drywall.")
            vm.selectScheduleType(GigComposeScheduleType.Flexible)
            vm.selectLocationMode(GigComposeLocationMode.YourAddress)
            assertTrue(vm.chrome.primaryCtaEnabled)
            vm.addPickedPhoto(pickedPhoto())
            assertFalse(
                "Continue must be disabled while the upload is in flight.",
                vm.chrome.primaryCtaEnabled,
            )
            advanceTimeBy(1_100)
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    @Test
    fun uploaded_urls_ride_magic_post_attachments() =
        runTest {
            stubUploadSuccess(url = "https://cdn.pantopus.app/cover.jpg")
            val vm = makeVm()
            seedReviewReady(vm)
            vm.addPickedPhoto(pickedPhoto())
            advanceTimeBy(50)
            assertEquals(listOf("https://cdn.pantopus.app/cover.jpg"), vm.buildMagicPostBody()?.draft?.attachments)
        }

    // MARK: - Budget validation

    @Test
    fun budget_offers_enables_continue_without_numbers() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.selectBudgetType(GigComposeBudgetType.Offers)
        assertNotNull(
            "Open-to-bids must not require a numeric min.",
            vm.buildMagicPostBody(),
        )
    }

    @Test
    fun budget_fixed_requires_positive_min() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.selectBudgetType(GigComposeBudgetType.Fixed)
        vm.setBudgetMin("0")
        assertNull(vm.buildMagicPostBody())
        vm.setBudgetMin("25")
        assertNotNull(vm.buildMagicPostBody())
    }

    @Test
    fun budget_sanitizer_strips_non_digits() {
        val vm = makeVm()
        vm.setBudgetMin("\$1,234.50abc")
        assertEquals("1234.50", vm.state.value.form.budgetMin)
        vm.setBudgetMin("12.3.4")
        assertEquals("12.34", vm.state.value.form.budgetMin)
    }

    @Test
    fun hourly_budget_rides_hourly_rate_and_estimated_hours() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.selectBudgetType(GigComposeBudgetType.Hourly)
        vm.setBudgetMin("35")
        vm.setEstimatedHours("2.5")
        val draft = vm.buildMagicPostBody()?.draft
        assertEquals("hourly", draft?.payType)
        assertEquals(35.0, draft?.hourlyRate)
        assertNull(draft?.budgetFixed)
        assertEquals(2.5, draft?.estimatedHours)
    }

    // MARK: - Schedule / location validation

    @Test
    fun schedule_one_time_requires_future_date() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.selectScheduleType(GigComposeScheduleType.OneTime)
        vm.setScheduledStart(Instant.now().minusSeconds(60).toString())
        assertNull(vm.buildMagicPostBody())
        vm.setScheduledStart(Instant.now().plusSeconds(3600).toString())
        assertNotNull(vm.buildMagicPostBody())
    }

    @Test
    fun selecting_non_one_time_clears_date() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.selectScheduleType(GigComposeScheduleType.Flexible)
        assertNull(vm.state.value.form.scheduledStartISO)
    }

    @Test
    fun location_a_place_requires_complete_address() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.selectLocationMode(GigComposeLocationMode.APlace)
        assertNull(vm.buildMagicPostBody())
        vm.updatePlaceAddress(line1 = "123 Main St", city = "Portland", state = "OR", zip = "97214")
        assertNotNull(vm.buildMagicPostBody())
    }

    @Test
    fun virtual_maps_to_remote_task_format() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.selectLocationMode(GigComposeLocationMode.Virtual)
        val body = vm.buildMagicPostBody()
        assertEquals("remote", body?.taskFormat)
        assertEquals("custom", body?.location?.mode)
        assertEquals("home", body?.draft?.locationMode)
    }

    @Test
    fun one_time_with_date_maps_to_scheduled_wire_value() {
        val vm = makeVm()
        seedReviewReady(vm)
        val body = vm.buildMagicPostBody()
        assertEquals("scheduled", body?.draft?.scheduleType)
        assertNotNull(body?.draft?.timeWindowStart)
    }

    @Test
    fun recurring_maps_to_flexible_wire_value() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.selectScheduleType(GigComposeScheduleType.Recurring)
        assertEquals("flexible", vm.buildMagicPostBody()?.draft?.scheduleType)
    }

    @Test
    fun urgent_maps_to_asap_wire_value_with_urgent_details() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.setUrgent(true)
        val draft = vm.buildMagicPostBody()?.draft
        assertEquals("asap", draft?.scheduleType)
        assertEquals(true, draft?.isUrgent)
        assertEquals(true, draft?.urgentDetails?.startsAsap)
    }

    // MARK: - Forward / back

    @Test
    fun forward_advances_through_steps() =
        runTest {
            val vm = makeVm()
            vm.setComposeMode(ComposeMode.Manual)
            vm.selectCategory(GigComposeCategory.Handyman)
            vm.onPrimary()
            advanceTimeBy(10)
            assertEquals(GigComposeStep.FillGaps, vm.state.value.form.currentStep)
            vm.setTitle("Hang 3 shelves")
            vm.setDescription("Need three IKEA Lack shelves mounted on drywall.")
            vm.selectScheduleType(GigComposeScheduleType.Flexible)
            vm.selectLocationMode(GigComposeLocationMode.YourAddress)
            vm.onPrimary()
            advanceTimeBy(10)
            assertEquals(GigComposeStep.BudgetMode, vm.state.value.form.currentStep)
        }

    @Test
    fun back_preserves_data() =
        runTest {
            val vm = makeVm()
            vm.setComposeMode(ComposeMode.Manual)
            vm.selectCategory(GigComposeCategory.Handyman)
            vm.onPrimary()
            advanceTimeBy(10)
            vm.onLeading()
            assertEquals(GigComposeStep.Describe, vm.state.value.form.currentStep)
            assertEquals(
                "Going back must not stomp the user's category pick.",
                GigComposeCategory.Handyman,
                vm.state.value.form.category,
            )
        }

    @Test
    fun module_prompt_jump_lands_on_owning_step() {
        val vm = makeVm()
        vm.jumpToStep(GigComposeStep.BudgetMode)
        assertEquals(GigComposeStep.BudgetMode, vm.state.value.form.currentStep)
        vm.jumpToStep(GigComposeStep.FillGaps)
        assertEquals(GigComposeStep.FillGaps, vm.state.value.form.currentStep)
    }

    // MARK: - Submit (magic-post)

    @Test
    fun submit_posts_via_magic_post_and_records_undo_result() =
        runTest {
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns NetworkResult.Success(magicPostResponse)
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(GigComposeStep.Success, vm.state.value.form.currentStep)
            assertEquals("gig_42", vm.state.value.createdGigId)
            val result = vm.state.value.postResult
            assertEquals(5, result?.notifiedCount)
            assertEquals(7, result?.nearbyHelpers)
            assertTrue("Undo deadline sits in the future.", (result?.undoDeadlineEpochMs ?: 0) > System.currentTimeMillis())
            assertEquals("View task", vm.chrome.primaryCtaLabel)
            assertEquals("composeGigDone", vm.chrome.secondaryCta?.testTag)
            assertFalse(vm.chrome.showsProgressBar)
        }

    @Test
    fun submit_error_keeps_user_on_review() =
        runTest {
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(GigComposeStep.Review, vm.state.value.form.currentStep)
            assertNotNull(vm.state.value.errorMessage)
        }

    @Test
    fun success_primary_fires_open_gig_detail_event() =
        runTest {
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns NetworkResult.Success(magicPostResponse)
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(10)
            val event = vm.pendingEvent.value
            assertTrue(event is GigComposeOutboundEvent.OpenGigDetail)
            assertEquals("gig_42", (event as GigComposeOutboundEvent.OpenGigDetail).gigId)
        }

    @Test
    fun success_secondary_fires_dismiss_event() =
        runTest {
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns NetworkResult.Success(magicPostResponse)
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onSecondary()
            assertEquals(GigComposeOutboundEvent.Dismiss, vm.pendingEvent.value)
        }

    @Test
    fun manual_path_submits_classic_source_flow() {
        val vm = makeVm()
        vm.setComposeMode(ComposeMode.Manual)
        seedReviewReady(vm)
        val body = vm.buildMagicPostBody()
        assertEquals("classic", body?.sourceFlow)
        // No describe text → title + description carry the required `text`.
        assertTrue((body?.text ?: "").startsWith("Hang 3 shelves"))
        assertNull("Default identity is Personal — beneficiary stays null.", body?.beneficiaryUserId)
    }

    @Test
    fun magic_path_submits_magic_source_flow_with_describe_text() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.setDescribeText("Need someone to hang shelves this weekend")
        assertEquals("magic", vm.buildMagicPostBody()?.sourceFlow)
        assertEquals("Need someone to hang shelves this weekend", vm.buildMagicPostBody()?.text)
    }

    // MARK: - A12.8 Undo

    @Test
    fun undo_returns_to_review_with_form_intact() =
        runTest {
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns NetworkResult.Success(magicPostResponse)
            coEvery { repo.undoMagicPost("gig_42") } returns
                NetworkResult.Success(MagicUndoResponse(message = "Task undone", gigId = "gig_42"))
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(GigComposeStep.Success, vm.state.value.form.currentStep)
            vm.undoPost()
            advanceTimeBy(50)
            val state = vm.state.value
            assertEquals(GigComposeStep.Review, state.form.currentStep)
            assertTrue("Undone toast flag raised.", state.showUndoneToast)
            assertNull(state.createdGigId)
            assertNull(state.postResult)
            assertEquals(
                "Form survives the undo round-trip.",
                "Hang 3 shelves in the living room",
                state.form.title,
            )
            vm.acknowledgeUndoneToast()
            assertFalse(vm.state.value.showUndoneToast)
        }

    @Test
    fun undo_failure_surfaces_error_and_stays_on_success() =
        runTest {
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns NetworkResult.Success(magicPostResponse)
            coEvery { repo.undoMagicPost("gig_42") } returns
                NetworkResult.Failure(NetworkError.Server(400, "expired"))
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            vm.undoPost()
            advanceTimeBy(50)
            assertEquals(GigComposeStep.Success, vm.state.value.form.currentStep)
            assertNotNull(vm.state.value.errorMessage)
        }

    // MARK: - Close-confirm

    @Test
    fun close_on_empty_step1_is_clean() {
        val vm = makeVm()
        assertFalse(vm.chrome.dirty)
    }

    @Test
    fun close_after_selecting_category_is_dirty() {
        val vm = makeVm()
        vm.selectCategory(GigComposeCategory.Handyman)
        assertTrue(vm.chrome.dirty)
    }

    // MARK: - Saved-state restore

    @Test
    fun saved_state_handle_restores_form_on_construct() {
        val handle =
            SavedStateHandle(
                mapOf(
                    "composeGig2.step" to GigComposeStep.BudgetMode.ordinal0,
                    "composeGig2.category" to "Cleaning",
                    "composeGig2.title" to "Deep clean",
                    "composeGig2.description" to "Deep clean a 2BR apartment before move-out day.",
                    "composeGig2.budgetType" to "Fixed",
                    "composeGig2.budgetMin" to "180",
                    "composeGig2.estimatedHours" to "3",
                    "composeGig2.engagementMode" to "Quotes",
                ),
            )
        val vm = GigComposeViewModel(repo, handle, networkMonitor, filesRepo, transcriptionRepo, draftQueue, businessesRepo)
        assertEquals(GigComposeStep.BudgetMode, vm.state.value.form.currentStep)
        assertEquals(GigComposeCategory.Cleaning, vm.state.value.form.category)
        assertEquals("Deep clean", vm.state.value.form.title)
        assertEquals(GigComposeBudgetType.Fixed, vm.state.value.form.budgetType)
        assertEquals("3", vm.state.value.form.estimatedHours)
        assertEquals(GigEngagementMode.Quotes, vm.state.value.form.engagementOverride)
    }

    @Test
    fun stale_six_step_snapshot_keys_are_ignored() {
        // Old `composeGig.*` keys (pre-A12.8) must not leak into the new form.
        val handle =
            SavedStateHandle(
                mapOf(
                    "composeGig.step" to 5,
                    "composeGig.title" to "Old wizard title",
                ),
            )
        val vm = GigComposeViewModel(repo, handle, networkMonitor, filesRepo, transcriptionRepo, draftQueue, businessesRepo)
        assertEquals(GigComposeStep.Describe, vm.state.value.form.currentStep)
        assertTrue(vm.state.value.form.title.isEmpty())
    }

    // MARK: - E.1 Composer picker sheets

    @Test
    fun build_body_carries_picker_sheet_fields() {
        val vm = makeVm()
        seedReviewReady(vm)
        val deadline = Instant.now().plusSeconds(172_800).toString()
        vm.setDeadline(deadline)
        vm.setCancellationPolicy(GigCancellationPolicy.Moderate)
        vm.addTag("#Heavy Lifting")
        vm.addTag("weekend")
        val draft = vm.buildMagicPostBody()?.draft
        assertNotNull(draft)
        assertEquals("Deadline rides the draft's time-window end.", deadline, draft?.timeWindowEnd)
        assertEquals("standard", draft?.cancellationPolicy)
        assertEquals(listOf("heavy-lifting", "weekend"), draft?.tags)
    }

    @Test
    fun build_body_omits_picker_fields_when_unset() {
        val vm = makeVm()
        seedReviewReady(vm)
        val draft = vm.buildMagicPostBody()?.draft
        assertNotNull(draft)
        assertNull(draft?.timeWindowEnd)
        assertNull(draft?.cancellationPolicy)
        assertNull("is_urgent is omitted when the boost is off.", draft?.isUrgent)
        assertNull(draft?.tags)
    }

    @Test
    fun cancellation_policy_wire_values() {
        assertEquals("flexible", GigCancellationPolicy.Flexible.wireValue)
        assertEquals("standard", GigCancellationPolicy.Moderate.wireValue)
        assertEquals("strict", GigCancellationPolicy.Strict.wireValue)
    }

    @Test
    fun normalize_tag_strips_hash_lowercases_and_hyphenates() {
        assertEquals("heavy-lifting", GigComposeViewModel.normalizeTag("#Heavy Lifting"))
        assertEquals("truck-needed", GigComposeViewModel.normalizeTag("  Truck  Needed "))
        assertNull(GigComposeViewModel.normalizeTag("   "))
        assertNull(GigComposeViewModel.normalizeTag("#"))
    }

    @Test
    fun add_tag_caps_at_max_and_dedupes() {
        val vm = makeVm()
        repeat(GigComposeLimits.MAX_TAGS + 3) { vm.addTag("tag$it") }
        assertEquals(GigComposeLimits.MAX_TAGS, vm.state.value.form.tags.size)
        val before = vm.state.value.form.tags
        vm.addTag("#TAG0")
        assertEquals("Duplicate (normalised) tags are ignored.", before, vm.state.value.form.tags)
    }

    @Test
    fun toggle_tag_adds_then_removes() {
        val vm = makeVm()
        vm.toggleTag("#furniture")
        assertEquals(listOf("furniture"), vm.state.value.form.tags)
        vm.toggleTag("#furniture")
        assertTrue(vm.state.value.form.tags.isEmpty())
    }

    @Test
    fun present_and_dismiss_picker() {
        val vm = makeVm()
        assertNull(vm.state.value.activeSheet)
        vm.presentPicker(GigPickerSheet.Tags)
        assertEquals(GigPickerSheet.Tags, vm.state.value.activeSheet)
        vm.dismissPicker()
        assertNull(vm.state.value.activeSheet)
    }

    @Test
    fun urgency_counts_toward_dirty() {
        val vm = makeVm()
        assertFalse(vm.chrome.dirty)
        vm.setUrgent(true)
        assertTrue("Setting urgent must trigger the discard confirm.", vm.chrome.dirty)
    }

    // MARK: - A12.8 delivery_errand items

    @Test
    fun items_cap_and_blank_filtering() {
        val vm = makeVm()
        seedReviewReady(vm)
        repeat(GigComposeLimits.MAX_ITEMS + 5) { vm.addItem() }
        assertEquals(GigComposeLimits.MAX_ITEMS, vm.state.value.form.items.size)
        vm.updateItemName(0, "Milk 2%")
        vm.updateItemName(1, "Eggs")
        val draftItems = vm.buildMagicPostBody()?.draft?.items
        assertEquals("Blank item rows are dropped from the body.", 2, draftItems?.size)
        assertEquals("Milk 2%", draftItems?.first()?.name)
        vm.removeItem(0)
        assertEquals(GigComposeLimits.MAX_ITEMS - 1, vm.state.value.form.items.size)
    }

    // MARK: - P6c offline draft queue

    @Test
    fun offline_submit_enqueues_draft_and_stays_on_review() =
        runTest {
            every { networkMonitor.isOnline } returns MutableStateFlow(false)
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(GigComposeStep.Review, vm.state.value.form.currentStep)
            assertNotNull(vm.state.value.errorMessage)
            val queued = draftQueue.drafts.value.single()
            assertEquals("Hang 3 shelves in the living room", queued.title)
            coVerify(exactly = 0) { repo.magicPost(any<MagicPostBody>()) }
        }

    @Test
    fun transport_failure_enqueues_draft() =
        runTest {
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns
                NetworkResult.Failure(NetworkError.Transport(java.io.IOException("airplane mode")))
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(GigComposeStep.Review, vm.state.value.form.currentStep)
            assertEquals(1, draftQueue.drafts.value.size)
        }

    @Test
    fun server_failure_does_not_enqueue() =
        runTest {
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            assertTrue("Only connectivity-class failures park a draft.", draftQueue.drafts.value.isEmpty())
        }

    @Test
    fun repeated_offline_submits_replace_the_same_draft() =
        runTest {
            every { networkMonitor.isOnline } returns MutableStateFlow(false)
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals("Retries must not stack duplicates.", 1, draftQueue.drafts.value.size)
        }

    @Test
    fun successful_submit_clears_previously_queued_copy() =
        runTest {
            coEvery { repo.magicPost(any<MagicPostBody>()) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Transport(java.io.IOException("blip"))),
                    NetworkResult.Success(magicPostResponse),
                )
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(1, draftQueue.drafts.value.size)
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(GigComposeStep.Success, vm.state.value.form.currentStep)
            assertTrue("Posted draft leaves the queue.", draftQueue.drafts.value.isEmpty())
        }

    @Test
    fun close_confirm_offers_save_draft_and_saves_on_tap() {
        val vm = makeVm()
        assertNull("Clean form offers no Save draft.", vm.chrome.saveDraftLabel)
        vm.setTitle("Hang shelves")
        assertEquals("Save draft", vm.chrome.saveDraftLabel)
        vm.onSaveDraft()
        assertEquals(1, draftQueue.drafts.value.size)
        assertEquals(GigComposeOutboundEvent.Dismiss, vm.pendingEvent.value)
    }

    @Test
    fun queued_draft_round_trips_into_a_magic_post_body() =
        runTest {
            every { networkMonitor.isOnline } returns MutableStateFlow(false)
            val vm = makeVmAtReview()
            vm.onPrimary()
            advanceTimeBy(50)
            val body = GigComposeViewModel.bodyFromQueuedDraft(draftQueue.drafts.value.single())
            assertNotNull("Snapshot must rebuild the same submit body.", body)
            assertEquals("Hang 3 shelves in the living room", body?.draft?.title)
            assertEquals(vm.buildMagicPostBody()?.sourceFlow, body?.sourceFlow)
            assertEquals("fixed", body?.draft?.payType)
            assertEquals("scheduled", body?.draft?.scheduleType)
        }

    // MARK: - P6c persona switching

    private fun membership(
        businessUserId: String,
        name: String?,
    ): BusinessMembership =
        BusinessMembership(
            id = "seat-$businessUserId",
            businessUserId = businessUserId,
            business = BusinessUserDto(id = businessUserId, name = name, username = "biz"),
        )

    @Test
    fun identity_options_load_and_hide_blank_postable_ids() =
        runTest {
            coEvery { businessesRepo.myBusinesses() } returns
                NetworkResult.Success(
                    MyBusinessesResponse(
                        businesses =
                            listOf(
                                membership("biz1", "Acme Cleaning"),
                                // No postable user id → hidden from the picker.
                                membership("", "Ghost LLC"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.loadIdentitiesIfNeeded()
            advanceTimeBy(50)
            val options = vm.state.value.identityOptions
            assertEquals(listOf("biz1"), options.map { it.id })
            assertEquals("Acme Cleaning", options.single().name)
        }

    @Test
    fun identity_load_failure_keeps_chip_static() =
        runTest {
            coEvery { businessesRepo.myBusinesses() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.loadIdentitiesIfNeeded()
            advanceTimeBy(50)
            assertTrue(vm.state.value.identityOptions.isEmpty())
        }

    @Test
    fun selected_business_rides_magic_post_as_beneficiary() {
        val vm = makeVm()
        seedReviewReady(vm)
        vm.selectIdentity(GigComposeIdentityOption(id = "biz1", name = "Acme Cleaning"))
        assertEquals("biz1", vm.state.value.form.beneficiaryUserId)
        assertEquals("Acme Cleaning", vm.state.value.form.beneficiaryLabel)
        assertEquals("biz1", vm.buildMagicPostBody()?.beneficiaryUserId)
        // Back to Personal → null beneficiary.
        vm.selectIdentity(null)
        assertNull(vm.state.value.form.beneficiaryUserId)
        assertNull(vm.buildMagicPostBody()?.beneficiaryUserId)
    }

    @Test
    fun beneficiary_survives_saved_state_restore() {
        val handle = SavedStateHandle()
        val vm = makeVm(handle)
        seedReviewReady(vm)
        vm.selectIdentity(GigComposeIdentityOption(id = "biz9", name = "Brick & Mortar"))
        val restored = GigComposeViewModel(repo, handle, networkMonitor, filesRepo, transcriptionRepo, draftQueue, businessesRepo)
        assertEquals("biz9", restored.state.value.form.beneficiaryUserId)
        assertEquals("Brick & Mortar", restored.state.value.form.beneficiaryLabel)
    }

    // MARK: - G2 delivery / pro-service module fields

    /** Review-ready form seeded straight onto the pure body builder. */
    private fun reviewReadyForm(archetype: String) =
        GigComposeFormState(
            step = GigComposeStep.Review.ordinal0,
            taskArchetype = archetype,
            category = GigComposeCategory.Handyman,
            title = "Hang 3 shelves in the living room",
            description = "Need three IKEA Lack shelves mounted on drywall. Studs marked.",
            budgetType = GigComposeBudgetType.Fixed,
            budgetMin = "60",
            scheduleType = GigComposeScheduleType.OneTime,
            scheduledStartISO = Instant.now().plusSeconds(86_400).toString(),
            locationMode = GigComposeLocationMode.YourAddress,
        )

    @Test
    fun delivery_module_fields_ride_the_magic_post_draft() {
        val form =
            reviewReadyForm("delivery_errand").copy(
                deliveryDetails =
                    GigDeliveryDetails(
                        pickupAddress = "  12 Market St  ",
                        pickupNotes = "Ask for John",
                        dropoffAddress = "48 Rose Court",
                        dropoffNotes = "",
                        proofRequired = true,
                    ),
            )
        val draft = GigComposeViewModel.bodyFromForm(form)?.draft
        assertEquals("12 Market St", draft?.pickupAddress)
        assertEquals("Ask for John", draft?.pickupNotes)
        assertEquals("48 Rose Court", draft?.dropoffAddress)
        assertNull(draft?.dropoffNotes)
        assertEquals(true, draft?.deliveryProofRequired)
        assertNull(draft?.requiresLicense)
    }

    @Test
    fun pro_service_module_fields_ride_the_magic_post_draft() {
        val form =
            reviewReadyForm("pro_service_quote").copy(
                proServiceDetails =
                    GigProServiceDetails(
                        requiresLicense = true,
                        licenseType = "Licensed Plumber",
                        requiresInsurance = true,
                        scopeDescription = "Replace the water heater",
                        depositRequired = true,
                        depositAmount = "150",
                    ),
            )
        val draft = GigComposeViewModel.bodyFromForm(form)?.draft
        assertEquals(true, draft?.requiresLicense)
        assertEquals("Licensed Plumber", draft?.licenseType)
        assertEquals(true, draft?.requiresInsurance)
        assertEquals("Replace the water heater", draft?.scopeDescription)
        assertEquals(true, draft?.depositRequired)
        assertEquals(150.0, draft?.depositAmount ?: 0.0, 0.0)
        assertNull(draft?.pickupAddress)
    }

    @Test
    fun deposit_toggle_without_amount_blocks_posting() {
        val form =
            reviewReadyForm("pro_service_quote").copy(
                proServiceDetails = GigProServiceDetails(depositRequired = true),
            )
        assertNull(GigComposeViewModel.bodyFromForm(form))
        val filled = form.copy(proServiceDetails = GigProServiceDetails(depositRequired = true, depositAmount = "75"))
        assertNotNull(GigComposeViewModel.bodyFromForm(filled))
    }
}
