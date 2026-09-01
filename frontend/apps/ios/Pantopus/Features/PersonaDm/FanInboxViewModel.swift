//
//  FanInboxViewModel.swift
//  Pantopus
//
//  Backs the fan side of persona DMs (A15.5). Loads the fan's own thread
//  list (`GET /api/personas/:id/dms/threads`,
//  `backend/routes/personaDms.js:185`) plus their membership
//  (`GET /api/personas/:id/membership`,
//  `backend/routes/personaMembership.js:108`) so the composer can show the
//  real remaining message-thread quota before a credit is spent.
//
//  Opening a thread posts `POST /api/personas/:id/dms/threads`
//  (`backend/routes/personaDms.js:135`) and **burns one credit**. The
//  402 / 403 rejections are mapped onto `FanInboxGate`, each with its own
//  copy, rather than a generic "request failed".
//

import Foundation
import Observation

@Observable
@MainActor
public final class FanInboxViewModel {
    public private(set) var state: FanInboxState = .loading

    /// Composer text for the open-thread call.
    public var draft: String = ""
    public private(set) var isOpening = false
    /// Confirmation after a successful open ("Sent. 2 threads left…").
    public private(set) var lastOpenConfirmation: String?

    private let api: APIClient
    private let personaId: String
    private var header = FanInboxStartContent(
        personaTitle: "Messages",
        personaName: "Creator",
        initials: "",
        quota: FanInboxQuota(remaining: nil, limit: nil),
        gate: nil
    )

    init(personaId: String, api: APIClient = .shared) {
        self.personaId = personaId
        self.api = api
    }

    public var canOpen: Bool {
        guard case let .start(content) = state else { return false }
        return content.gate == nil
            && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isOpening
    }

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        // Membership first: it decides `no_membership` / `tier_does_not_allow`
        // and supplies the quota chip. A 404 here is the no-membership state,
        // not a load failure.
        var membership: PersonaMembershipDTO?
        var membershipMissing = false
        do {
            let response: PersonaMembershipResponse = try await api.request(
                MembershipEndpoints.membership(personaId: personaId)
            )
            membership = response.membership
            membershipMissing = response.membership == nil
        } catch let error as APIError {
            switch error {
            case .notFound, .forbidden:
                membershipMissing = true
            default:
                state = .error(message: error.errorDescription ?? "Couldn't load your messages.")
                return
            }
        } catch {
            state = .error(message: "Couldn't load your messages.")
            return
        }

        header = Self.startContent(membership: membership, membershipMissing: membershipMissing)

        // With no membership the thread list is guaranteed empty (the
        // backend short-circuits), so skip the call entirely.
        if membershipMissing {
            state = .start(header)
            return
        }

        do {
            let response: PersonaThreadsResponse = try await api.request(
                PersonaDmEndpoints.threads(personaId: personaId)
            )
            if let thread = response.threads.first {
                state = .thread(threadId: thread.id)
            } else {
                state = .start(header)
            }
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load your messages."
            state = .error(message: message)
        }
    }

    /// Open a brand-new thread. Consumes one message-thread credit; the
    /// backend replies with the remaining count so the confirmation can
    /// state it exactly (mirrors RN's "Sent. N threads left this period.").
    public func openThread() async {
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isOpening else { return }
        isOpening = true
        lastOpenConfirmation = nil
        defer { isOpening = false }
        do {
            let response: PersonaDmOpenThreadResponse = try await api.request(
                PersonaDmEndpoints.openThread(
                    personaId: personaId,
                    body: PersonaDmMessageBody(body: trimmed)
                )
            )
            draft = ""
            lastOpenConfirmation = Self.openConfirmation(quotaRemaining: response.quotaRemaining)
            if let threadId = response.threadId {
                state = .thread(threadId: threadId)
            } else {
                await fetch()
            }
        } catch {
            state = .start(
                FanInboxStartContent(
                    personaTitle: header.personaTitle,
                    personaName: header.personaName,
                    initials: header.initials,
                    quota: header.quota,
                    gate: Self.gate(for: error) ?? header.gate
                )
            )
        }
    }

    static func openConfirmation(quotaRemaining: Int?) -> String {
        guard let quotaRemaining else { return "Sent." }
        let noun = quotaRemaining == 1 ? "thread" : "threads"
        return "Sent. \(quotaRemaining) \(noun) left this period."
    }

    /// Map an open-thread rejection onto its first-class state.
    ///
    /// `APIClient` collapses every 403 into `.forbidden` (the body is
    /// dropped), so `blocked` is the residual once `no_membership` and
    /// `tier_does_not_allow` have already been ruled out client-side from
    /// the membership read.
    static func gate(for error: any Error) -> FanInboxGate? {
        guard let apiError = error as? APIError else { return nil }
        switch apiError {
        case let .clientError(status, _) where status == 402:
            return .quotaExhausted
        case .forbidden:
            return .blocked
        case .notFound:
            return .noMembership
        default:
            return nil
        }
    }

    // MARK: - Projection

    static func startContent(
        membership: PersonaMembershipDTO?,
        membershipMissing: Bool
    ) -> FanInboxStartContent {
        let handle = membership?.persona?.handle
        let name = membership?.persona?.displayName ?? handle ?? "Creator"
        let perPeriod = membership?.tier?.msgThreadsPerPeriod
        let remaining = membership?.quotaRemaining?.msgThreads
        let quota = FanInboxQuota(remaining: remaining, limit: perPeriod)
        return FanInboxStartContent(
            personaTitle: handle.map { "@\($0)" } ?? "Messages",
            personaName: name,
            initials: PersonaDmThreadViewModel.initials(from: name),
            quota: quota,
            gate: gate(membershipMissing: membershipMissing, perPeriod: perPeriod, remaining: remaining)
        )
    }

    static func gate(membershipMissing: Bool, perPeriod: Int?, remaining: Int?) -> FanInboxGate? {
        if membershipMissing { return .noMembership }
        guard let perPeriod, perPeriod != 0 else { return .tierDoesNotAllow }
        // A negative `msgThreadsPerPeriod` means unlimited — never gated.
        if perPeriod < 0 { return nil }
        if let remaining, remaining <= 0 { return .quotaExhausted }
        return nil
    }
}
