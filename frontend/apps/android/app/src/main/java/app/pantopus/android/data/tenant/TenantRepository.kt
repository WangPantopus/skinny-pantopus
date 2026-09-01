package app.pantopus.android.data.tenant

import app.pantopus.android.data.api.models.tenant.TenantMoveOutRequest
import app.pantopus.android.data.api.models.tenant.TenantMoveOutResponse
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.TenantApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [TenantApi] in the typed [NetworkResult] taxonomy. */
@Singleton
class TenantRepository
    @Inject
    constructor(
        private val api: TenantApi,
    ) {
        /** `POST /api/v1/tenant/request-approval`. */
        suspend fun requestApproval(body: TenantRequestApprovalRequest): NetworkResult<TenantRequestApprovalResponse> =
            safeApiCall { api.requestApproval(body) }

        /** `POST /api/v1/tenant/move-out`. */
        suspend fun moveOut(
            leaseId: String,
            reason: String? = null,
        ): NetworkResult<TenantMoveOutResponse> = safeApiCall { api.moveOut(TenantMoveOutRequest(leaseId, reason)) }
    }
