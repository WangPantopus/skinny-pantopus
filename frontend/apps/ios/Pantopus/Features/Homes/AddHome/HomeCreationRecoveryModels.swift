import Foundation

struct HomeCreationScope: Codable, Equatable {
    let origin: String
    let actorId: String

    var isValid: Bool {
        guard let url = URL(string: origin), ["http", "https"].contains(url.scheme ?? ""), url.host != nil else { return false }
        return UUID(uuidString: actorId) != nil
    }
}

/// The body is frozen before the first possible POST. It includes optional
/// access records and is stored only in the protected creation store.
struct PendingHomeCreation: Codable, Equatable {
    let scope: HomeCreationScope
    let requestId: String
    let body: JSONValue
    let form: AddHomeFormState
    var residencyHomeId: String?
    var outcome: HomeCreationOutcome?

    func matches(_ expected: HomeCreationScope) -> Bool {
        if let residencyHomeId {
            guard scope == expected, scope.isValid, UUID(uuidString: residencyHomeId) != nil,
                  UUID(uuidString: requestId) != nil, let values = body.dictValue,
                  Set(values.keys) == ["request_id", "claimed_role", "address"],
                  values["request_id"]?.stringValue == requestId,
                  let role = values["claimed_role"]?.stringValue, ["renter", "household"].contains(role),
                  form.role?.claimedRole == role, let address = values["address"],
                  let data = try? JSONEncoder().encode(address),
                  let snapshot = try? JSONDecoder().decode(HomeResidencyAddressSnapshot.self, from: data), snapshot.isValid,
                  snapshot.line1 == form.address.street, snapshot.line2 == form.address.unit,
                  snapshot.city == form.address.city, snapshot.state == form.address.state,
                  snapshot.postalCode == form.address.zipCode else { return false }
            return outcome == nil || outcome?.matches(self) == true
        }
        guard scope == expected, scope.isValid, UUID(uuidString: requestId) != nil,
              let values = body.dictValue, values["request_id"]?.stringValue == requestId,
              let address = values["address"]?.stringValue, !address.isEmpty,
              let addressId = values["address_id"]?.stringValue, UUID(uuidString: addressId) != nil,
              let role = values["role"]?.stringValue, ["owner", "renter", "household"].contains(role),
              form.role?.claimedRole == role else { return false }
        return outcome == nil || outcome?.matches(self) == true
    }

    func hasSameIntent(as other: Self) -> Bool {
        scope == other.scope && requestId == other.requestId && body == other.body && form == other.form
            && residencyHomeId == other.residencyHomeId
    }
}

/// A command outcome is separate from a current Home/household response.
/// Even a completed command must reload current authority before navigation.
struct HomeCreationOutcome: Codable, Equatable {
    enum State: String, Codable {
        case pending, completed, rejected, cancelled
    }

    struct Command: Codable, Equatable {
        let actorId: String
        let requestId: String
        let createdAt: String
        let updatedAt: String

        private enum CodingKeys: String, CodingKey {
            case actorId = "actor_id"
            case requestId = "request_id"
            case createdAt = "created_at"
            case updatedAt = "updated_at"
        }
    }

    struct Home: Codable, Equatable {
        let id: String
    }

    let state: State
    let command: Command
    let home: Home?
    let ownershipClaimId: String?
    let accessSecretIds: [String]?
    let role: String?
    let requiresVerification: Bool?
    let verificationType: String?
    let currentAccess: String?
    let code: String?
    let error: String?
    let message: String?
    var residencyHomeId: String?
    var claimId: String?
    var occupancyId: String?
    var claimedRole: String?
    var routing: String?
    var nextStep: String?
    var postcardRequested: Bool?

    private enum CodingKeys: String, CodingKey {
        case state, command, home, role, code, error, message
        case ownershipClaimId = "ownership_claim_id"
        case accessSecretIds = "access_secret_ids"
        case requiresVerification = "requires_verification"
        case verificationType = "verification_type"
        case currentAccess = "current_access"
        case residencyHomeId = "home_id"
        case claimId = "claim_id"
        case occupancyId = "occupancy_id"
        case claimedRole = "claimed_role"
        case routing
        case nextStep = "next_step"
        case postcardRequested = "postcard_requested"
    }

    var isTerminal: Bool {
        state != .pending
    }

    func matches(_ draft: PendingHomeCreation) -> Bool {
        guard command.actorId == draft.scope.actorId, command.requestId == draft.requestId,
              Self.validDate(command.createdAt), Self.validDate(command.updatedAt) else { return false }
        if let requestedHome = draft.residencyHomeId {
            guard residencyHomeId == requestedHome, home == nil, ownershipClaimId == nil, accessSecretIds == nil else { return false }
            if state == .completed {
                return claimId.flatMap(UUID.init(uuidString:)) != nil && occupancyId.flatMap(UUID.init(uuidString:)) != nil
                    && claimedRole == draft.body.dictValue?["claimed_role"]?.stringValue
                    && ["household_review", "self_bootstrap", "external_postcard", "stale_authority_postcard"].contains(routing ?? "")
                    && nextStep == (routing == "household_review" ? "household_review" : "address_verification")
                    && requiresVerification == true && currentAccess == "not_checked" && postcardRequested == false
            }
            return claimId == nil && occupancyId == nil && claimedRole == nil && routing == nil
                && (state != .rejected || code?.range(of: "^[A-Z][A-Z0-9_]{1,79}$", options: .regularExpression) != nil)
        }
        guard residencyHomeId == nil, claimId == nil, occupancyId == nil else { return false }
        if state == .completed {
            guard let home, UUID(uuidString: home.id) != nil,
                  role == draft.body.dictValue?["role"]?.stringValue,
                  requiresVerification == true, currentAccess == "not_checked",
                  verificationType == (role == "owner" ? "ownership" : "residency"),
                  let accessSecretIds, accessSecretIds.allSatisfy({ UUID(uuidString: $0) != nil }),
                  Set(accessSecretIds).count == accessSecretIds.count else { return false }
            let expectedSecretCount = draft.body.dictValue?["access_secrets"]?.arrayValue?.count ?? 0
            guard accessSecretIds.count == expectedSecretCount else { return false }
            return role == "owner" ? ownershipClaimId.flatMap(UUID.init(uuidString:)) != nil : ownershipClaimId == nil
        }
        guard home == nil, ownershipClaimId == nil, accessSecretIds == nil else { return false }
        return state != .rejected || code?.range(of: "^[A-Z][A-Z0-9_]{1,79}$", options: .regularExpression) != nil
    }

    func hasSameDecision(as other: Self) -> Bool {
        state == other.state && command.actorId == other.command.actorId && command.requestId == other.command.requestId
            && home == other.home && ownershipClaimId == other.ownershipClaimId && accessSecretIds == other.accessSecretIds
            && role == other.role && (state != .rejected || code == other.code)
            && residencyHomeId == other.residencyHomeId && claimId == other.claimId && occupancyId == other.occupancyId
            && claimedRole == other.claimedRole && routing == other.routing && nextStep == other.nextStep
            && postcardRequested == other.postcardRequested
    }

    private static func validDate(_ value: String) -> Bool {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if formatter.date(from: value) != nil { return true }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value) != nil
    }
}

enum HomeCreationRecoveryError: LocalizedError {
    case storage, changed, busy, unavailable, sessionChanged

    var errorDescription: String? {
        switch self {
        case .storage: "Your saved Home request could not be read or saved. Retry recovery before starting another request."
        case .changed: "A different Home request is saved. Reopen Add Home to recover that request."
        case .busy: "Your original Home request is still being checked. Try again shortly."
        case .unavailable: "The Home request could not be confirmed. Its original details are saved; check again or cancel the request."
        case .sessionChanged: "Your session changed. Reopen Add Home to recover your saved request."
        }
    }
}
