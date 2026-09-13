import Foundation

struct HomeResidencyHistoryIdentity: Equatable {
    let homeId: String
    let actorId: String
    var isValid: Bool {
        HomeResidencyHistoryValidation.uuid(homeId) && HomeResidencyHistoryValidation.uuid(actorId)
    }
}

enum HomeResidencyHistoryError: Error, LocalizedError, Equatable {
    case unavailable, sessionChanged, forbidden, homeUnavailable, notFound, cursorInvalid
    var errorDescription: String? {
        switch self {
        case .unavailable: "Your past decisions could not be checked. Try again."
        case .sessionChanged: "Your session changed. Close history and reopen it under the intended account."
        case .forbidden: "Your current permission does not allow reviewing this Home's decision history."
        case .homeUnavailable: "This Home is unavailable. Close history and check your Homes again."
        case .notFound: "That saved decision is unavailable. Reload your recent decisions."
        case .cursorInvalid: "This history page is no longer available. Reload your recent decisions."
        }
    }
}

struct HomeResidencyHistorySession: Equatable {
    let actorId: String
    let scope: String
    static func parse(_ value: JSONValue, actorId: String) throws -> Self {
        let fields = try HomeResidencyHistoryValidation.fields(value, keys: ["actor_id", "session_scope"])
        guard fields["actor_id"] == .string(actorId), HomeResidencyHistoryValidation.uuid(actorId),
              let scope = fields["session_scope"]?.stringValue, HomeClaimReviewSnapshot.validToken(scope) else {
            throw HomeResidencyHistoryError.sessionChanged
        }
        return Self(actorId: actorId, scope: scope)
    }
}

/// Recorded roles describe a receipt; they never expand the admission role picker.
enum HomeResidencyHistoryRole: String, CaseIterable {
    case owner, admin, manager, member, guest
    case restrictedMember = "restricted_member", leaseResident = "lease_resident", serviceProvider = "service_provider"
    var label: String {
        switch self {
        case .owner: "Owner"
        case .admin: "Admin"
        case .manager: "Manager"
        case .member: "Member"
        case .guest: "Guest"
        case .restrictedMember: "Restricted member"
        case .leaseResident: "Lease resident"
        case .serviceProvider: "Service provider"
        }
    }
}

enum HomeResidencyHistoryAction: String {
    case approve, reject
}

struct HomeResidencyHistoryItem: Equatable, Identifiable {
    let id: String
    let claimId: String
    let action: HomeResidencyHistoryAction
    let createdAt: String
    let reviewedAt: String
    let legacyRequest: Bool
    let occupancyId: String?
    let role: HomeResidencyHistoryRole?
    let currentClaimStatus: String
    let currentApplicantId: String?
    let currentUsername: String?

    var decisionLabel: String {
        action == .approve ? "Approval recorded" : "Rejection recorded"
    }

    var applicantLabel: String {
        if let currentUsername, !currentUsername.isEmpty { return "Current applicant: @" + currentUsername }
        return "Current applicant identity unavailable"
    }

    func isEarlier(than other: Self) -> Bool {
        createdAt < other.createdAt || (createdAt == other.createdAt && id < other.id)
    }

    static func parse(_ value: JSONValue, identity: HomeResidencyHistoryIdentity, receiptId: String? = nil) throws -> Self {
        typealias Validation = HomeResidencyHistoryValidation
        let item = try Validation.fields(value, keys: ["decision", "current"])
        let decision = try Validation.fields(
            item["decision"],
            keys: ["id", "home_id", "claim_id", "actor_id", "action", "created_at", "legacy_request", "result"]
        )
        let result = try Validation.fields(decision["result"], keys: ["status", "reviewed_at", "occupancy_id", "role_base"])
        let current = try Validation.fields(item["current"], keys: ["claim_status", "applicant_lookup", "applicant", "household_access"])
        guard identity.isValid, decision["home_id"] == .string(identity.homeId), decision["actor_id"] == .string(identity.actorId),
              let id = decision["id"]?.stringValue, Validation.uuid(id), receiptId == nil || id == receiptId,
              let claim = decision["claim_id"]?.stringValue, Validation.uuid(claim),
              let action = decision["action"]?.stringValue.flatMap(HomeResidencyHistoryAction.init(rawValue:)),
              let created = decision["created_at"]?.stringValue, Validation.date(created, canonical: true),
              let legacy = decision["legacy_request"]?.boolValue,
              let reviewed = result["reviewed_at"]?.stringValue, Validation.date(reviewed),
              result["status"] == .string(action == .approve ? "verified" : "rejected"),
              let status = current["claim_status"]?.stringValue, ["pending", "verified", "rejected"].contains(status),
              current["applicant_lookup"] == .string("current_claim_reference"),
              current["household_access"] == .string("not_checked") else {
            throw HomeResidencyHistoryError.unavailable
        }
        let occupancy = result["occupancy_id"]?.stringValue
        guard action == .approve ? occupancy.map(Validation.uuid) == true : result["occupancy_id"] == .null else {
            throw HomeResidencyHistoryError.unavailable
        }
        let role = result["role_base"]?.stringValue.flatMap(HomeResidencyHistoryRole.init(rawValue:))
        guard result["role_base"] == .null || role != nil, action == .approve || result["role_base"] == .null else {
            throw HomeResidencyHistoryError.unavailable
        }
        var applicantId: String?
        var username: String?
        if current["applicant"] != .null {
            let applicant = try Validation.fields(current["applicant"], keys: ["id", "username", "name"])
            guard let id = applicant["id"]?.stringValue, Validation.uuid(id), applicant["name"] == .null,
                  applicant["username"] == .null || (applicant["username"]?.stringValue.map { $0.utf16.count <= 100 } == true) else {
                throw HomeResidencyHistoryError.unavailable
            }
            applicantId = id
            username = applicant["username"]?.stringValue
        }
        return Self(
            id: id,
            claimId: claim,
            action: action,
            createdAt: created,
            reviewedAt: reviewed,
            legacyRequest: legacy,
            occupancyId: occupancy,
            role: role,
            currentClaimStatus: status,
            currentApplicantId: applicantId,
            currentUsername: username
        )
    }
}

struct HomeResidencyHistoryCursor: Equatable {
    let raw: String
    let createdAt: String
    let id: String
    static func parse(_ raw: String, identity: HomeResidencyHistoryIdentity) throws -> Self {
        typealias Validation = HomeResidencyHistoryValidation
        guard !raw.isEmpty, raw.utf8.count <= 600,
              Validation.matches(raw, "^[A-Za-z0-9_-]+$") else { throw HomeResidencyHistoryError.cursorInvalid }
        let base64 = raw.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        guard let bytes = Data(base64Encoded: base64 + String(repeating: "=", count: (4 - base64.count % 4) % 4)),
              let text = String(data: bytes, encoding: .utf8),
              let value = try? JSONDecoder().decode(JSONValue.self, from: bytes),
              let fields = try? Validation.fields(value, keys: ["version", "actor_id", "home_id", "created_at", "id"]),
              fields["version"] == .number(1), fields["actor_id"] == .string(identity.actorId),
              fields["home_id"] == .string(identity.homeId),
              let created = fields["created_at"]?.stringValue, Validation.date(created, canonical: true),
              let id = fields["id"]?.stringValue, Validation.uuid(id),
              identity.isValid else { throw HomeResidencyHistoryError.cursorInvalid }
        let canonical = "{\"version\":1,\"actor_id\":\"\(identity.actorId)\",\"home_id\":\"\(identity.homeId)\","
            + "\"created_at\":\"\(created)\",\"id\":\"\(id)\"}"
        let encoded = bytes.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        guard text == canonical, encoded == raw else { throw HomeResidencyHistoryError.cursorInvalid }
        return Self(raw: raw, createdAt: created, id: id)
    }

    func precedes(_ item: HomeResidencyHistoryItem) -> Bool {
        item.createdAt < createdAt || (item.createdAt == createdAt && item.id < id)
    }
}

struct HomeResidencyHistoryPage: Equatable {
    let items: [HomeResidencyHistoryItem]
    let nextCursor: HomeResidencyHistoryCursor?
    static func parse(
        _ value: JSONValue,
        identity: HomeResidencyHistoryIdentity,
        session: HomeResidencyHistorySession,
        after: HomeResidencyHistoryCursor?
    ) throws -> Self {
        let fields = try HomeResidencyHistoryValidation.envelope(
            value,
            keys: ["home_id", "actor_id", "items", "next_cursor", "session"],
            identity: identity,
            session: session
        )
        guard let values = fields["items"]?.arrayValue, values.count <= 20 else { throw HomeResidencyHistoryError.unavailable }
        let items = try values.map { try HomeResidencyHistoryItem.parse($0, identity: identity) }
        guard Set(items.map(\.id)).count == items.count else { throw HomeResidencyHistoryError.unavailable }
        for (index, item) in items.enumerated() {
            guard index == 0 ? after?.precedes(item) != false : item.isEarlier(than: items[index - 1])
            else { throw HomeResidencyHistoryError.unavailable }
        }
        var next: HomeResidencyHistoryCursor?
        if fields["next_cursor"] != .null {
            guard let raw = fields["next_cursor"]?.stringValue, items.count == 20 else { throw HomeResidencyHistoryError.unavailable }
            next = try HomeResidencyHistoryCursor.parse(raw, identity: identity)
            guard next?.raw != after?.raw, next?.id == items.last?.id,
                  next?.createdAt == items.last?.createdAt else { throw HomeResidencyHistoryError.unavailable }
        }
        return Self(items: items, nextCursor: next)
    }
}

enum HomeResidencyHistoryValidation {
    static func fields(_ value: JSONValue?, keys: Set<String>) throws -> [String: JSONValue] {
        guard let fields = value?.dictValue, Set(fields.keys) == keys else { throw HomeResidencyHistoryError.unavailable }
        return fields
    }

    static func envelope(
        _ value: JSONValue,
        keys: Set<String>,
        identity: HomeResidencyHistoryIdentity,
        session: HomeResidencyHistorySession
    ) throws -> [String: JSONValue] {
        let fields = try fields(value, keys: keys)
        guard identity.isValid, fields["home_id"] == .string(identity.homeId), fields["actor_id"] == .string(identity.actorId),
              try HomeResidencyHistorySession.parse(fields["session"] ?? .null, actorId: identity.actorId) == session else {
            throw HomeResidencyHistoryError.sessionChanged
        }
        return fields
    }

    static func uuid(_ value: String) -> Bool {
        UUID(uuidString: value)?.uuidString.lowercased() == value
    }

    static func matches(_ text: String, _ pattern: String) -> Bool {
        text.range(of: pattern, options: .regularExpression) != nil
    }

    static func date(_ text: String, canonical: Bool = false) -> Bool {
        let pattern = canonical ? "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z$"
            : "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$"
        guard matches(text, pattern) else { return false }
        let pieces = text.prefix(19).split { "-T:".contains($0) }.compactMap { Int($0) }
        guard pieces.count == 6, pieces[0] > 0, pieces[3] < 24, pieces[4] < 60, pieces[5] < 60 else { return false }
        let year = pieces[0], month = pieces[1], day = pieces[2]
        guard (1...12).contains(month), day > 0 else { return false }
        let leap = year.isMultiple(of: 400) || (year.isMultiple(of: 4) && !year.isMultiple(of: 100))
        let monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        guard day <= monthDays[month - 1] else { return false }
        if !text.hasSuffix("Z") {
            let offset = text.suffix(5).split(separator: ":").compactMap { Int($0) }
            guard offset.count == 2, offset[0] < 24, offset[1] < 60 else { return false }
        }
        return true
    }
}
