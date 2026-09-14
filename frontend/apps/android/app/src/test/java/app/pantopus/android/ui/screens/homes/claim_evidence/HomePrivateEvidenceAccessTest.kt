@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.claim_evidence

import app.pantopus.android.data.api.models.homes.HomeEvidenceSessionDto
import app.pantopus.android.data.api.models.homes.HomeEvidenceVerifyReceipt
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceDto
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceList
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeEvidenceBytes
import app.pantopus.android.data.homes.HomePrivateEvidenceRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimScopeTestFixture
import app.pantopus.android.ui.screens.homes.claim_review.claimScopeFactory
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomePrivateEvidenceAccessTest {
    private val repository = mockk<HomePrivateEvidenceRepository>()
    private val identity = HomeClaimScopeTestFixture()
    private lateinit var scope: CoroutineScope
    private lateinit var access: HomePrivateEvidenceAccess
    private val server = HomeEvidenceSessionDto("user-1", "a".repeat(64), "home", "claim")
    private val record =
        HomePrivateEvidenceDto("upload", "home", "claim", "lease", "lease.txt", 3, "text/plain", "pending", "ready", true, false)
    private val list = HomePrivateEvidenceList(listOf(record), server, true, "b".repeat(64))

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        access = HomePrivateEvidenceAccess(claimScopeFactory(identity).create(scope), repository, "home", "claim", false)
        coEvery { repository.list("home", "claim", any(), false) } returns NetworkResult.Success(list)
    }

    @After fun teardown() {
        scope.cancel()
        Dispatchers.resetMain()
    }

    private suspend fun denied(action: suspend () -> Unit) {
        var caught: IllegalStateException? = null
        try {
            action()
        } catch (e: IllegalStateException) {
            caught = e
        }
        assertNotNull(caught)
    }

    @Test fun first_list_binds_exact_actor_home_claim_and_server_scope() =
        runTest {
            assertEquals(list, access.list())
            access.list()
            coVerify { repository.list("home", "claim", null, false) }
            coVerify { repository.list("home", "claim", server.sessionScope, false) }
        }

    @Test fun delayed_first_scope_cannot_bind_after_stored_session_replacement() =
        runTest {
            coEvery { repository.list(any(), any(), any(), any()) } answers {
                identity.storedToken = "replacement"
                NetworkResult.Success(list)
            }
            denied { access.list() }
        }

    @Test fun another_actor_or_home_or_claim_cannot_bind_first_response() =
        runTest {
            for (wrong in listOf(
                server.copy(actorId = "other"),
                server.copy(homeId = "other"),
                server.copy(claimId = "other"),
                server.copy(sessionScope = "bad"),
            )) {
                coEvery { repository.list(any(), any(), any(), any()) } returns NetworkResult.Success(list.copy(claimSession = wrong))
                denied { access.list() }
            }
        }

    @Test fun later_server_session_drift_fails_without_adopting_new_fingerprint() =
        runTest {
            access.list()
            coEvery {
                repository.list(any(), any(), any(), any())
            } returns NetworkResult.Success(list.copy(claimSession = server.copy(sessionScope = "c".repeat(64))))
            denied { access.list() }
        }

    @Test fun foreign_record_projection_is_rejected() =
        runTest {
            coEvery {
                repository.list(any(), any(), any(), any())
            } returns NetworkResult.Success(list.copy(evidence = listOf(record.copy(claimId = "other"))))
            denied { access.list() }
        }

    @Test fun exact_pending_bytes_are_returned_after_current_read_recheck() =
        runTest {
            val bytes = byteArrayOf(1, 2, 3)
            coEvery { repository.download(server, "upload", false, null) } returns
                NetworkResult.Success(HomeEvidenceBytes(bytes, "text/plain", null))
            assertSame(bytes, access.read("upload").bytes)
            coVerify(exactly = 2) { repository.list("home", "claim", any(), false) }
        }

    @Test fun late_bytes_after_stored_session_replacement_are_zeroed() =
        runTest {
            val bytes = byteArrayOf(1, 2, 3)
            coEvery { repository.download(any(), any(), any(), any()) } answers {
                identity.storedToken = "replacement"
                NetworkResult.Success(HomeEvidenceBytes(bytes, "text/plain", null))
            }
            denied { access.read("upload") }
            assertArrayEquals(byteArrayOf(0, 0, 0), bytes)
        }

    @Test fun wrong_size_or_mime_never_leaves_access_boundary() =
        runTest {
            for (content in listOf(
                HomeEvidenceBytes(byteArrayOf(1), "text/plain", null),
                HomeEvidenceBytes(byteArrayOf(1, 2, 3), "image/png", null),
            )) {
                coEvery { repository.download(any(), any(), any(), any()) } returns NetworkResult.Success(content)
                denied { access.read("upload") }
                assertTrue(content.bytes.all { it == 0.toByte() })
            }
        }

    @Test fun retired_record_cannot_download() =
        runTest {
            coEvery {
                repository.list(any(), any(), any(), any())
            } returns NetworkResult.Success(list.copy(evidence = listOf(record.copy(state = "retired", available = false))))
            denied { access.read("upload") }
            coVerify(exactly = 0) { repository.download(any(), any(), any(), any()) }
        }

    @Test fun retirement_during_download_denies_and_wipes_returned_bytes() =
        runTest {
            val bytes = byteArrayOf(1, 2, 3)
            coEvery { repository.download(server, "upload", false, null) } answers {
                coEvery { repository.list("home", "claim", any(), false) } returns
                    NetworkResult.Success(list.copy(evidence = listOf(record.copy(state = "retired", available = false))))
                NetworkResult.Success(HomeEvidenceBytes(bytes, "text/plain", null))
            }
            denied { access.read("upload") }
            assertArrayEquals(byteArrayOf(0, 0, 0), bytes)
            coVerify(exactly = 2) { repository.list("home", "claim", any(), false) }
        }

    @Test fun changed_review_token_cannot_inspect() =
        runTest {
            denied { access.read("upload", "c".repeat(64)) }
            coVerify(exactly = 0) { repository.download(any(), any(), any(), any()) }
        }

    @Test fun inspection_requires_exact_current_snapshot_and_receipt() =
        runTest {
            coEvery {
                repository.download(server, "upload", false, list.reviewToken)
            } returns NetworkResult.Success(HomeEvidenceBytes(byteArrayOf(1, 2, 3), "text/plain", "d".repeat(64)))
            assertEquals("d".repeat(64), access.read("upload", list.reviewToken).inspection)
        }

    @Test fun lost_inspection_header_does_not_return_bytes() =
        runTest {
            val bytes = byteArrayOf(1, 2, 3)
            coEvery { repository.download(any(), any(), any(), any()) } returns
                NetworkResult.Success(HomeEvidenceBytes(bytes, "text/plain", null))
            denied { access.read("upload", list.reviewToken) }
            assertTrue(bytes.all { it == 0.toByte() })
        }

    @Test fun exact_verification_receipt_is_checked_against_current_list() =
        runTest {
            val verified = record.copy(status = "verified", eligibleForReview = true)
            val next = "c".repeat(64)
            coEvery { repository.verify(server, "upload", false, list.reviewToken!!, "d".repeat(64)) } answers {
                coEvery {
                    repository.list(any(), any(), any(), any())
                } returns NetworkResult.Success(list.copy(evidence = listOf(verified), reviewToken = next))
                NetworkResult.Success(HomeEvidenceVerifyReceipt(true, "home", "claim", "upload", "verify_evidence", next, verified, true))
            }
            assertEquals(next, access.verify("upload", list.reviewToken!!, "d".repeat(64)))
        }

    @Test fun foreign_success_receipt_does_not_confirm_verification() =
        runTest {
            coEvery {
                repository.verify(any(), any(), any(), any(), any())
            } returns
                NetworkResult.Success(
                    HomeEvidenceVerifyReceipt(
                        true, "other", "claim", "upload", "verify_evidence", "c".repeat(64),
                        record.copy(status = "verified", eligibleForReview = true), false,
                    ),
                )
            denied { access.verify("upload", list.reviewToken!!, "d".repeat(64)) }
        }

    @Test fun reopened_withdrawn_claim_discovers_current_pending_evidence_then_retires_exact_id() =
        runTest {
            coEvery {
                repository.remove(server, "upload")
            } returns NetworkResult.Success(HomePrivateEvidenceResponse(record.copy(state = "retired", available = false)))
            assertEquals("upload", access.list().evidence.single().id)
            assertEquals("retired", access.remove("upload").state)
            coVerify(exactly = 1) { repository.remove(server, "upload") }
        }

    @Test fun invalid_removal_receipt_keeps_cleanup_unconfirmed() =
        runTest {
            coEvery { repository.remove(any(), any()) } returns NetworkResult.Success(HomePrivateEvidenceResponse(record))
            denied { access.remove("upload") }
        }

    @Test fun auth_denial_prevents_provider_download() =
        runTest {
            coEvery { repository.list(any(), any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
            try {
                access.read("upload")
                fail("must deny")
            } catch (error: NetworkError) {
                assertEquals(403, error.code)
            }
            coVerify(exactly = 0) { repository.download(any(), any(), any(), any()) }
        }
}
