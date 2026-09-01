//
//  MailRoutingQueueViewModel.swift
//  Pantopus
//
//  Mail routing queue — the disambiguation lane the Mailbox root's
//  "N items need routing" banner opens.
//
//  Mail that arrives addressed to a name the auto-router can't map to a
//  resident lands in `MailRoutingQueue` (`backend/routes/mailboxV2.js:530`).
//  This screen walks that queue one item at a time:
//
//    GET  /api/mailbox/v2/pending  (`mailboxV2.js:612`) — the queue
//    POST /api/mailbox/v2/resolve  (`mailboxV2.js:555`) — the answer
//
//  Behaviour mirrors the RN screen (`src/app/mailbox/disambiguate.tsx`):
//  one card per queued item, three drawer choices, an optional
//  "remember this name as my alias" toggle on the personal choice, and an
//  advance-or-dismiss step after each successful resolve.
//
//  This is a different surface from `DisambiguateMailFormView` (A13.15),
//  which resolves a *single, already-known* mail id from a scanned
//  envelope. That one takes a mail id; this one owns the queue.
//

import Foundation
import Observation

/// The three drawers `POST /api/mailbox/v2/resolve` accepts
/// (`resolveRoutingSchema`, `backend/routes/mailboxV2.js:12`; privacy map
/// at `:568`).
public enum MailRoutingDrawerOption: String, CaseIterable, Identifiable, Sendable {
    case personal
    case home
    case business

    public var id: String {
        rawValue
    }

    /// Row title — RN `disambiguate.tsx:86-88`.
    public var label: String {
        switch self {
        case .personal: "Me"
        case .home: "My Household"
        case .business: "My Business"
        }
    }

    /// Row subtitle — RN `disambiguate.tsx:86-88`.
    public var subtitle: String {
        switch self {
        case .personal: "This is my personal mail"
        case .home: "Shared household mail"
        case .business: "Business or company mail"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .personal: .user
        case .home: .home
        case .business: .briefcase
        }
    }
}

/// One queued item projected for the card.
public struct MailRoutingQueueEntry: Sendable, Equatable, Identifiable {
    public let id: String
    /// `MailRoutingQueue.recipient_name_raw` — the name the mail carries.
    public let recipientName: String
    /// Sender line for the preview card.
    public let senderDisplay: String
    /// Subject / preview line for the preview card. Empty → row hidden.
    public let previewText: String

    public init(
        id: String,
        recipientName: String,
        senderDisplay: String,
        previewText: String
    ) {
        self.id = id
        self.recipientName = recipientName
        self.senderDisplay = senderDisplay
        self.previewText = previewText
    }
}

/// Render state for the routing queue.
public enum MailRoutingQueueState: Sendable, Equatable {
    case loading
    /// Nothing left to route — RN's "All clear" frame.
    case empty
    case loaded(MailRoutingQueueEntry)
    case error(message: String)
}

@Observable
@MainActor
public final class MailRoutingQueueViewModel {
    public private(set) var state: MailRoutingQueueState = .loading

    /// 1-based position of the current card ("2 of 5"). Zero when empty.
    public private(set) var position: Int = 0
    /// Total unresolved items fetched in this session.
    public private(set) var total: Int = 0

    /// Drawer the user picked for the current item.
    public private(set) var selection: MailRoutingDrawerOption?
    /// "Add <name> as my alias" toggle — only meaningful on `.personal`.
    public var addAlias: Bool = false
    public private(set) var isSubmitting: Bool = false

    public var toast: ToastMessage?
    /// Flips true once the queue is drained via the CTA so the host can pop.
    public private(set) var shouldDismiss: Bool = false

    private let api: APIClient
    private var queue: [PendingRoutingItem] = []
    private var index: Int = 0

    /// Production initializer. `APIClient` is module-internal, so this
    /// cannot be `public` (see `MembersListViewModel.swift:204`).
    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - Derived presentation

    /// "2 of 5" header counter. Nil while loading / empty.
    public var counterLabel: String? {
        guard total > 0, position > 0 else { return nil }
        return "\(position) of \(total)"
    }

    /// Alias-toggle row copy — RN `disambiguate.tsx:159`.
    public var aliasLabel: String {
        guard case let .loaded(entry) = state else { return "" }
        return "Add \u{201C}\(entry.recipientName)\u{201D} as my alias"
    }

    /// Alias row is only offered when routing to the personal drawer,
    /// matching RN (`disambiguate.tsx:154`) and the backend, which only
    /// writes a `MailAlias` row for the caller (`mailboxV2.js:589`).
    public var showsAliasToggle: Bool {
        selection == .personal
    }

    public var canSubmit: Bool {
        guard case .loaded = state else { return false }
        return selection != nil && !isSubmitting
    }

    public func isSelected(_ option: MailRoutingDrawerOption) -> Bool {
        selection == option
    }

    // MARK: - Lifecycle

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: PendingRoutingResponse = try await api.request(
                MailboxRoutingEndpoints.pending()
            )
            queue = response.pending
            index = 0
            total = queue.count
            applyCurrent()
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load the routing queue."
            )
        }
    }

    // MARK: - Intents

    public func select(_ option: MailRoutingDrawerOption) {
        selection = option
        if option != .personal { addAlias = false }
    }

    /// Resolve the current item, then advance to the next one (or signal
    /// dismissal when the queue is drained) — RN `disambiguate.tsx:34-56`.
    @discardableResult
    public func submit() async -> Bool {
        guard case let .loaded(entry) = state, let selection, !isSubmitting else { return false }
        isSubmitting = true
        defer { isSubmitting = false }
        let wantsAlias = selection == .personal && addAlias
        let request = ResolveRoutingRequest(
            mailId: entry.id,
            drawer: selection.rawValue,
            addAlias: wantsAlias ? true : nil,
            aliasString: wantsAlias ? entry.recipientName : nil
        )
        do {
            let _: ResolveRoutingResponse = try await api.request(
                MailboxV2Endpoints.resolve(request)
            )
            advance()
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Failed to resolve routing",
                kind: .error
            )
            return false
        }
    }

    public func acknowledgeDismiss() {
        shouldDismiss = false
    }

    // MARK: - Queue walking

    private func advance() {
        if index < queue.count - 1 {
            index += 1
            applyCurrent()
        } else {
            // Last item resolved — RN pops back to the mailbox.
            shouldDismiss = true
        }
    }

    private func applyCurrent() {
        selection = nil
        addAlias = false
        guard index < queue.count else {
            position = 0
            state = .empty
            return
        }
        position = index + 1
        state = .loaded(Self.project(queue[index]))
    }

    // MARK: - Projection

    static func project(_ item: PendingRoutingItem) -> MailRoutingQueueEntry {
        let name = item.recipientNameRaw?.trimmingCharacters(in: .whitespacesAndNewlines)
        let mail = item.mail
        let preview = [mail?.previewText, mail?.content, mail?.subject]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty } ?? ""
        let sender = [mail?.senderDisplay, mail?.senderBusinessName]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty } ?? "Unknown sender"
        return MailRoutingQueueEntry(
            id: item.mailId,
            recipientName: (name?.isEmpty == false ? name : nil) ?? "this address",
            senderDisplay: sender,
            previewText: preview
        )
    }
}
