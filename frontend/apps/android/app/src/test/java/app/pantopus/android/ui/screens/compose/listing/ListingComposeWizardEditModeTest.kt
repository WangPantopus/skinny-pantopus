@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.compose.listing

import app.pantopus.android.data.api.models.listings.ListingDetailResponse
import app.pantopus.android.data.api.models.listings.UpdateListingRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import io.mockk.coEvery
import io.mockk.coVerify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ListingComposeWizardEditModeTest : ListingComposeWizardViewModelTestCase() {
    @Test
    fun edit_mode_chrome_shows_edit_title() {
        val vm = makeEditVm()
        assertTrue(vm.isEditMode)
        assertEquals("listing_42", vm.editingListingId)
        assertEquals("Edit listing", vm.chrome.title)
    }

    @Test
    fun edit_mode_review_step_cta_reads_save_changes() =
        runTest {
            coEvery { repo.detail("listing_42") } returns
                NetworkResult.Success(ListingDetailResponse(listing = editListingDto()))
            val vm = makeEditVm()
            vm.loadExistingIfNeeded()
            assertEquals(ListingComposeStep.Review, vm.state.value.form.currentStep)
            assertEquals("Save changes", vm.chrome.primaryCtaLabel)
        }

    @Test
    fun edit_prefill_projects_listing_dto_into_form() =
        runTest {
            coEvery { repo.detail("listing_42") } returns
                NetworkResult.Success(ListingDetailResponse(listing = editListingDto()))
            val vm = makeEditVm()
            vm.loadExistingIfNeeded()
            val form = vm.state.value.form
            assertEquals("Mid-century walnut credenza", form.title)
            assertEquals(ListingComposeCategory.Goods, form.category)
            assertEquals(ListingComposeCondition.LikeNew, form.condition)
            assertEquals(ListingComposePriceKind.Fixed, form.priceKind)
            assertEquals("420", form.priceAmount)
            assertEquals(
                "Solid walnut, four sliding doors, dovetail joinery.",
                form.bodyText,
            )
            assertEquals(2, form.photos.size)
            assertEquals(ListingComposeLocationKind.MeetPoint, form.locationKind)
            assertEquals("Lincoln Park bandshell", form.locationLabel)
            // jumpToStep default → land on Review so the user can scan +
            // tap Save changes immediately.
            assertEquals(ListingComposeStep.Review, form.currentStep)
        }

    @Test
    fun edit_prefill_jumps_to_price_step_when_requested() =
        runTest {
            coEvery { repo.detail("listing_42") } returns
                NetworkResult.Success(ListingDetailResponse(listing = editListingDto()))
            val vm = makeEditVm(jumpToStep = ListingComposeStep.Price)
            vm.loadExistingIfNeeded()
            assertEquals(ListingComposeStep.Price, vm.state.value.form.currentStep)
            assertEquals("420", vm.state.value.form.priceAmount)
        }

    @Test
    fun edit_prefill_is_noop_when_form_already_dirty() =
        runTest {
            val vm = makeEditVm()
            vm.addPhoto("user_photo")
            vm.setTitle("User-edited title")
            // No coEvery — fetch must NOT be invoked.
            vm.loadExistingIfNeeded()
            assertEquals("User-edited title", vm.state.value.form.title)
        }

    @Test
    fun edit_prefill_free_listing_maps_to_free_category() =
        runTest {
            coEvery { repo.detail("listing_free") } returns
                NetworkResult.Success(ListingDetailResponse(listing = freeEditListingDto()))
            val vm = makeEditVm(listingId = "listing_free")
            vm.loadExistingIfNeeded()
            assertEquals(ListingComposeCategory.Free, vm.state.value.form.category)
            assertEquals(ListingComposePriceKind.Free, vm.state.value.form.priceKind)
            assertEquals("", vm.state.value.form.priceAmount)
        }

    @Test
    fun edit_prefill_wanted_listing_maps_to_wanted_category() =
        runTest {
            coEvery { repo.detail("listing_w") } returns
                NetworkResult.Success(ListingDetailResponse(listing = wantedEditListingDto()))
            val vm = makeEditVm(listingId = "listing_w")
            vm.loadExistingIfNeeded()
            assertEquals(ListingComposeCategory.Wanted, vm.state.value.form.category)
        }

    @Test
    fun edit_prefill_surfaces_error_on_fetch_failure() =
        runTest {
            coEvery { repo.detail("listing_42") } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeEditVm()
            vm.loadExistingIfNeeded()
            assertNotNull(vm.state.value.errorMessage)
            // Form stays empty so the user can retry.
            assertEquals(ListingComposeFormState.EMPTY, vm.state.value.form)
        }

    @Test
    fun edit_submit_fires_PATCH_and_emits_listing_updated() =
        runTest {
            coEvery { repo.detail("listing_42") } returns
                NetworkResult.Success(ListingDetailResponse(listing = editListingDto()))
            coEvery {
                repo.update(
                    "listing_42",
                    any<UpdateListingRequest>(),
                )
            } returns NetworkResult.Success(updateResponse)
            val vm = makeEditVm()
            vm.loadExistingIfNeeded()
            assertEquals(ListingComposeStep.Review, vm.state.value.form.currentStep)
            vm.onPrimary() // submit
            advanceTimeBy(50)
            assertEquals(ListingComposeStep.Success, vm.state.value.form.currentStep)
            assertEquals("listing_42", vm.state.value.createdListingId)
            assertEquals("Back to listing", vm.chrome.primaryCtaLabel)
            assertEquals("listingComposeEditDone", vm.chrome.secondaryCta?.testTag)
            vm.onPrimary()
            advanceTimeBy(10)
            assertEquals(
                ListingComposeOutboundEvent.ListingUpdated("listing_42"),
                vm.pendingEvent.value,
            )
            coVerify {
                repo.update(
                    "listing_42",
                    any<UpdateListingRequest>(),
                )
            }
        }

    @Test
    fun edit_submit_error_keeps_user_on_review_with_banner() =
        runTest {
            coEvery { repo.detail("listing_42") } returns
                NetworkResult.Success(ListingDetailResponse(listing = editListingDto()))
            coEvery {
                repo.update(
                    "listing_42",
                    any<UpdateListingRequest>(),
                )
            } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeEditVm()
            vm.loadExistingIfNeeded()
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(ListingComposeStep.Review, vm.state.value.form.currentStep)
            assertNotNull(vm.state.value.errorMessage)
        }

    @Test
    fun edit_mode_is_always_dirty_pre_success() =
        runTest {
            coEvery { repo.detail("listing_42") } returns
                NetworkResult.Success(ListingDetailResponse(listing = editListingDto()))
            val vm = makeEditVm()
            vm.loadExistingIfNeeded()
            assertTrue("Edit mode warns on close so the user doesn't lose intent.", vm.chrome.dirty)
        }

    @Test
    fun edit_secondary_tap_emits_listing_updated() =
        runTest {
            coEvery { repo.detail("listing_42") } returns
                NetworkResult.Success(ListingDetailResponse(listing = editListingDto()))
            coEvery {
                repo.update(
                    "listing_42",
                    any<UpdateListingRequest>(),
                )
            } returns NetworkResult.Success(updateResponse)
            val vm = makeEditVm()
            vm.loadExistingIfNeeded()
            vm.onPrimary() // submit
            advanceTimeBy(50)
            assertEquals(ListingComposeStep.Success, vm.state.value.form.currentStep)
            vm.onSecondary()
            assertEquals(
                ListingComposeOutboundEvent.ListingUpdated("listing_42"),
                vm.pendingEvent.value,
            )
        }

    @Test
    fun project_pure_helper_handles_default_jump_target() {
        val form =
            ListingComposeWizardViewModel.project(editListingDto())
        assertEquals(ListingComposeStep.Review, form.currentStep)
        assertEquals(ListingComposeCategory.Goods, form.category)
    }
}
