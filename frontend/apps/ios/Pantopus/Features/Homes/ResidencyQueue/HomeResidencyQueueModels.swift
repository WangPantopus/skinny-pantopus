import Foundation

struct HomeResidencyQueueIdentity: Equatable {
    let homeId: String
    let actorId: String
    var isValid: Bool {
        HomeResidencyQueueValidation.uuid(homeId) && HomeResidencyQueueValidation.uuid(actorId)
    }
}

enum HomeResidencyQueueError: Error, LocalizedError, Equatable {
    case unavailable, sessionChanged, forbidden, homeUnavailable

    var errorDescription: String? {
        switch self {
        case .unavailable: "Current residency claims could not be loaded. Reload to check access."
        case .sessionChanged: "Your session changed. Reopen this Home to check current residency claims."
        case .forbidden: "Your current household permissions do not allow reviewing residency claims."
        case .homeUnavailable: "Current residency claims are not available for your account in this Home."
        }
    }
}

struct HomeResidencyQueueSession: Equatable {
    let actorId: String
    let scope: String

    static func parse(_ value: JSONValue?, actorId: String) throws -> Self {
        let fields = try HomeResidencyQueueValidation.fields(value, keys: ["actor_id", "session_scope"])
        guard HomeResidencyQueueValidation.uuid(actorId), fields["actor_id"] == .string(actorId),
              let scope = fields["session_scope"]?.stringValue, HomeClaimReviewSnapshot.validToken(scope) else {
            throw HomeResidencyQueueError.sessionChanged
        }
        return Self(actorId: actorId, scope: scope)
    }
}

/// Only current pending-request references belong in the queue. Evidence and
/// private account identity are retrieved separately during an authorized review.
struct HomeResidencyQueueClaim: Equatable, Identifiable {
    let id: String
    let userId: String
    let username: String?
    let claimedRole: String?
    let createdAt: String?

    var applicantLabel: String {
        if let username, !username.isEmpty { return "@" + username }
        return "Applicant identity unavailable"
    }

    var roleLabel: String {
        switch claimedRole {
        case "household": "Requesting: Household"
        case "renter": "Requesting: Renter"
        default: "Requested relationship unspecified"
        }
    }

    var dateLabel: String {
        createdAt.map { "Requested " + $0.prefix(10) + " (UTC)" } ?? "Date unavailable"
    }

    func isEarlier(than other: Self) -> Bool {
        if createdAt == other.createdAt { return id < other.id }
        guard let createdAt else { return true }
        guard let otherDate = other.createdAt else { return false }
        return createdAt < otherDate
    }

    static func parse(_ value: JSONValue, homeId: String) throws -> Self {
        let fields = try HomeResidencyQueueValidation.fields(
            value, keys: ["id", "home_id", "user_id", "status", "created_at", "claimed_role", "claimant"]
        )
        guard fields["home_id"] == .string(homeId), fields["status"] == .string("pending"),
              let id = fields["id"]?.stringValue, HomeResidencyQueueValidation.uuid(id),
              let userId = fields["user_id"]?.stringValue, HomeResidencyQueueValidation.uuid(userId),
              fields["created_at"] == .null || fields["created_at"]?.stringValue.map(HomeResidencyQueueValidation.date) == true,
              fields["claimed_role"] == .null || ["renter", "household"].contains(fields["claimed_role"]?.stringValue ?? "") else {
            throw HomeResidencyQueueError.unavailable
        }
        var username: String?
        if fields["claimant"] != .null {
            let person = try HomeResidencyQueueValidation.fields(fields["claimant"], keys: ["id", "username", "name"])
            guard person["id"] == .string(userId), person["name"] == .null,
                  person["username"] == .null || person["username"]?.stringValue.map({ $0.utf16.count <= 100 }) == true else {
                throw HomeResidencyQueueError.unavailable
            }
            username = person["username"]?.stringValue
        }
        return Self(
            id: id,
            userId: userId,
            username: username,
            claimedRole: fields["claimed_role"]?.stringValue,
            createdAt: fields["created_at"]?.stringValue
        )
    }
}

struct HomeResidencyQueuePage: Equatable {
    let claims: [HomeResidencyQueueClaim]

    static func parse(_ value: JSONValue, identity: HomeResidencyQueueIdentity, session: HomeResidencyQueueSession) throws -> Self {
        let fields = try HomeResidencyQueueValidation.fields(value, keys: ["home_id", "actor_id", "claims", "residency_session"])
        let responseSession = try HomeResidencyQueueValidation.fields(
            fields["residency_session"],
            keys: ["home_id", "actor_id", "session_scope"]
        )
        guard identity.isValid, session.actorId == identity.actorId, HomeClaimReviewSnapshot.validToken(session.scope),
              fields["home_id"] == .string(identity.homeId), fields["actor_id"] == .string(identity.actorId),
              responseSession["home_id"] == .string(identity.homeId), responseSession["actor_id"] == .string(identity.actorId),
              responseSession["session_scope"] == .string(session.scope), case let .array(rows) = fields["claims"] else {
            throw HomeResidencyQueueError.unavailable
        }
        let claims = try rows.map { try HomeResidencyQueueClaim.parse($0, homeId: identity.homeId) }
        guard Set(claims.map(\.id)).count == claims.count, Set(claims.map(\.userId)).count == claims.count else {
            throw HomeResidencyQueueError.unavailable
        }
        for (previous, current) in zip(claims, claims.dropFirst()) where !current.isEarlier(than: previous) {
            throw HomeResidencyQueueError.unavailable
        }
        return Self(claims: claims)
    }
}

enum HomeResidencyQueueValidation {
    static func fields(_ value: JSONValue?, keys: Set<String>) throws -> [String: JSONValue] {
        guard case let .object(fields) = value, Set(fields.keys) == keys else { throw HomeResidencyQueueError.unavailable }
        return fields
    }

    static func uuid(_ value: String) -> Bool {
        UUID(uuidString: value)?.uuidString.lowercased() == value
    }

    static func date(_ value: String) -> Bool {
        guard value.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$"#, options: .regularExpression) != nil
        else { return false }
        let numbers = value.split { !$0.isNumber }.compactMap { Int($0) }
        guard numbers.count == 7 else { return false }
        let year = numbers[0], month = numbers[1], day = numbers[2]
        guard year > 0, (1...12).contains(month), numbers[3] < 24, numbers[4] < 60, numbers[5] < 60 else { return false }
        let leap = year.isMultiple(of: 400) || (year.isMultiple(of: 4) && !year.isMultiple(of: 100))
        let days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        return (1...days[month - 1]).contains(day)
    }
}
