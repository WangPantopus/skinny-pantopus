import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomeTaskRecurrenceStoring {
    func load(scope: String) throws -> HomeTaskRecurrenceDraft?
    func save(_ draft: HomeTaskRecurrenceDraft, scope: String, matching expected: HomeTaskRecurrenceDraft?) throws
    func clear(scope: String, matching draft: HomeTaskRecurrenceDraft) throws
}

/// Main-actor comparisons serialize writers in this app process. Keychain is
/// this-device-only, non-synchronizing, and available only while unlocked.
@MainActor
struct PendingHomeTaskRecurrenceStore: PendingHomeTaskRecurrenceStoring {
    private let keychain: Keychain

    init(service: String = "app.pantopus.ios.pending-home-task-recurrence") {
        keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    }

    func load(scope: String) throws -> HomeTaskRecurrenceDraft? {
        guard let data = try keychain.getData(key(scope)) else { return nil }
        return try JSONDecoder().decode(HomeTaskRecurrenceDraft.self, from: data)
    }

    func save(_ draft: HomeTaskRecurrenceDraft, scope: String, matching expected: HomeTaskRecurrenceDraft?) throws {
        guard try load(scope: scope) == expected else { throw HomeTaskRecurrenceViewModel.Failure.changedRequest }
        try keychain.set(JSONEncoder().encode(draft), key: key(scope))
    }

    func clear(scope: String, matching draft: HomeTaskRecurrenceDraft) throws {
        guard try load(scope: scope) == draft else { throw HomeTaskRecurrenceViewModel.Failure.changedRequest }
        try keychain.remove(key(scope))
    }

    private func key(_ scope: String) -> String {
        SHA256.hash(data: Data(scope.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
