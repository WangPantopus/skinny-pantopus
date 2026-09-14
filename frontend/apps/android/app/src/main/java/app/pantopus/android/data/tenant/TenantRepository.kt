package app.pantopus.android.data.tenant

import app.pantopus.android.data.api.models.tenant.TenantHomeStatusResponse
import app.pantopus.android.data.api.models.tenant.TenantMoveOutRequest
import app.pantopus.android.data.api.models.tenant.TenantMoveOutResponse
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.TenantApi
import com.squareup.moshi.JsonDataException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
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
    }
