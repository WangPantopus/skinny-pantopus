@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_ownership

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.HomeClaimUploadSessionDto
import app.pantopus.android.data.api.models.homes.HomeEvidenceSessionDto
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceDto
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceList
import app.pantopus.android.data.api.models.homes.MyOwnershipClaimsResponse
import app.pantopus.android.data.api.models.homes.SubmitClaimEnvelope
import app.pantopus.android.data.api.models.homes.SubmitClaimResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homediscovery.HomeDiscoveryRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.claim_evidence.HomePrivateEvidenceAccess
import app.pantopus.android.ui.screens.homes.claim_evidence.HomePrivateEvidenceAccessFactory
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
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
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ClaimOwnershipWizardViewModelTest {
    private val repo = mockk<HomesRepository>(relaxed = true)
    private val discovery = mockk<HomeDiscoveryRepository>(relaxed = true)
    private val factory = mockk<HomePrivateEvidenceAccessFactory>()
    private val session = mockk<HomeClaimSessionScope>()
    private val access = mockk<HomePrivateEvidenceAccess>()
    private val online = MutableStateFlow(true)
    private val invalidated = MutableStateFlow(false)
    private val network = mockk<NetworkMonitor>()
    private val scope = HomeEvidenceSessionDto("actor", "a".repeat(64), "home-1", "claim-1")
    private val document =
        HomePrivateEvidenceDto("upload", "home-1", "claim-1", "deed", "deed.pdf", 3, "application/pdf", "pending", "ready", true, false)
    private var current = true

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { network.isOnline } returns online
        every { factory.session(any()) } returns session
        every { factory.create(session, "home-1", "claim-1", false) } returns access
        every { session.isCurrent } answers { current }
        every { session.actorId } answers { if (current) "actor" else null }
        every { session.invalidated } returns invalidated
        coEvery { session.requireCurrent() } answers { check(current) { "Session changed" } }
        coEvery { access.list() } returns HomePrivateEvidenceList(emptyList(), scope, false, null)
        coEvery { access.upload(any(), any(), any(), any(), any()) } answers { document.copy(id = firstArg()) }
        coEvery { repo.myOwnershipClaims() } returns
            NetworkResult.Success(MyOwnershipClaimsResponse(emptyList(), HomeClaimUploadSessionDto("actor", scope.sessionScope)))
        coEvery {
            repo.submitClaim(any(), any(), any())
        } returns NetworkResult.Success(SubmitClaimResponse("ok", SubmitClaimEnvelope(id = "claim-1", status = "under_review")))
    }

    @After fun teardown() {
        Dispatchers.resetMain()
    }

    private fun vm(type: String = "owner") =
        ClaimOwnershipWizardViewModel(
            repo,
            discovery,
            factory,
            network,
            SavedStateHandle(mapOf(CLAIM_OWNERSHIP_HOME_ID_KEY to "home-1", CLAIM_VERIFICATION_TYPE_KEY to type)),
        )

    private fun file() = ClaimPickedFile("deed.pdf", "application/pdf", byteArrayOf(1, 2, 3))

    private fun ready(model: ClaimOwnershipWizardViewModel) {
        model.onPrimary()
        model.picked(ClaimEvidenceSlot.Ownership, file())
    }

    @Test fun owner_requires_only_supported_manual_document() {
        val model = vm()
        assertEquals(listOf(ClaimEvidenceSlot.Ownership), model.state.value.activeSlots)
        assertEquals(setOf("deed", "closing_disclosure", "tax_bill"), model.state.value.documentOptions.map { it.id }.toSet())
        assertEquals(ClaimOwnershipStep.Start, model.state.value.currentStep)
        model.onPrimary()
        assertFalse(model.chrome.primaryCtaEnabled)
    }

    @Test fun residency_starts_at_upload_with_explicit_kind_selection() {
        val model = vm("residency")
        assertEquals(ClaimOwnershipStep.Upload, model.state.value.currentStep)
        model.picked(ClaimEvidenceSlot.Residency, file())
        assertFalse(model.state.value.canSubmit)
        model.selectDocumentType("lease")
        assertTrue(model.state.value.canSubmit)
    }

    @Test fun picking_a_filename_never_claims_address_or_identity_verification() {
        val model = vm()
        ready(model)
        assertTrue(model.state.value.addressMatches.isEmpty())
        model.selectDocumentType("idv")
        assertEquals("deed", model.state.value.selectedDocumentType)
    }

    @Test fun empty_file_and_unsupported_mime_are_rejected() {
        val model = vm()
        model.onPrimary()
        model.picked(ClaimEvidenceSlot.Ownership, ClaimPickedFile("x.html", "text/html", byteArrayOf(1)))
        assertFalse(model.state.value.canSubmit)
        model.picked(ClaimEvidenceSlot.Ownership, ClaimPickedFile("empty.txt", "text/plain", byteArrayOf()))
        assertFalse(model.state.value.canSubmit)
    }

    @Test fun missing_document_never_creates_claim() =
        runTest {
            val model = vm()
            model.onPrimary()
            model.onPrimary()
            coVerify(exactly = 0) { repo.submitClaim(any(), any(), any()) }
        }

    @Test fun successful_private_upload_uses_exact_type_and_never_calls_legacy_url_gateway() =
        runTest {
            val model = vm()
            ready(model)
            model.onPrimary()
            assertEquals(ClaimOwnershipStep.Success, model.state.value.currentStep)
            val slot = model.state.value.slots[ClaimEvidenceSlot.Ownership] as ClaimSlotState.Uploaded
            coVerify { repo.submitClaim("home-1", any(), scope.sessionScope) }
            assertTrue(slot.uploadId.matches(Regex("[a-f0-9-]{36}")))
            coVerify { access.upload(slot.uploadId, "deed", "deed.pdf", "application/pdf", byteArrayOf(1, 2, 3)) }
            coVerify(exactly = 0) { repo.uploadFile(any(), any(), any()) }
            coVerify(exactly = 0) { repo.uploadEvidence(any(), any(), any()) }
            assertTrue(
                model.state.value.submissionOutcomeNote!!.contains("Uploading does not verify identity or grant Home access."),
            )
        }

    @Test fun unknown_upload_result_retries_original_claim_and_upload_id() =
        runTest {
            val ids = mutableListOf<String>()
            coEvery { access.upload(any(), any(), any(), any(), any()) } answers {
                ids.add(firstArg())
                if (ids.size == 1) throw NetworkError.Transport(java.io.IOException("lost reply"))
                document.copy(id = firstArg())
            }
            val model = vm()
            ready(model)
            model.onPrimary()
            assertEquals(ClaimOwnershipStep.Upload, model.state.value.currentStep)
            assertTrue(model.state.value.slots[ClaimEvidenceSlot.Ownership] is ClaimSlotState.Failed)
            model.selectDocumentType("tax_bill")
            assertEquals("deed", model.state.value.selectedDocumentType)
            val replacement = file()
            model.picked(ClaimEvidenceSlot.Ownership, replacement)
            assertTrue(replacement.bytes.all { it == 0.toByte() })
            assertNull(model.beginPick(ClaimEvidenceSlot.Ownership))
            model.onPrimary()
            assertEquals(2, ids.size)
            assertEquals(ids[0], ids[1])
            coVerify(exactly = 1) { repo.submitClaim(any(), any(), any()) }
            assertEquals(ClaimOwnershipStep.Success, model.state.value.currentStep)
        }

    @Test fun claim_error_preserves_file_for_retry() =
        runTest {
            coEvery { repo.submitClaim(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val model = vm()
            ready(model)
            model.onPrimary()
            assertTrue(model.state.value.slots[ClaimEvidenceSlot.Ownership] is ClaimSlotState.Picked)
            assertEquals("Couldn't submit. Retry.", model.state.value.submitError)
        }

    @Test fun missing_or_foreign_first_server_scope_never_creates_claim() =
        runTest {
            val invalid = listOf(null, HomeClaimUploadSessionDto("other", scope.sessionScope), HomeClaimUploadSessionDto("actor", "bad"))
            for (server in invalid) {
                coEvery { repo.myOwnershipClaims() } returns NetworkResult.Success(MyOwnershipClaimsResponse(emptyList(), server))
                val model = vm()
                ready(model)
                model.onPrimary()
                assertNotNull(model.state.value.submitError)
            }
            coVerify(exactly = 0) { repo.submitClaim(any(), any(), any()) }
        }

    @Test fun delayed_first_server_scope_cannot_bind_replacement_session() =
        runTest {
            coEvery { repo.myOwnershipClaims() } answers {
                current = false
                NetworkResult.Success(MyOwnershipClaimsResponse(emptyList(), HomeClaimUploadSessionDto("actor", scope.sessionScope)))
            }
            val model = vm()
            ready(model)
            model.onPrimary()
            assertTrue(model.state.value.slots.isEmpty())
            coVerify(exactly = 0) { repo.submitClaim(any(), any(), any()) }
        }

    @Test fun changed_server_scope_cannot_rebind_claim_creation_retry() =
        runTest {
            coEvery { repo.submitClaim(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(503, null))
            val model = vm()
            ready(model)
            model.onPrimary()
            coEvery { repo.myOwnershipClaims() } returns
                NetworkResult.Success(MyOwnershipClaimsResponse(emptyList(), HomeClaimUploadSessionDto("actor", "f".repeat(64))))
            model.onPrimary()
            coVerify(exactly = 1) { repo.submitClaim(any(), any(), scope.sessionScope) }
            coVerify(exactly = 0) { repo.submitClaim(any(), any(), "f".repeat(64)) }
        }

    @Test fun evidence_scope_must_match_original_claim_submission_scope() =
        runTest {
            coEvery { access.list() } returns
                HomePrivateEvidenceList(emptyList(), scope.copy(sessionScope = "f".repeat(64)), false, null)
            val model = vm()
            ready(model)
            model.onPrimary()
            assertNotNull(model.state.value.submitError)
            coVerify(exactly = 0) { access.upload(any(), any(), any(), any(), any()) }
        }

    @Test fun opaque_duplicate_claim_never_uploads() =
        runTest {
            coEvery {
                repo.submitClaim(any(), any(), any())
            } returns NetworkResult.Success(SubmitClaimResponse("ok", SubmitClaimEnvelope(id = null, status = "under_review")))
            val model = vm()
            ready(model)
            model.onPrimary()
            assertNotNull(model.state.value.blockedByOtherClaimPrompt)
            coVerify(exactly = 0) { access.upload(any(), any(), any(), any(), any()) }
        }

    @Test fun offline_submit_keeps_selection() =
        runTest {
            val model = vm()
            ready(model)
            online.value = false
            model.onPrimary()
            assertTrue(model.state.value.submitError!!.contains("offline"))
            coVerify(exactly = 0) { repo.submitClaim(any(), any(), any()) }
        }

    @Test fun successful_submit_emits_status_navigation_only_on_next_action() =
        runTest {
            val model = vm()
            ready(model)
            model.onPrimary()
            assertNull(model.pendingEvent.value)
            model.onPrimary()
            assertEquals(ClaimOwnershipOutboundEvent.OpenClaimsList, model.pendingEvent.value)
        }

    @Test fun same_turn_duplicate_submit_has_one_claim_and_upload() =
        runTest {
            val reply = CompletableDeferred<HomePrivateEvidenceDto>()
            coEvery { access.upload(any(), any(), any(), any(), any()) } coAnswers { reply.await() }
            val model = vm()
            ready(model)
            model.onPrimary()
            model.onPrimary()
            coVerify(exactly = 1) { repo.submitClaim(any(), any(), any()) }
            coVerify(exactly = 1) { access.upload(any(), any(), any(), any(), any()) }
            reply.complete(document)
        }

    @Test fun session_replacement_during_claim_creation_discards_success() =
        runTest {
            coEvery { repo.submitClaim(any(), any(), any()) } answers {
                current = false
                NetworkResult.Success(SubmitClaimResponse("ok", SubmitClaimEnvelope(id = "claim-1", status = "under_review")))
            }
            val model = vm()
            ready(model)
            model.onPrimary()
            assertTrue(model.state.value.slots.isEmpty())
            assertNull(model.pendingEvent.value)
            coVerify(exactly = 0) { access.upload(any(), any(), any(), any(), any()) }
        }

    @Test fun late_upload_after_session_replacement_never_advances_or_retains_bytes() =
        runTest {
            val reply = CompletableDeferred<HomePrivateEvidenceDto>()
            coEvery { access.upload(any(), any(), any(), any(), any()) } coAnswers { reply.await() }
            val model = vm()
            model.onPrimary()
            val picked = file()
            model.picked(ClaimEvidenceSlot.Ownership, picked)
            model.onPrimary()
            current = false
            invalidated.value = true
            reply.complete(document)
            assertTrue(picked.bytes.all { it == 0.toByte() })
            assertNull(model.pendingEvent.value)
            assertNotEquals(ClaimOwnershipStep.Success, model.state.value.currentStep)
        }

    @Test fun picker_callback_after_session_change_does_not_read_private_uri() =
        runTest {
            val model = vm()
            model.onPrimary()
            val ticket = model.beginPick(ClaimEvidenceSlot.Ownership)!!
            current = false
            var read = false
            model.acceptPick(ClaimEvidenceSlot.Ownership, ticket) {
                read = true
                file()
            }
            assertFalse(read)
            assertTrue(model.state.value.slots.isEmpty())
        }

    @Test fun picker_callback_after_dismiss_does_not_read_private_uri() =
        runTest {
            val model = vm()
            model.onPrimary()
            val ticket = model.beginPick(ClaimEvidenceSlot.Ownership)!!
            model.onDiscard()
            var read = false
            model.acceptPick(ClaimEvidenceSlot.Ownership, ticket) {
                read = true
                file()
            }
            assertFalse(read)
        }

    @Test fun late_picker_bytes_after_session_change_are_zeroed() =
        runTest {
            val model = vm()
            model.onPrimary()
            val ticket = model.beginPick(ClaimEvidenceSlot.Ownership)!!
            val data = file()
            model.acceptPick(ClaimEvidenceSlot.Ownership, ticket) {
                current = false
                data
            }
            assertTrue(data.bytes.all { it == 0.toByte() })
        }

    @Test fun pending_server_document_is_retired_before_local_slot_clears() =
        runTest {
            coEvery { access.upload(any(), any(), any(), any(), any()) } throws NetworkError.Server(503, null)
            val model = vm()
            ready(model)
            model.onPrimary()
            val uploadId = io.mockk.slot<String>()
            coVerify { access.upload(capture(uploadId), any(), any(), any(), any()) }
            coEvery { access.list() } returns HomePrivateEvidenceList(listOf(document.copy(id = uploadId.captured)), scope, false, null)
            coEvery { access.remove(uploadId.captured) } returns document.copy(id = uploadId.captured, state = "retired", available = false)
            model.remove(ClaimEvidenceSlot.Ownership)
            coVerify { access.remove(uploadId.captured) }
            assertEquals(ClaimSlotState.Empty, model.state.value.slots[ClaimEvidenceSlot.Ownership])
        }

    @Test fun removal_failure_keeps_original_reservation_for_retry() =
        runTest {
            coEvery { access.upload(any(), any(), any(), any(), any()) } throws NetworkError.Server(503, null)
            val model = vm()
            ready(model)
            model.onPrimary()
            val uploadId = io.mockk.slot<String>()
            coVerify { access.upload(capture(uploadId), any(), any(), any(), any()) }
            coEvery { access.list() } returns HomePrivateEvidenceList(listOf(document.copy(id = uploadId.captured)), scope, false, null)
            coEvery { access.remove(uploadId.captured) } throws NetworkError.Server(503, null)
            model.remove(ClaimEvidenceSlot.Ownership)
            assertTrue(model.state.value.slots[ClaimEvidenceSlot.Ownership] is ClaimSlotState.Failed)
            assertNull(model.beginPick(ClaimEvidenceSlot.Ownership))
            model.remove(ClaimEvidenceSlot.Ownership)
            coVerify(exactly = 2) { access.remove(uploadId.captured) }
        }

    @Test fun selected_doc_and_method_are_explicit_in_request() =
        runTest {
            val model = vm("residency")
            model.selectDocumentType("lease")
            model.picked(ClaimEvidenceSlot.Residency, file())
            model.onPrimary()
            coVerify { repo.submitClaim("home-1", match { it.method == "doc_upload" && it.claimType == "resident" }, scope.sessionScope) }
            coVerify { access.upload(any(), "lease", any(), any(), any()) }
        }
}
