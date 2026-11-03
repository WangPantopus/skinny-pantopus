//
//  AssistantMemoryViewModel.swift
//  Pantopus
//
//  Settings → What Pantopus remembers
//  (`docs/product/ai-assistant-phase3-contract-2026-10-22.md` §5.7): what the
//  person asked Pantopus to remember, newest first. A fact can be edited, any
//  item deleted, Forget everything deletes them all, and once a year the list
//  asks "Still right?" (§5.5). The list is the person's own: nobody in their
//  household sees it, and it is read from the server each time, never kept on
//  the phone.
//

import Foundation
import Observation

@Observable
@MainActor
final class AssistantMemoryViewModel {
    enum State: Equatable {
        case loading
        case empty
        case loaded
        case error(String)
    }

    /// One item as the list shows it.
    struct Row: Identifiable, Equatable {
        let id: String
        let fact: String
        /// "Home · Maple St · Private · From a chat on Oct 22".
        let caption: String
        /// Its home is one the person left: it isn't used until they delete it.
        let notInUse: Bool
        /// Only facts are edited; a "Plans you'd like" alert is deleted and asked for again.
        let editable: Bool
    }

    static let headerLine = "Pantopus uses these only for you. Your household doesn\u{2019}t see them."
    static let notInUseLine = "Not used: you\u{2019}re no longer in this home"

    private(set) var state: State = .loading
    private(set) var rows: [Row] = []
    /// A year since the oldest item was saved or confirmed: the list asks "Still right?".
    private(set) var reviewDue = false
    /// Items with a Delete or an edit in flight.
    private(set) var busyIds: Set<String> = []
    private(set) var isForgettingAll = false
    private(set) var isConfirmingReview = false
    var toast: ToastMessage?
    /// The item whose words are being edited.
    var editing: Row?
    var isForgetAllConfirmPresented = false

    private let api: APIClient
    private let now: @Sendable () -> Date

    init(api: APIClient = .shared, now: @escaping @Sendable () -> Date = { Date() }) {
        self.api = api
        self.now = now
    }

    func load() async {
        if case .loaded = state {} else { state = .loading }
        await read()
    }

    /// Pull to refresh: the rows stay while it reads.
    func refresh() async {
        await read()
    }

    private func read() async {
        do {
            let response: AIMemoryListResponse = try await api.request(AIEndpoints.memory())
            apply(items: response.items, reviewDueAt: response.reviewDueAt)
        } catch {
            if case .loaded = state {
                toast = ToastMessage(text: "Couldn\u{2019}t refresh. Check your connection and try again.", kind: .error)
            } else {
                state = .error((error as? APIError)?.errorDescription ?? "Check your connection and try again.")
            }
        }
    }

    private func apply(items: [AIMemoryItemDTO], reviewDueAt: String?) {
        rows = items.map { Self.row($0) }
        reviewDue = !items.isEmpty && Self.parse(reviewDueAt).map { $0 <= now() } == true
        state = rows.isEmpty ? .empty : .loaded
    }

    // MARK: - Actions

    /// Forgets one item. One already gone counts as forgotten.
    func delete(_ row: Row) async {
        guard !busyIds.contains(row.id), !isForgettingAll else { return }
        busyIds.insert(row.id)
        defer { busyIds.remove(row.id) }
        do {
            try await api.request(AIEndpoints.forgetMemory(id: row.id))
        } catch APIError.notFound {
            // Deleted already (another phone, or a retry whose first try went through).
        } catch {
            toast = ToastMessage(text: Self.message(error, fallback: "Couldn\u{2019}t delete it. Try again."), kind: .error)
            return
        }
        remove(ids: [row.id])
        toast = ToastMessage(text: "Deleted", kind: .success)
    }

    /// New words for a fact. Nil once saved, else the reason to show in the editor.
    func save(_ row: Row, fact: String) async -> String? {
        let words = fact.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !busyIds.contains(row.id) else { return nil }
        busyIds.insert(row.id)
        defer { busyIds.remove(row.id) }
        do {
            let response: AIMemoryItemResponse = try await api.request(AIEndpoints.editMemory(id: row.id, fact: words))
            if let index = rows.firstIndex(where: { $0.id == row.id }) {
                rows[index] = Self.row(response.item)
            }
            toast = ToastMessage(text: "Saved", kind: .success)
            // Editing an item counts as reviewing it; the review line reads again.
            await refresh()
            return nil
        } catch APIError.notFound {
            remove(ids: [row.id])
            return "That item is gone. It may have been deleted on another device."
        } catch {
            return Self.message(error, fallback: "Couldn\u{2019}t save it. Try again.")
        }
    }

    /// Forget everything, once the person confirmed it.
    func forgetAll() async {
        guard !isForgettingAll else { return }
        isForgettingAll = true
        defer { isForgettingAll = false }
        do {
            try await api.request(AIEndpoints.forgetAllMemory())
            remove(ids: Set(rows.map(\.id)))
            toast = ToastMessage(text: "Pantopus forgot everything", kind: .success)
        } catch {
            toast = ToastMessage(text: Self.message(error, fallback: "Couldn\u{2019}t forget them. Try again."), kind: .error)
        }
    }

    /// "Looks right": every item counts as confirmed today, so the review line goes.
    func confirmReview() async {
        guard !isConfirmingReview else { return }
        isConfirmingReview = true
        defer { isConfirmingReview = false }
        do {
            let response: AIMemoryReviewedResponse = try await api.request(AIEndpoints.memoryReviewed())
            reviewDue = Self.parse(response.reviewDueAt).map { $0 <= now() } == true
        } catch {
            toast = ToastMessage(text: Self.message(error, fallback: "Couldn\u{2019}t save that. Try again."), kind: .error)
        }
    }

    /// "Forget all 12 things?"
    var forgetAllTitle: String {
        rows.count == 1 ? "Forget the 1 thing Pantopus remembers?" : "Forget all \(rows.count) things?"
    }

    private func remove(ids: Set<String>) {
        rows.removeAll { ids.contains($0.id) }
        if rows.isEmpty {
            reviewDue = false
            state = .empty
        }
    }

    // MARK: - Projection

    static func row(_ item: AIMemoryItemDTO) -> Row {
        Row(
            id: item.id,
            fact: item.fact,
            caption: caption(item),
            notInUse: !item.inUse,
            editable: item.kind == "fact"
        )
    }

    /// The topic, the home, "Private" for a sensitive item, and where it came from.
    static func caption(_ item: AIMemoryItemDTO) -> String {
        var parts: [String] = [item.kind == "plan_alert" ? "Plans you\u{2019}d like" : topicLabel(item.topic)]
        if let label = item.home?.label, !label.isEmpty { parts.append(label) }
        if item.sensitive { parts.append("Private") }
        if let source = item.from, let at = parse(source.at ?? item.createdAt) {
            parts.append("From a chat on \(day(at))")
        } else if let at = parse(item.createdAt) {
            parts.append("Saved \(day(at))")
        }
        return parts.joined(separator: " \u{00B7} ")
    }

    static func topicLabel(_ topic: String) -> String {
        switch topic {
        case "you": "About you"
        case "household": "Household"
        case "home": "Home"
        case "plans": "Plans"
        case "nearby": "Nearby"
        default: "Other"
        }
    }

    /// "Oct 22", or "Oct 22, 2025" in another year.
    static func day(_ date: Date, now: Date = Date()) -> String {
        let calendar = Calendar.current
        let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: now)
        return date.formatted(sameYear ? .dateTime.month(.abbreviated).day() : .dateTime.month(.abbreviated).day().year())
    }

    static func parse(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
    }

    /// The server's own words when it gave some ("Pantopus doesn't keep passwords, PINs or codes").
    static func message(_ error: any Error, fallback: String) -> String {
        if case let APIError.clientError(_, body) = error, let text = APIError.friendlyClientMessage(body) {
            return text
        }
        if case APIError.transport = error { return "Can\u{2019}t reach Pantopus. Check your connection." }
        return fallback
    }
}
