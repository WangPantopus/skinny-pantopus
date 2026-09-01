@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.compose.listing

import app.pantopus.android.data.api.models.ai.AIDraftListingVisionRequest
import app.pantopus.android.data.api.models.listings.CreateListingRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.slot
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ListingComposeWizardViewModelTest : ListingComposeWizardViewModelTestCase() {
    // MARK: - Chrome shape

    @Test
    fun initial_chrome_is_photos_step() {
        val vm = makeVm()
        val chrome = vm.chrome
        assertEquals("List an item", chrome.title)
        assertEquals("Review suggestions", chrome.primaryCtaLabel)
        assertFalse(chrome.primaryCtaEnabled)
        assertEquals(WizardLeadingControl.Close, chrome.leading)
        assertEquals(WizardProgressLabel.StepOf(current = 1, total = 3), chrome.progressLabel)
    }

    // MARK: - Photo step

    @Test
    fun photo_step_requires_at_least_one_photo() {
        val vm = makeVm()
        assertFalse(vm.chrome.primaryCtaEnabled)
        vm.addPhoto("a")
        assertTrue(vm.chrome.primaryCtaEnabled)
    }

    @Test
    fun add_photos_caps_at_max() {
        val vm = makeVm()
        repeat(10) { vm.addPhoto("p_$it") }
        assertEquals(ListingComposeFormState.MAX_PHOTOS, vm.state.value.form.photos.size)
    }

    @Test
    fun remove_photo_by_id() {
        val vm = makeVm()
        vm.addPhoto("a")
        vm.addPhoto("b")
        val firstId = vm.state.value.form.photos.first().id
        vm.removePhoto(firstId)
        assertEquals(1, vm.state.value.form.photos.size)
        assertEquals("b", vm.state.value.form.photos.first().token)
    }

    @Test
    fun move_photo_changes_hero() {
        val vm = makeVm()
        vm.addPhoto("a")
        vm.addPhoto("b")
        vm.addPhoto("c")
        assertEquals("a", vm.state.value.form.photos.first().token)
        vm.movePhoto(from = 2, to = 0)
        assertEquals("c", vm.state.value.form.photos.first().token)
    }

    @Test
    fun make_hero_promotes_to_zero() {
        val vm = makeVm()
        vm.addPhoto("a")
        vm.addPhoto("b")
        vm.addPhoto("c")
        val secondId = vm.state.value.form.photos[1].id
        vm.makeHero(secondId)
        assertEquals("b", vm.state.value.form.photos.first().token)
    }

    @Test
    fun make_hero_is_noop_for_first_slot() {
        val vm = makeVm()
        vm.addPhoto("a")
        vm.addPhoto("b")
        val firstId = vm.state.value.form.photos.first().id
        vm.makeHero(firstId)
        assertEquals("a", vm.state.value.form.photos.first().token)
    }

    @Test
    fun skip_to_manual_preserves_original_photo_grid_path() {
        val vm = makeVm()
        assertTrue(vm.isCameraCaptureStep)
        vm.skipToManualPhotoEditor()
        assertEquals(ListingComposeEntryMode.Manual, vm.state.value.form.entryMode)
        assertFalse(vm.isCameraCaptureStep)
        assertEquals("Continue", vm.chrome.primaryCtaLabel)
    }

    @Test
    fun camera_capture_appends_real_photo_bytes_with_angle_tokens() {
        val vm = makeVm()
        vm.captureSnapPhoto(byteArrayOf(1))
        vm.captureSnapPhoto(byteArrayOf(2))
        vm.captureSnapPhoto(byteArrayOf(3))
        val photos = vm.state.value.form.photos
        assertEquals(listOf("snap_angle_1", "snap_angle_2", "snap_angle_3"), photos.map { it.token })
        assertNotNull(photos.first().localImageData)
        assertFalse(photos.first().isRemote)
        // No hardcoded suggestions — fields stay empty until the vision draft.
        assertEquals("", vm.state.value.form.title)
        assertNull(vm.state.value.form.category)
    }

    @Test
    fun library_picks_append_with_library_tokens() {
        val vm = makeVm()
        vm.addLibraryPhotos(listOf(byteArrayOf(1), byteArrayOf(2)))
        assertEquals(
            listOf("library_photo_1", "library_photo_2"),
            vm.state.value.form.photos.map { it.token },
        )
    }

    @Test
    fun snap_review_requests_vision_draft_and_fills_empty_fields() =
        runTest {
            coEvery { aiRepo.draftListingVision(any()) } returns NetworkResult.Success(visionResponse())
            val vm = makeVm()
            vm.captureSnapPhoto(byteArrayOf(1))
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(ListingComposeStep.TitleCategory, vm.state.value.form.currentStep)
            assertTrue(vm.isSnapReviewStep)
            assertFalse(vm.state.value.isAnalyzing)
            val form = vm.state.value.form
            assertEquals("Sage green velvet sofa, 3-seater", form.title)
            assertEquals(ListingComposeCategory.Goods, form.category)
            assertEquals("furniture", form.backendCategory)
            assertEquals(ListingComposeCondition.Good, form.condition)
            assertEquals(ListingComposePriceKind.Fixed, form.priceKind)
            // Median wins over the draft's flat price.
            assertEquals("280", form.priceAmount)
            assertEquals(280.0, form.priceSuggestion?.median)
            assertEquals(ListingComposeLocationKind.SavedAddress, form.locationKind)
            assertTrue(form.deliveryEnabled)
            assertEquals("Post listing", vm.chrome.primaryCtaLabel)
            assertEquals("listingComposeSaveDraft", vm.chrome.secondaryCta?.testTag)
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    @Test
    fun vision_draft_never_overwrites_user_entered_fields() =
        runTest {
            coEvery { aiRepo.draftListingVision(any()) } returns NetworkResult.Success(visionResponse())
            val vm = makeVm()
            vm.captureSnapPhoto(byteArrayOf(1))
            vm.setTitle("My own title here")
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals("My own title here", vm.state.value.form.title)
        }

    @Test
    fun vision_request_caps_images_at_five() =
        runTest {
            val captured = slot<AIDraftListingVisionRequest>()
            coEvery { aiRepo.draftListingVision(capture(captured)) } returns NetworkResult.Success(visionResponse())
            val vm = makeVm()
            repeat(6) { vm.captureSnapPhoto(byteArrayOf(it.toByte())) }
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(5, captured.captured.images.size)
            assertTrue(captured.captured.images.first().startsWith("data:image/jpeg;base64,"))
        }

    @Test
    fun vision_failure_degrades_to_manual_entry() =
        runTest {
            // Test-case default: vision returns a 500.
            val vm = makeVm()
            vm.captureSnapPhoto(byteArrayOf(1))
            vm.onPrimary()
            advanceTimeBy(50)
            assertFalse(vm.state.value.isAnalyzing)
            assertEquals(
                "Couldn't generate suggestions from your photos. Fill in the details below.",
                vm.state.value.errorMessage,
            )
            // Fields stay empty for manual entry; typing a price implies Fixed.
            assertEquals("", vm.state.value.form.title)
            vm.setPriceAmount("45")
            assertEquals(ListingComposePriceKind.Fixed, vm.state.value.form.priceKind)
        }

    @Test
    fun vision_request_fires_once_per_session() =
        runTest {
            coEvery { aiRepo.draftListingVision(any()) } returns NetworkResult.Success(visionResponse())
            val vm = makeVm()
            vm.captureSnapPhoto(byteArrayOf(1))
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onLeading() // back to camera
            vm.onPrimary() // forward again
            advanceTimeBy(50)
            coVerify(exactly = 1) { aiRepo.draftListingVision(any()) }
        }

    @Test
    fun snap_review_primary_submits_listing_with_mapped_enums() =
        runTest {
            coEvery { aiRepo.draftListingVision(any()) } returns NetworkResult.Success(visionResponse())
            val captured = slot<CreateListingRequest>()
            coEvery { repo.create(capture(captured)) } returns NetworkResult.Success(createResponse)
            val vm = makeVm()
            vm.captureSnapPhoto(byteArrayOf(1))
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(ListingComposeStep.Success, vm.state.value.form.currentStep)
            assertEquals("listing_42", vm.state.value.createdListingId)
            // AI category flows through; local photos stay out of mediaUrls.
            assertEquals("furniture", captured.captured.category)
            assertEquals("sell_item", captured.captured.listingType)
            assertEquals("public_meetup", captured.captured.meetupPreference)
            assertTrue(captured.captured.mediaUrls.isEmpty())
            coVerify { uploadRepo.uploadListingMedia("listing_42", match { it.size == 1 }) }
        }

    @Test
    fun upload_failure_is_non_blocking_with_notice() =
        runTest {
            coEvery { aiRepo.draftListingVision(any()) } returns NetworkResult.Success(visionResponse())
            coEvery { repo.create(any<CreateListingRequest>()) } returns NetworkResult.Success(createResponse)
            coEvery { uploadRepo.uploadListingMedia(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "upload down"))
            val vm = makeVm()
            vm.captureSnapPhoto(byteArrayOf(1))
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(ListingComposeStep.Success, vm.state.value.form.currentStep)
            assertEquals(
                "Your listing is live, but some photos didn't upload. Edit the listing to add them.",
                vm.state.value.errorMessage,
            )
        }

    @Test
    fun snap_review_save_draft_dismisses() =
        runTest {
            val vm = makeVm()
            vm.captureSnapPhoto(byteArrayOf(1))
            vm.onPrimary()
            advanceTimeBy(10)
            vm.onSecondary()
            assertEquals(ListingComposeOutboundEvent.Dismiss, vm.pendingEvent.value)
        }

    // MARK: - Backend enum contracts

    @Test
    fun listing_types_match_backend_constants() {
        assertEquals("sell_item", ListingComposeCategory.Goods.listingType)
        assertEquals("rent_sublet", ListingComposeCategory.Rentals.listingType)
        assertEquals("vehicle_sale", ListingComposeCategory.Vehicles.listingType)
        assertEquals("free_item", ListingComposeCategory.Free.listingType)
        assertEquals("wanted_request", ListingComposeCategory.Wanted.listingType)
    }

    @Test
    fun meetup_preference_uses_backend_enum_values() {
        assertEquals("public_meetup", ListingComposeFulfillment.Pickup.meetupPreference)
        assertEquals("flexible", ListingComposeFulfillment.Delivery.meetupPreference)
    }

    @Test
    fun ai_categories_map_onto_backend_listing_categories() {
        assertEquals("sports_outdoors", ListingComposeVisionMapping.backendCategoryFromAI("sports"))
        assertEquals("books_media", ListingComposeVisionMapping.backendCategoryFromAI("books"))
        assertEquals("books_media", ListingComposeVisionMapping.backendCategoryFromAI("music"))
        assertEquals("kids_baby", ListingComposeVisionMapping.backendCategoryFromAI("toys"))
        assertEquals("kids_baby", ListingComposeVisionMapping.backendCategoryFromAI("baby_kids"))
        assertEquals("vehicles", ListingComposeVisionMapping.backendCategoryFromAI("automotive"))
        assertEquals("furniture", ListingComposeVisionMapping.backendCategoryFromAI("furniture"))
        assertEquals("other", ListingComposeVisionMapping.backendCategoryFromAI("spaceships"))
        assertNull(ListingComposeVisionMapping.backendCategoryFromAI(null))
    }

    @Test
    fun fallback_backend_categories_by_wizard_chip() {
        assertEquals("vehicles", ListingComposeCategory.Vehicles.fallbackBackendCategory)
        assertEquals("free_stuff", ListingComposeCategory.Free.fallbackBackendCategory)
        assertEquals("other", ListingComposeCategory.Goods.fallbackBackendCategory)
        assertEquals("other", ListingComposeCategory.Rentals.fallbackBackendCategory)
        assertEquals("other", ListingComposeCategory.Wanted.fallbackBackendCategory)
    }

    // MARK: - Title + category

    @Test
    fun title_category_gate() =
        runTest {
            val vm = makeVm()
            vm.skipToManualPhotoEditor()
            vm.addPhoto("a")
            vm.onPrimary() // -> TitleCategory
            advanceTimeBy(10)
            assertEquals(ListingComposeStep.TitleCategory, vm.state.value.form.currentStep)
            assertFalse(vm.chrome.primaryCtaEnabled)
            vm.setTitle("Hi")
            assertFalse("Title under 5 chars must fail", vm.chrome.primaryCtaEnabled)
            vm.setTitle("Moving boxes — bundle of 18")
            assertFalse("Title alone is not enough — category required.", vm.chrome.primaryCtaEnabled)
            vm.setCategory(ListingComposeCategory.Goods)
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    @Test
    fun title_max_length_enforced() =
        runTest {
            val vm = makeVm()
            vm.skipToManualPhotoEditor()
            vm.addPhoto("a")
            vm.onPrimary()
            advanceTimeBy(10)
            vm.setCategory(ListingComposeCategory.Goods)
            vm.setTitle("a".repeat(81))
            assertFalse("Title over 80 chars must fail", vm.chrome.primaryCtaEnabled)
            vm.setTitle("a".repeat(80))
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    @Test
    fun free_category_picks_price_kind_free() {
        val vm = makeVm()
        vm.setCategory(ListingComposeCategory.Free)
        assertEquals(ListingComposePriceKind.Free, vm.state.value.form.priceKind)
    }

    @Test
    fun wanted_category_clears_condition_and_skips_gate() =
        runTest {
            val vm = makeVm()
            vm.skipToManualPhotoEditor()
            vm.addPhoto("a")
            vm.setTitle("Looking for a sewing machine")
            vm.setCategory(ListingComposeCategory.Wanted)
            vm.setBody("Anything in working order would be great — thank you, neighbors!")
            vm.onPrimary()
            advanceTimeBy(10)
            vm.onPrimary()
            advanceTimeBy(10)
            assertEquals(ListingComposeStep.ConditionDescription, vm.state.value.form.currentStep)
            // Wanted skips condition; description alone gates this step.
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    // MARK: - Description gate

    @Test
    fun description_min_length_enforced() =
        runTest {
            val vm = makeVm()
            vm.skipToManualPhotoEditor()
            vm.addPhoto("a")
            vm.setTitle("Moving boxes — bundle of 18")
            vm.setCategory(ListingComposeCategory.Goods)
            vm.setCondition(ListingComposeCondition.LikeNew)
            vm.onPrimary()
            advanceTimeBy(10)
            vm.onPrimary()
            advanceTimeBy(10)
            assertEquals(ListingComposeStep.ConditionDescription, vm.state.value.form.currentStep)
            assertFalse(vm.chrome.primaryCtaEnabled)
            vm.setBody("Short.")
            assertFalse(vm.chrome.primaryCtaEnabled)
            vm.setBody("Lightly used, perfect for a one-bedroom move across town.")
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    @Test
    fun condition_required_for_goods() =
        runTest {
            val vm = makeVm()
            vm.skipToManualPhotoEditor()
            vm.addPhoto("a")
            vm.setTitle("Moving boxes — bundle of 18")
            vm.setCategory(ListingComposeCategory.Goods)
            vm.setBody("Lightly used, perfect for a one-bedroom move across town.")
            vm.onPrimary()
            advanceTimeBy(10)
            vm.onPrimary()
            advanceTimeBy(10)
            assertFalse("Condition required for goods.", vm.chrome.primaryCtaEnabled)
            vm.setCondition(ListingComposeCondition.LikeNew)
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    // MARK: - Price gate

    @Test
    fun fixed_price_requires_positive_amount() {
        val vm = makeVm()
        vm.setPriceKind(ListingComposePriceKind.Fixed)
        // Manually drive to the Price step.
        assertFalse(vm.isPriceValid(vm.state.value.form))
        vm.setPriceAmount("0")
        assertFalse(vm.isPriceValid(vm.state.value.form))
        vm.setPriceAmount("25")
        assertTrue(vm.isPriceValid(vm.state.value.form))
    }

    @Test
    fun free_price_kind_always_valid() {
        val vm = makeVm()
        vm.setPriceKind(ListingComposePriceKind.Free)
        assertTrue(vm.isPriceValid(vm.state.value.form))
    }

    @Test
    fun price_amount_filters_to_decimal() {
        val vm = makeVm()
        vm.setPriceAmount("abc12.5")
        assertEquals("12.5", vm.state.value.form.priceAmount)
        vm.setPriceAmount("12.3.4")
        // Two-decimal-separator input is rejected — last valid value sticks.
        assertEquals("12.5", vm.state.value.form.priceAmount)
    }

    // MARK: - Location gate

    @Test
    fun location_requires_selection() {
        val vm = makeVm()
        assertNull(vm.state.value.form.locationKind)
        vm.setLocationKind(ListingComposeLocationKind.SavedAddress)
        assertEquals(ListingComposeLocationKind.SavedAddress, vm.state.value.form.locationKind)
    }

    // MARK: - Submit happy path

    @Test
    fun submit_advances_to_success_and_records_listing_id() =
        runTest {
            val captured = slot<CreateListingRequest>()
            coEvery { repo.create(capture(captured)) } returns NetworkResult.Success(createResponse)
            val vm = makeVm()
            seedReadyToSubmit(vm)
            assertEquals(ListingComposeStep.Review, vm.state.value.form.currentStep)
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(ListingComposeStep.Success, vm.state.value.form.currentStep)
            assertEquals("listing_42", vm.state.value.createdListingId)
            assertEquals("View listing", vm.chrome.primaryCtaLabel)
            assertEquals("listingComposeBackToMarketplace", vm.chrome.secondaryCta?.testTag)
            assertFalse("Success step hides progress bar", vm.chrome.showsProgressBar)
            coVerify { repo.create(any()) }
            assertEquals("Moving boxes — bundle of 18", captured.captured.title)
            // No AI draft in the manual flow → the Goods chip falls
            // back to the valid backend category "other".
            assertEquals("other", captured.captured.category)
            assertEquals("goods", captured.captured.layer)
            assertEquals("sell_item", captured.captured.listingType)
            assertEquals(25.0, captured.captured.price)
            assertFalse(captured.captured.isFree)
        }

    @Test
    fun submit_error_keeps_user_on_review() =
        runTest {
            coEvery { repo.create(any<CreateListingRequest>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "server"))
            val vm = makeVm()
            seedReadyToSubmit(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(ListingComposeStep.Review, vm.state.value.form.currentStep)
            assertNotNull(vm.state.value.errorMessage)
        }

    @Test
    fun submit_offline_surfaces_inline_error() =
        runTest {
            isOnlineFlow.value = false
            val vm = makeVm()
            seedReadyToSubmit(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(ListingComposeStep.Review, vm.state.value.form.currentStep)
            assertEquals(
                "You're offline. Try again when you're back online.",
                vm.state.value.errorMessage,
            )
        }

    // MARK: - Success CTAs

    @Test
    fun success_primary_emits_open_listing_event() =
        runTest {
            coEvery { repo.create(any<CreateListingRequest>()) } returns
                NetworkResult.Success(createResponse)
            val vm = makeVm()
            seedReadyToSubmit(vm)
            vm.onPrimary() // Review → submit → Success
            advanceTimeBy(50)
            vm.onPrimary() // Success → open listing detail
            advanceTimeBy(10)
            assertEquals(
                ListingComposeOutboundEvent.OpenListingDetail("listing_42"),
                vm.pendingEvent.value,
            )
        }

    @Test
    fun success_secondary_emits_dismiss() =
        runTest {
            coEvery { repo.create(any<CreateListingRequest>()) } returns
                NetworkResult.Success(createResponse)
            val vm = makeVm()
            seedReadyToSubmit(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onSecondary()
            assertEquals(ListingComposeOutboundEvent.Dismiss, vm.pendingEvent.value)
        }

    // MARK: - Close-confirm dirtiness

    @Test
    fun close_on_empty_photos_is_clean() {
        val vm = makeVm()
        assertFalse(vm.chrome.dirty)
    }

    @Test
    fun close_on_photos_present_is_dirty() {
        val vm = makeVm()
        vm.addPhoto("a")
        assertTrue(vm.chrome.dirty)
    }

    @Test
    fun close_on_success_is_clean() =
        runTest {
            coEvery { repo.create(any<CreateListingRequest>()) } returns
                NetworkResult.Success(createResponse)
            val vm = makeVm()
            seedReadyToSubmit(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            assertFalse(vm.chrome.dirty)
        }

    // MARK: - Back navigation

    @Test
    fun back_on_title_step_returns_to_photos() =
        runTest {
            val vm = makeVm()
            vm.skipToManualPhotoEditor()
            vm.addPhoto("a")
            vm.onPrimary()
            advanceTimeBy(10)
            vm.onLeading()
            assertEquals(ListingComposeStep.Photos, vm.state.value.form.currentStep)
        }
}
