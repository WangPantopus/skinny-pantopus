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
        case "verified": "Review recorded"
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
        case .home: "Household access is available"
        case .householdReview: "Waiting for household review"
        case .addressVerification: needsResidencyRequest ? "Request residency review" : "Address verification is required"
        case .resubmit: "Review your request"
        case .accessReview: "Household access needs review"
        case .ownershipVerification: "Continue ownership verification"
        case .unavailable: "Verification is unavailable for this Home"
        }
    }

    var explanation: String {
        switch nextStep {
        case .home: "Your current access allows you to open this Home. Your role and permissions still apply."
        case .householdReview:
            "Your request is saved for a household reviewer. You do not need to upload an ownership "
                + "document for this step. Refresh to check for a decision."
        case .addressVerification:
            needsResidencyRequest
                ? "Confirm this Home’s address, apartment and your relationship before submitting a residency request. "
                + "Checking an address does not grant household access or send mail."
                : "Saving a request does not request a postcard or verify residency. Review mail verification "
                + "to check for an existing request and its delivery status."
        case .resubmit:
            "Check your street, apartment and relationship before submitting again. A new request does "
                + "not restore previous household access."
        case .accessReview:
            "A saved residency record does not grant current household access. A household reviewer must "
                + "resolve your access before it can be restored."
        case .ownershipVerification: "Ownership has a separate review. Residency verification cannot grant or restore ownership."
        case .unavailable: "Your personal request remains visible. This Home cannot continue the verification flow right now."
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
