import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomeTaskCreateStoring {
    func load(scope: String) throws -> HomeTaskCreateDraft?
    func save(_ draft: HomeTaskCreateDraft, scope: String, matching expected: HomeTaskCreateDraft?) throws
    func clear(scope: String, matching draft: HomeTaskCreateDraft) throws
}

/// Private task text stays in this-device-only Keychain storage. Missing and
/// unreadable items are distinct: a read failure cannot authorize a new UUID.
@MainActor
struct PendingHomeTaskCreateStore: PendingHomeTaskCreateStoring {
    private let keychain: Keychain

    init(service: String = "app.pantopus.ios.pending-home-task-create") {
        keychain = Keychain(service: service)
            .accessibility(.whenUnlockedThisDeviceOnly)
            .synchronizable(false)
    }

    func load(scope: String) throws -> HomeTaskCreateDraft? {
        guard let data = try keychain.getData(key(scope)) else { return nil }
        return try JSONDecoder().decode(HomeTaskCreateDraft.self, from: data)
    }

    func save(_ draft: HomeTaskCreateDraft, scope: String, matching expected: HomeTaskCreateDraft?) throws {
        guard try load(scope: scope) == expected else { throw HomeTaskCreationCoordinator.RecoveryError.changedRequest }
        try keychain.set(JSONEncoder().encode(draft), key: key(scope))
    }

    func clear(scope: String, matching draft: HomeTaskCreateDraft) throws {
        guard try load(scope: scope) == draft else { throw HomeTaskCreationCoordinator.RecoveryError.changedRequest }
        try keychain.remove(key(scope))
    }

    private func key(_ scope: String) -> String {
        SHA256.hash(data: Data(scope.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
