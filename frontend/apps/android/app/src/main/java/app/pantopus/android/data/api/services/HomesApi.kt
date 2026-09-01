package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.CastVoteRequest
import app.pantopus.android.data.api.models.homes.CastVoteResponse
import app.pantopus.android.data.api.models.homes.CheckAddressRequest
import app.pantopus.android.data.api.models.homes.CheckAddressResponse
import app.pantopus.android.data.api.models.homes.CreateAccessSecretRequest
import app.pantopus.android.data.api.models.homes.CreateBillRequest
import app.pantopus.android.data.api.models.homes.CreateDocumentRequest
import app.pantopus.android.data.api.models.homes.CreateDocumentResponse
import app.pantopus.android.data.api.models.homes.CreateEmergencyRequest
import app.pantopus.android.data.api.models.homes.CreateEmergencyResponse
import app.pantopus.android.data.api.models.homes.CreateHomeEventRequest
import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.api.models.homes.CreateHomeResponse
import app.pantopus.android.data.api.models.homes.CreateMaintenanceRequest
import app.pantopus.android.data.api.models.homes.CreatePackageRequest
import app.pantopus.android.data.api.models.homes.CreatePollRequest
import app.pantopus.android.data.api.models.homes.DeleteOwnershipClaimResponse
import app.pantopus.android.data.api.models.homes.GetBillSplitsResponse
import app.pantopus.android.data.api.models.homes.GetHomeBillsResponse
import app.pantopus.android.data.api.models.homes.GetHomeDocumentsResponse
import app.pantopus.android.data.api.models.homes.GetHomeEmergenciesResponse
import app.pantopus.android.data.api.models.homes.GetHomeEventsResponse
import app.pantopus.android.data.api.models.homes.GetHomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.GetHomePackagesResponse
import app.pantopus.android.data.api.models.homes.GetHomePollsResponse
import app.pantopus.android.data.api.models.homes.HomeAccessSecretResponse
import app.pantopus.android.data.api.models.homes.HomeAccessSecretsResponse
import app.pantopus.android.data.api.models.homes.HomeBillResponse
import app.pantopus.android.data.api.models.homes.HomeDetailResponse
import app.pantopus.android.data.api.models.homes.HomeEventDetailResponse
import app.pantopus.android.data.api.models.homes.HomeEventResponse
import app.pantopus.android.data.api.models.homes.HomeEventRsvpRequest
import app.pantopus.android.data.api.models.homes.HomeEventRsvpResponse
import app.pantopus.android.data.api.models.homes.HomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.HomePackageResponse
import app.pantopus.android.data.api.models.homes.HomePollResponse
import app.pantopus.android.data.api.models.homes.HomePublicProfileResponse
import app.pantopus.android.data.api.models.homes.InviteOwnerRequest
import app.pantopus.android.data.api.models.homes.InviteOwnerResponse
import app.pantopus.android.data.api.models.homes.MoveOutResponse
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.MyOwnershipClaimsResponse
import app.pantopus.android.data.api.models.homes.OwnersResponse
import app.pantopus.android.data.api.models.homes.PropertyDetailsResponse
import app.pantopus.android.data.api.models.homes.PropertySuggestionsRequest
import app.pantopus.android.data.api.models.homes.PropertySuggestionsResponse
import app.pantopus.android.data.api.models.homes.RemoveOwnerResponse
import app.pantopus.android.data.api.models.homes.SubmitClaimRequest
import app.pantopus.android.data.api.models.homes.SubmitClaimResponse
import app.pantopus.android.data.api.models.homes.TransferOwnerRequest
import app.pantopus.android.data.api.models.homes.TransferOwnerResponse
import app.pantopus.android.data.api.models.homes.UpdateAccessSecretRequest
import app.pantopus.android.data.api.models.homes.UpdateBillRequest
import app.pantopus.android.data.api.models.homes.UpdateHomeEventRequest
import app.pantopus.android.data.api.models.homes.UpdateMaintenanceRequest
import app.pantopus.android.data.api.models.homes.UpdatePackageRequest
import app.pantopus.android.data.api.models.homes.UpdatePollRequest
import app.pantopus.android.data.api.models.homes.UploadEvidenceRequest
import app.pantopus.android.data.api.models.homes.UploadEvidenceResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/** Home routes from `backend/routes/home.js`. */
@Suppress("TooManyFunctions")
interface HomesApi {
    /** `GET /api/homes/my-homes` — route `backend/routes/home.js:1464`. */
    @GET("api/homes/my-homes")
    suspend fun myHomes(): MyHomesResponse

    /** `GET /api/homes/:id` — route `backend/routes/home.js:2891`. */
    @GET("api/homes/{id}")
    suspend fun detail(
        @Path("id") id: String,
    ): HomeDetailResponse

    /** `GET /api/homes/:id/public-profile` — route `backend/routes/home.js:2439`. */
    @GET("api/homes/{id}/public-profile")
    suspend fun publicProfile(
        @Path("id") id: String,
    ): HomePublicProfileResponse

    /** `GET /api/homes/:id/property-details` — route `backend/routes/home.js:2991`. */
    @GET("api/homes/{id}/property-details")
    suspend fun propertyDetails(
        @Path("id") id: String,
    ): PropertyDetailsResponse

    /** `POST /api/homes` — route `backend/routes/home.js:677`. */
    @POST("api/homes")
    suspend fun create(
        @Body body: CreateHomeRequest,
    ): CreateHomeResponse

    /**
     * `POST /api/homes/property-suggestions` — route `backend/routes/home.js:540`.
     * Tiered property hints (ATTOM → heuristics → optional LLM) that
     * pre-fill the Add-Home wizard's Details block. The nested
     * `attom_property_detail` bundle stays untyped — its shape is
     * provider-defined.
     */
    @POST("api/homes/property-suggestions")
    suspend fun propertySuggestions(
        @Body body: PropertySuggestionsRequest,
    ): PropertySuggestionsResponse

    /** `POST /api/homes/check-address` — route `backend/routes/home.js:555`. */
    @POST("api/homes/check-address")
    suspend fun checkAddress(
        @Body body: CheckAddressRequest,
    ): CheckAddressResponse

    /**
     * `POST /api/homes/:id/owners/invite` — route
     * `backend/routes/homeOwnership.js:1376`.
     */
    @POST("api/homes/{id}/owners/invite")
    suspend fun inviteOwner(
        @Path("id") homeId: String,
        @Body body: InviteOwnerRequest,
    ): InviteOwnerResponse

    /**
     * `GET /api/homes/:id/owners` — route
     * `backend/routes/homeOwnership.js:1381`. Per-home owner roster
     * with each `user`-subject owner enriched with username + display
     * name + avatar URL.
     */
    @GET("api/homes/{id}/owners")
    suspend fun listOwners(
        @Path("id") homeId: String,
    ): OwnersResponse

    /**
     * `DELETE /api/homes/:id/owners/:ownerId` — route
     * `backend/routes/homeOwnership.js:1614`. May return a quorum
     * action id when removal requires co-owner approval; the screen
     * keeps the row optimistically dropped in either case.
     */
    @DELETE("api/homes/{id}/owners/{ownerId}")
    suspend fun removeOwner(
        @Path("id") homeId: String,
        @Path("ownerId") ownerId: String,
    ): RemoveOwnerResponse

    /**
     * `POST /api/homes/:id/owners/transfer` — route
     * `backend/routes/homeOwnership.js:1526`. Initiates a full
     * ownership transfer; returns a `transfer_claim_id` directly for a
     * sole owner, or a `quorum_action_id` + `required_approvals` when
     * co-owners must approve first.
     */
    @POST("api/homes/{id}/owners/transfer")
    suspend fun transferOwner(
        @Path("id") homeId: String,
        @Body body: TransferOwnerRequest,
    ): TransferOwnerResponse

    /**
     * `POST /api/homes/:id/ownership-claims` — route
     * `backend/routes/homeOwnership.js:251`.
     */
    @POST("api/homes/{id}/ownership-claims")
    suspend fun submitClaim(
        @Path("id") homeId: String,
        @Body body: SubmitClaimRequest,
    ): SubmitClaimResponse

    /**
     * `POST /api/homes/:id/ownership-claims/:claimId/evidence` — route
     * `backend/routes/homeOwnership.js:886`. Body is JSON; real bytes
     * are pushed through `/api/files/upload` first and the resulting
     * URL is sent here as `storage_ref`.
     */
    @POST("api/homes/{id}/ownership-claims/{claimId}/evidence")
    suspend fun uploadEvidence(
        @Path("id") homeId: String,
        @Path("claimId") claimId: String,
        @Body body: UploadEvidenceRequest,
    ): UploadEvidenceResponse

    /**
     * `GET /api/homes/my-ownership-claims` — route
     * `backend/routes/homeOwnership.js:217`.
     */
    @GET("api/homes/my-ownership-claims")
    suspend fun myOwnershipClaims(): MyOwnershipClaimsResponse

    /**
     * `POST /api/homes/:id/move-out` — route `backend/routes/home.js:3391`.
     * Self-initiated leave for any occupant.
     */
    @POST("api/homes/{id}/move-out")
    suspend fun moveOut(
        @Path("id") homeId: String,
    ): MoveOutResponse

    /**
     * `DELETE /api/homes/:id/ownership-claims/:claimId` — route
     * `backend/routes/homeOwnership.js:603`.
     */
    @DELETE("api/homes/{id}/ownership-claims/{claimId}")
    suspend fun deleteOwnershipClaim(
        @Path("id") homeId: String,
        @Path("claimId") claimId: String,
    ): DeleteOwnershipClaimResponse

    /** `GET /api/homes/:id/bills` — route `backend/routes/home.js:4506`. */
    @GET("api/homes/{id}/bills")
    suspend fun getHomeBills(
        @Path("id") homeId: String,
        @Query("status") status: String? = null,
    ): GetHomeBillsResponse

    /** `POST /api/homes/:id/bills` — route `backend/routes/home.js:4539`. */
    @POST("api/homes/{id}/bills")
    suspend fun createHomeBill(
        @Path("id") homeId: String,
        @Body body: CreateBillRequest,
    ): HomeBillResponse

    /** `PUT /api/homes/:id/bills/:billId` — route `backend/routes/home.js:4585`. */
    @PUT("api/homes/{id}/bills/{billId}")
    suspend fun updateHomeBill(
        @Path("id") homeId: String,
        @Path("billId") billId: String,
        @Body body: UpdateBillRequest,
    ): HomeBillResponse

    /** `GET /api/homes/:id/bills/:billId/splits` — route
     *  `backend/routes/home.js:4627`. Backend has no POST/PATCH/DELETE
     *  for splits today; the detail view treats them as read-only. */
    @GET("api/homes/{id}/bills/{billId}/splits")
    suspend fun getHomeBillSplits(
        @Path("id") homeId: String,
        @Path("billId") billId: String,
    ): GetBillSplitsResponse

    /** `GET /api/homes/:id/events` — route `backend/routes/home.js:4793`. */
    @GET("api/homes/{id}/events")
    suspend fun getHomeEvents(
        @Path("id") homeId: String,
        @Query("start_after") startAfter: String? = null,
        @Query("start_before") startBefore: String? = null,
    ): GetHomeEventsResponse

    /** `POST /api/homes/:id/events` — route `backend/routes/home.js:4827`. */
    @POST("api/homes/{id}/events")
    suspend fun createHomeEvent(
        @Path("id") homeId: String,
        @Body body: CreateHomeEventRequest,
    ): HomeEventResponse

    /** `PUT /api/homes/:id/events/:eventId` — route
     *  `backend/routes/home.js:5082`. */
    @PUT("api/homes/{id}/events/{eventId}")
    suspend fun updateHomeEvent(
        @Path("id") homeId: String,
        @Path("eventId") eventId: String,
        @Body body: UpdateHomeEventRequest,
    ): HomeEventResponse

    /** `DELETE /api/homes/:id/events/:eventId` — route
     *  `backend/routes/home.js:5120`. */
    @DELETE("api/homes/{id}/events/{eventId}")
    suspend fun deleteHomeEvent(
        @Path("id") homeId: String,
        @Path("eventId") eventId: String,
    )

    /** `GET /api/homes/:id/events/:eventId` — route
     *  `backend/routes/home.js:5205`. Event detail + per-user RSVP attendees. */
    @GET("api/homes/{id}/events/{eventId}")
    suspend fun getHomeEvent(
        @Path("id") homeId: String,
        @Path("eventId") eventId: String,
    ): HomeEventDetailResponse

    /** `POST /api/homes/:id/events/:eventId/rsvp` — route
     *  `backend/routes/home.js:5231`. Upserts the caller's RSVP. */
    @POST("api/homes/{id}/events/{eventId}/rsvp")
    suspend fun rsvpHomeEvent(
        @Path("id") homeId: String,
        @Path("eventId") eventId: String,
        @Body body: HomeEventRsvpRequest,
    ): HomeEventRsvpResponse
    // ─── Emergency info (T6.4b / P17) ─────────────────────────

    /** `GET /api/homes/:id/emergencies` — route `backend/routes/home.js:5406`. */
    @GET("api/homes/{id}/emergencies")
    suspend fun getHomeEmergencies(
        @Path("id") homeId: String,
    ): GetHomeEmergenciesResponse

    /** `POST /api/homes/:id/emergencies` — route `backend/routes/home.js:5442`. */
    @POST("api/homes/{id}/emergencies")
    suspend fun createHomeEmergency(
        @Path("id") homeId: String,
        @Body body: CreateEmergencyRequest,
    ): CreateEmergencyResponse

    // ─── Documents (T6.4b / P17) ──────────────────────────────

    /** `GET /api/homes/:id/documents` — route `backend/routes/home.js:4944`. */
    @GET("api/homes/{id}/documents")
    suspend fun getHomeDocuments(
        @Path("id") homeId: String,
    ): GetHomeDocumentsResponse

    /** `POST /api/homes/:id/documents` — route `backend/routes/home.js:4985`. */
    @POST("api/homes/{id}/documents")
    suspend fun createHomeDocument(
        @Path("id") homeId: String,
        @Body body: CreateDocumentRequest,
    ): CreateDocumentResponse

    /** `GET /api/homes/:id/packages` — route `backend/routes/home.js:4673`. */
    @GET("api/homes/{id}/packages")
    suspend fun getHomePackages(
        @Path("id") homeId: String,
        @Query("status") status: String? = null,
    ): GetHomePackagesResponse

    /** `POST /api/homes/:id/packages` — route `backend/routes/home.js:4706`. */
    @POST("api/homes/{id}/packages")
    suspend fun createHomePackage(
        @Path("id") homeId: String,
        @Body body: CreatePackageRequest,
    ): HomePackageResponse

    /** `PUT /api/homes/:id/packages/:packageId` — route
     *  `backend/routes/home.js:4746`. */
    @PUT("api/homes/{id}/packages/{packageId}")
    suspend fun updateHomePackage(
        @Path("id") homeId: String,
        @Path("packageId") packageId: String,
        @Body body: UpdatePackageRequest,
    ): HomePackageResponse

    // ─── Polls (T6.3e / P13) ─────────────────────────────────────

    /**
     * `GET /api/homes/:id/polls` — route `backend/routes/home.js:6984`.
     * The response is enriched server-side with `vote_count`,
     * `option_counts` (per-option breakdown), and `my_vote`.
     */
    @GET("api/homes/{id}/polls")
    suspend fun getHomePolls(
        @Path("id") homeId: String,
    ): GetHomePollsResponse

    /** `POST /api/homes/:id/polls` — route `backend/routes/home.js:7058`. */
    @POST("api/homes/{id}/polls")
    suspend fun createHomePoll(
        @Path("id") homeId: String,
        @Body body: CreatePollRequest,
    ): HomePollResponse

    /**
     * `POST /api/homes/:id/polls/:pollId/vote` — route
     * `backend/routes/home.js:7100`. Upserts the viewer's vote
     * (changing a vote is a re-call with new `selected_options`).
     */
    @POST("api/homes/{id}/polls/{pollId}/vote")
    suspend fun castHomePollVote(
        @Path("id") homeId: String,
        @Path("pollId") pollId: String,
        @Body body: CastVoteRequest,
    ): CastVoteResponse

    /**
     * `PUT /api/homes/:id/polls/:pollId` — route `backend/routes/home.js:7159`.
     * Used to close a poll (`status: "closed"`) or edit metadata.
     */
    @PUT("api/homes/{id}/polls/{pollId}")
    suspend fun updateHomePoll(
        @Path("id") homeId: String,
        @Path("pollId") pollId: String,
        @Body body: UpdatePollRequest,
    ): HomePollResponse

    // ─── Access codes (T6.4a) ──────────────────────────────────────

    /** `GET /api/homes/:id/access` — route `backend/routes/home.js:5487`. */
    @GET("api/homes/{id}/access")
    suspend fun getHomeAccessSecrets(
        @Path("id") homeId: String,
    ): HomeAccessSecretsResponse

    /** `POST /api/homes/:id/access` — route `backend/routes/home.js:5527`. */
    @POST("api/homes/{id}/access")
    suspend fun createHomeAccessSecret(
        @Path("id") homeId: String,
        @Body body: CreateAccessSecretRequest,
    ): HomeAccessSecretResponse

    /** `PUT /api/homes/:id/access/:secretId` — route `backend/routes/home.js:5586`. */
    @PUT("api/homes/{id}/access/{secretId}")
    suspend fun updateHomeAccessSecret(
        @Path("id") homeId: String,
        @Path("secretId") secretId: String,
        @Body body: UpdateAccessSecretRequest,
    ): HomeAccessSecretResponse

    /** `DELETE /api/homes/:id/access/:secretId` — route `backend/routes/home.js:5624`. */
    @DELETE("api/homes/{id}/access/{secretId}")
    suspend fun deleteHomeAccessSecret(
        @Path("id") homeId: String,
        @Path("secretId") secretId: String,
    )

    // ─── Maintenance (T6.3b / P10) ─────────────────────────────

    /** `GET /api/homes/:id/maintenance` — route `backend/routes/home.js`
     *  (added in T6.3b / P10). */
    @GET("api/homes/{id}/maintenance")
    suspend fun getHomeMaintenance(
        @Path("id") homeId: String,
        @Query("status") status: String? = null,
    ): GetHomeMaintenanceResponse

    /** `POST /api/homes/:id/maintenance` — route `backend/routes/home.js`. */
    @POST("api/homes/{id}/maintenance")
    suspend fun createHomeMaintenance(
        @Path("id") homeId: String,
        @Body body: CreateMaintenanceRequest,
    ): HomeMaintenanceResponse

    /** `PUT /api/homes/:id/maintenance/:taskId` — route `backend/routes/home.js`. */
    @PUT("api/homes/{id}/maintenance/{taskId}")
    suspend fun updateHomeMaintenance(
        @Path("id") homeId: String,
        @Path("taskId") taskId: String,
        @Body body: UpdateMaintenanceRequest,
    ): HomeMaintenanceResponse

    /** `DELETE /api/homes/:id/maintenance/:taskId` — route `backend/routes/home.js`. */
    @DELETE("api/homes/{id}/maintenance/{taskId}")
    suspend fun deleteHomeMaintenance(
        @Path("id") homeId: String,
        @Path("taskId") taskId: String,
    ): retrofit2.Response<Unit>
}
