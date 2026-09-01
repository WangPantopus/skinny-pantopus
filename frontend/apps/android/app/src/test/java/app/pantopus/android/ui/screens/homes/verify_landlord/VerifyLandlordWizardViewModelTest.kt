@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.verify_landlord

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.PostcardInfoDto
import app.pantopus.android.data.api.models.homes.RequestPostcardResponse
import app.pantopus.android.data.api.models.tenant.TenantLeaseDto
import app.pantopus.android.data.api.models.tenant.TenantLeaseMetadataDto
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeVerificationRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.tenant.TenantRepository
import io.mockk.coEvery
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class VerifyLandlordWizardViewModelTest {
    private val networkMonitor: NetworkMonitor =
        mockk<NetworkMonitor>(relaxed = true).also {
            every { it.isOnline } returns MutableStateFlow(true)
        }

    private val verificationRepository: HomeVerificationRepository = mockk(relaxed = true)
    private val tenantRepository: TenantRepository = mockk(relaxed = true)

    private val stubLease =
        TenantLeaseDto(
            id = "lease-1",
            homeId = "home-1",
            state = "pending",
            source = "tenant_request",
            startAt = "2026-04-01T00:00:00.000Z",
            createdAt = "2026-03-04T18:12:00.000Z",
            metadata = TenantLeaseMetadataDto(message = "Hi, I'm the new tenant."),
        )

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { verificationRepository.requestPostcard(any()) } returns
            NetworkResult.Success(RequestPostcardResponse("ok", PostcardInfoDto("p1")))
        coEvery { tenantRepository.requestApproval(any()) } returns
            NetworkResult.Success(TenantRequestApprovalResponse(stubLease))
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private class TestVm(
        networkMonitor: NetworkMonitor,
        handle: SavedStateHandle,
        verificationRepository: HomeVerificationRepository,
        tenantRepository: TenantRepository,
    ) : VerifyLandlordWizardViewModel(networkMonitor, handle, verificationRepository, tenantRepository) {
        override val submitDelayMillis: Long = 0L
    }

    private fun makeVm(homeId: String = "home-1"): TestVm =
        TestVm(
            networkMonitor = networkMonitor,
            handle = SavedStateHandle(mapOf(VERIFY_LANDLORD_HOME_ID_KEY to homeId)),
            verificationRepository = verificationRepository,
            tenantRepository = tenantRepository,
        )

    /** Feeds a valid form through the public mutators. */
    private fun TestVm.seedPopulatedForm() {
        VerifyLandlordSampleData.populatedForm.let { f ->
            setOwnerName(f.ownerName)
            setContactName(f.contactName)
            setEmail(f.email)
            setPhone(f.phone)
            setLease(f.lease)
            setPMEnabled(true)
            setPMName(f.pmName)
            setPMEmail(f.pmEmail)
            setPMPhone(f.pmPhone)
        }
    }

    // MARK: - Step machine

    @Test fun initial_state_is_start_step() {
        val vm = makeVm()
        assertEquals(VerifyLandlordStep.Start, vm.state.value.currentStep)
        assertEquals("Start verification", vm.chrome.primaryCtaLabel)
        assertTrue(vm.chrome.primaryCtaEnabled)
    }

    @Test fun primary_on_start_advances_to_details() {
        val vm = makeVm()
        vm.onPrimary()
        assertEquals(VerifyLandlordStep.Details, vm.state.value.currentStep)
        assertEquals("Submit", vm.chrome.primaryCtaLabel)
    }

    @Test fun back_on_details_returns_to_start_and_clears_errors() =
        runTest {
            val vm = makeVm()
            vm.onPrimary()
            // Force errors to surface so we can confirm they get cleared.
            VerifyLandlordSampleData.errorForm.let { errored ->
                vm.setOwnerName(errored.ownerName)
                vm.setEmail(errored.email)
                vm.setLease(errored.lease)
            }
            vm.onPrimary() // submit with errors
            assertNotNull(vm.state.value.errors)
            vm.onLeading() // back to start
            assertEquals(VerifyLandlordStep.Start, vm.state.value.currentStep)
            assertNull(vm.state.value.errors)
        }

    @Test fun leading_on_start_dismisses() {
        val vm = makeVm()
        vm.onLeading()
        assertEquals(VerifyLandlordOutboundEvent.Dismiss, vm.pendingEvent.value)
    }

    // MARK: - Variants

    @Test fun fast_track_variant_surfaces_existing_landlord() {
        val vm = makeVm("home-fast-track")
        assertTrue(vm.state.value.startContent.isFastTrack)
        assertNotNull(vm.state.value.startContent.existingLandlord)
    }

    @Test fun canonical_variant_has_no_existing_landlord() {
        val vm = makeVm()
        assertFalse(vm.state.value.startContent.isFastTrack)
        assertNull(vm.state.value.startContent.existingLandlord)
    }

    // MARK: - Validation

    @Test fun validation_catches_missing_tld() {
        val errors =
            VerifyLandlordSampleData.populatedForm
                .copy(email = "mira@elmstholdings")
                .validate()
        assertEquals("Missing top-level domain", errors.email)
    }

    @Test fun validation_catches_lease_unit_mismatch() {
        val errors = VerifyLandlordSampleData.errorForm.validate()
        assertNotNull(errors.lease)
        assertEquals("Missing top-level domain", errors.email)
        assertEquals(2, errors.count)
    }

    @Test fun validation_count_and_compact_summary_match_iOS_order() {
        val errors =
            VerifyLandlordValidationErrors(
                email = "Missing top-level domain",
                lease = "Unit mismatch",
            )
        assertEquals(2, errors.count)
        assertEquals("Email format · Lease unit mismatch", errors.compactSummary)
    }

    @Test fun pm_required_when_toggle_on() {
        val errors =
            VerifyLandlordSampleData.populatedForm
                .copy(pmEnabled = true, pmName = "", pmEmail = "")
                .validate()
        assertEquals("Required", errors.pmName)
        assertEquals("Required", errors.pmEmail)
    }

    @Test fun pm_not_required_when_toggle_off() {
        val errors =
            VerifyLandlordSampleData.populatedForm
                .copy(pmEnabled = false, pmName = "", pmEmail = "")
                .validate()
        assertNull(errors.pmName)
        assertNull(errors.pmEmail)
    }

    // MARK: - Submit state machine

    @Test fun submit_blocked_when_errors_present() =
        runTest {
            val vm = makeVm()
            vm.onPrimary() // -> details
            // Feed the errored form through the public mutators so the
            // VM's validation pipeline runs identically to the runtime.
            vm.setOwnerName(VerifyLandlordSampleData.errorForm.ownerName)
            vm.setContactName(VerifyLandlordSampleData.errorForm.contactName)
            vm.setEmail(VerifyLandlordSampleData.errorForm.email)
            vm.setLease(VerifyLandlordSampleData.errorForm.lease)
            vm.onPrimary() // submit
            assertEquals(VerifyLandlordStep.Details, vm.state.value.currentStep)
            val state = vm.state.value
            assertTrue(state.submitState is VerifyLandlordSubmitState.Error)
            assertEquals(2, state.errors?.count)
            assertNull(vm.pendingEvent.value)
            assertFalse(vm.chrome.primaryCtaEnabled)
        }

    @Test fun submit_posts_approval_request_and_lands_on_sent_step() =
        runTest {
            val captured = slot<TenantRequestApprovalRequest>()
            coEvery { tenantRepository.requestApproval(capture(captured)) } returns
                NetworkResult.Success(TenantRequestApprovalResponse(stubLease))
            val vm = makeVm("home-42")
            vm.onPrimary()
            vm.seedPopulatedForm()
            vm.setMoveInDate("2026-04-01")
            vm.setMessageToLandlord("Hi, I'm the new tenant.")
            vm.onPrimary() // submit
            assertEquals(VerifyLandlordStep.Sent, vm.state.value.currentStep)
            assertEquals(VerifyLandlordSubmitState.Submitted, vm.state.value.submitState)
            assertEquals(
                VerifyLandlordApprovalResult.Kind.Submitted,
                vm.state.value.approvalResult?.kind,
            )
            assertEquals("home-42", captured.captured.homeId)
            assertEquals("2026-04-01T00:00:00.000Z", captured.captured.startAt)
            assertTrue(captured.captured.message.orEmpty().contains("Hi, I'm the new tenant."))
            assertTrue(
                "Landlord details must travel with the request instead of being discarded",
                captured.captured.message.orEmpty().contains("Elm Street Holdings LLC"),
            )
            assertNull(vm.pendingEvent.value)
        }

    @Test fun submit_without_verified_landlord_falls_back_to_postcard() =
        runTest {
            coEvery { tenantRepository.requestApproval(any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(
                        400,
                        """{"error":"This property has no verified landlord. Cannot submit a lease request."}""",
                    ),
                )
            val vm = makeVm("home-42")
            vm.onPrimary()
            vm.seedPopulatedForm()
            vm.onPrimary() // submit
            assertEquals(
                VerifyLandlordOutboundEvent.OpenPostcardVerification("home-42"),
                vm.pendingEvent.value,
            )
            assertEquals(VerifyLandlordSubmitState.Submitted, vm.state.value.submitState)
        }

    @Test fun submit_surfaces_existing_pending_request() =
        runTest {
            coEvery { tenantRepository.requestApproval(any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(
                        409,
                        """{"error":"You already have a pending request for this home"}""",
                    ),
                )
            val vm = makeVm()
            vm.onPrimary()
            vm.seedPopulatedForm()
            vm.onPrimary()
            assertEquals(VerifyLandlordStep.Sent, vm.state.value.currentStep)
            assertEquals(
                VerifyLandlordApprovalResult.Kind.AlreadyPending,
                vm.state.value.approvalResult?.kind,
            )
            assertEquals(
                "You already have a pending request for this home",
                vm.state.value.approvalResult?.serverMessage,
            )
        }

    @Test fun submit_surfaces_existing_active_lease() =
        runTest {
            coEvery { tenantRepository.requestApproval(any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(
                        409,
                        """{"error":"You already have an active lease at this home"}""",
                    ),
                )
            val vm = makeVm()
            vm.onPrimary()
            vm.seedPopulatedForm()
            vm.onPrimary()
            assertEquals(
                VerifyLandlordApprovalResult.Kind.AlreadyActive,
                vm.state.value.approvalResult?.kind,
            )
        }

    @Test fun sent_step_secondary_starts_postcard_fallback() =
        runTest {
            val vm = makeVm("home-9")
            vm.onPrimary()
            vm.seedPopulatedForm()
            vm.onPrimary() // submit -> Sent
            assertEquals(VerifyLandlordStep.Sent, vm.state.value.currentStep)
            assertEquals("Mail me a code", vm.chrome.secondaryCta?.label)
            vm.onSecondary()
            assertEquals(
                VerifyLandlordOutboundEvent.OpenPostcardVerification("home-9"),
                vm.pendingEvent.value,
            )
        }

    @Test fun move_in_date_must_be_iso_shaped() {
        assertEquals(
            "Use YYYY-MM-DD",
            VerifyLandlordSampleData.populatedForm.copy(moveInDate = "04/01/2026").validate().moveInDate,
        )
        assertNull(
            VerifyLandlordSampleData.populatedForm.copy(moveInDate = "2026-04-01").validate().moveInDate,
        )
        assertNull(
            VerifyLandlordSampleData.populatedForm.copy(moveInDate = "").validate().moveInDate,
        )
    }

    // MARK: - Field mutations

    @Test fun pm_toggle_off_clears_pm_fields() {
        val vm = makeVm()
        // Seed PM fields then flip the toggle off.
        vm.setPMEnabled(true)
        vm.setPMName("Daniel")
        vm.setPMEmail("d@x.co")
        vm.setPMPhone("(415) 555")
        vm.setPMEnabled(false)
        assertFalse(vm.state.value.form.pmEnabled)
        assertEquals("", vm.state.value.form.pmName)
        assertEquals("", vm.state.value.form.pmEmail)
        assertEquals("", vm.state.value.form.pmPhone)
    }

    @Test fun field_update_revalidates_when_errors_shown() =
        runTest {
            val vm = makeVm()
            vm.onPrimary()
            vm.setOwnerName(VerifyLandlordSampleData.errorForm.ownerName)
            vm.setContactName(VerifyLandlordSampleData.errorForm.contactName)
            vm.setEmail(VerifyLandlordSampleData.errorForm.email)
            vm.setLease(VerifyLandlordSampleData.errorForm.lease)
            vm.onPrimary() // submit with errors
            assertEquals(2, vm.state.value.errors?.count)
            vm.setEmail("mira@elmstholdings.com")
            assertEquals(1, vm.state.value.errors?.count)
        }

    @Test fun field_updates_do_not_show_errors_until_submit_attempt() {
        val vm = makeVm()
        vm.onPrimary()
        assertNull(vm.state.value.errors)
        vm.setEmail("typing@")
        assertNull(vm.state.value.errors)
    }
}
