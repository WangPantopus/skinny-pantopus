@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_ownership

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.FileUploadResponse
import app.pantopus.android.data.api.models.homes.SubmitClaimEnvelope
import app.pantopus.android.data.api.models.homes.SubmitClaimRequest
import app.pantopus.android.data.api.models.homes.SubmitClaimResponse
import app.pantopus.android.data.api.models.homes.UploadEvidenceRequest
import app.pantopus.android.data.api.models.homes.UploadEvidenceResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homediscovery.HomeDiscoveryRepository
import app.pantopus.android.data.homes.HomeOwnershipClaimRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ClaimOwnershipWizardViewModelTest {
    private val repo: HomesRepository = mockk(relaxed = true)
    private val discoveryRepo: HomeDiscoveryRepository = mockk(relaxed = true)
    private val claimRepo: HomeOwnershipClaimRepository = mockk(relaxed = true)
    private val networkMonitor: NetworkMonitor =
        mockk<NetworkMonitor>(relaxed = true).also {
            every { it.isOnline } returns MutableStateFlow(true)
        }

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): ClaimOwnershipWizardViewModel =
        ClaimOwnershipWizardViewModel(
            repository = repo,
            discoveryRepository = discoveryRepo,
            claimRepository = claimRepo,
            networkMonitor = networkMonitor,
            savedStateHandle = SavedStateHandle(mapOf(CLAIM_OWNERSHIP_HOME_ID_KEY to "home-1")),
        )

    private fun pickedFile(name: String): ClaimPickedFile =
        ClaimPickedFile(filename = name, mimeType = "image/jpeg", bytes = byteArrayOf(1, 2, 3))

    @Test fun initial_state_is_start_step() {
        val vm = makeVm()
        assertEquals(ClaimOwnershipStep.Start, vm.state.value.currentStep)
        assertEquals("Start claim", vm.chrome.primaryCtaLabel)
        assertTrue(vm.chrome.primaryCtaEnabled)
        assertEquals(WizardLeadingControl.Close, vm.chrome.leading)
    }

    @Test fun primary_on_start_advances_to_upload() {
        val vm = makeVm()
        vm.onPrimary()
        assertEquals(ClaimOwnershipStep.Upload, vm.state.value.currentStep)
        assertEquals("Submit claim", vm.chrome.primaryCtaLabel)
        // Slots empty → CTA disabled.
        assertFalse(vm.chrome.primaryCtaEnabled)
        assertEquals(WizardLeadingControl.Back, vm.chrome.leading)
    }

    @Test fun picked_computes_address_match_when_filename_carries_street_number() {
        // Sample-data heuristic: a filename carrying the home's street number
        // ("412") resolves to a Matches verdict on the slot.
        val vm = makeVm()
        vm.onPrimary()
        vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed_412_elm.pdf"))
        val verdict = vm.state.value.addressMatches[ClaimEvidenceSlot.Ownership]
        assertTrue(verdict is ClaimAddressMatch.Matches)
        assertTrue((verdict as ClaimAddressMatch.Matches).detail.contains("412 Elm St"))
    }

    @Test fun picked_computes_address_differs_when_street_number_absent() {
        val vm = makeVm()
        vm.onPrimary()
        vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("mortgage_statement.pdf"))
        assertTrue(vm.state.value.addressMatches[ClaimEvidenceSlot.Ownership] is ClaimAddressMatch.Differs)
    }

    @Test fun remove_clears_address_match() {
        val vm = makeVm()
        vm.onPrimary()
        vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed_412.pdf"))
        assertNotNull(vm.state.value.addressMatches[ClaimEvidenceSlot.Ownership])
        vm.remove(ClaimEvidenceSlot.Ownership)
        assertNull(vm.state.value.addressMatches[ClaimEvidenceSlot.Ownership])
    }

    @Test fun submit_blocked_without_both_files() =
        runTest {
            val vm = makeVm()
            vm.onPrimary()
            vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
            // Only one slot filled.
            assertFalse(vm.state.value.bothSlotsHaveFiles)
            vm.onPrimary() // submit — should no-op
            coVerify(exactly = 0) { repo.submitClaim(any(), any()) }
        }

    @Test fun submit_failure_keeps_files_and_surfaces_error() =
        runTest {
            coEvery { repo.submitClaim(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.onPrimary()
            vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
            vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed.pdf"))
            vm.onPrimary() // submit
            assertEquals(ClaimOwnershipStep.Upload, vm.state.value.currentStep)
            assertEquals("Couldn't submit. Retry.", vm.state.value.submitError)
            assertTrue(vm.state.value.slots[ClaimEvidenceSlot.Identity] is ClaimSlotState.Picked)
            assertTrue(vm.state.value.slots[ClaimEvidenceSlot.Ownership] is ClaimSlotState.Picked)
        }

    @Test fun submit_happy_path_advances_to_success() =
        runTest {
            coEvery { repo.submitClaim("home-1", any()) } returns
                NetworkResult.Success(
                    SubmitClaimResponse(
                        message = "ok",
                        claim = SubmitClaimEnvelope(id = "claim-1", status = "under_review"),
                    ),
                )
            coEvery { repo.uploadFile(any(), any(), any()) } returns
                NetworkResult.Success(
                    FileUploadResponse(
                        message = "uploaded",
                        file = FileUploadResponse.FileRef(id = "f", url = "https://files/x"),
                    ),
                )
            coEvery { repo.uploadEvidence(any(), any(), any()) } returns
                NetworkResult.Success(
                    UploadEvidenceResponse(
                        evidence = emptyMap<String, Any?>(),
                        verificationTier = null,
                    ),
                )
            val vm = makeVm()
            vm.onPrimary()
            vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
            vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed.pdf"))
            vm.onPrimary()
            assertEquals(ClaimOwnershipStep.Success, vm.state.value.currentStep)
            assertEquals("View status", vm.chrome.primaryCtaLabel)
            assertEquals(WizardProgressLabel.Hidden, vm.chrome.progressLabel)
            assertNotNull(vm.chrome.secondaryCta)
        }

    @Test fun note_carried_as_metadata_on_first_evidence_only() =
        runTest {
            coEvery { repo.submitClaim(any(), any()) } returns
                NetworkResult.Success(
                    SubmitClaimResponse(
                        message = "ok",
                        claim = SubmitClaimEnvelope(id = "claim-2", status = "under_review"),
                    ),
                )
            coEvery { repo.uploadFile(any(), any(), any()) } returns
                NetworkResult.Success(
                    FileUploadResponse(
                        message = "ok",
                        file = FileUploadResponse.FileRef(id = "f", url = "https://files/x"),
                    ),
                )
            val captured = mutableListOf<UploadEvidenceRequest>()
            coEvery { repo.uploadEvidence(any(), any(), capture(captured)) } returns
                NetworkResult.Success(
                    UploadEvidenceResponse(evidence = emptyMap<String, Any?>(), verificationTier = null),
                )
            val vm = makeVm()
            vm.onPrimary()
            vm.setNote("Inherited from grandparents")
            vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
            vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed.pdf"))
            vm.onPrimary()
            assertEquals(2, captured.size)
            assertEquals("Inherited from grandparents", captured[0].metadata?.get("note"))
            assertNull(captured[1].metadata)
        }

    @Test fun duplicate_claim_nil_id_surfaces_friendly_error() =
        runTest {
            coEvery { repo.submitClaim(any(), any()) } returns
                NetworkResult.Success(
                    SubmitClaimResponse(
                        message = "duplicate",
                        claim = SubmitClaimEnvelope(id = null, status = "under_review"),
                    ),
                )
            val vm = makeVm()
            vm.onPrimary()
            vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
            vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed.pdf"))
            vm.onPrimary()
            assertEquals(ClaimOwnershipStep.Upload, vm.state.value.currentStep)
            // A null claim id on the opaque-handshake path means a duplicate
            // already exists — the same user-visible outcome as a 409. It now
            // raises the blocked prompt (which offers "Search homes", matching
            // RN's `claim-owner/evidence.tsx:194-212`) rather than a bare
            // error string, so `submitError` stays null.
            assertNull(vm.state.value.submitError)
            assertTrue(
                vm.state.value.blockedByOtherClaimPrompt
                    ?.contains("verification is already in progress") == true,
            )
        }

    @Test fun back_on_upload_step_returns_to_start() {
        val vm = makeVm()
        vm.onPrimary() // → upload
        vm.onLeading() // back
        assertEquals(ClaimOwnershipStep.Start, vm.state.value.currentStep)
    }

    @Test fun start_chrome_stays_dirty_after_files_picked_then_back() {
        // Regression: when the user picks files on Upload then backs to
        // Start, tapping X must still trigger the discard-confirm —
        // otherwise the in-memory bytes are dumped silently.
        val vm = makeVm()
        vm.onPrimary() // → upload
        vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
        assertTrue("Upload chrome should be dirty after picking a file", vm.chrome.dirty)
        vm.onLeading() // back to Start
        assertEquals(ClaimOwnershipStep.Start, vm.state.value.currentStep)
        assertTrue(
            "Start chrome should stay dirty so X tap triggers discard-confirm",
            vm.chrome.dirty,
        )
    }

    @Test fun retry_after_partial_success_skips_claim_and_uploaded_slots() =
        runTest {
            // First attempt:  claim → slot1 upload → slot1 evidence OK
            // → slot2 upload OK → slot2 evidence fails.
            // Retry:  no claim call, no re-upload, just slot2 evidence.
            val claimResponses =
                ArrayDeque(
                    listOf(
                        NetworkResult.Success(
                            SubmitClaimResponse(
                                message = "ok",
                                claim = SubmitClaimEnvelope("claim-r", "under_review"),
                            ),
                        ),
                    ),
                )
            coEvery { repo.submitClaim(any(), any()) } answers { claimResponses.removeFirst() }

            val uploadResponses =
                ArrayDeque(
                    listOf(
                        NetworkResult.Success(
                            FileUploadResponse("ok", FileUploadResponse.FileRef("f1", "https://files/r1")),
                        ),
                        NetworkResult.Success(
                            FileUploadResponse("ok", FileUploadResponse.FileRef("f2", "https://files/r2")),
                        ),
                    ),
                )
            coEvery { repo.uploadFile(any(), any(), any()) } answers { uploadResponses.removeFirst() }

            val evidenceResponses =
                ArrayDeque(
                    listOf<NetworkResult<UploadEvidenceResponse>>(
                        NetworkResult.Success(UploadEvidenceResponse(emptyMap<String, Any?>(), null)),
                        NetworkResult.Failure(NetworkError.Server(500, null)),
                        NetworkResult.Success(UploadEvidenceResponse(emptyMap<String, Any?>(), null)),
                    ),
                )
            coEvery { repo.uploadEvidence(any(), any(), any()) } answers {
                evidenceResponses.removeFirst()
            }

            val vm = makeVm()
            vm.onPrimary() // → upload
            vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
            vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed.pdf"))
            vm.onPrimary() // attempt 1 — fails on slot2 evidence
            assertEquals(ClaimOwnershipStep.Upload, vm.state.value.currentStep)
            assertNotNull(vm.state.value.submitError)

            vm.onPrimary() // retry — should succeed
            assertEquals(ClaimOwnershipStep.Success, vm.state.value.currentStep)

            coVerify(exactly = 1) { repo.submitClaim(any(), any()) }
            coVerify(exactly = 2) { repo.uploadFile(any(), any(), any()) }
            coVerify(exactly = 3) { repo.uploadEvidence(any(), any(), any()) }
        }

    @Test fun success_primary_emits_open_claims_list() =
        runTest {
            coEvery { repo.submitClaim(any(), any()) } returns
                NetworkResult.Success(
                    SubmitClaimResponse(
                        message = "ok",
                        claim = SubmitClaimEnvelope(id = "claim-3", status = "under_review"),
                    ),
                )
            coEvery { repo.uploadFile(any(), any(), any()) } returns
                NetworkResult.Success(
                    FileUploadResponse("ok", FileUploadResponse.FileRef("f", "https://files/x")),
                )
            coEvery { repo.uploadEvidence(any(), any(), any()) } returns
                NetworkResult.Success(
                    UploadEvidenceResponse(emptyMap<String, Any?>(), null),
                )
            val vm = makeVm()
            vm.onPrimary()
            vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
            vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed.pdf"))
            vm.onPrimary()
            vm.onPrimary() // tap "View status"
            assertEquals(ClaimOwnershipOutboundEvent.OpenClaimsList, vm.pendingEvent.value)
        }

    @Test fun offline_blocks_submit() =
        runTest {
            val offlineMonitor =
                mockk<NetworkMonitor>(relaxed = true).also {
                    every { it.isOnline } returns MutableStateFlow(false)
                }
            val vm =
                ClaimOwnershipWizardViewModel(
                    repository = repo,
                    discoveryRepository = discoveryRepo,
                    claimRepository = claimRepo,
                    networkMonitor = offlineMonitor,
                    savedStateHandle = SavedStateHandle(mapOf(CLAIM_OWNERSHIP_HOME_ID_KEY to "home-1")),
                )
            vm.onPrimary()
            vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
            vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed.pdf"))
            vm.onPrimary()
            coVerify(exactly = 0) { repo.submitClaim(any(), any()) }
            assertNotNull(vm.state.value.submitError)
        }

    @Test fun submit_builds_doc_upload_request() =
        runTest {
            val captured = slot<SubmitClaimRequest>()
            coEvery { repo.submitClaim("home-1", capture(captured)) } returns
                NetworkResult.Success(
                    SubmitClaimResponse(
                        message = "ok",
                        claim = SubmitClaimEnvelope(id = "claim-4", status = "under_review"),
                    ),
                )
            coEvery { repo.uploadFile(any(), any(), any()) } returns
                NetworkResult.Success(
                    FileUploadResponse("ok", FileUploadResponse.FileRef("f", "https://files/x")),
                )
            coEvery { repo.uploadEvidence(any(), any(), any()) } returns
                NetworkResult.Success(
                    UploadEvidenceResponse(emptyMap<String, Any?>(), null),
                )
            val vm = makeVm()
            vm.onPrimary()
            vm.picked(ClaimEvidenceSlot.Identity, pickedFile("id.jpg"))
            vm.picked(ClaimEvidenceSlot.Ownership, pickedFile("deed.pdf"))
            vm.onPrimary()
            assertEquals("doc_upload", captured.captured.method)
            assertEquals("owner", captured.captured.claimType)
        }
}
