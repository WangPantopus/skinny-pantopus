//
//  ScreenStore.swift
//  Pantopus
//
//  Instant Screens store (docs/product/instant-screens-contract-2026-10-09.md
//  section 6): the app's one cache of API reads, beside `APIClient`. A screen
//  shows the store's copy the moment it has one and never keeps its own; a
//  quiet refresh runs only when the copy is out of date or a refresh is
//  forced, concurrent asks for one key share one request, and a refresh sends
//  `If-None-Match` so unchanged data costs a 304. Replies that land after an
//  account switch, a sign-out or a wipe are dropped.
//
//  This is the memory layer. The saved copy on the phone (section 7) reads and
//  writes through the same entries later. Value types and the account and
//  lifecycle observation are in `ScreenStoreSupport.swift`.
//

import Foundation
import Logging
import Observation

@Observable
@MainActor
final class ScreenStore {
    static let shared = ScreenStore()

    /// Server + account + method + path + sorted query. Tokens never appear in keys.
    struct Key: Hashable, CustomStringConvertible {
        let server: String
        let account: String
        let method: String
        let path: String
        let query: String

        var description: String {
            query.isEmpty ? "\(method) \(path)" : "\(method) \(path)?\(query)"
        }
    }

    /// The memory limits of contract section 6.
    static let maxEntries = 200
    static let maxSeeds = 300
    static let unusedLifetime: TimeInterval = 30 * 60
    /// Coming back to the app after this long marks every copy out of date.
    static let backgroundStaleAfter: TimeInterval = 15 * 60

    /// Changes whenever an entry is written, marked or removed, so a view can
    /// observe `revision(for:)` and re-read.
    private(set) var revisions: [Key: Int] = [:]
    /// Bumped by every wipe: replies already in flight can't write into the new state.
    @ObservationIgnored private(set) var generation = 0

    @ObservationIgnored private var entries: [Key: ScreenStoreEntry] = [:]
    @ObservationIgnored private var inFlight: [Key: InFlight] = [:]
    /// Rows another screen already shows (a feed card's post), by the key of
    /// the detail read they stand in for. Memory only, never fresh or saved.
    @ObservationIgnored private var seeds: [Key: any Sendable] = [:]
    @ObservationIgnored private var seedOrder: [Key] = []
    @ObservationIgnored private var counts: [String: Int] = [:]
    /// When each topic (or `kind:<kind>`) was last marked out of date, for
    /// readers that keep a short-lived answer of their own.
    @ObservationIgnored private var marks: [String: Date] = [:]
    @ObservationIgnored var observedAccount: String?
    @ObservationIgnored var backgroundedAt: Date?
    @ObservationIgnored var observers: [NSObjectProtocol] = []
    @ObservationIgnored let now: @Sendable () -> Date
    @ObservationIgnored private let injectedAPI: APIClient?
    @ObservationIgnored private let injectedAuth: AuthManager?
    @ObservationIgnored private let logger = Logger(label: "app.pantopus.ios.ScreenStore")

    /// - Parameters: `api` / `auth` for tests; the live app resolves the shared
    ///   instances lazily (with the app lock on, `APIClient.shared` is created
    ///   only after unlock).
    init(api: APIClient? = nil, auth: AuthManager? = nil, now: @escaping @Sendable () -> Date = { Date() }) {
        injectedAPI = api
        injectedAuth = auth
        self.now = now
        observedAccount = Self.account(of: auth ?? AuthManager.shared)
        observeAccount()
        observeLifecycle()
    }

    /// The store a screen reads through: the shared one for the app's client,
    /// a private one for an injected client (unit tests, previews).
    static func store(for api: APIClient) -> ScreenStore {
        api === APIClient.shared ? shared : ScreenStore(api: api, auth: api.authProvider)
    }

    var api: APIClient {
        injectedAPI ?? APIClient.shared
    }

    var auth: AuthManager {
        injectedAuth ?? AuthManager.shared
    }

    // MARK: - Reading

    /// The copy the store holds for `endpoint`, if it may be shown before a
    /// re-check: never for sensitive data, and for household data only when
    /// the viewer is an owner or household member.
    func peek<Value: Decodable & Sendable>(_ endpoint: Endpoint, as type: Value.Type = Value.self) -> ScreenSnapshot<Value>? {
        guard let key = key(for: endpoint), let entry = entries[key], entry.showsBeforeRecheck,
              let value = decoded(entry, as: type) else { return nil }
        entry.lastUsed = now()
        return snapshot(entry, value)
    }

    /// The store's copy when it is fresh; otherwise one request (shared with
    /// any concurrent ask for the same key) with `If-None-Match`. `force`
    /// (pull to refresh, Retry, a change signal) always asks the server.
    ///
    /// - A 304 keeps the copy and resets its time; a 200 replaces it.
    /// - A 403 or 404 deletes the copy and rethrows (the screen shows the
    ///   server's answer); a 401 runs the existing sign-in flow in `APIClient`.
    /// - A network error, or a 200 that `failedIf` rejects, keeps the copy,
    ///   marks the failure and rethrows; a screen with content stays as it is.
    /// - A reply that lands after a wipe or an account change throws
    ///   `CancellationError` and writes nothing.
    /// - `showsBeforeRecheck` decides from the reply whether the copy may show
    ///   before the next re-check (household data: owners and household roles
    ///   only; guests, service providers and expiring access re-check first).
    @discardableResult
    func load<Value: Decodable & Sendable>(
        _ endpoint: Endpoint,
        as type: Value.Type = Value.self,
        kind: ScreenDataKind,
        topics: Set<String> = [],
        force: Bool = false,
        expiresAt: Date? = nil,
        showsBeforeRecheck: (@Sendable (Value) -> Bool)? = nil,
        failedIf: (@Sendable (Value) -> Bool)? = nil
    ) async throws -> ScreenSnapshot<Value> {
        guard kind != .sensitive, let key = key(for: endpoint) else {
            // Sensitive reads and anything the store can't key go straight through.
            let value: Value = try await api.request(endpoint)
            return ScreenSnapshot(value: value, fetchedAt: now(), isFresh: true, refreshFailed: false, kind: kind)
        }
        if !force, let entry = entries[key], isFresh(entry), let value = decoded(entry, as: type) {
            entry.lastUsed = now()
            count("hit", kind)
            return snapshot(entry, value)
        }
        let start = Start(generation: generation, account: Self.account(of: auth), scope: HomeClaimSessionScope(api: api))
        let fetched: ScreenStoreFetched
        do {
            fetched = try await fetch(key: key, endpoint: endpoint)
        } catch {
            try dropIfLate(start)
            if Self.isRefusal(error) {
                remove(key)
            } else {
                markFailed(key, kind)
            }
            throw error
        }
        try dropIfLate(start)
        if fetched.status == 304, let entry = entries[key], let value = decoded(entry, as: type) {
            let shows = showsBeforeRecheck?(value) ?? true
            entry.confirm(at: now(), kind: kind, topics: topics, expiresAt: expiresAt, showsBeforeRecheck: shows)
            bump(key)
            count("304", kind)
            return snapshot(entry, value)
        }
        let value: Value
        do {
            value = try await Self.decodeOffMain(type, from: fetched.data)
        } catch {
            try dropIfLate(start)
            markFailed(key, kind)
            logger.error("Store decode failed for \(key)", metadata: ["error": .string("\(error)")])
            throw APIError.decoding(underlying: error)
        }
        try dropIfLate(start)
        if let failedIf, failedIf(value) {
            markFailed(key, kind)
            throw ScreenStoreReplyFailed()
        }
        let entry = ScreenStoreEntry(data: fetched.data, etag: fetched.etag, kind: kind, at: now())
        let shows = showsBeforeRecheck?(value) ?? true
        entry.confirm(at: now(), kind: kind, topics: topics, expiresAt: expiresAt, showsBeforeRecheck: shows)
        entry.decoded[ObjectIdentifier(type)] = value
        entries[key] = entry
        enforceLimits()
        bump(key)
        count("200", kind)
        return snapshot(entry, value)
    }

    /// What a screen calls on appear (the conversion recipe): the store's copy
    /// at once through `apply`, then, only when it is out of date (or `force`),
    /// the refreshed copy through `apply` again. Errors are `load`'s: a screen
    /// that already shows content keeps it.
    func show<Value: Decodable & Sendable>(
        _ endpoint: Endpoint,
        as type: Value.Type = Value.self,
        kind: ScreenDataKind,
        topics: Set<String> = [],
        force: Bool = false,
        showsBeforeRecheck: (@Sendable (Value) -> Bool)? = nil,
        apply: (ScreenSnapshot<Value>) -> Void
    ) async throws {
        if !force, let copy = peek(endpoint, as: type) {
            apply(copy)
            if copy.isFresh { return }
        }
        let fresh = try await load(
            endpoint,
            as: type,
            kind: kind,
            topics: topics,
            force: force,
            showsBeforeRecheck: showsBeforeRecheck
        )
        apply(fresh)
    }

    /// The copy is inside its fresh window (no request needed on return).
    func isFresh(_ endpoint: Endpoint) -> Bool {
        guard let key = key(for: endpoint), let entry = entries[key] else { return false }
        return isFresh(entry)
    }

    /// Observing this re-renders a view when the entry changes.
    func revision(for endpoint: Endpoint) -> Int {
        key(for: endpoint).flatMap { revisions[$0] } ?? 0
    }

    /// Phase 1 measurement: how often each kind's window was hit, revalidated
    /// (304), refreshed (200) or failed.
    var windowCounts: [String: Int] {
        counts
    }

    // MARK: - Keys

    func key(for endpoint: Endpoint) -> Key? {
        guard endpoint.method == .get else { return nil }
        let account: String
        if let signedIn = Self.account(of: auth) {
            account = signedIn
        } else if endpoint.authenticated {
            return nil
        } else {
            account = "anon"
        }
        let query = endpoint.query.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        return Key(
            server: api.apiBaseURL.absoluteString,
            account: account,
            method: endpoint.method.rawValue,
            path: endpoint.path,
            query: query
        )
    }

    // MARK: - Private

    private func isFresh(_ entry: ScreenStoreEntry) -> Bool {
        guard entry.showsBeforeRecheck, !entry.staleMark else { return false }
        if let expiresAt = entry.expiresAt, now() >= expiresAt { return false }
        return now().timeIntervalSince(entry.fetchedAt) < entry.kind.freshFor
    }

    private func snapshot<Value: Sendable>(_ entry: ScreenStoreEntry, _ value: Value) -> ScreenSnapshot<Value> {
        ScreenSnapshot(
            value: value,
            fetchedAt: entry.fetchedAt,
            isFresh: isFresh(entry),
            refreshFailed: entry.refreshFailedAt != nil,
            kind: entry.kind
        )
    }

    private func decoded<Value: Decodable & Sendable>(_ entry: ScreenStoreEntry, as type: Value.Type) -> Value? {
        if let value = entry.decoded[ObjectIdentifier(type)] as? Value { return value }
        guard let value = try? Self.decoder().decode(type, from: entry.data) else { return nil }
        entry.decoded[ObjectIdentifier(type)] = value
        return value
    }

    /// One request per key: a second ask while one is running awaits it.
    private func fetch(key: Key, endpoint: Endpoint) async throws -> ScreenStoreFetched {
        if let running = inFlight[key] {
            return try await running.task.value
        }
        let etag = entries[key]?.etag
        var headers = endpoint.headers
        if let etag { headers["If-None-Match"] = etag }
        // The store is the only cache: never answer from, or write to, the URL cache.
        let conditional = Endpoint(
            method: endpoint.method,
            path: endpoint.path,
            query: endpoint.query,
            headers: headers,
            authenticated: endpoint.authenticated,
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeout: endpoint.timeout,
            dispatchGuard: endpoint.dispatchGuard
        )
        let client = api
        let task = Task<ScreenStoreFetched, any Error> {
            let reply = try await client.requestDataResponse(conditional)
            return ScreenStoreFetched(
                status: reply.response.statusCode,
                data: reply.data,
                etag: reply.response.value(forHTTPHeaderField: "ETag")
            )
        }
        let id = UUID()
        inFlight[key] = InFlight(id: id, task: task)
        defer { if inFlight[key]?.id == id { inFlight[key] = nil } }
        let fetched = try await task.value
        // A 304 for a copy removed meanwhile has nothing to keep: ask again plainly.
        if fetched.status == 304, entries[key] == nil, etag != nil {
            inFlight[key] = nil
            return try await fetch(key: key, endpoint: endpoint)
        }
        return fetched
    }

    private func dropIfLate(_ start: Start) throws {
        let late = generation != start.generation || Self.account(of: auth) != start.account
            || (start.account != nil && !start.scope.isCurrent)
        if late { throw CancellationError() }
    }

    private func markFailed(_ key: Key, _ kind: ScreenDataKind) {
        guard let entry = entries[key] else { return }
        entry.refreshFailedAt = now()
        bump(key)
        count("failure", kind)
    }

    private func remove(_ key: Key) {
        entries[key] = nil
        bump(key)
    }

    private func bump(_ key: Key) {
        revisions[key, default: 0] += 1
    }

    private func enforceLimits() {
        let cutoff = now().addingTimeInterval(-Self.unusedLifetime)
        for (key, entry) in entries where entry.lastUsed < cutoff && inFlight[key] == nil {
            entries[key] = nil
            revisions[key] = nil
        }
        guard entries.count > Self.maxEntries else { return }
        let oldest = entries.sorted { $0.value.lastUsed < $1.value.lastUsed }.prefix(entries.count - Self.maxEntries)
        for (key, _) in oldest {
            entries[key] = nil
            revisions[key] = nil
        }
    }

    private func count(_ event: String, _ kind: ScreenDataKind) {
        counts["\(kind.rawValue).\(event)", default: 0] += 1
        logger.debug("store \(event) \(kind.rawValue)")
    }
}

// MARK: - Out of date and removal

extension ScreenStore {
    /// Marks every entry carrying one of `topics` out of date (contract
    /// section 8). They stay on screen and refresh when next shown.
    func markStale(topics: Set<String>) {
        let topics = Set(topics.map { $0.lowercased() })
        for topic in topics {
            marks[topic] = now()
        }
        for (key, entry) in entries where !entry.topics.isDisjoint(with: topics) {
            entry.staleMark = true
            bump(key)
        }
    }

    /// Marks every entry of these kinds out of date (a socket reconnect marks
    /// Household, Messages and Notifications entries).
    func markStale(kinds: Set<ScreenDataKind>) {
        for kind in kinds {
            marks["kind:\(kind.rawValue)"] = now()
        }
        for (key, entry) in entries where kinds.contains(entry.kind) {
            entry.staleMark = true
            bump(key)
        }
    }

    func markAllStale() {
        markStale(kinds: Set(ScreenDataKind.allCases))
    }

    func remove(_ endpoint: Endpoint) {
        if let key = key(for: endpoint) { remove(key) }
    }

    /// Sign-out, a revoked session, an account switch or deletion, Clear
    /// cache: everything goes, and replies already in flight are dropped.
    func wipe() {
        generation += 1
        for flight in inFlight.values {
            flight.task.cancel()
        }
        inFlight.removeAll()
        entries.removeAll()
        revisions.removeAll()
        seeds.removeAll()
        seedOrder.removeAll()
        marks.removeAll()
    }

    /// The memory warning: keep only what screens used in the last minute
    /// (what's on screen), drop the rest.
    func trimForMemoryWarning() {
        let cutoff = now().addingTimeInterval(-60)
        for (key, entry) in entries where entry.lastUsed < cutoff && inFlight[key] == nil {
            entries[key] = nil
            revisions[key] = nil
        }
        seeds.removeAll()
        seedOrder.removeAll()
    }
}

// MARK: - Seeds

extension ScreenStore {
    /// A list's row that stands in for `endpoint`'s detail until that read
    /// answers (a post opened from the feed shows the feed's card at once).
    func seed(_ value: some Sendable, for endpoint: Endpoint) {
        guard let key = key(for: endpoint) else { return }
        if seeds.updateValue(value, forKey: key) == nil { seedOrder.append(key) }
        guard seedOrder.count > Self.maxSeeds else { return }
        for old in seedOrder.prefix(seedOrder.count - Self.maxSeeds) {
            seeds[old] = nil
        }
        seedOrder.removeFirst(seedOrder.count - Self.maxSeeds)
    }

    func seeded<Value: Sendable>(_ endpoint: Endpoint, as _: Value.Type = Value.self) -> Value? {
        key(for: endpoint).flatMap { seeds[$0] as? Value }
    }
}

// MARK: - Answers kept outside the store

extension ScreenStore {
    /// Whether any of `topics`, or every entry of `kind`, was marked out of
    /// date after `date` (Today's radon card keeps its own answer).
    func wasMarked(topics: Set<String>, kind: ScreenDataKind, since date: Date) -> Bool {
        let names = topics.map { $0.lowercased() } + ["kind:\(kind.rawValue)"]
        return names.contains { (marks[$0] ?? .distantPast) > date }
    }
}
