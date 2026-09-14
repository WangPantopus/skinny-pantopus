package app.pantopus.android.data.tenant

import app.pantopus.android.data.api.models.tenant.LEASE_FILE_UUID
import app.pantopus.android.data.api.models.tenant.TenantHomeStatusResponse
import app.pantopus.android.data.api.models.tenant.TenantLeaseFile
import app.pantopus.android.data.api.models.tenant.TenantLeaseFileSession
import app.pantopus.android.data.api.models.tenant.TenantMoveOutRequest
import app.pantopus.android.data.api.models.tenant.TenantMoveOutResponse
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalResponse
import app.pantopus.android.data.api.models.tenant.TenantRequestContextDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.TenantApi
import app.pantopus.android.data.homes.privateEvidencePart
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.Moshi
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okio.ByteString
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [TenantApi] in the typed [NetworkResult] taxonomy. */
@Singleton
class TenantRepository
    @Inject
    constructor(
        private val api: TenantApi,
    ) {
        suspend fun homeStatus(homeId: String): NetworkResult<TenantHomeStatusResponse> = safeApiCall { api.homeStatus(homeId) }

        /** `POST /api/v1/tenant/request-approval`. */
        suspend fun requestApproval(
            body: TenantRequestApprovalRequest,
            requireCurrentSession: suspend () -> Unit = {},
        ): NetworkResult<TenantRequestApprovalResponse> =
            safeApiCall {
                requireCurrentSession()
                val status = api.homeStatus(body.homeId)
                val context = status.requestContext
                if (!status.matches(body.homeId)) {
                    throw JsonDataException("Could not confirm this Home's lease status")
                }
                currentCoroutineContext().ensureActive()
                requireCurrentSession()
                api.requestApproval(body.copy(requestContext = context))
            }

        /** `POST /api/v1/tenant/move-out`. */
        suspend fun moveOut(
            leaseId: String,
            reason: String? = null,
        ): NetworkResult<TenantMoveOutResponse> = safeApiCall { api.moveOut(TenantMoveOutRequest(leaseId, reason)) }

        suspend fun leaseFileSession(
            homeId: String,
            expected: String?,
        ) = safeApiCall { api.leaseFileSession(homeId, expected) }

        suspend fun uploadLeaseFile(
            session: TenantLeaseFileSession,
            uploadId: String,
            context: TenantRequestContextDto,
            filename: String,
            mimeType: String,
            bytes: ByteString,
        ) = safeApiCall {
            require(session.matches(context.homeId, context.actorId) && LEASE_FILE_UUID.matches(uploadId))
            require(mimeType in TenantLeaseFile.ALLOWED_MIMES && bytes.size in 1..TenantLeaseFile.MAX_BYTES)
            api.uploadLeaseFile(
                session.homeId,
                session.sessionScope,
                uploadId.toRequestBody("text/plain".toMediaType()),
                Moshi.Builder().build().adapter(TenantRequestContextDto::class.java).toJson(context)
                    .toRequestBody("application/json".toMediaType()),
                privateEvidencePart(filename, mimeType, bytes.toByteArray()),
            )
        }

        suspend fun removeLeaseFile(
            session: TenantLeaseFileSession,
            fileId: String,
        ) = safeApiCall { api.removeLeaseFile(session.homeId, fileId, session.sessionScope) }

        /** Preserve the attachment's original observed context across a lost request reply. */
        suspend fun requestApprovalWithLease(
            body: TenantRequestApprovalRequest,
            session: TenantLeaseFileSession,
            requireCurrentSession: suspend () -> Unit,
        ) = safeApiCall {
            requireCurrentSession()
            val context = requireNotNull(body.requestContext)
            require(session.matches(body.homeId, context.actorId) && context.homeId == body.homeId)
            require(LEASE_FILE_UUID.matches(body.leaseFileId.orEmpty()))
            api.requestApprovalWithLease(body, session.sessionScope)
        }
    }
