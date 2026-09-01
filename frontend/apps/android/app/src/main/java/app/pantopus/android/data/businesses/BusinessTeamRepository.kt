package app.pantopus.android.data.businesses

import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessChangeRoleRequest
import app.pantopus.android.data.api.models.businesses.BusinessMemberPermissionsResponse
import app.pantopus.android.data.api.models.businesses.BusinessRolePresetsResponse
import app.pantopus.android.data.api.models.businesses.BusinessSeatInviteRequest
import app.pantopus.android.data.api.models.businesses.BusinessSeatInviteResponse
import app.pantopus.android.data.api.models.businesses.BusinessSeatsResponse
import app.pantopus.android.data.api.models.businesses.BusinessTeamMembersResponse
import app.pantopus.android.data.api.models.businesses.BusinessTogglePermissionRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessTeamApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps the owner-side business team & roles endpoints in the
 * [NetworkResult] taxonomy. Mirrors `HomeMembersRepository`.
 */
@Singleton
open class BusinessTeamRepository
    @Inject
    constructor(
        private val api: BusinessTeamApi,
    ) {
        /** `GET /:id/me` — caller access + permissions. */
        open suspend fun access(businessId: String): NetworkResult<BusinessAccessDto> = safeApiCall { api.access(businessId) }

        /** `GET /:id/role-presets`. */
        open suspend fun rolePresets(businessId: String): NetworkResult<BusinessRolePresetsResponse> =
            safeApiCall { api.rolePresets(businessId) }

        /** `GET /:id/members`. */
        open suspend fun members(businessId: String): NetworkResult<BusinessTeamMembersResponse> = safeApiCall { api.members(businessId) }

        /** `GET /:id/seats`. */
        open suspend fun seats(businessId: String): NetworkResult<BusinessSeatsResponse> = safeApiCall { api.seats(businessId) }

        /** `POST /:id/members/:userId/role`. */
        open suspend fun changeRole(
            businessId: String,
            userId: String,
            presetKey: String,
        ): NetworkResult<Unit> = safeApiCall { api.changeRole(businessId, userId, BusinessChangeRoleRequest(presetKey)) }

        /** `DELETE /:id/members/:userId`. */
        open suspend fun removeMember(
            businessId: String,
            userId: String,
        ): NetworkResult<Unit> = safeApiCall { api.removeMember(businessId, userId) }

        /** `POST /:id/seats/invite`. */
        open suspend fun inviteSeat(
            businessId: String,
            request: BusinessSeatInviteRequest,
        ): NetworkResult<BusinessSeatInviteResponse> = safeApiCall { api.inviteSeat(businessId, request) }

        /** `DELETE /:id/seats/:seatId`. */
        open suspend fun cancelSeat(
            businessId: String,
            seatId: String,
        ): NetworkResult<Unit> = safeApiCall { api.cancelSeat(businessId, seatId) }

        /** `GET /:id/members/:userId/permissions`. */
        open suspend fun memberPermissions(
            businessId: String,
            userId: String,
        ): NetworkResult<BusinessMemberPermissionsResponse> = safeApiCall { api.memberPermissions(businessId, userId) }

        /** `POST /:id/members/:userId/permissions`. */
        open suspend fun togglePermission(
            businessId: String,
            userId: String,
            permission: String,
            allowed: Boolean,
        ): NetworkResult<Unit> =
            safeApiCall { api.togglePermission(businessId, userId, BusinessTogglePermissionRequest(permission, allowed)) }
    }
