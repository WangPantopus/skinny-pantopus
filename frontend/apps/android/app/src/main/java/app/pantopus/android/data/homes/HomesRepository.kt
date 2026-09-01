package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CastVoteRequest
import app.pantopus.android.data.api.models.homes.CastVoteResponse
import app.pantopus.android.data.api.models.homes.CheckAddressRequest
import app.pantopus.android.data.api.models.homes.CreateAccessSecretRequest
import app.pantopus.android.data.api.models.homes.CreateBillRequest
import app.pantopus.android.data.api.models.homes.CreateDocumentRequest
import app.pantopus.android.data.api.models.homes.CreateDocumentResponse
import app.pantopus.android.data.api.models.homes.CreateEmergencyRequest
import app.pantopus.android.data.api.models.homes.CreateEmergencyResponse
import app.pantopus.android.data.api.models.homes.CreateHomeEventRequest
import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.CreateMaintenanceRequest
import app.pantopus.android.data.api.models.homes.CreatePackageRequest
import app.pantopus.android.data.api.models.homes.CreatePollRequest
import app.pantopus.android.data.api.models.homes.DeleteOwnershipClaimResponse
import app.pantopus.android.data.api.models.homes.FileUploadResponse
import app.pantopus.android.data.api.models.homes.GetBillSplitsResponse
import app.pantopus.android.data.api.models.homes.GetHomeBillsResponse
import app.pantopus.android.data.api.models.homes.GetHomeDocumentsResponse
import app.pantopus.android.data.api.models.homes.GetHomeEmergenciesResponse
import app.pantopus.android.data.api.models.homes.GetHomeEventsResponse
import app.pantopus.android.data.api.models.homes.GetHomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.GetHomePackagesResponse
import app.pantopus.android.data.api.models.homes.GetHomePollsResponse
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeAccessSecretResponse
import app.pantopus.android.data.api.models.homes.HomeAccessSecretsResponse
import app.pantopus.android.data.api.models.homes.HomeBillResponse
import app.pantopus.android.data.api.models.homes.HomeEventDetailResponse
import app.pantopus.android.data.api.models.homes.HomeEventResponse
import app.pantopus.android.data.api.models.homes.HomeEventRsvpRequest
import app.pantopus.android.data.api.models.homes.HomeEventRsvpResponse
import app.pantopus.android.data.api.models.homes.HomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.HomePackageResponse
import app.pantopus.android.data.api.models.homes.HomePollResponse
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.InviteOwnerRequest
import app.pantopus.android.data.api.models.homes.MoveOutResponse
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.MyOwnershipClaimsResponse
import app.pantopus.android.data.api.models.homes.PropertySuggestionsRequest
import app.pantopus.android.data.api.models.homes.SubmitClaimRequest
import app.pantopus.android.data.api.models.homes.SubmitClaimResponse
import app.pantopus.android.data.api.models.homes.UpdateAccessSecretRequest
import app.pantopus.android.data.api.models.homes.UpdateBillRequest
import app.pantopus.android.data.api.models.homes.UpdateHomeEventRequest
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.UpdateMaintenanceRequest
import app.pantopus.android.data.api.models.homes.UpdatePackageRequest
import app.pantopus.android.data.api.models.homes.UpdatePollRequest
import app.pantopus.android.data.api.models.homes.UploadEvidenceRequest
import app.pantopus.android.data.api.models.homes.UploadEvidenceResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.FilesApi
import app.pantopus.android.data.api.services.HomeTasksApi
import app.pantopus.android.data.api.services.HomesApi
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [HomesApi] that returns the typed [NetworkResult]
 * taxonomy. ViewModels depend on this rather than Retrofit directly so
 * they can expose a single error surface to the UI.
 */
@Singleton
@Suppress("TooManyFunctions")
open class HomesRepository
    @Inject
    constructor(
        private val api: HomesApi,
        private val tasksApi: HomeTasksApi,
        private val filesApi: FilesApi,
    ) {
        /** `GET /api/homes/my-homes`. */
        open suspend fun myHomes(): NetworkResult<MyHomesResponse> = safeApiCall { api.myHomes() }

        /** `GET /api/homes/:id`. */
        open suspend fun detail(id: String) = safeApiCall { api.detail(id) }

        /** `GET /api/homes/:id/public-profile`. */
        open suspend fun publicProfile(id: String) = safeApiCall { api.publicProfile(id) }

        /** `GET /api/homes/:id/property-details`. */
        open suspend fun propertyDetails(id: String) = safeApiCall { api.propertyDetails(id) }

        /** `POST /api/homes/property-suggestions`. */
        open suspend fun propertySuggestions(request: PropertySuggestionsRequest) = safeApiCall { api.propertySuggestions(request) }

        /** `POST /api/homes/check-address`. */
        open suspend fun checkAddress(request: CheckAddressRequest) = safeApiCall { api.checkAddress(request) }

        /** `POST /api/homes`. */
        open suspend fun create(request: CreateHomeRequest) = safeApiCall { api.create(request) }

        /** `POST /api/homes/:id/owners/invite`. */
        open suspend fun inviteOwner(
            homeId: String,
            request: InviteOwnerRequest,
        ) = safeApiCall { api.inviteOwner(homeId, request) }

        /** `POST /api/homes/:id/ownership-claims`. */
        open suspend fun submitClaim(
            homeId: String,
            request: SubmitClaimRequest,
        ): NetworkResult<SubmitClaimResponse> = safeApiCall { api.submitClaim(homeId, request) }

        /** `POST /api/homes/:id/ownership-claims/:claimId/evidence`. */
        open suspend fun uploadEvidence(
            homeId: String,
            claimId: String,
            request: UploadEvidenceRequest,
        ): NetworkResult<UploadEvidenceResponse> = safeApiCall { api.uploadEvidence(homeId, claimId, request) }

        /** `GET /api/homes/my-ownership-claims`. */
        open suspend fun myOwnershipClaims(): NetworkResult<MyOwnershipClaimsResponse> = safeApiCall { api.myOwnershipClaims() }

        /** `POST /api/homes/:id/move-out`. */
        open suspend fun moveOut(homeId: String): NetworkResult<MoveOutResponse> = safeApiCall { api.moveOut(homeId) }

        /** `DELETE /api/homes/:id/ownership-claims/:claimId`. */
        open suspend fun deleteOwnershipClaim(
            homeId: String,
            claimId: String,
        ): NetworkResult<DeleteOwnershipClaimResponse> = safeApiCall { api.deleteOwnershipClaim(homeId, claimId) }

        /** `GET /api/homes/:id/bills`. */
        open suspend fun getHomeBills(
            homeId: String,
            status: String? = null,
        ): NetworkResult<GetHomeBillsResponse> = safeApiCall { api.getHomeBills(homeId, status) }

        /** `POST /api/homes/:id/bills`. */
        open suspend fun createHomeBill(
            homeId: String,
            request: CreateBillRequest,
        ): NetworkResult<HomeBillResponse> = safeApiCall { api.createHomeBill(homeId, request) }

        /** `PUT /api/homes/:id/bills/:billId`. */
        open suspend fun updateHomeBill(
            homeId: String,
            billId: String,
            request: UpdateBillRequest,
        ): NetworkResult<HomeBillResponse> = safeApiCall { api.updateHomeBill(homeId, billId, request) }

        /** `GET /api/homes/:id/bills/:billId/splits`. */
        open suspend fun getHomeBillSplits(
            homeId: String,
            billId: String,
        ): NetworkResult<GetBillSplitsResponse> = safeApiCall { api.getHomeBillSplits(homeId, billId) }

        /** `GET /api/homes/:id/events`. */
        open suspend fun getHomeEvents(
            homeId: String,
            startAfter: String? = null,
            startBefore: String? = null,
        ): NetworkResult<GetHomeEventsResponse> = safeApiCall { api.getHomeEvents(homeId, startAfter, startBefore) }

        /** `POST /api/homes/:id/events`. */
        open suspend fun createHomeEvent(
            homeId: String,
            request: CreateHomeEventRequest,
        ): NetworkResult<HomeEventResponse> = safeApiCall { api.createHomeEvent(homeId, request) }

        /** `PUT /api/homes/:id/events/:eventId`. */
        open suspend fun updateHomeEvent(
            homeId: String,
            eventId: String,
            request: UpdateHomeEventRequest,
        ): NetworkResult<HomeEventResponse> = safeApiCall { api.updateHomeEvent(homeId, eventId, request) }

        /** `DELETE /api/homes/:id/events/:eventId`. */
        open suspend fun deleteHomeEvent(
            homeId: String,
            eventId: String,
        ): NetworkResult<Unit> = safeApiCall { api.deleteHomeEvent(homeId, eventId) }

        /** `GET /api/homes/:id/events/:eventId` — event detail + RSVP attendees. */
        open suspend fun getHomeEvent(
            homeId: String,
            eventId: String,
        ): NetworkResult<HomeEventDetailResponse> = safeApiCall { api.getHomeEvent(homeId, eventId) }

        /** `POST /api/homes/:id/events/:eventId/rsvp` — upsert the caller's RSVP
         *  (`going` | `maybe` | `declined` | `pending`). */
        open suspend fun rsvpHomeEvent(
            homeId: String,
            eventId: String,
            status: String,
        ): NetworkResult<HomeEventRsvpResponse> = safeApiCall { api.rsvpHomeEvent(homeId, eventId, HomeEventRsvpRequest(status)) }
        // ─── Emergency info (T6.4b / P17) ─────────────────────────

        /** `GET /api/homes/:id/emergencies`. */
        open suspend fun getHomeEmergencies(homeId: String): NetworkResult<GetHomeEmergenciesResponse> =
            safeApiCall { api.getHomeEmergencies(homeId) }

        /** `POST /api/homes/:id/emergencies`. */
        open suspend fun createHomeEmergency(
            homeId: String,
            request: CreateEmergencyRequest,
        ): NetworkResult<CreateEmergencyResponse> = safeApiCall { api.createHomeEmergency(homeId, request) }

        // ─── Documents (T6.4b / P17) ──────────────────────────────

        /** `GET /api/homes/:id/documents`. */
        open suspend fun getHomeDocuments(homeId: String): NetworkResult<GetHomeDocumentsResponse> =
            safeApiCall { api.getHomeDocuments(homeId) }

        /** `POST /api/homes/:id/documents`. */
        open suspend fun createHomeDocument(
            homeId: String,
            request: CreateDocumentRequest,
        ): NetworkResult<CreateDocumentResponse> = safeApiCall { api.createHomeDocument(homeId, request) }

        /** `GET /api/homes/:id/packages`. */
        open suspend fun getHomePackages(
            homeId: String,
            status: String? = null,
        ): NetworkResult<GetHomePackagesResponse> = safeApiCall { api.getHomePackages(homeId, status) }

        /** `POST /api/homes/:id/packages`. */
        open suspend fun createHomePackage(
            homeId: String,
            request: CreatePackageRequest,
        ): NetworkResult<HomePackageResponse> = safeApiCall { api.createHomePackage(homeId, request) }

        /** `PUT /api/homes/:id/packages/:packageId`. */
        open suspend fun updateHomePackage(
            homeId: String,
            packageId: String,
            request: UpdatePackageRequest,
        ): NetworkResult<HomePackageResponse> = safeApiCall { api.updateHomePackage(homeId, packageId, request) }

        /** `GET /api/homes/:id/polls` (T6.3e / P13). */
        open suspend fun getHomePolls(homeId: String): NetworkResult<GetHomePollsResponse> = safeApiCall { api.getHomePolls(homeId) }

        /** `POST /api/homes/:id/polls` (T6.3e / P13). */
        open suspend fun createHomePoll(
            homeId: String,
            request: CreatePollRequest,
        ): NetworkResult<HomePollResponse> = safeApiCall { api.createHomePoll(homeId, request) }

        /** `POST /api/homes/:id/polls/:pollId/vote` (T6.3e / P13). */
        open suspend fun castHomePollVote(
            homeId: String,
            pollId: String,
            request: CastVoteRequest,
        ): NetworkResult<CastVoteResponse> = safeApiCall { api.castHomePollVote(homeId, pollId, request) }

        /** `PUT /api/homes/:id/polls/:pollId` (T6.3e / P13). */
        open suspend fun updateHomePoll(
            homeId: String,
            pollId: String,
            request: UpdatePollRequest,
        ): NetworkResult<HomePollResponse> = safeApiCall { api.updateHomePoll(homeId, pollId, request) }

        // MARK: - Household tasks (T6.3c / P11)

        /** `GET /api/homes/:id/tasks`. */
        open suspend fun getHomeTasks(homeId: String): NetworkResult<GetHomeTasksResponse> = safeApiCall { tasksApi.getHomeTasks(homeId) }

        /** `POST /api/homes/:id/tasks`. */
        open suspend fun createHomeTask(
            homeId: String,
            request: CreateHomeTaskRequest,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { tasksApi.createHomeTask(homeId, request) }

        /** `PUT /api/homes/:id/tasks/:taskId`. */
        open suspend fun updateHomeTask(
            homeId: String,
            taskId: String,
            request: UpdateHomeTaskRequest,
        ): NetworkResult<HomeTaskResponse> = safeApiCall { tasksApi.updateHomeTask(homeId, taskId, request) }

        /** `DELETE /api/homes/:id/tasks/:taskId`. */
        open suspend fun deleteHomeTask(
            homeId: String,
            taskId: String,
        ): NetworkResult<Unit> = safeApiCall { tasksApi.deleteHomeTask(homeId, taskId) }

        // ─── Access codes (T6.4a) ──────────────────────────────────

        /** `GET /api/homes/:id/access`. */
        open suspend fun getHomeAccessSecrets(homeId: String): NetworkResult<HomeAccessSecretsResponse> =
            safeApiCall { api.getHomeAccessSecrets(homeId) }

        /** `POST /api/homes/:id/access`. */
        open suspend fun createHomeAccessSecret(
            homeId: String,
            request: CreateAccessSecretRequest,
        ): NetworkResult<HomeAccessSecretResponse> = safeApiCall { api.createHomeAccessSecret(homeId, request) }

        /** `PUT /api/homes/:id/access/:secretId`. */
        open suspend fun updateHomeAccessSecret(
            homeId: String,
            secretId: String,
            request: UpdateAccessSecretRequest,
        ): NetworkResult<HomeAccessSecretResponse> = safeApiCall { api.updateHomeAccessSecret(homeId, secretId, request) }

        /** `DELETE /api/homes/:id/access/:secretId`. */
        open suspend fun deleteHomeAccessSecret(
            homeId: String,
            secretId: String,
        ): NetworkResult<Unit> = safeApiCall { api.deleteHomeAccessSecret(homeId, secretId) }

        // ─── Maintenance (T6.3b / P10) ─────────────────────────

        /** `GET /api/homes/:id/maintenance`. */
        open suspend fun getHomeMaintenance(
            homeId: String,
            status: String? = null,
        ): NetworkResult<GetHomeMaintenanceResponse> = safeApiCall { api.getHomeMaintenance(homeId, status) }

        /** `POST /api/homes/:id/maintenance`. */
        open suspend fun createHomeMaintenance(
            homeId: String,
            request: CreateMaintenanceRequest,
        ): NetworkResult<HomeMaintenanceResponse> = safeApiCall { api.createHomeMaintenance(homeId, request) }

        /** `PUT /api/homes/:id/maintenance/:taskId`. */
        open suspend fun updateHomeMaintenance(
            homeId: String,
            taskId: String,
            request: UpdateMaintenanceRequest,
        ): NetworkResult<HomeMaintenanceResponse> = safeApiCall { api.updateHomeMaintenance(homeId, taskId, request) }

        /** `DELETE /api/homes/:id/maintenance/:taskId`. */
        open suspend fun deleteHomeMaintenance(
            homeId: String,
            taskId: String,
        ): NetworkResult<Unit> =
            safeApiCall {
                val response = api.deleteHomeMaintenance(homeId, taskId)
                if (!response.isSuccessful) {
                    throw retrofit2.HttpException(response)
                }
                Unit
            }

        /**
         * Upload one binary file to `POST /api/files/upload` and return
         * the resulting URL. ViewModels pass that URL as `storage_ref`
         * on the subsequent evidence call. `fileType="claim_evidence"`
         * / `visibility="private"` keeps the artefact off public
         * surfaces.
         */
        open suspend fun uploadFile(
            filename: String,
            mimeType: String,
            bytes: ByteArray,
        ): NetworkResult<FileUploadResponse> =
            safeApiCall {
                val filePart =
                    MultipartBody.Part.createFormData(
                        name = "file",
                        filename = filename,
                        body = bytes.toRequestBody(mimeType.toMediaTypeOrNull()),
                    )
                val plain = "text/plain".toMediaTypeOrNull()
                filesApi.upload(
                    file = filePart,
                    fileType = "claim_evidence".toRequestBody(plain),
                    visibility = "private".toRequestBody(plain),
                )
            }
    }
