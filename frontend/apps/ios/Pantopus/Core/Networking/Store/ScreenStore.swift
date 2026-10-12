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
//  Reads go memory, then the saved copy on the phone (`ScreenStoreDisk`,
//  section 7), then the network. Value types and the account and lifecycle
//  observation are in `ScreenStoreSupport.swift`.
//

// The store, its saved copy and its seeds share private state; keeping them
// in one file keeps that state private.
// swiftlint:disable file_length

import Foundation
import Logging
import Observation

@Observable
@MainActor
final class ScreenStore {
    static let shared = ScreenStore(disk: .shared)

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
    /// The saved copy on the phone; nil for private stores (tests, previews).
    @ObservationIgnored let disk: ScreenStoreDisk?
    @ObservationIgnored private let logger = Logger(label: "app.pantopus.ios.ScreenStore")

    /// - Parameters: `api` / `auth` for tests; the live app resolves the shared
    ///   instances lazily (with the app lock on, `APIClient.shared` is created
    ///   only after unlock).
    init(
        api: APIClient? = nil,
        auth: AuthManager? = nil,
        disk: ScreenStoreDisk? = nil,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        injectedAPI = api
        injectedAuth = auth
        self.disk = disk
        self.now = now
        observedAccount = Self.account(of: auth ?? AuthManager.shared)
        observeAccount()
        observeLifecycle()
        if disk != nil { WidgetSnapshotStore.shared.removeLegacyToday() }
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
        guard let key = key(for: endpoint), let entry = entry(for: key), entry.showsBeforeRecheck,
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
    /// - A network error keeps the copy and marks the failure; a quiet read
    ///   then answers with that copy (if it may show before a re-check), a
    ///   forced one rethrows. A 200 that `failedIf` rejects does the same but
    ///   always rethrows; a screen with content stays as it is.
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
        // Memory, then the saved copy (its ETag makes an unchanged reply a 304).
        let held = entry(for: key)
        if let held, let showsBeforeRecheck, let value = decoded(held, as: type) {
            held.showsBeforeRecheck = showsBeforeRecheck(value)
            if !held.showsBeforeRecheck { unsave(key) }
        }
        if !force, let entry = held, isFresh(entry), let value = decoded(entry, as: type) {
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
                throw error
            }
            markFailed(key, kind)
            // A quiet read that can't reach the server answers with the copy it
            // has (marked failed: offline, the saved copy opens the screen); a
            // forced one (pull to refresh, Try again) says it failed.
            if !force, let entry = held ?? entries[key], entry.showsBeforeRecheck, let value = decoded(entry, as: type) {
                return snapshot(entry, value)
            }
            throw error
        }
        try dropIfLate(start)
        if fetched.status == 304, let entry = entries[key], let value = decoded(entry, as: type) {
            let shows = showsBeforeRecheck?(value) ?? true
            entry.confirm(at: now(), kind: kind, topics: topics, expiresAt: expiresAt, showsBeforeRecheck: shows)
            save(key, entry)
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
        save(key, entry)
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
        unsave(key)
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

// MARK: - Out of date, writing and removal

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

    /// Keeps a reply a screen read itself (the Home dashboard's access check
    /// reads 403 answers too, so it can't go through `load`).
    func put(_ endpoint: Endpoint, data: Data, kind: ScreenDataKind, topics: Set<String>, showsBeforeRecheck: Bool) {
        guard kind != .sensitive, let key = key(for: endpoint) else { return }
        let entry = ScreenStoreEntry(data: data, etag: nil, kind: kind, at: now())
        entry.confirm(at: now(), kind: kind, topics: topics, expiresAt: nil, showsBeforeRecheck: showsBeforeRecheck)
        entries[key] = entry
        save(key, entry)
        enforceLimits()
        bump(key)
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
        // The app's own store (not a test's) also owns the images on the phone.
        if let disk {
            disk.removeAll()
            PantopusImagePipeline.shared.removeAll()
            WidgetSnapshotStore.shared.clearToday()
        }
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

// MARK: - The saved copy (contract sections 5 to 7)

extension ScreenStore {
    /// Replies the phone never keeps, whoever reads them: the Hub overview
    /// (bill items, bills due, notification titles) and a Home's dashboard
    /// (the next bill, bill and document counts). Bills and notifications are
    /// never saved (contract sections 4 and 5); these stay in memory.
    static func isNeverSaved(_ path: String) -> Bool {
        path == "/api/hub" || (path.hasPrefix("/api/homes/") && path.hasSuffix("/dashboard"))
    }

    /// The entry in memory, else the saved copy on the phone. A saved copy is
    /// never fresh: it shows at once and is re-checked once.
    private func entry(for key: Key) -> ScreenStoreEntry? {
        if let entry = entries[key] { return entry }
        guard let disk else { return nil }
        if Self.isNeverSaved(key.path) {
            // A file an older build saved for it goes, unread.
            disk.remove(folder: folder(for: key), file: file(for: key))
            return nil
        }
        guard let saved = disk.read(folder: folder(for: key), file: file(for: key), now: now()),
              let kind = ScreenDataKind(rawValue: saved.kind), kind.savedOnPhone else { return nil }
        let entry = ScreenStoreEntry(data: saved.data, etag: saved.etag, kind: kind, at: saved.fetchedAt)
        entry.topics = Set(saved.topics)
        entry.expiresAt = saved.expiresAt
        entry.staleMark = true
        entry.lastUsed = now()
        entries[key] = entry
        enforceLimits()
        count("saved", kind)
        return entry
    }

    /// Writes an entry the phone may keep: never sensitive data or a reply
    /// that is never saved, and only while it may show before the re-check
    /// (including Today's household subset). Other copies are deleted.
    private func save(_ key: Key, _ entry: ScreenStoreEntry) {
        guard let disk else { return }
        guard !Self.isNeverSaved(key.path), entry.kind.savedOnPhone,
              entry.showsBeforeRecheck else {
            disk.remove(folder: folder(for: key), file: file(for: key))
            return
        }
        let saved = SavedScreenEntry(
            schema: SavedScreenEntry.currentSchema,
            build: disk.build,
            kind: entry.kind.rawValue,
            fetchedAt: entry.fetchedAt,
            etag: entry.etag,
            topics: entry.topics.sorted(),
            expiresAt: entry.expiresAt,
            data: entry.data
        )
        disk.write(saved, folder: folder(for: key), file: file(for: key))
    }

    private func unsave(_ key: Key) {
        disk?.remove(folder: folder(for: key), file: file(for: key))
    }

    private func folder(for key: Key) -> String {
        disk?.folder(server: key.server, account: key.account) ?? ""
    }

    private func file(for key: Key) -> String {
        disk?.file(method: key.method, path: key.path, query: key.query) ?? ""
    }
}
