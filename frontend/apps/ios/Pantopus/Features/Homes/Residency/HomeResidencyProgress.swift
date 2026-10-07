import Foundation
import Observation

struct PersonalHomeResidencyRequest: Decodable, Identifiable, Equatable {
    let id: String
    let homeId: String?
    let submittedAddress: String?
    let claimedRole: String?
    let status: String
    let reviewedAt: String?
    let createdAt: String?
    let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, status
        case homeId = "home_id"
        case submittedAddress = "submitted_address"
        case claimedRole = "claimed_role"
        case reviewedAt = "reviewed_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var isValid: Bool {
        UUID(uuidString: id) != nil && (homeId == nil || homeId.flatMap(UUID.init(uuidString:)) != nil)
            && ["pending", "verified", "rejected"].contains(status)
            && [reviewedAt, createdAt, updatedAt].allSatisfy(Self.validDate)
    }

    var label: String {
        if let address = submittedAddress?.trimmingCharacters(in: .whitespacesAndNewlines), !address.isEmpty { return address }
        return "Residency request · \(id.suffix(8))"
    }

    var reviewLabel: String {
        switch status {
        case "verified": "Approved"
        case "rejected": "Request not approved"
        default: "Request pending"
        }
    }

    private static func validDate(_ value: String?) -> Bool {
        guard let value else { return true }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if formatter.date(from: value) != nil { return true }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value) != nil
    }
}

struct PersonalHomeResidencyPage: Decodable {
    let requests: [PersonalHomeResidencyRequest]
    let nextCursor: String?
    private enum CodingKeys: String, CodingKey { case requests, nextCursor = "next_cursor" }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        requests = try values.decode([PersonalHomeResidencyRequest].self, forKey: .requests)
        guard values.contains(.nextCursor) else { throw APIError.invalidResponse }
        nextCursor = try values.decodeIfPresent(String.self, forKey: .nextCursor)
    }

    func follows(_ cursor: String?) -> Bool {
        let ids = requests.map { $0.id.lowercased() }
        return requests.count <= 50 && requests.allSatisfy(\.isValid)
            && Set(ids).count == ids.count && ids == ids.sorted()
            && (cursor.map { cursor in ids.allSatisfy { $0 > cursor.lowercased() } } ?? true)
            && (nextCursor.map { UUID(uuidString: $0) != nil && ids.last == $0.lowercased() } ?? true)
    }
}

struct PersonalHomeResidencyProgress: Decodable, Equatable {
    enum NextStep: String, Decodable {
        case home
        case householdReview = "household_review"
        case addressVerification = "address_verification"
        case resubmit
        case accessReview = "access_review"
        case ownershipVerification = "ownership_verification"
        case unavailable
    }

    let homeId: String
    let request: PersonalHomeResidencyRequest?
    let currentAccess: String
    let nextStep: NextStep

    private enum CodingKeys: String, CodingKey {
        case request
        case homeId = "home_id"
        case currentAccess = "current_access"
        case nextStep = "next_step"
    }

    func matches(_ home: String) -> Bool {
        homeId == home && UUID(uuidString: homeId) != nil && ["shared", "private_setup", "none"].contains(currentAccess)
            && (nextStep == .home) == (currentAccess == "shared")
            && (request == nil || (request?.isValid == true && request?.homeId == homeId))
    }

    var needsResidencyRequest: Bool {
        nextStep == .addressVerification && request == nil
    }

    var title: String {
        switch nextStep {
        case .home: "You're part of this household"
        case .householdReview: "Waiting for household review"
        case .addressVerification: needsResidencyRequest ? "Confirm your address" : "Your address isn't verified yet"
        case .resubmit: "Send your request again"
        case .accessReview: "You don't have household access"
        case .ownershipVerification: "Continue ownership verification"
        case .unavailable: "This Home can't be verified right now"
        }
    }

    var explanation: String {
        switch nextStep {
        case .home: "Open the Home to see your household. What you can see and change depends on your role."
        case .householdReview:
            "Someone in the household will review your request. You don't need to upload any documents. "
                + "Check back here for their answer."
        case .addressVerification:
            needsResidencyRequest
                ? "Check this Home’s address, apartment and how you live here, then send your request. "
                + "We don't mail anything until you ask for a postcard."
                : "Your request is saved. To finish, verify your address by mail: request a postcard, "
                + "then enter the code printed on it."
        case .resubmit: "Check the street, apartment and how you live here, then send your request again."
        case .accessReview: "To come back, add this Home again or ask someone in the household to invite you."
        case .ownershipVerification: "Ownership has its own review. Verifying your address by mail doesn't make you an owner."
        case .unavailable: "This Home isn't accepting changes right now. Your request is still saved."
        }
    }
}

enum HomeResidencyNavigation { case home, mail, ownership, addHome }

@Observable
@MainActor
final class HomeResidencyProgressViewModel {
    let homeId: String
    private(set) var progress: PersonalHomeResidencyProgress?
    private(set) var isLoading = true
    private(set) var error: String?
    private var revision = 0
    private var visible = false
    private let api: APIClient
    private let scope: HomeClaimSessionScope

    init(homeId: String, api: APIClient = .shared, identity: (() -> String?)? = nil) {
        self.homeId = homeId.lowercased()
        self.api = api
        scope = HomeClaimSessionScope(api: api, identity: identity)
    }

    var isCurrent: Bool {
        scope.isCurrent
    }

    func suspend() {
        revision += 1
        visible = false
        progress = nil
        error = nil
        isLoading = true
    }

    func refresh() async {
        suspend()
        visible = true
        let generation = revision
        do {
            try scope.requireCurrent()
            guard UUID(uuidString: homeId) != nil else { throw APIError.invalidResponse }
            let result: PersonalHomeResidencyProgress = try await api.request(Endpoint(
                method: .get, path: "/api/homes/\(homeId)/my-residency", cachePolicy: .reloadIgnoringLocalCacheData
            ))
            guard visible, revision == generation, isCurrent, !Task.isCancelled else { return }
            guard result.matches(homeId) else { throw APIError.invalidResponse }
            progress = result
            isLoading = false
        } catch {
            guard visible, revision == generation else { return }
            progress = nil
            isLoading = false
            self.error = isCurrent ? "Your residency status could not be checked. Please retry."
                : "Your session changed. Reopen residency status to continue."
        }
    }

    func permits(_ destination: HomeResidencyNavigation) -> Bool {
        guard visible, isCurrent, !isLoading, let progress else { return false }
        switch destination {
        case .home: return progress.currentAccess == "shared" && progress.nextStep == .home
        case .mail: return progress.nextStep == .addressVerification && !progress.needsResidencyRequest
        case .ownership: return progress.nextStep == .ownershipVerification
        case .addHome: return progress.nextStep == .resubmit || progress.needsResidencyRequest
        }
    }
}
