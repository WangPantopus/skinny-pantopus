import Foundation

/// Persists only a non-secret SetupIntent identifier, scoped to origin/account.
/// The server must recheck ownership and status before it can be resumed.
@MainActor
protocol PendingCardSaveStoring {
    func load(scope: String) -> String?
    func save(_ setupIntentId: String, scope: String) throws
    func clear(scope: String) throws
}

@MainActor
struct PendingCardSaveStore: PendingCardSaveStoring {
    private let store: any SecureStore

    init(store: any SecureStore = KeychainStore(service: "app.pantopus.ios.pending-card-save")) {
        self.store = store
    }

    func load(scope: String) -> String? {
        guard let value = store.get(scope), Self.isIdentifier(value) else { return nil }
        return value
    }

    func save(_ setupIntentId: String, scope: String) throws {
        guard Self.isIdentifier(setupIntentId) else { throw APIError.invalidResponse }
        try store.set(setupIntentId, for: scope)
    }

    func clear(scope: String) throws {
        try store.delete(scope)
    }

    private static func isIdentifier(_ value: String) -> Bool {
        value.range(of: "^seti_[A-Za-z0-9]+$", options: .regularExpression) != nil
    }
}
