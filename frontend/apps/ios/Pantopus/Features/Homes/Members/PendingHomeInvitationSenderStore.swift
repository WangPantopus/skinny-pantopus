import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomeInvitationSenderStoring {
    func load(scope: HomeCreationScope) throws -> PendingHomeInvitationSender?
    func replace(scope: HomeCreationScope, expected: PendingHomeInvitationSender?, next: PendingHomeInvitationSender?) throws
}

/// One account/origin-bound original; never plaintext, synchronized, or erased by logout.
@MainActor
struct PendingHomeInvitationSenderStore: PendingHomeInvitationSenderStoring {
    private let keychain: Keychain
    init(service: String = "app.pantopus.ios.pending-home-invitation-sender") {
        keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    }

    func load(scope: HomeCreationScope) throws -> PendingHomeInvitationSender? {
        guard scope.isValid else { throw HomeInvitationSenderError.sessionChanged }
        do {
            guard let data = try keychain.getData(key(scope)) else { return nil }
            let original = try JSONDecoder().decode(PendingHomeInvitationSender.self, from: data)
            guard original.matches(scope) else { throw HomeInvitationSenderError.storage }
            return original
        } catch { throw HomeInvitationSenderError.storage }
    }

    func replace(scope: HomeCreationScope, expected: PendingHomeInvitationSender?, next: PendingHomeInvitationSender?) throws {
        guard scope.isValid, next == nil || next?.matches(scope) == true else { throw HomeInvitationSenderError.storage }
        guard try load(scope: scope) == expected else { throw HomeInvitationSenderError.changed }
        do {
            if let next { try keychain.set(JSONEncoder().encode(next), key: key(scope)) } else { try keychain.remove(key(scope)) }
        } catch { throw HomeInvitationSenderError.storage }
    }

    private func key(_ scope: HomeCreationScope) -> String {
        let identity = "\(scope.origin.utf8.count):\(scope.origin):\(scope.actorId)"
        return SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
