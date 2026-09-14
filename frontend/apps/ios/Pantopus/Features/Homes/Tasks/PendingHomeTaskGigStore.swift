import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomeTaskGigStoring {
    func load(scope: String) throws -> HomeTaskGigDraft?
    func save(_ draft: HomeTaskGigDraft, scope: String, matching expected: HomeTaskGigDraft?) throws
    func clear(scope: String, matching draft: HomeTaskGigDraft) throws
}

/// Main-actor comparisons serialize writers in this app process. Keychain is
/// this-device-only, non-synchronizing, and available only while unlocked.
@MainActor
struct PendingHomeTaskGigStore: PendingHomeTaskGigStoring {
    private let keychain: Keychain

    init(service: String = "app.pantopus.ios.pending-home-task-gig") {
        keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    }

    func load(scope: String) throws -> HomeTaskGigDraft? {
        guard let data = try keychain.getData(key(scope)) else { return nil }
        return try JSONDecoder().decode(HomeTaskGigDraft.self, from: data)
    }

    func save(_ draft: HomeTaskGigDraft, scope: String, matching expected: HomeTaskGigDraft?) throws {
        guard try load(scope: scope) == expected else { throw HomeTaskGigViewModel.Failure.changedRequest }
        try keychain.set(JSONEncoder().encode(draft), key: key(scope))
    }

    func clear(scope: String, matching draft: HomeTaskGigDraft) throws {
        guard try load(scope: scope) == draft else { throw HomeTaskGigViewModel.Failure.changedRequest }
        try keychain.remove(key(scope))
    }

    private func key(_ scope: String) -> String {
        SHA256.hash(data: Data(scope.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
