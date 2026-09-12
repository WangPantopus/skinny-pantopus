import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomeCreationStoring {
    func load(scope: HomeCreationScope) throws -> PendingHomeCreation?
    func replace(scope: HomeCreationScope, expected: PendingHomeCreation?, next: PendingHomeCreation?) throws
}

/// Account/origin scoped, this-device-only storage. Session changes retire the
/// screen, while a fresh sign-in to the same account can recover its command.
@MainActor
struct PendingHomeCreationStore: PendingHomeCreationStoring {
    private let keychain: Keychain

    init(service: String = "app.pantopus.ios.pending-home-creation") {
        keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    }

    func load(scope: HomeCreationScope) throws -> PendingHomeCreation? {
        guard scope.isValid else { throw HomeCreationRecoveryError.sessionChanged }
        do {
            guard let data = try keychain.getData(key(scope)) else { return nil }
            let draft = try JSONDecoder().decode(PendingHomeCreation.self, from: data)
            guard draft.matches(scope) else { throw HomeCreationRecoveryError.storage }
            return draft
        } catch { throw HomeCreationRecoveryError.storage }
    }

    func replace(scope: HomeCreationScope, expected: PendingHomeCreation?, next: PendingHomeCreation?) throws {
        guard scope.isValid, next == nil || next?.matches(scope) == true else { throw HomeCreationRecoveryError.storage }
        guard try load(scope: scope) == expected else { throw HomeCreationRecoveryError.changed }
        do {
            if let next {
                try keychain.set(JSONEncoder().encode(next), key: key(scope))
            } else {
                try keychain.remove(key(scope))
            }
        } catch { throw HomeCreationRecoveryError.storage }
    }

    private func key(_ scope: HomeCreationScope) -> String {
        let identity = "\(scope.origin.utf8.count):\(scope.origin):\(scope.actorId)"
        return SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
