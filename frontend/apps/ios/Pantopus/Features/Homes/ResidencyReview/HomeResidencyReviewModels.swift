import Foundation

struct HomeResidencyReviewScope: Codable, Equatable, Hashable {
    let origin: String
    let actorId: String
    let homeId: String

    var isValid: Bool {
        HomeCreationScope(origin: origin, actorId: actorId).isValid && HomePostalValidation.uuid(homeId)
    }
}

enum HomeResidencyDecision: String, Codable, CaseIterable {
    case approve, reject
    var label: String {
        self == .approve ? "Approve residency" : "Reject residency"
    }
}

enum HomeResidencyReviewRole: String, Codable, CaseIterable {
    case member
    case leaseResident = "lease_resident"
    case restrictedMember = "restricted_member"
    case guest
    case serviceProvider = "service_provider"

    var label: String {
        switch self {
        case .member: "Member"
        case .leaseResident: "Lease resident"
        case .restrictedMember: "Restricted member"
        case .guest: "Guest"
        case .serviceProvider: "Service provider"
        }
    }
}

/// The original request and its historical receipt survive a lost reply. The
/// current claim, membership and session proof are deliberately not persisted.
struct PendingHomeResidencyReview: Codable, Equatable {
    let scope: HomeResidencyReviewScope
    let claimId: String
    let action: HomeResidencyDecision
    let body: JSONValue
    var receipt: HomeResidencyReviewReceipt?

    var requestId: String {
        body.dictValue?["request_id"]?.stringValue ?? ""
    }

    var reviewToken: String {
        body.dictValue?["review_token"]?.stringValue ?? ""
    }

    var role: HomeResidencyReviewRole? {
        body.dictValue?["proposed_role"]?.stringValue.flatMap(HomeResidencyReviewRole.init(rawValue:))
    }

    var reason: String? {
        body.dictValue?["reason"]?.stringValue
    }

    func matches(_ expected: HomeResidencyReviewScope) -> Bool {
        guard scope == expected, scope.isValid, HomePostalValidation.uuid(claimId),
              HomePostalValidation.uuid(requestId), HomeClaimReviewSnapshot.validToken(reviewToken),
              let fields = body.dictValue else { return false }
        switch action {
        case .approve:
            guard Set(fields.keys) == ["request_id", "review_token", "proposed_role"], role != nil else { return false }
        case .reject:
            guard Set(fields.keys) == ["request_id", "review_token", "reason"], let reason,
                  reason.utf16.count <= 2000, reason == reason.trimmingCharacters(in: .whitespacesAndNewlines) else { return false }
        }
        return receipt == nil || receipt?.matches(self) == true
    }

    func hasSameIntent(as other: Self) -> Bool {
        scope == other.scope && claimId == other.claimId && action == other.action && body == other.body
    }
}

struct HomeResidencyReviewReceipt: Codable, Equatable {
    let value: JSONValue
    var fields: [String: JSONValue] {
        value.dictValue ?? [:]
    }

    var recordedAt: String {
        fields["created_at"]?.stringValue ?? ""
    }

    func matches(_ draft: PendingHomeResidencyReview) -> Bool {
        let row = fields
        guard HomePostalValidation.uuid(row["id"]?.stringValue),
              row["home_id"]?.stringValue == draft.scope.homeId,
              row["claim_id"]?.stringValue == draft.claimId,
              row["actor_id"]?.stringValue == draft.scope.actorId,
              row["request_id"]?.stringValue == draft.requestId,
              row["action"]?.stringValue == draft.action.rawValue,
              row["review_token"]?.stringValue == draft.reviewToken,
              row["legacy_request"] == .bool(false),
              HomeClaimReviewSnapshot.validToken(row["request_hash"]?.stringValue),
              HomePostalValidation.date(row["created_at"]), let result = row["result"]?.dictValue,
              result["status"]?.stringValue == (draft.action == .approve ? "verified" : "rejected"),
              HomePostalValidation.date(result["reviewed_at"]),
              result["occupancy_id"] == .null || HomePostalValidation.uuid(result["occupancy_id"]?.stringValue),
              HomeResidencyReviewValidation.nullableText(result["role_base"]) else { return false }
        return true
    }

    func projected() -> Self {
        let allowed = [
            "id",
            "home_id",
            "claim_id",
            "actor_id",
            "request_id",
            "action",
            "review_token",
            "legacy_request",
            "request_hash",
            "created_at"
        ]
        var result = fields.filter { allowed.contains($0.key) }
        if let decision = fields["result"]?.dictValue {
            result["result"] = .object(decision.filter { ["status", "reviewed_at", "occupancy_id", "role_base"].contains($0.key) })
        }
        return Self(value: .object(result))
    }
}

struct HomeResidencyCurrentReview: Equatable {
    let value: JSONValue
    var fields: [String: JSONValue] {
        value.dictValue ?? [:]
    }

    var claim: [String: JSONValue] {
        fields["claim"]?.dictValue ?? [:]
    }

    var occupancy: [String: JSONValue]? {
        fields["occupancy"]?.dictValue
    }

    var claimId: String {
        claim["id"]?.stringValue ?? ""
    }

    var applicantId: String {
        claim["user_id"]?.stringValue ?? ""
    }

    var reviewToken: String {
        claim["review_token"]?.stringValue ?? ""
    }

    var sessionScope: String {
        fields["residency_session"]?.dictValue?["session_scope"]?.stringValue ?? ""
    }

    func matches(_ scope: HomeResidencyReviewScope, claimId: String, expectedSession: String?) -> Bool {
        guard scope.isValid, HomePostalValidation.uuid(claimId), fields["ok"] == .bool(true),
              fields["home_id"]?.stringValue == scope.homeId,
              let session = fields["residency_session"]?.dictValue,
              session["actor_id"]?.stringValue == scope.actorId, session["home_id"]?.stringValue == scope.homeId,
              HomeClaimReviewSnapshot.validToken(sessionScope), expectedSession == nil || expectedSession == sessionScope,
              self.claimId == claimId, claim["home_id"]?.stringValue == scope.homeId,
              HomePostalValidation.uuid(applicantId), claim["status"]?.stringValue?.isEmpty == false,
              HomeClaimReviewSnapshot.validToken(reviewToken),
              ["claimed_role", "claimed_address", "review_note", "reviewed_by"]
              .allSatisfy({ HomeResidencyReviewValidation.nullableText(claim[$0]) }),
              ["created_at", "updated_at"].allSatisfy({ HomePostalValidation.date(claim[$0]) }),
              HomeResidencyReviewValidation.nullableDate(claim["reviewed_at"]) else { return false }
        if fields["occupancy"] == .null { return true }
        guard let occupancy, HomePostalValidation.uuid(occupancy["id"]?.stringValue),
              occupancy["user_id"]?.stringValue == applicantId, occupancy["is_active"]?.boolValue != nil else { return false }
        return ["role", "role_base", "age_band", "verification_status"]
            .allSatisfy { HomeResidencyReviewValidation.nullableText(occupancy[$0]) }
            && ["start_at", "end_at", "access_start_at", "access_end_at", "verified_at", "verification_expires_at"].allSatisfy {
                HomeResidencyReviewValidation.nullableDate(occupancy[$0])
            }
    }

    func canDecide(actorId: String) -> Bool {
        applicantId != actorId && claim["status"]?.stringValue == "pending"
    }
}

enum HomeResidencyReviewValidation {
    static func nullableText(_ value: JSONValue?) -> Bool {
        value == .null || value?.stringValue != nil
    }

    static func nullableDate(_ value: JSONValue?) -> Bool {
        value == .null || HomePostalValidation.date(value)
    }
}

enum HomeResidencyReviewError: LocalizedError {
    case storage, changed, busy, unknown, unavailable, sessionChanged
    case refusal(String)

    var errorDescription: String? {
        switch self {
        case .storage: "Your original residency decision could not be read or saved. Retry recovery before choosing another decision."
        case .changed: "Another residency decision is saved for this Home. Reopen review to recover the original."
        case .busy: "Your original decision is still being checked. Try again shortly."
        case .unknown: "The decision is not confirmed. Retry the saved original to check its result."
        case .unavailable: "Current residency access could not be verified. Reload to check again."
        case .sessionChanged: "Your session changed. Reopen residency review to check access and recover the original."
        case .refusal: "The saved decision could not be applied to the current claim and membership limits. Review the current claim again."
        }
    }
}
