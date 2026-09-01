//
//  HomesEndpoints.swift
//  Pantopus
//
// swiftlint:disable file_length type_body_length

import Foundation

/// Endpoint builders for `backend/routes/home.js`.
public enum HomesEndpoints {
    /// `GET /api/homes/my-homes` — route `backend/routes/home.js:1464`.
    public static func myHomes() -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/my-homes")
    }

    /// `GET /api/homes/:id` — route `backend/routes/home.js:2891`.
    public static func detail(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)")
    }

    /// `GET /api/homes/:id/property-details` — route
    /// `backend/routes/home.js:2991`. Returns the home's property fields
    /// (`home`) plus an opaque ATTOM payload + `source` /
    /// `unavailable_reason` that the Property Details screen doesn't model.
    public static func propertyDetails(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/property-details")
    }

    /// `GET /api/homes/:id/public-profile` — route `backend/routes/home.js:2439`.
    public static func publicProfile(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/public-profile")
    }

    /// `POST /api/homes` — route `backend/routes/home.js:677`.
    public static func create(_ request: CreateHomeRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes", body: request)
    }

    /// `POST /api/homes/property-suggestions` — route `backend/routes/home.js:540`.
    public static func propertySuggestions(_ request: PropertySuggestionsRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/property-suggestions", body: request)
    }

    /// `POST /api/homes/check-address` — route `backend/routes/home.js:555`.
    public static func checkAddress(_ request: CheckAddressRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/check-address", body: request)
    }

    /// `POST /api/homes/:id/owners/invite` — route
    /// `backend/routes/homeOwnership.js:1376`.
    public static func inviteOwner(homeId: String, request: InviteOwnerRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/owners/invite",
            body: request
        )
    }

    /// `GET /api/homes/:id/owners` — route
    /// `backend/routes/homeOwnership.js:1381`. Returns the per-home
    /// owner roster with each user-type owner enriched with username +
    /// display name + avatar URL.
    public static func listOwners(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/owners")
    }

    /// `DELETE /api/homes/:id/owners/:ownerId` — route
    /// `backend/routes/homeOwnership.js:1614`. May return a quorum
    /// action id when removal requires co-owner approval; in that case
    /// the row stays in the list until the quorum resolves.
    public static func removeOwner(homeId: String, ownerId: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/homes/\(homeId)/owners/\(ownerId)"
        )
    }

    /// `POST /api/homes/:id/owners/transfer` — route
    /// `backend/routes/homeOwnership.js:1526`. Initiates a full
    /// ownership transfer to a buyer. Returns a `transfer_claim_id`
    /// directly for a sole owner, or a `quorum_action_id` +
    /// `required_approvals` when co-owners must approve first.
    public static func transferOwner(
        homeId: String,
        request: TransferOwnerRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/owners/transfer",
            body: request
        )
    }

    /// `POST /api/homes/:id/ownership-claims` — route
    /// `backend/routes/homeOwnership.js:251`.
    public static func submitClaim(homeId: String, request: SubmitClaimRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/ownership-claims",
            body: request
        )
    }

    /// `POST /api/homes/:id/ownership-claims/:claimId/evidence` — route
    /// `backend/routes/homeOwnership.js:886`.
    public static func uploadEvidence(
        homeId: String,
        claimId: String,
        request: UploadEvidenceRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/ownership-claims/\(claimId)/evidence",
            body: request
        )
    }

    /// `GET /api/homes/my-ownership-claims` — route
    /// `backend/routes/homeOwnership.js:217`.
    public static func myOwnershipClaims() -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/my-ownership-claims")
    }

    /// `DELETE /api/homes/:id/ownership-claims/:claimId` — route
    /// `backend/routes/homeOwnership.js:603`.
    public static func deleteOwnershipClaim(homeId: String, claimId: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/homes/\(homeId)/ownership-claims/\(claimId)"
        )
    }

    /// `POST /api/homes/:id/move-out` — route `backend/routes/home.js:3391`.
    /// Self-initiated leave for any occupant.
    public static func moveOut(homeId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/move-out")
    }

    /// `GET /api/homes/:id/bills` — route `backend/routes/home.js:4506`.
    public static func bills(homeId: String, status: String? = nil) -> Endpoint {
        var query: [String: String] = [:]
        if let status { query["status"] = status }
        return Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/bills",
            query: query
        )
    }

    /// `POST /api/homes/:id/bills` — route `backend/routes/home.js:4539`.
    public static func createBill(homeId: String, request: CreateBillRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/bills",
            body: request
        )
    }

    /// `PUT /api/homes/:id/bills/:billId` — route `backend/routes/home.js:4585`.
    public static func updateBill(
        homeId: String,
        billId: String,
        request: UpdateBillRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/homes/\(homeId)/bills/\(billId)",
            body: request
        )
    }

    /// `GET /api/homes/:id/bills/:billId/splits` — route
    /// `backend/routes/home.js:4627`. Backend has no POST/PATCH/DELETE
    /// for splits; the detail view treats them as read-only until a
    /// follow-up PR ships the write side.
    public static func billSplits(homeId: String, billId: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/bills/\(billId)/splits"
        )
    }

    // MARK: - Calendar events (T6.4c / P18)

    /// `GET /api/homes/:id/events` — route `backend/routes/home.js:4793`.
    /// Optional `start_after` / `start_before` ISO-8601 filters narrow
    /// the agenda window; both nil returns every event for the home.
    public static func homeEvents(
        homeId: String,
        startAfter: String? = nil,
        startBefore: String? = nil
    ) -> Endpoint {
        var query: [String: String] = [:]
        if let startAfter { query["start_after"] = startAfter }
        if let startBefore { query["start_before"] = startBefore }
        return Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/events",
            query: query
        )
    }

    /// `POST /api/homes/:id/events` — route `backend/routes/home.js:4827`.
    public static func createHomeEvent(
        homeId: String,
        request: CreateHomeEventRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/events",
            body: request
        )
    }

    /// `PUT /api/homes/:id/events/:eventId` — route
    /// `backend/routes/home.js:5082`. Allow-listed body keys per the
    /// destructure at line 5090.
    public static func updateHomeEvent(
        homeId: String,
        eventId: String,
        request: UpdateHomeEventRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/homes/\(homeId)/events/\(eventId)",
            body: request
        )
    }

    /// `DELETE /api/homes/:id/events/:eventId` — route
    /// `backend/routes/home.js:5120`.
    public static func deleteHomeEvent(
        homeId: String,
        eventId: String
    ) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/homes/\(homeId)/events/\(eventId)"
        )
    }

    /// `GET /api/homes/:id/events/:eventId` — event detail + RSVP attendees
    /// (route `backend/routes/home.js`). Added for Calendarly I10 (Home Event
    /// Detail + RSVP); consumed read-only by the feature stream. Decodes
    /// `HomeEventDetailResponse`.
    public static func getHomeEvent(
        homeId: String,
        eventId: String
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/events/\(eventId)"
        )
    }

    /// `POST /api/homes/:id/events/:eventId/rsvp` — upsert the signed-in
    /// member's RSVP (`HomeEventRsvpRequest` → `HomeEventRsvpResponse`). Added
    /// for Calendarly I10.
    public static func rsvpHomeEvent(
        homeId: String,
        eventId: String,
        request: HomeEventRsvpRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/events/\(eventId)/rsvp",
            body: request
        )
    }

    // MARK: - Maintenance (T6.3b / P10)

    /// `GET /api/homes/:id/maintenance` — route `backend/routes/home.js`
    /// (added in T6.3b / P10).
    public static func maintenance(
        homeId: String,
        status: String? = nil
    ) -> Endpoint {
        var query: [String: String] = [:]
        if let status { query["status"] = status }
        return Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/maintenance",
            query: query
        )
    }

    /// `POST /api/homes/:id/maintenance` — route `backend/routes/home.js`.
    public static func createMaintenance(
        homeId: String,
        request: CreateMaintenanceRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/maintenance",
            body: request
        )
    }

    /// `PUT /api/homes/:id/maintenance/:taskId` — route
    /// `backend/routes/home.js`.
    public static func updateMaintenance(
        homeId: String,
        taskId: String,
        request: UpdateMaintenanceRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/homes/\(homeId)/maintenance/\(taskId)",
            body: request
        )
    }

    /// `DELETE /api/homes/:id/maintenance/:taskId` — route
    /// `backend/routes/home.js`.
    public static func deleteMaintenance(
        homeId: String,
        taskId: String
    ) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/homes/\(homeId)/maintenance/\(taskId)"
        )
    }

    // MARK: - Pets (T5.2.1)

    /// `GET /api/homes/:id/pets` — route `backend/routes/home.js:6789`.
    public static func listPets(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/pets")
    }

    /// `POST /api/homes/:id/pets` — route `backend/routes/home.js:6826`.
    public static func createPet(homeId: String, request: CreatePetRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/pets", body: request)
    }

    /// `PUT /api/homes/:id/pets/:petId` — route `backend/routes/home.js:6880`.
    public static func updatePet(
        homeId: String,
        petId: String,
        request: UpdatePetRequest
    ) -> Endpoint {
        Endpoint(method: .put, path: "/api/homes/\(homeId)/pets/\(petId)", body: request)
    }

    /// `DELETE /api/homes/:id/pets/:petId` — route `backend/routes/home.js:6926`.
    public static func deletePet(homeId: String, petId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/homes/\(homeId)/pets/\(petId)")
    }

    // MARK: - Emergency info (T6.4b / P17)

    /// `GET /api/homes/:id/emergencies` — route `backend/routes/home.js:5406`.
    public static func emergencies(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/emergencies")
    }

    /// `POST /api/homes/:id/emergencies` — route `backend/routes/home.js:5442`.
    public static func createEmergency(
        homeId: String,
        request: CreateEmergencyRequest
    ) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/emergencies", body: request)
    }

    // MARK: - Documents (T6.4b / P17)

    /// `GET /api/homes/:id/documents` — route `backend/routes/home.js:4944`.
    public static func documents(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/documents")
    }

    /// `POST /api/homes/:id/documents` — route `backend/routes/home.js:4985`.
    public static func createDocument(
        homeId: String,
        request: CreateDocumentRequest
    ) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/documents", body: request)
    }

    // MARK: - Packages (T6.3d / P14)

    /// `GET /api/homes/:id/packages` — route `backend/routes/home.js:4673`.
    /// Optional `status` filter mirrors the backend query param; tab
    /// filtering on the client side projects backend statuses into the
    /// design's Expected / Delivered / Archived buckets.
    public static func packages(homeId: String, status: String? = nil) -> Endpoint {
        var query: [String: String] = [:]
        if let status { query["status"] = status }
        return Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/packages",
            query: query
        )
    }

    /// `POST /api/homes/:id/packages` — route `backend/routes/home.js:4706`.
    public static func createPackage(
        homeId: String,
        request: CreatePackageRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/packages",
            body: request
        )
    }

    /// `PUT /api/homes/:id/packages/:packageId` — route
    /// `backend/routes/home.js:4746`.
    public static func updatePackage(
        homeId: String,
        packageId: String,
        request: UpdatePackageRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/homes/\(homeId)/packages/\(packageId)",
            body: request
        )
    }

    // MARK: - Polls (T6.3e / P13)

    /// `GET /api/homes/:id/polls` — route `backend/routes/home.js:6984`.
    /// Response is enriched server-side with `vote_count`, `option_counts`
    /// (per-option breakdown keyed by `PollOptionDTO.id`), and `my_vote`.
    public static func listPolls(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/polls")
    }

    /// `POST /api/homes/:id/polls` — route `backend/routes/home.js:7058`.
    public static func createPoll(homeId: String, request: CreatePollRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/polls",
            body: request
        )
    }

    /// `POST /api/homes/:id/polls/:pollId/vote` — route
    /// `backend/routes/home.js:7100`. Upserts the viewer's vote (changing
    /// a vote is a re-call with new `selectedOptions`).
    public static func castPollVote(
        homeId: String,
        pollId: String,
        request: CastVoteRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/polls/\(pollId)/vote",
            body: request
        )
    }

    /// `PUT /api/homes/:id/polls/:pollId` — route `backend/routes/home.js:7159`.
    /// Used to close a poll (`status: "closed"`) or edit metadata.
    public static func updatePoll(
        homeId: String,
        pollId: String,
        request: UpdatePollRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/homes/\(homeId)/polls/\(pollId)",
            body: request
        )
    }

    // MARK: - Access codes (T6.4a)

    /// `GET /api/homes/:id/access` — route `backend/routes/home.js:5487`.
    /// Returns `{ secrets: [HomeAccessSecretDTO] }` filtered by the
    /// caller's visibility scope (members / managers / sensitive).
    public static func accessSecrets(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/access")
    }

    /// `POST /api/homes/:id/access` — route `backend/routes/home.js:5527`.
    public static func createAccessSecret(
        homeId: String,
        request: CreateAccessSecretRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/access",
            body: request
        )
    }

    /// `PUT /api/homes/:id/access/:secretId` — route `backend/routes/home.js:5586`.
    public static func updateAccessSecret(
        homeId: String,
        secretId: String,
        request: UpdateAccessSecretRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/homes/\(homeId)/access/\(secretId)",
            body: request
        )
    }

    /// `DELETE /api/homes/:id/access/:secretId` — route `backend/routes/home.js:5624`.
    public static func deleteAccessSecret(homeId: String, secretId: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/homes/\(homeId)/access/\(secretId)"
        )
    }

    // MARK: - Household tasks (T6.3c / P11)

    /// `GET /api/homes/:id/tasks` — route `backend/routes/home.js:4170`.
    /// Returns the per-home chore list (HOUSEHOLD tasks — distinct from
    /// `me.gigs` / My tasks which is the posted-to-neighbours gig list).
    public static func tasks(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/tasks")
    }

    /// `POST /api/homes/:id/tasks` — route `backend/routes/home.js:4238`.
    public static func createTask(
        homeId: String,
        request: CreateHomeTaskRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/tasks",
            body: request
        )
    }

    /// `PUT /api/homes/:id/tasks/:taskId` — route `backend/routes/home.js:4308`.
    public static func updateTask(
        homeId: String,
        taskId: String,
        request: UpdateHomeTaskRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/homes/\(homeId)/tasks/\(taskId)",
            body: request
        )
    }

    /// `DELETE /api/homes/:id/tasks/:taskId` — route `backend/routes/home.js:4354`.
    public static func deleteTask(homeId: String, taskId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/homes/\(homeId)/tasks/\(taskId)")
    }

    // MARK: - Members (T6.3a / P9)

    /// `GET /api/homes/:id/occupants` — route `backend/routes/home.js:3705`.
    /// Returns `{ occupants, pendingInvites }`; the Members screen
    /// buckets client-side into the Members / Guests / Pending tabs.
    public static func listOccupants(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/occupants")
    }

    /// `POST /api/homes/:id/invite` — route `backend/routes/home.js:5662`.
    /// Body shape: `InviteMemberRequest`.
    public static func inviteMember(
        homeId: String,
        request: InviteMemberRequest
    ) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/invite", body: request)
    }

    /// `DELETE /api/homes/:id/members/:userId` — route
    /// `backend/routes/homeIam.js:512`. Removes the membership; if the
    /// caller is the target it acts as a self-leave.
    public static func removeMember(homeId: String, userId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/homes/\(homeId)/members/\(userId)")
    }

    // MARK: - Guest passes (A13.1)

    /// `POST /api/homes/:id/guest-passes` — route
    /// `backend/routes/homeIam.js:667`. Issues a short-term guest pass;
    /// the response carries the raw share `token` exactly once.
    public static func createGuestPass(
        homeId: String,
        request: CreateGuestPassRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/guest-passes",
            body: request
        )
    }

    /// `GET /api/homes/:id/guest-passes` — route
    /// `backend/routes/homeIam.js:783`. Active passes only unless
    /// `includeRevoked` is set.
    public static func listGuestPasses(
        homeId: String,
        includeRevoked: Bool = false
    ) -> Endpoint {
        var query: [String: String] = [:]
        if includeRevoked { query["include_revoked"] = "true" }
        return Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/guest-passes",
            query: query
        )
    }

    /// `DELETE /api/homes/:id/guest-passes/:passId` — route
    /// `backend/routes/homeIam.js:860`. Revokes (soft-deletes) the pass.
    public static func revokeGuestPass(homeId: String, passId: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/homes/\(homeId)/guest-passes/\(passId)"
        )
    }

    // MARK: - Postcard verification (A12.5–A12.7)

    /// `POST /api/homes/:id/request-postcard` — route
    /// `backend/routes/homeOwnership.js:2452`. Mails a verification code
    /// to the home address; takes no request body. Rate-limited; returns
    /// 400 when a code is already pending and 429 at the address cap.
    public static func requestPostcard(homeId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/request-postcard")
    }

    /// `POST /api/homes/:id/verify-postcard` — route
    /// `backend/routes/homeOwnership.js:2548`. Verifies the mailed code.
    public static func verifyPostcard(
        homeId: String,
        request: VerifyPostcardRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/verify-postcard",
            body: request
        )
    }
}

// MARK: - Access codes request bodies

/// POST body for `createAccessSecret`. Mirrors the destructure at
/// `backend/routes/home.js:5535`.
public struct CreateAccessSecretRequest: Encodable, Sendable {
    public let accessType: String
    public let label: String
    public let secretValue: String
    public let notes: String?
    public let visibility: String?

    private enum CodingKeys: String, CodingKey {
        case accessType = "access_type"
        case label
        case secretValue = "secret_value"
        case notes
        case visibility
    }

    public init(
        accessType: String,
        label: String,
        secretValue: String,
        notes: String? = nil,
        visibility: String? = nil
    ) {
        self.accessType = accessType
        self.label = label
        self.secretValue = secretValue
        self.notes = notes
        self.visibility = visibility
    }
}

/// PUT body for `updateAccessSecret`. All fields optional (server-side
/// applies only present keys per the allow-list at
/// `backend/routes/home.js:5594`).
public struct UpdateAccessSecretRequest: Encodable, Sendable {
    public let accessType: String?
    public let label: String?
    public let secretValue: String?
    public let notes: String?
    public let visibility: String?

    private enum CodingKeys: String, CodingKey {
        case accessType = "access_type"
        case label
        case secretValue = "secret_value"
        case notes
        case visibility
    }

    public init(
        accessType: String? = nil,
        label: String? = nil,
        secretValue: String? = nil,
        notes: String? = nil,
        visibility: String? = nil
    ) {
        self.accessType = accessType
        self.label = label
        self.secretValue = secretValue
        self.notes = notes
        self.visibility = visibility
    }
}
