//
//  GigSavedSearchesViewModel.swift
//  Pantopus
//
//  Backs the "Saved searches" manage sheet (P6a). Loads the caller's
//  saved searches (`GET /api/gigs/saved-searches`), projects each row
//  to a render-only content struct (stored-or-derived name + criteria
//  summary + relative created date), and owns the optimistic notify
//  toggle (PATCH) and delete (DELETE) with revert-on-failure.
//

import Foundation
import Observation

/// Render state for the manage sheet. Four-state per the house rule.
public enum GigSavedSearchesState: Sendable {
    case loading
    case empty
    case loaded([GigSavedSearchRowContent])
    case error(message: String)
}

/// Render-only projection of one saved search row.
public struct GigSavedSearchRowContent: Identifiable, Sendable, Hashable {
    public let id: String
    /// Stored name, or a client-derived one when the row has none.
    public let name: String
    /// One-line criteria recap ("under $100 · One-time · within 5 mi").
    public let summary: String
    /// Relative created date ("Saved 2d ago"); nil when unparseable.
    public let createdLabel: String?
    /// Alert toggle state — mutated optimistically by `setNotify`.
    public var notify: Bool
}

/// Saved-searches manage sheet view-model.
@Observable
@MainActor
public final class GigSavedSearchesViewModel {
    /// Current render state.
    public private(set) var state: GigSavedSearchesState = .loading

    /// Error surfacing for toggle / delete failures (same pattern as
    /// the Gigs feed). The view clears it after the toast expires.
    public var toast: ToastMessage?

    private let api: APIClient
    private let now: () -> Date
    private var rows: [GigSavedSearchRowContent] = []

    init(api: APIClient = .shared, now: @escaping () -> Date = Date.init) {
        self.api = api
        self.now = now
    }

    /// First-time load. No-op once we have content.
    public func load() async {
        if case .loaded = state { return }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    /// `GET /api/gigs/saved-searches` — route
    /// `backend/routes/gigSavedSearches.js:44`.
    private func fetch() async {
        if case .loaded = state {} else { state = .loading }
        do {
            let response: GigSavedSearchListResponse = try await api.request(
                GigSavedSearchesEndpoints.list()
            )
            let reference = now()
            rows = response.searches.map { Self.project($0, now: reference) }
            rebuildState()
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load saved searches."
            state = .error(message: message)
        }
    }

    /// Notify toggle — optimistic flip, `PATCH
    /// /api/gigs/saved-searches/:id` (route
    /// `backend/routes/gigSavedSearches.js:143`), revert on failure.
    public func setNotify(id: String, to value: Bool) async {
        guard let index = rows.firstIndex(where: { $0.id == id }),
              rows[index].notify != value else { return }
        let snapshot = rows
        rows[index].notify = value
        rebuildState()
        do {
            _ = try await api.request(
                GigSavedSearchesEndpoints.update(id: id, body: UpdateGigSavedSearchBody(notify: value)),
                as: GigSavedSearchSaveResponse.self
            )
        } catch {
            rows = snapshot
            rebuildState()
            toast = ToastMessage(text: "Couldn't update alerts.", kind: .error)
        }
    }

    /// Delete — optimistic removal, `DELETE
    /// /api/gigs/saved-searches/:id` (route
    /// `backend/routes/gigSavedSearches.js:163`), revert on failure.
    public func deleteSearch(id: String) async {
        guard rows.contains(where: { $0.id == id }) else { return }
        let snapshot = rows
        rows.removeAll { $0.id == id }
        rebuildState()
        do {
            _ = try await api.request(GigSavedSearchesEndpoints.delete(id: id), as: EmptyResponse.self)
        } catch {
            rows = snapshot
            rebuildState()
            toast = ToastMessage(text: "Couldn't delete that search.", kind: .error)
        }
    }

    private func rebuildState() {
        state = rows.isEmpty ? .empty : .loaded(rows)
    }
}

// MARK: - Projection

extension GigSavedSearchesViewModel {
    /// `GigSavedSearchDTO` → render row. Pure + internal for tests.
    static func project(_ dto: GigSavedSearchDTO, now: Date) -> GigSavedSearchRowContent {
        GigSavedSearchRowContent(
            id: dto.id,
            name: displayName(dto),
            summary: summaryLine(dto),
            createdLabel: createdLabel(dto.createdAt, now: now),
            notify: dto.notify ?? true
        )
    }

    /// Stored name, or a derived "Cleaning · “mount tv”" style fallback
    /// (category + quoted query — the summary line carries the rest).
    static func displayName(_ dto: GigSavedSearchDTO) -> String {
        if let name = dto.name, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return name
        }
        var pieces = [dto.category.map { GigsCategory.from(backendKey: $0).label } ?? "All tasks"]
        if let search = dto.search, !search.isEmpty {
            pieces.append("\u{201C}\(search)\u{201D}")
        }
        return pieces.joined(separator: " · ")
    }

    /// One-line criteria recap mirroring the saved server fields.
    static func summaryLine(_ dto: GigSavedSearchDTO) -> String {
        var pieces: [String] = []
        switch (dto.minPrice, dto.maxPrice) {
        case let (min?, max?): pieces.append("$\(Int(min))–$\(Int(max))")
        case let (min?, nil): pieces.append("over $\(Int(min))")
        case let (nil, max?): pieces.append("under $\(Int(max))")
        case (nil, nil): break
        }
        if let schedule = scheduleLabel(dto.scheduleType) { pieces.append(schedule) }
        if let pay = payLabel(dto.payType) { pieces.append(pay) }
        if let radius = dto.radiusMiles {
            let label = radius.truncatingRemainder(dividingBy: 1) == 0
                ? "\(Int(radius)) mi"
                : String(format: "%.1f mi", radius)
            pieces.append("within \(label)")
        }
        return pieces.isEmpty ? "Any criteria" : pieces.joined(separator: " · ")
    }

    /// Backend `schedule_type` enum → user-facing label.
    static func scheduleLabel(_ raw: String?) -> String? {
        switch raw {
        case "asap": "ASAP"
        case "today": "Today"
        case "scheduled": "One-time"
        case "flexible": "Flexible"
        default: nil
        }
    }

    /// Backend `pay_type` enum → user-facing label.
    static func payLabel(_ raw: String?) -> String? {
        switch raw {
        case "offers": "open to bids"
        case "hourly": "hourly"
        case "fixed": "fixed price"
        default: nil
        }
    }

    /// Relative "Saved 2d ago" label. `nil` when the timestamp is
    /// missing or unparseable.
    static func createdLabel(_ iso: String?, now: Date) -> String? {
        guard let date = parseTimestamp(iso) else { return nil }
        let interval = max(0, now.timeIntervalSince(date))
        if interval < 60 { return "Saved just now" }
        if interval < 3600 { return "Saved \(Int(interval / 60))m ago" }
        if interval < 86400 { return "Saved \(Int(interval / 3600))h ago" }
        if interval < 604_800 { return "Saved \(Int(interval / 86400))d ago" }
        return "Saved \(Int(interval / 604_800))w ago"
    }

    /// ISO-8601 parse tolerant of Supabase's microsecond fractions
    /// (`ISO8601DateFormatter` only accepts millisecond precision).
    static func parseTimestamp(_ iso: String?) -> Date? {
        if let date = GigFilterCriteria.parseDate(iso) { return date }
        guard let iso else { return nil }
        let trimmed = iso.replacingOccurrences(
            of: #"(\.\d{3})\d+"#,
            with: "$1",
            options: .regularExpression
        )
        return GigFilterCriteria.parseDate(trimmed)
    }
}
