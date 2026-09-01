//
//  TerminalStateViewModel.swift
//  Pantopus
//
//  D7 Unavailable / Expired / Paused / Secret (Stream I7). Every status is a
//  FIRST-CLASS state keyed by the page/link response — NEVER an error screen. A
//  slug resolves the public booking page (`GET /api/public/book/:slug`); a
//  one-off token resolves the single-use link (`GET /api/public/book/o/:token`).
//  `status:'paused'` is calm, a 404 on a one-off is "expired", a 404 on a page is
//  "no longer available". Tokens only.
//

import SwiftUI

/// The terminal states an invitee link can land in. Driven by the live response;
/// the design's full set is modelled so the screen renders any of them honestly.
enum TerminalKind: Equatable {
    case notFound
    case privateLink
    case expired
    case paused
    case fullyBooked
    case cancelled
}

@Observable
@MainActor
final class TerminalStateViewModel {
    enum State: Equatable {
        case loading
        case resolved(TerminalKind, hostName: String?)
        case error(message: String)
    }

    let slug: String?
    let oneOffToken: String?
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private var didLoad = false
    private var isFetching = false

    /// The `private`-link access code the invitee types into the inline field
    /// (design: "Have a code?" → "Enter access code"). View-only for now; the
    /// unlock round-trip is deferred backend.
    var accessCode: String = ""

    /// The paused host's note + reopen label, shown in the paused note card
    /// (design: "A note from Maria" + "Reopens Jun 20"). The booking page does
    /// not yet wire these, so they stay `nil` (card is hidden) until the backend
    /// surfaces them — see `deferredBackend`.
    private(set) var hostNote: String?
    private(set) var reopenLabel: String?

    /// Designated, test-injectable initializer (no default-argument `@MainActor`
    /// init — Xcode 16.4 crashes on those).
    init(
        slug: String?,
        oneOffToken: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.slug = slug
        self.oneOffToken = oneOffToken
        self.push = push
        self.client = client
    }

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        guard !isFetching else { return }
        isFetching = true
        defer { isFetching = false }
        state = .loading

        if let oneOffToken {
            await resolveOneOff(oneOffToken)
        } else if let slug {
            await resolvePage(slug)
        } else {
            state = .resolved(.notFound, hostName: nil)
        }
    }

    private func resolveOneOff(_ token: String) async {
        do {
            let view: OneOffBookView = try await client.request(SchedulingPublicEndpoints.oneOffView(token: token))
            // A one-off that still resolves but offers nothing is fully booked;
            // otherwise the link has been consumed/expired by the time we route here.
            state = .resolved(view.slots.isEmpty ? .fullyBooked : .expired, hostName: nil)
        } catch let error as SchedulingError {
            switch error {
            case .notFound, .conflict:
                state = .resolved(.expired, hostName: nil)
            case .transport:
                state = .error(message: error.userMessage ?? "Can't reach Pantopus. Check your connection.")
            default:
                state = .resolved(.expired, hostName: nil)
            }
        } catch {
            state = .resolved(.expired, hostName: nil)
        }
    }

    private func resolvePage(_ slug: String) async {
        do {
            let view: PublicBookView = try await client.request(SchedulingPublicEndpoints.bookPage(slug: slug))
            let hostName = firstName(from: view.page.title)
            switch view.status {
            case .paused:
                state = .resolved(.paused, hostName: hostName)
            case .secret:
                state = .resolved(.privateLink, hostName: hostName)
            case .expired:
                state = .resolved(.expired, hostName: hostName)
            case .unavailable:
                state = .resolved(.notFound, hostName: hostName)
            case .active, .unknown:
                state = .resolved(view.eventTypes.isEmpty ? .fullyBooked : .notFound, hostName: hostName)
            }
        } catch let error as SchedulingError {
            switch error {
            case .notFound:
                state = .resolved(.notFound, hostName: nil)
            case .forbidden:
                state = .resolved(.privateLink, hostName: nil)
            case .transport:
                state = .error(message: error.userMessage ?? "Can't reach Pantopus. Check your connection.")
            default:
                state = .resolved(.notFound, hostName: nil)
            }
        } catch {
            state = .resolved(.notFound, hostName: nil)
        }
    }

    /// Re-open the host's public page (Book again / try this link).
    func openBookingPage() {
        guard let slug, !slug.isEmpty else { return }
        push(.inviteeLanding(slug: slug))
    }

    /// Submit the typed access code to unlock a `private` link. View-only stub —
    /// the unlock endpoint is deferred backend; no-ops when the field is blank.
    func submitAccessCode() {
        guard !accessCode.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        // Deferred: POST the code, re-resolve the page on success.
    }

    /// "Request a new link" (expired) / "Notify me when …" (paused, fully booked)
    /// secondary CTAs. View-only stubs — the notify/relink endpoints are deferred
    /// backend.
    func requestNewLink() {
        // Deferred: trigger a fresh single-use link for this invitee.
    }

    func notifyWhenAvailable() {
        // Deferred: subscribe the invitee to reopen / new-times notifications.
    }

    /// The resolved host's first name (for the paused note card header), falling
    /// back to "the host" when the page carries no title.
    var hostNameLabel: String {
        if case let .resolved(_, hostName) = state, let hostName, !hostName.isEmpty {
            return hostName
        }
        return "the host"
    }

    private func firstName(from title: String?) -> String? {
        let trimmed = (title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return trimmed.split(separator: " ").first.map(String.init)
    }
}

#if DEBUG
extension TerminalStateViewModel {
    static func preview(_ kind: TerminalKind, hostName: String? = "Maria") -> TerminalStateViewModel {
        let viewModel = TerminalStateViewModel(slug: "ada", oneOffToken: nil, push: { _ in }, client: .shared)
        viewModel.state = .resolved(kind, hostName: hostName)
        viewModel.didLoad = true
        if kind == .paused {
            viewModel.hostNote = "Out of office for a bit — back to taking bookings soon. Thanks for your patience."
            viewModel.reopenLabel = "Reopens Jun 20"
        }
        return viewModel
    }
}
#endif
