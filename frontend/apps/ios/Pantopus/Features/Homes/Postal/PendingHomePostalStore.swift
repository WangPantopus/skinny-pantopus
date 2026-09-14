import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomePostalStoring {
    func load(scope: HomePostalScope) throws -> PendingHomePostalCommand?
    func replace(scope: HomePostalScope, expected: PendingHomePostalCommand?, next: PendingHomePostalCommand?) throws
}

/// One retained mailing/code command per account, API origin and Home. Main
/// actor isolation keeps the synchronous Keychain compare/write indivisible.
@MainActor
struct PendingHomePostalStore: PendingHomePostalStoring {
    private let keychain: Keychain
    init(service: String = "app.pantopus.ios.pending-home-postal") {
        keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    }

    func load(scope: HomePostalScope) throws -> PendingHomePostalCommand? {
        guard scope.isValid else { throw HomePostalError.sessionChanged }
        do {
            guard let bytes = try keychain.getData(key(scope)) else { return nil }
            let draft = try JSONDecoder().decode(PendingHomePostalCommand.self, from: bytes)
            guard draft.matches(scope) else { throw HomePostalError.storage }
            return draft
        } catch { throw HomePostalError.storage }
    }

    func replace(scope: HomePostalScope, expected: PendingHomePostalCommand?, next: PendingHomePostalCommand?) throws {
        guard scope.isValid, next == nil || next?.matches(scope) == true else { throw HomePostalError.storage }
        guard try load(scope: scope) == expected else { throw HomePostalError.changed }
        do {
            if let next {
                try keychain.set(JSONEncoder().encode(next), key: key(scope))
            } else {
                try keychain.remove(key(scope))
            }
        } catch { throw HomePostalError.storage }
    }

    private func key(_ scope: HomePostalScope) -> String {
        let identity = "\(scope.origin.utf8.count):\(scope.origin):\(scope.actorId):\(scope.homeId)"
        return SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
