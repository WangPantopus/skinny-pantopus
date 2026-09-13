@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.claim_evidence

import app.pantopus.android.data.api.models.homes.HomeEvidenceSessionDto
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceDto
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceList
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.homes.HomeEvidenceBytes
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
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
class HomePrivateEvidenceControllerTest {
    private val access = mockk<HomePrivateEvidenceAccess>()
    private val session = mockk<HomeClaimSessionScope>()
    private val invalidated = MutableStateFlow(false)
    private lateinit var scope: CoroutineScope
    private var current = true
    private val token = "b".repeat(64)
    private val record =
        HomePrivateEvidenceDto("upload", "home", "claim", "lease", "lease.txt", 3, "text/plain", "pending", "ready", true, false)
    private val list = HomePrivateEvidenceList(listOf(record), HomeEvidenceSessionDto("user", "a".repeat(64), "home", "claim"), true, token)

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        every { access.session } returns session
        every { session.isCurrent } answers { current }
        every { session.invalidated } returns invalidated
        coEvery { access.list() } returns list
        coEvery { access.read("upload", token) } returns HomeEvidenceBytes(byteArrayOf(1, 2, 3), "text/plain", "d".repeat(64))
        coEvery { access.read("upload", null) } returns HomeEvidenceBytes(byteArrayOf(1, 2, 3), "text/plain", null)
    }

    @After fun teardown() {
        scope.cancel()
        Dispatchers.resetMain()
    }

    private fun controller(claimant: Boolean = false) =
        HomePrivateEvidenceController(
            scope,
            access,
            claimant,
            if (claimant) null else token,
        )

    private fun inspected(c: HomePrivateEvidenceController) {
        c.open(record)
        c.previewDisplayed(requireNotNull(c.state.value.preview))
    }

    @Test fun private_list_loads_without_reading_or_verifying_bytes() =
        runTest {
            val c = controller()
            assertEquals(list.evidence, c.state.value.documents)
            coVerify(exactly = 0) { access.read(any(), any()) }
            coVerify(exactly = 0) { access.verify(any(), any(), any()) }
        }

    @Test fun opening_does_not_verify_and_rendered_confirmation_is_required() =
        runTest {
            val c = controller()
            c.open(record)
            c.verify()
            coVerify(exactly = 0) { access.verify(any(), any(), any()) }
            assertNotNull(c.state.value.preview)
            assertFalse(c.state.value.previewReady)
        }

    @Test fun exact_rendered_document_requires_explicit_verification() =
        runTest {
            val c = controller()
            inspected(c)
            coEvery { access.verify("upload", token, "d".repeat(64)) } answers {
                coEvery {
                    access.list()
                } returns
                    list.copy(
                        evidence = listOf(record.copy(status = "verified", eligibleForReview = true)),
                        reviewToken = "c".repeat(64),
                    )
                "c".repeat(64)
            }
            c.verify()
            coVerify(exactly = 1) { access.verify("upload", token, "d".repeat(64)) }
            assertNull(c.state.value.preview)
            assertTrue(c.state.value.notice!!.contains("separate decision"))
        }

    @Test fun unknown_verification_preserves_original_receipt_for_retry() =
        runTest {
            val c = controller()
            inspected(c)
            val decisions = mutableListOf<Triple<String, String, String>>()
            coEvery { access.verify(any(), any(), any()) } answers {
                decisions += Triple(firstArg(), secondArg(), thirdArg())
                if (decisions.size == 1) throw NetworkError.Transport(java.io.IOException("lost reply"))
                coEvery {
                    access.list()
                } returns
                    list.copy(
                        reviewToken = "c".repeat(64),
                        evidence = listOf(record.copy(status = "verified", eligibleForReview = true)),
                    )
                "c".repeat(64)
            }
            c.verify()
            assertTrue(c.state.value.retryVerification)
            c.reload()
            c.closePreview()
            assertNull(c.state.value.preview)
            assertTrue(c.state.value.documents.isEmpty())
            c.verify()
            assertEquals(2, decisions.size)
            assertEquals(decisions[0], decisions[1])
            assertFalse(c.state.value.retryVerification)
        }

    @Test fun duplicate_open_in_same_turn_has_one_download() =
        runTest {
            val response = CompletableDeferred<HomeEvidenceBytes>()
            coEvery { access.read(any(), any()) } coAnswers { response.await() }
            val c = controller()
            c.open(record)
            c.open(record)
            coVerify(exactly = 1) { access.read(any(), any()) }
            response.complete(HomeEvidenceBytes(byteArrayOf(1, 2, 3), "text/plain", "d".repeat(64)))
        }

    @Test fun duplicate_verify_in_same_turn_has_one_decision() =
        runTest {
            val response = CompletableDeferred<String>()
            coEvery { access.verify(any(), any(), any()) } coAnswers { response.await() }
            val c = controller()
            inspected(c)
            c.verify()
            c.verify()
            coVerify(exactly = 1) { access.verify(any(), any(), any()) }
            c.close()
        }

    @Test fun claimant_read_never_mints_inspection_or_exposes_verify() =
        runTest {
            val c = controller(true)
            c.open(record)
            c.previewDisplayed(requireNotNull(c.state.value.preview))
            c.verify()
            assertFalse(c.state.value.canVerify)
            coVerify { access.read("upload", null) }
            coVerify(exactly = 0) { access.verify(any(), any(), any()) }
        }

    @Test fun verified_document_opens_without_new_inspection() =
        runTest {
            val verified = record.copy(status = "verified", eligibleForReview = true)
            coEvery { access.list() } returns list.copy(evidence = listOf(verified))
            val c = controller()
            c.open(verified)
            coVerify { access.read("upload", null) }
            assertNull(c.state.value.preview?.reviewToken)
        }

    @Test fun reviewer_cannot_remove_even_pending_document() =
        runTest {
            val c = controller()
            c.remove(record)
            coVerify(exactly = 0) { access.remove(any()) }
        }

    @Test fun claimant_cannot_remove_verified_document() =
        runTest {
            val verified = record.copy(status = "verified", eligibleForReview = true)
            coEvery { access.list() } returns list.copy(evidence = listOf(verified))
            val c = controller(true)
            c.remove(verified)
            coVerify(exactly = 0) { access.remove(any()) }
        }

    @Test fun failed_removal_remains_retryable_with_exact_document() =
        runTest {
            coEvery { access.remove("upload") } throws NetworkError.Server(503, null)
            val c = controller(true)
            c.remove(record)
            assertNotNull(c.state.value.error)
            assertTrue(c.state.value.documents.isEmpty())
            c.reload()
            c.remove(record)
            coVerify(exactly = 2) { access.remove("upload") }
        }

    @Test fun completed_cleanup_cannot_be_requested_again() =
        runTest {
            val retired = record.copy(state = "retired", available = false, cleanupPending = false)
            coEvery { access.list() } returns list.copy(evidence = listOf(retired))
            val c = controller(true)
            c.remove(retired)
            coVerify(exactly = 0) { access.remove(any()) }
        }

    @Test fun retired_pending_cleanup_retries_exact_document_once() =
        runTest {
            val retired = record.copy(state = "retired", available = false, cleanupPending = true)
            coEvery { access.list() } returns list.copy(evidence = listOf(retired))
            coEvery { access.remove("upload") } answers {
                val clean = retired.copy(cleanupPending = false)
                coEvery { access.list() } returns list.copy(evidence = listOf(clean))
                clean
            }
            val c = controller(true)
            c.remove(retired)
            val current = c.state.value.documents.single()
            assertFalse(current.cleanupPending)
            c.remove(current)
            coVerify(exactly = 1) { access.remove("upload") }
        }

    @Test fun late_download_after_identity_change_is_wiped_and_hidden() =
        runTest {
            val bytes = byteArrayOf(1, 2, 3)
            coEvery { access.read(any(), any()) } answers {
                current = false
                HomeEvidenceBytes(bytes, "text/plain", null)
            }
            val c = controller()
            c.open(record)
            assertNull(c.state.value.preview)
            assertTrue(bytes.all { it == 0.toByte() })
            assertTrue(c.state.value.documents.isEmpty())
        }

    @Test fun session_notification_retires_already_rendered_bytes() =
        runTest {
            val c = controller()
            inspected(c)
            val bytes = c.state.value.preview!!.content.bytes
            current = false
            invalidated.value = true
            assertTrue(bytes.all { it == 0.toByte() })
            assertNull(c.state.value.preview)
        }

    @Test fun closing_panel_retires_preview_and_all_callbacks() =
        runTest {
            val c = controller()
            inspected(c)
            val bytes = c.state.value.preview!!.content.bytes
            c.close()
            c.verify()
            c.open(record)
            assertTrue(bytes.all { it == 0.toByte() })
            assertNull(c.state.value.preview)
            coVerify(exactly = 0) { access.verify(any(), any(), any()) }
        }

    @Test fun changed_initial_claim_snapshot_cannot_open_old_review() =
        runTest {
            coEvery { access.list() } returns list.copy(reviewToken = "c".repeat(64))
            val c = controller()
            assertNotNull(c.state.value.error)
            assertTrue(c.state.value.documents.isEmpty())
        }

    @Test fun revoked_access_after_open_clears_preview_and_metadata_on_reload() =
        runTest {
            val c = controller()
            inspected(c)
            val bytes = c.state.value.preview!!.content.bytes
            coEvery { access.list() } throws NetworkError.Forbidden
            c.reload()
            assertTrue(bytes.all { it == 0.toByte() })
            assertNull(c.state.value.preview)
            assertTrue(c.state.value.documents.isEmpty())
            assertFalse(c.state.value.canVerify)
        }

    @Test fun reload_transport_failure_also_hides_prior_authorized_bytes() =
        runTest {
            val c = controller()
            inspected(c)
            val bytes = c.state.value.preview!!.content.bytes
            coEvery { access.list() } throws NetworkError.Transport(java.io.IOException("offline"))
            c.reload()
            assertTrue(bytes.all { it == 0.toByte() })
            assertTrue(c.state.value.documents.isEmpty())
        }

    @Test fun unknown_verification_failure_retains_only_receipt_not_bytes_or_metadata() =
        runTest {
            val c = controller()
            inspected(c)
            val bytes = c.state.value.preview!!.content.bytes
            coEvery { access.verify(any(), any(), any()) } throws NetworkError.Server(503, null)
            c.verify()
            assertTrue(c.state.value.retryVerification)
            assertTrue(bytes.all { it == 0.toByte() })
            assertNull(c.state.value.preview)
            assertTrue(c.state.value.documents.isEmpty())
            c.verify()
            coVerify(exactly = 2) { access.verify("upload", token, "d".repeat(64)) }
        }

    @Test fun final_verification_denial_drops_pending_receipt_and_cached_documents() =
        runTest {
            val c = controller()
            inspected(c)
            coEvery { access.verify(any(), any(), any()) } throws NetworkError.Forbidden
            c.verify()
            assertFalse(c.state.value.retryVerification)
            assertTrue(c.state.value.documents.isEmpty())
            assertNull(c.state.value.preview)
            c.verify()
            coVerify(exactly = 1) { access.verify(any(), any(), any()) }
        }

    @Test fun unknown_verification_survives_timeout_or_rate_limit_then_replays_exact_receipt() =
        runTest {
            for (status in listOf(408, 429)) {
                coEvery { access.list() } returns list
                val c = controller()
                inspected(c)
                coEvery { access.verify("upload", token, "d".repeat(64)) } throws NetworkError.Server(503, null)
                c.verify()
                coEvery { access.verify("upload", token, "d".repeat(64)) } throws NetworkError.ClientError(status, null)
                c.verify()
                assertTrue(c.state.value.retryVerification)
                assertTrue(c.state.value.documents.isEmpty())
                assertNull(c.state.value.preview)
                coEvery { access.verify("upload", token, "d".repeat(64)) } answers {
                    coEvery { access.list() } returns list.copy(reviewToken = "e".repeat(64))
                    "e".repeat(64)
                }
                c.verify()
                assertFalse(c.state.value.retryVerification)
                assertTrue(c.state.value.notice!!.contains("verified"))
                c.close()
            }
            coVerify(exactly = 6) { access.verify("upload", token, "d".repeat(64)) }
        }

    @Test fun unconfirmed_response_shape_keeps_only_original_verification_receipt() =
        runTest {
            val c = controller()
            inspected(c)
            coEvery { access.verify(any(), any(), any()) } throws IllegalStateException("Unconfirmed verification response")
            c.verify()
            assertTrue(c.state.value.retryVerification)
            assertNull(c.state.value.preview)
            c.verify()
            coVerify(exactly = 2) { access.verify("upload", token, "d".repeat(64)) }
        }
}
