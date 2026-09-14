@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.verify_landlord

import app.pantopus.android.data.api.models.tenant.LEASE_FILE_UUID
import app.pantopus.android.data.api.models.tenant.TenantLeaseFile
import app.pantopus.android.data.api.models.tenant.TenantLeaseFileSession
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalResponse
import app.pantopus.android.data.api.models.tenant.TenantRequestContextDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.tenant.TenantRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.documents.PickedFile
import app.pantopus.android.ui.screens.homes.documents.formatBytes
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.Normalizer
import java.util.UUID

/** Only display metadata enters Compose state. Selected bytes belong to this opening wizard. */
data class VerifyLandlordAttachmentState(
    val pickerOpen: Boolean = false,
    val launchPicker: Boolean = false,
    val busy: Boolean = false,
    val file: VerifyLandlordLeaseFile? = null,
    val retryLabel: String? = null,
    val error: String? = null,
)

/** Connects the existing Attach/remove controls; retries retain one immutable selection/context. */
internal class VerifyLandlordLeaseAttachment(
    private val homeId: String,
    private val session: HomeClaimSessionScope,
    private val repository: TenantRepository,
    private val scope: CoroutineScope,
) {
    private val mutable = MutableStateFlow(VerifyLandlordAttachmentState())
    val state = mutable.asStateFlow()
    private var picked: PickedFile? = null
    private var uploadId: String? = null
    private var context: TenantRequestContextDto? = null
    private var serverSession: TenantLeaseFileSession? = null
    private var receipt: TenantLeaseFile? = null
    private var removing = false
    private var generation = 0
    private var pickerGeneration: Int? = null
    private var work: Job? = null
    val hasDraft: Boolean get() = picked != null
    val uploadIdentity: String? get() = uploadId

    fun choose() {
        if (!session.isCurrent || state.value.busy) return
        if (hasDraft || state.value.pickerOpen) return
        pickerGeneration = generation
        mutable.value = state.value.copy(pickerOpen = true, launchPicker = true, error = null)
    }

    fun pickerLaunched() {
        mutable.value = state.value.copy(launchPicker = false)
    }

    fun receive(read: (() -> PickedFile)?) {
        if (pickerGeneration != generation || !session.isCurrent) return
        pickerGeneration = null
        mutable.value = state.value.copy(pickerOpen = false, launchPicker = false)
        if (read == null) return
        run { current ->
            val file = withContext(Dispatchers.IO) { read() }
            requireCurrent(current)
            select(file)
            upload(current)
        }
    }

    private fun select(file: PickedFile) {
        val bytes = requireNotNull(file.bytes)
        require(!hasDraft && bytes.size in 1..TenantLeaseFile.MAX_BYTES && file.mimeType in TenantLeaseFile.ALLOWED_MIMES)
        val name =
            Normalizer.normalize(file.filename, Normalizer.Form.NFC)
                .map { if (it.isISOControl() || it in "/\\\"") '_' else it }.joinToString("").trim()
        require(name.isNotBlank() && name.length <= TenantLeaseFile.MAX_NAME_LENGTH)
        picked = file.copy(filename = name, sizeBytes = bytes.size.toLong())
        uploadId = UUID.randomUUID().toString()
        publish()
    }

    fun retry() {
        if (removing) remove() else run { upload(it) }
    }

    fun remove() {
        if (!hasDraft || state.value.busy || !session.isCurrent) return
        removing = true
        run { current ->
            val id = requireNotNull(uploadId)
            retireFile(current, id)
            requireCurrent(current)
            clearDraft()
        }
    }

    private suspend fun retireFile(
        current: Int,
        id: String,
    ) {
        if (context == null) return
        val bound = handshake(current)
        when (val result = repository.removeLeaseFile(bound, id)) {
            is NetworkResult.Success -> check(result.data.deleted)
            is NetworkResult.Failure -> if (result.error !is NetworkError.NotFound) throw result.error
        }
    }

    fun retire() {
        generation++
        work?.cancel()
        work = null
        pickerGeneration = null
        mutable.value = state.value.copy(busy = false, pickerOpen = false, launchPicker = false)
        publish()
    }

    fun clear() {
        retire()
        clearDraft()
        serverSession = null
        mutable.value = VerifyLandlordAttachmentState()
    }

    private fun clearDraft() {
        picked = null
        uploadId = null
        context = null
        receipt = null
        removing = false
        publish()
    }

    private fun publish() {
        val file =
            picked?.let {
                VerifyLandlordLeaseFile(
                    filename = it.filename,
                    sizeLabel = formatBytes(it.bytes?.size?.toLong()).orEmpty(),
                    pageCount = null, detectedOwner = null, detectedUnit = null,
                    typeLabel =
                        when (it.mimeType) {
                            "application/pdf" -> "PDF"
                            "text/plain" -> "TXT"
                            else -> "IMG"
                        },
                    uploadStatus =
                        if (removing) {
                            if (state.value.busy) "Removing…" else "Removal unconfirmed"
                        } else if (receipt != null) {
                            "Uploaded privately"
                        } else if (state.value.busy) {
                            "Uploading…"
                        } else {
                            "Upload unconfirmed"
                        },
                    reviewNote =
                        if (receipt != null && !removing) {
                            "Shared with the verified property owner when you submit."
                        } else {
                            "Retry the attachment or remove it before submitting."
                        },
                    uploadUnconfirmed = receipt == null || removing,
                )
            }
        mutable.value =
            state.value.copy(
                file = file,
                retryLabel =
                    if (hasDraft && (receipt == null || removing)) {
                        if (removing) "Retry removal" else "Retry attachment"
                    } else {
                        null
                    },
            )
    }

    private suspend fun requireCurrent(current: Int) {
        currentCoroutineContext().ensureActive()
        check(generation == current && session.confirmCurrent() && LEASE_FILE_UUID.matches(homeId))
        currentCoroutineContext().ensureActive()
    }

    private fun run(operation: suspend (Int) -> Unit) {
        if (state.value.busy || !session.isCurrent) return
        val current = generation
        mutable.value = state.value.copy(busy = true, error = null)
        publish()
        work =
            scope.launch {
                try {
                    requireCurrent(current)
                    operation(current)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: NetworkError) {
                    failed(current)
                } catch (_: Exception) {
                    failed(current)
                } finally {
                    if (generation == current) {
                        mutable.value = state.value.copy(busy = false)
                        publish()
                    }
                }
            }
    }

    private fun failed(current: Int) {
        if (generation == current && session.isCurrent) {
            mutable.value =
                state.value.copy(
                    error =
                        if (hasDraft) {
                            "Couldn't confirm the attachment. Retry or remove it before submitting."
                        } else {
                            "Choose a readable, nonempty PDF, text file or supported image of 25 MB or less."
                        },
                )
        }
    }

    private suspend fun handshake(current: Int): TenantLeaseFileSession {
        requireCurrent(current)
        val result = repository.leaseFileSession(homeId, serverSession?.sessionScope).value()
        requireCurrent(current)
        check(
            result.matches(homeId, session.actorId.orEmpty()) &&
                (serverSession == null || result.sessionScope == serverSession?.sessionScope),
        )
        serverSession = result
        return result
    }

    private suspend fun upload(current: Int) {
        val file = requireNotNull(picked)
        val id = requireNotNull(uploadId)
        val bound = handshake(current)
        if (context == null) {
            val status = repository.homeStatus(homeId).value()
            requireCurrent(current)
            check(
                status.matches(homeId) && status.requestContext.actorId == session.actorId &&
                    status.lease?.state !in setOf("pending", "active"),
            )
            context = status.requestContext
        }
        val result =
            repository.uploadLeaseFile(
                bound,
                id,
                requireNotNull(context),
                file.filename,
                requireNotNull(file.mimeType),
                requireNotNull(file.bytes),
            ).value().file
        requireCurrent(current)
        check(
            result.matches(homeId, id) && result.fileName == file.filename && result.mimeType == file.mimeType &&
                result.fileSize == file.bytes?.size && result.leaseId == null,
        )
        receipt = result
        publish()
    }

    suspend fun requestApproval(body: TenantRequestApprovalRequest): TenantRequestApprovalResponse {
        val current = generation
        requireCurrent(current)
        val file = requireNotNull(receipt)
        check(!removing && file.id == uploadId && body.homeId == homeId)
        val bound = handshake(current)
        val result =
            repository.requestApprovalWithLease(
                body.copy(requestContext = requireNotNull(context), leaseFileId = file.id),
                bound,
            ) { requireCurrent(current) }.value()
        requireCurrent(current)
        check(
            result.lease.homeId == homeId && LEASE_FILE_UUID.matches(result.lease.id) &&
                result.lease.metadata?.leaseFileId == file.id && result.lease.state in setOf("pending", "active"),
        )
        return result
    }

    private fun <T> NetworkResult<T>.value(): T =
        when (this) {
            is NetworkResult.Success -> data
            is NetworkResult.Failure -> throw error
        }
}
