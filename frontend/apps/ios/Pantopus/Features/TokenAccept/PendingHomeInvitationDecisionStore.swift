import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomeInvitationDecisionStoring {
    func load(scope: HomeCreationScope) throws -> PendingHomeInvitationDecision?
    func replace(scope: HomeCreationScope, expected: PendingHomeInvitationDecision?, next: PendingHomeInvitationDecision?) throws
}

/// One device-only original per origin/account. Synchronous MainActor compare
/// and write prevents a second scene from replacing or erasing a different intent.
@MainActor
struct PendingHomeInvitationDecisionStore: PendingHomeInvitationDecisionStoring {
    private let keychain: Keychain
    init(service: String = "app.pantopus.ios.pending-home-invitation-decision") {
        keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    }

    func load(scope: HomeCreationScope) throws -> PendingHomeInvitationDecision? {
        guard scope.isValid else { throw HomeInvitationDecisionError.sessionChanged }
        do {
            guard let bytes = try keychain.getData(key(scope)) else { return nil }
            let draft = try JSONDecoder().decode(PendingHomeInvitationDecision.self, from: bytes)
            guard draft.matches(scope) else { throw HomeInvitationDecisionError.storage }
            return draft
        } catch { throw HomeInvitationDecisionError.storage }
    }

    func replace(scope: HomeCreationScope, expected: PendingHomeInvitationDecision?, next: PendingHomeInvitationDecision?) throws {
        guard scope.isValid, next == nil || next?.matches(scope) == true else { throw HomeInvitationDecisionError.storage }
        guard try load(scope: scope) == expected else { throw HomeInvitationDecisionError.changed }
        do {
            if let next { try keychain.set(JSONEncoder().encode(next), key: key(scope)) } else { try keychain.remove(key(scope)) }
        } catch { throw HomeInvitationDecisionError.storage }
    }

    private func key(_ scope: HomeCreationScope) -> String {
        let identity = "\(scope.origin.utf8.count):\(scope.origin):\(scope.actorId)"
        return SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
