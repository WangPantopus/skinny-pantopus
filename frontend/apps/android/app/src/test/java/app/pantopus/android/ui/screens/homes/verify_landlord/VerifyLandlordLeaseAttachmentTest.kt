@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.verify_landlord

import app.pantopus.android.data.api.models.tenant.TenantHomeStatusResponse
import app.pantopus.android.data.api.models.tenant.TenantLeaseDto
import app.pantopus.android.data.api.models.tenant.TenantLeaseFile
import app.pantopus.android.data.api.models.tenant.TenantLeaseFileRemoval
import app.pantopus.android.data.api.models.tenant.TenantLeaseFileResponse
import app.pantopus.android.data.api.models.tenant.TenantLeaseFileSession
import app.pantopus.android.data.api.models.tenant.TenantLeaseMetadataDto
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalResponse
import app.pantopus.android.data.api.models.tenant.TenantRequestContextDto
import app.pantopus.android.data.api.services.TenantApi
import app.pantopus.android.data.tenant.TenantRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.documents.PickedFile
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okio.Buffer
import okio.ByteString.Companion.encodeUtf8
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

class VerifyLandlordLeaseAttachmentTest {
    private val home = "fa280000-0000-4000-8000-000000000001"
    private val actor = "fa280000-0000-4000-8000-000000000002"
    private val leaseId = "fa280000-0000-4000-8000-000000000003"
    private val identity = mockk<HomeClaimSessionScope>()
    private val api = mockk<TenantApi>()
    private val context = TenantRequestContextDto(home, actor, null, null)
    private val serverSession = TenantLeaseFileSession(home, actor, "a".repeat(64))
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    private lateinit var attachment: VerifyLandlordLeaseAttachment
    private var current = true
    private val selected = PickedFile("Lease-é.txt", mimeType = "text/plain", bytes = "Synthetic private lease".encodeUtf8())
    private val uploads = mutableListOf<Triple<String, String, String>>()
    private var failUpload = false
    private var returnedHome = home

    @Before fun setup() {
        every { identity.isCurrent } answers { current }
        every { identity.actorId } answers { actor.takeIf { current } }
        coEvery { identity.confirmCurrent() } answers { current }
        coEvery { api.leaseFileSession(home, any()) } answers { serverSession }
        coEvery { api.homeStatus(home) } returns TenantHomeStatusResponse(home, context, TenantHomeStatusResponse.LeaseStatus("none"))
        coEvery { api.uploadLeaseFile(home, any(), any(), any(), any()) } answers {
            assertEquals(serverSession.sessionScope, arg<String>(1))
            val id = arg<RequestBody>(2).text()
            val requestContext = arg<RequestBody>(3).text()
            val part = arg<MultipartBody.Part>(4)
            assertTrue(part.headers?.get("Content-Disposition").orEmpty().contains("filename*=UTF-8''Lease-%C3%A9.txt"))
            uploads += Triple(id, requestContext, part.body.text())
            if (failUpload) throw IOException("reply lost after reservation")
            TenantLeaseFileResponse(
                TenantLeaseFile(
                    id, returnedHome, selected.filename, selected.bytes!!.size,
                    "text/plain", available = true,
                ),
            )
        }
        coEvery { api.removeLeaseFile(home, any(), serverSession.sessionScope) } returns TenantLeaseFileRemoval(true)
        coEvery { api.requestApprovalWithLease(any(), serverSession.sessionScope) } answers {
            val request = arg<TenantRequestApprovalRequest>(0)
            assertEquals(context, request.requestContext)
            TenantRequestApprovalResponse(
                TenantLeaseDto(
                    leaseId, home, "pending",
                    metadata = TenantLeaseMetadataDto(leaseFileId = request.leaseFileId),
                ),
            )
        }
        attachment = VerifyLandlordLeaseAttachment(home, identity, TenantRepository(api), scope)
    }

    @After fun teardown() {
        attachment.clear()
        scope.cancel()
    }

    private suspend fun settle() = withContext(Dispatchers.Default) { withTimeout(5_000) { attachment.state.first { !it.busy } } }

    private suspend fun select() {
        attachment.choose()
        assertTrue(attachment.state.value.pickerOpen)
        attachment.pickerLaunched()
        attachment.receive { selected }
        settle()
    }

    @Test fun lost_upload_retries_same_selection_context_and_request_binding() =
        runBlocking {
            failUpload = true
            select()
            assertEquals("Retry attachment", attachment.state.value.retryLabel)
            assertTrue(attachment.state.value.file!!.uploadUnconfirmed)
            assertEquals(1, uploads.size)
            coVerify(exactly = 0) { api.requestApprovalWithLease(any(), any()) }
            failUpload = false
            attachment.retry()
            settle()
            assertEquals(uploads[0], uploads[1])
            val display = attachment.state.value.file!!
            assertNull(display.pageCount)
            assertNull(display.detectedOwner)
            assertFalse(display.uploadUnconfirmed)
            assertEquals("TXT", display.typeLabel)
            val result = attachment.requestApproval(TenantRequestApprovalRequest(home))
            assertEquals(uploads[0].first, result.lease.metadata?.leaseFileId)
            coVerify(exactly = 1) { api.homeStatus(home) }
            coVerify(exactly = 0) { api.requestApproval(any()) }
        }

    @Test fun lost_request_reply_preserves_original_context_and_file_on_explicit_retry() =
        runBlocking {
            select()
            var first = true
            val requests = mutableListOf<TenantRequestApprovalRequest>()
            coEvery { api.requestApprovalWithLease(any(), any()) } answers {
                val body = arg<TenantRequestApprovalRequest>(0)
                requests += body
                if (first) {
                    first = false
                    throw IOException("committed but reply lost")
                }
                TenantRequestApprovalResponse(
                    TenantLeaseDto(leaseId, home, "pending", metadata = TenantLeaseMetadataDto(leaseFileId = body.leaseFileId)),
                )
            }
            val body = TenantRequestApprovalRequest(home, startAt = "2026-09-14T00:00:00.000Z", message = "Same details")
            assertTrue(runCatching { attachment.requestApproval(body) }.isFailure)
            assertEquals(1, requests.size)
            attachment.requestApproval(body)
            assertEquals(requests[0], requests[1])
            assertEquals(context, requests[1].requestContext)
            coVerify(exactly = 1) { api.homeStatus(home) }
        }

    @Test fun unconfirmed_removal_blocks_request_and_retries_exact_file() =
        runBlocking {
            select()
            val id = attachment.uploadIdentity
            coEvery { api.removeLeaseFile(home, any(), any()) } throws IOException("lost removal reply")
            attachment.remove()
            settle()
            assertEquals("Retry removal", attachment.state.value.retryLabel)
            assertTrue(runCatching { attachment.requestApproval(TenantRequestApprovalRequest(home)) }.isFailure)
            coVerify(exactly = 0) { api.requestApprovalWithLease(any(), any()) }
            coEvery { api.removeLeaseFile(home, id!!, any()) } returns TenantLeaseFileRemoval(true)
            attachment.retry()
            settle()
            assertFalse(attachment.hasDraft)
            assertNull(attachment.state.value.file)
            coVerify(exactly = 2) { api.removeLeaseFile(home, id!!, any()) }
        }

    @Test fun closed_picker_and_empty_file_never_start_upload_or_request() =
        runBlocking {
            attachment.choose()
            attachment.retire()
            attachment.receive { error("retired picker must not read provider") }
            attachment.choose()
            attachment.receive { selected.copy(bytes = "".encodeUtf8()) }
            settle()
            assertNotNull(attachment.state.value.error)
            assertFalse(attachment.hasDraft)
            coVerify(exactly = 0) { api.leaseFileSession(any(), any()) }
            coVerify(exactly = 0) { api.requestApprovalWithLease(any(), any()) }
        }

    @Test fun account_change_before_retry_cannot_send_old_file() =
        runBlocking {
            failUpload = true
            select()
            current = false
            attachment.retry()
            settle()
            assertEquals(1, uploads.size)
            attachment.clear()
            assertFalse(attachment.hasDraft)
        }

    @Test fun wrong_receipt_or_changed_server_session_cannot_confirm_attachment() =
        runBlocking {
            returnedHome = actor
            select()
            assertNotNull(attachment.state.value.retryLabel)
            returnedHome = home
            coEvery { api.leaseFileSession(home, any()) } returns serverSession.copy(sessionScope = "b".repeat(64))
            attachment.retry()
            settle()
            assertEquals(1, uploads.size)
            assertTrue(runCatching { attachment.requestApproval(TenantRequestApprovalRequest(home)) }.isFailure)
            coVerify(exactly = 0) { api.requestApprovalWithLease(any(), any()) }
        }

    @Test fun late_upload_completion_cannot_publish_after_departure() =
        runBlocking {
            val started = CompletableDeferred<Unit>()
            val release = CompletableDeferred<TenantLeaseFileResponse>()
            coEvery { api.uploadLeaseFile(any(), any(), any(), any(), any()) } coAnswers {
                started.complete(Unit)
                withContext(NonCancellable) { release.await() }
            }
            attachment.choose()
            attachment.receive { selected }
            withTimeout(5_000) { started.await() }
            val id = attachment.uploadIdentity!!
            attachment.retire()
            release.complete(
                TenantLeaseFileResponse(TenantLeaseFile(id, home, selected.filename, selected.bytes!!.size, "text/plain", true)),
            )
            scope.coroutineContext[Job]!!.children.toList().joinAll()
            settle()
            assertEquals("Retry attachment", attachment.state.value.retryLabel)
            assertTrue(attachment.state.value.file!!.uploadUnconfirmed)
            coVerify(exactly = 0) { api.requestApprovalWithLease(any(), any()) }
        }

    private fun RequestBody.text(): String = Buffer().also { writeTo(it) }.readUtf8()
}
