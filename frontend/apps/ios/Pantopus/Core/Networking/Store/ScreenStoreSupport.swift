//
//  ScreenStoreSupport.swift
//  Pantopus
//
//  The screen store's value types (what a screen gets back, an entry, a
//  fetched reply) and its account and app-lifecycle observation. The store
//  itself is in `ScreenStore.swift`.
//

import Foundation
import UIKit

/// A copy the store holds, decoded for one screen.
struct ScreenSnapshot<Value: Sendable> {
    let value: Value
    /// When the server last confirmed this copy (a 200 or a 304). Screens show
    /// this time, not timestamps inside the body.
    let fetchedAt: Date
    /// Inside the kind's fresh window and not marked out of date.
    let isFresh: Bool
    /// The last refresh failed (a network error, or a reply saying it failed).
    let refreshFailed: Bool
    let kind: ScreenDataKind

    /// Older than the kind's max shown age.
    var isPastMaxShownAge: Bool {
        Date().timeIntervalSince(fetchedAt) > kind.maxShownAge
    }

    /// The quiet "Couldn't refresh. Showing 3:42 PM." line (contract section 3).
    var showsRefreshFailureLine: Bool {
        refreshFailed && isPastMaxShownAge
    }
}

/// A reply the server sent with 200 whose body says the read failed (for
/// example Today's `{ today: null, error }`): the store keeps its copy.
struct ScreenStoreReplyFailed: Error {}

/// One kept reply. The raw bytes stay (the saved copy writes them later) and
/// each type a screen asked for is decoded once.
final class ScreenStoreEntry {
    var data: Data
    var etag: String?
    var kind: ScreenDataKind
    var fetchedAt: Date
    var lastUsed: Date
    var topics: Set<String> = []
    var staleMark = false
    var expiresAt: Date?
    var refreshFailedAt: Date?
    var showsBeforeRecheck = true
    var decoded: [ObjectIdentifier: any Sendable] = [:]

    init(data: Data, etag: String?, kind: ScreenDataKind, at date: Date) {
        self.data = data
        self.etag = etag
        self.kind = kind
        fetchedAt = date
        lastUsed = date
    }

    /// The server confirmed this copy (a 200 that wrote it, or a 304).
    func confirm(at date: Date, kind: ScreenDataKind, topics: Set<String>, expiresAt: Date?, showsBeforeRecheck: Bool) {
        self.kind = kind
        fetchedAt = date
        lastUsed = date
        self.topics.formUnion(topics.map { $0.lowercased() })
        staleMark = false
        self.expiresAt = expiresAt
        refreshFailedAt = nil
        self.showsBeforeRecheck = showsBeforeRecheck
    }
}

/// A reply as it came off the wire.
struct ScreenStoreFetched {
    let status: Int
    let data: Data
    let etag: String?
}

extension ScreenStore {
    /// What a reply must still match to be written: no wipe since, the same
    /// account, and (signed in) the same session (`HomeClaimSessionScope`).
    struct Start {
        let generation: Int
        let account: String?
        let scope: HomeClaimSessionScope
    }

    struct InFlight {
        let id: UUID
        let task: Task<ScreenStoreFetched, any Error>
    }

    static func isRefusal(_ error: any Error) -> Bool {
        switch error as? APIError {
        case .forbidden, .notFound: true
        default: false
        }
    }

    static func account(of auth: AuthManager) -> String? {
        if case let .signedIn(user) = auth.state { return user.id }
        return nil
    }

    nonisolated static func decoder() -> JSONDecoder {
        // Same rules as `APIClient`: per-field `CodingKeys`, ISO 8601 dates.
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    nonisolated static func decodeOffMain<Value: Decodable & Sendable>(
        _ type: Value.Type,
        from data: Data
    ) async throws -> Value {
        try await Task.detached(priority: .userInitiated) {
            try decoder().decode(type, from: data)
        }.value
    }

    /// Any change of the signed-in account (sign-out on every path, a revoked
    /// session, an account switch) wipes the store.
    func observeAccount() {
        withObservationTracking {
            _ = auth.state
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let account = Self.account(of: auth)
                if account != observedAccount {
                    observedAccount = account
                    wipe()
                }
                observeAccount()
            }
        }
    }

    /// Coming back after 15 minutes marks every copy out of date; a memory
    /// warning trims to what's on screen.
    func observeLifecycle() {
        let center = NotificationCenter.default
        let background = UIApplication.didEnterBackgroundNotification
        let foreground = UIApplication.willEnterForegroundNotification
        let memory = UIApplication.didReceiveMemoryWarningNotification
        observers.append(center.addObserver(forName: background, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.backgroundedAt = self?.now() }
        })
        observers.append(center.addObserver(forName: foreground, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, let since = self.backgroundedAt else { return }
                self.backgroundedAt = nil
                if self.now().timeIntervalSince(since) >= Self.backgroundStaleAfter { self.markAllStale() }
            }
        })
        observers.append(center.addObserver(forName: memory, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.trimForMemoryWarning() }
        })
    }
}
