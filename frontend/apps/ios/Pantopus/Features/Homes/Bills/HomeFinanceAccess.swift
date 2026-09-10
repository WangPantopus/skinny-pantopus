import CryptoKit
import Foundation
import Observation

/// Each bill screen reads current effective rights and stays bound to the
/// session that opened it. The server still authorizes every operation.
@Observable
@MainActor
final class HomeFinanceAccess {
    enum AccessError: LocalizedError {
        case changed
        case denied

        var errorDescription: String? {
            switch self {
            case .changed: "Your session changed. Reopen Bills to continue."
            case .denied: "You don't have permission for this bill action."
            }
        }
    }

    private var access: HomeAccessDTO?
    private var generation = 0
    private let loadAccess: () async throws -> HomeAccessDTO
    private let identity: () -> String?
    private let initialIdentity: String?

    var isCurrentScope: Bool {
        initialIdentity != nil && identity() == initialIdentity
    }

    var canView: Bool {
        isCurrentScope && access?.can("finance.view") == true
    }

    var canManage: Bool {
        canView && access?.can("finance.manage") == true
    }

    init(
        homeId: String,
        api: APIClient,
        loadAccess: (() async throws -> HomeAccessDTO)? = nil,
        identity: (() -> String?)? = nil
    ) {
        self.loadAccess = loadAccess ?? { try await api.request(HomeAdminEndpoints.myAccess(homeId: homeId)) }
        let resolve = identity ?? {
            let auth = api.authProvider ?? AuthManager.shared
            guard case let .signedIn(user) = auth.state else { return nil }
            let session: String
            if let sessionId = auth.sessionId {
                session = sessionId
            } else if let token = auth.accessToken {
                session = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
            } else {
                return nil
            }
            return "\(api.apiBaseURL.absoluteString)|\(user.id)|\(session)"
        }
        self.identity = resolve
        initialIdentity = resolve()
    }

    func refresh(managing: Bool = false) async throws {
        generation += 1
        let revision = generation
        access = nil
        guard isCurrentScope else { throw AccessError.changed }
        let result = try await loadAccess()
        guard revision == generation, isCurrentScope else { throw AccessError.changed }
        access = result
        try require(managing: managing)
    }

    func require(managing: Bool = false) throws {
        guard isCurrentScope else { throw AccessError.changed }
        guard managing ? canManage : canView else { throw AccessError.denied }
    }
}
