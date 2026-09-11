import Foundation

/// A denied Home can expose only its current applicant context or an independently
/// granted task collection. Neither case authorizes the shared dashboard.
public struct HomeDashboardLimitedContent: Sendable {
    public let verificationKind: String?
    public let verificationStatus: String?
    public let canOpenTasks: Bool

    var title: String {
        if verificationKind == "residency" { return "Your residency request" }
        if verificationKind == "ownership" { return "Home ownership verification" }
        return "Home access unavailable"
    }

    var message: String {
        if verificationKind == "residency" {
            return "Your residency is not yet verified. Check for updates to your request."
        }
        if verificationKind == "ownership" {
            return "Complete your ownership verification to request access to this Home."
        }
        return "Current access to this Home could not be confirmed. Reload to check access."
    }
}

struct HomeDashboardAuthoritySnapshot {
    let access: HomeAccessDTO?
    let verificationKind: String?
    let verificationStatus: String?
    let fingerprint: Data
}

@MainActor
final class HomeDashboardAccess {
    private let api: APIClient
    private let homeId: String
    private let scope: HomeClaimSessionScope

    init(homeId: String, api: APIClient, identity: (() -> String?)? = nil) {
        self.homeId = homeId
        self.api = api
        scope = HomeClaimSessionScope(api: api, identity: identity)
    }

    var isCurrent: Bool {
        scope.isCurrent
    }

    func read() async throws -> HomeDashboardAuthoritySnapshot {
        try scope.requireCurrent()
        guard UUID(uuidString: homeId) != nil else { throw APIError.invalidResponse }
        let response = try await api.requestDataResponse(
            Endpoint(method: .get, path: "/api/homes/\(homeId)/dashboard-access", cachePolicy: .reloadIgnoringLocalAndRemoteCacheData),
            includingForbidden: true
        )
        try scope.requireCurrent()
        try Task.checkCancellation()
        guard let body = try JSONSerialization.jsonObject(with: response.data) as? [String: Any],
              let hasAccess = body["hasAccess"] as? Bool, let permissions = body["permissions"] as? [String],
              body["home_id"] as? String == homeId,
              let revision = body["access_revision"] as? String, HomeClaimReviewSnapshot.validToken(revision) else {
            throw APIError.invalidResponse
        }
        let fingerprint = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        if response.response.statusCode == 200 {
            guard hasAccess else { throw APIError.invalidResponse }
            return try HomeDashboardAuthoritySnapshot(
                access: JSONDecoder().decode(HomeAccessDTO.self, from: response.data),
                verificationKind: nil,
                verificationStatus: nil,
                fingerprint: fingerprint
            )
        }
        guard response.response.statusCode == 403, !hasAccess, permissions.isEmpty else { throw APIError.invalidResponse }
        let status = body["verification_status"] as? String
        let kind = body["verification_kind"] as? String
        let pending = body["verification_required"] as? Bool == true
            && ["ownership", "residency"].contains(kind ?? "")
            && [
                "unverified",
                "provisional",
                "provisional_bootstrap",
                "pending_doc",
                "pending_postcard",
                "pending_approval",
                "pending",
                "none"
            ].contains(status ?? "")
        return HomeDashboardAuthoritySnapshot(
            access: nil,
            verificationKind: pending ? kind : nil,
            verificationStatus: pending ? status : nil,
            fingerprint: fingerprint
        )
    }
}
