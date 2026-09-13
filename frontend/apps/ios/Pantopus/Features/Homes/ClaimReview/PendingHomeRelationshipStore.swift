import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomeRelationshipStoring {
    func load(scope: String) throws -> HomeRelationshipDraft?
    func save(_ draft: HomeRelationshipDraft, scope: String, matching expected: HomeRelationshipDraft?) throws
    func clear(scope: String, matching draft: HomeRelationshipDraft) throws
}

/// One original per API origin, account and Home, even after its claim leaves
/// the queue. Main-actor comparisons serialize writers in this app process.
@MainActor
struct PendingHomeRelationshipStore: PendingHomeRelationshipStoring {
    private let keychain: Keychain

    init(service: String = "app.pantopus.ios.pending-home-claim-relationship") {
        keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    }

    func load(scope: String) throws -> HomeRelationshipDraft? {
        guard let data = try keychain.getData(key(scope)) else { return nil }
        return try JSONDecoder().decode(HomeRelationshipDraft.self, from: data)
    }

    func save(_ draft: HomeRelationshipDraft, scope: String, matching expected: HomeRelationshipDraft?) throws {
        guard try load(scope: scope) == expected else { throw HomeRelationshipViewModel.Failure.changedRequest }
        try keychain.set(JSONEncoder().encode(draft), key: key(scope))
    }

    func clear(scope: String, matching draft: HomeRelationshipDraft) throws {
        guard try load(scope: scope) == draft else { throw HomeRelationshipViewModel.Failure.changedRequest }
        try keychain.remove(key(scope))
    }

    private func key(_ scope: String) -> String {
        SHA256.hash(data: Data(scope.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
