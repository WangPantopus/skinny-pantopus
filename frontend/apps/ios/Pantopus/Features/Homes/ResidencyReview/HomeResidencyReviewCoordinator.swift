import Foundation
import Observation

/// Current authorization is read before every dispatch or acknowledgement.
/// Restoring an original never submits it automatically or grants access.
@Observable
@MainActor
final class HomeResidencyReviewCoordinator {
    private(set) var pending: PendingHomeResidencyReview?
    private(set) var review: HomeResidencyCurrentReview?
    private(set) var isBusy = false
    private(set) var storageFailed = false
    private(set) var canDiscard = false
    private let scope: HomeResidencyReviewScope
    private let store: any PendingHomeResidencyReviewStoring
    private let transport: any HomeResidencyReviewTransport
    private let requireCurrent: () throws -> Void
    private let requestId: () -> String
    private var revision = 0
    private var sessionScope: String?
    private var knownReceipt: HomeResidencyReviewReceipt?
    private var expectedRequestId: String?
    private static var activeScopes = Set<HomeResidencyReviewScope>()

    init(
        scope: HomeResidencyReviewScope,
        store: any PendingHomeResidencyReviewStoring,
        transport: any HomeResidencyReviewTransport,
        requireCurrent: @escaping () throws -> Void,
        requestId: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) {
        self.scope = scope
        self.store = store
        self.transport = transport
        self.requireCurrent = requireCurrent
        self.requestId = requestId
    }

    var receipt: HomeResidencyReviewReceipt? {
        knownReceipt ?? pending?.receipt
    }

    func open(requestedClaim: String?) async throws {
        try await operation { revision in
            self.review = nil
            self.canDiscard = false
            try self.restore()
            if let claim = self.pending?.claimId ?? requestedClaim { try await self.readCurrent(claim, revision: revision) }
        }
    }

    func prepare(action: HomeResidencyDecision, role: HomeResidencyReviewRole, reason: String) throws {
        try requireCurrent()
        guard !isBusy, pending == nil, knownReceipt == nil, try readSaved() == nil,
              let review, review.canDecide(actorId: scope.actorId),
              review.matches(scope, claimId: review.claimId, expectedSession: sessionScope) else { throw HomeResidencyReviewError.changed }
        var body: [String: JSONValue] = ["request_id": .string(requestId()), "review_token": .string(review.reviewToken)]
        if action == .approve {
            body["proposed_role"] = .string(role.rawValue)
        } else {
            body["reason"] = .string(reason.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        let draft = PendingHomeResidencyReview(scope: scope, claimId: review.claimId, action: action, body: .object(body))
        guard draft.matches(scope) else { throw HomeResidencyReviewError.changed }
        try replace(expected: nil, next: draft)
        pending = draft
        expectedRequestId = draft.requestId
        canDiscard = false
    }

    func resolve() async throws {
        try await operation { revision in
            self.canDiscard = false
            try self.restore()
            guard let draft = self.pending else { throw HomeResidencyReviewError.changed }
            try await self.readCurrent(draft.claimId, revision: revision)
            guard let session = self.sessionScope else { throw HomeResidencyReviewError.unavailable }
            try self.requireSaved(draft)
            if let known = self.receipt {
                try self.persist(known, for: draft)
            } else {
                do {
                    let receipt = try await self.transport.decide(draft, sessionScope: session)
                    try self.current(revision)
                    guard receipt.matches(draft) else { throw HomeResidencyReviewError.unknown }
                    try self.persist(receipt, for: draft)
                } catch let HomeResidencyReviewError.refusal(code) {
                    try self.current(revision)
                    self.canDiscard = true
                    throw HomeResidencyReviewError.refusal(code)
                }
            }
            try await self.readCurrent(draft.claimId, revision: revision)
        }
    }

    func acknowledge(requestedClaim: String?) async throws {
        try await operation { revision in
            try self.restore()
            guard let draft = self.pending, draft.receipt != nil || self.canDiscard else { throw HomeResidencyReviewError.changed }
            try await self.readCurrent(draft.claimId, revision: revision)
            try self.requireSaved(draft)
            if let known = self.knownReceipt, draft.receipt?.projected() != known.projected() { throw HomeResidencyReviewError.changed }
            try self.replace(expected: draft, next: nil)
            self.pending = nil
            self.knownReceipt = nil
            self.expectedRequestId = nil
            self.canDiscard = false
            self.review = nil
            if let requestedClaim { try await self.readCurrent(requestedClaim, revision: revision) }
        }
    }

    func hide() {
        revision += 1
        review = nil
        pending = nil
        canDiscard = false
        // A known receipt survives a failed Keychain write in this process.
        // Process restart recovers the protected original using the same UUID.
    }

    private func operation(_ action: (Int) async throws -> Void) async throws {
        try requireCurrent()
        guard !isBusy, Self.activeScopes.insert(scope).inserted else { throw HomeResidencyReviewError.busy }
        isBusy = true
        defer { isBusy = false
            Self.activeScopes.remove(scope)
        }
        let opening = revision
        do {
            try await action(opening)
        } catch {
            try current(opening)
            if case HomeResidencyReviewError.unavailable = error { review = nil }
            if case HomeResidencyReviewError.sessionChanged = error { review = nil }
            throw error
        }
    }

    private func current(_ expected: Int) throws {
        try requireCurrent()
        guard revision == expected, !Task.isCancelled else { throw HomeResidencyReviewError.sessionChanged }
    }

    private func readCurrent(_ claimId: String, revision: Int) async throws {
        review = nil
        let result = try await transport.read(scope: scope, claimId: claimId, sessionScope: sessionScope)
        try current(revision)
        guard result.matches(scope, claimId: claimId, expectedSession: sessionScope) else { throw HomeResidencyReviewError.unavailable }
        sessionScope = result.sessionScope
        review = result
    }

    private func restore() throws {
        let saved = try readSaved()
        if let expectedRequestId, saved?.requestId != expectedRequestId { throw HomeResidencyReviewError.changed }
        if let pending, let saved, !pending.hasSameIntent(as: saved) { throw HomeResidencyReviewError.changed }
        if let knownReceipt {
            guard let saved, knownReceipt.matches(saved),
                  saved.receipt == nil || saved.receipt?.projected() == knownReceipt.projected()
            else { throw HomeResidencyReviewError.changed }
        }
        pending = saved
        expectedRequestId = saved?.requestId
        if knownReceipt == nil { knownReceipt = saved?.receipt }
    }

    private func requireSaved(_ draft: PendingHomeResidencyReview) throws {
        guard let saved = try readSaved(), saved == draft else { throw HomeResidencyReviewError.changed }
    }

    private func persist(_ receipt: HomeResidencyReviewReceipt, for draft: PendingHomeResidencyReview) throws {
        guard let saved = try readSaved(), saved.hasSameIntent(as: draft), receipt.matches(draft),
              saved.receipt == nil || saved.receipt?.projected() == receipt.projected() else { throw HomeResidencyReviewError.changed }
        if let knownReceipt, knownReceipt.projected() != receipt.projected() { throw HomeResidencyReviewError.changed }
        knownReceipt = receipt.projected()
        var confirmed = saved
        confirmed.receipt = knownReceipt
        try replace(expected: saved, next: confirmed)
        pending = confirmed
    }

    private func readSaved() throws -> PendingHomeResidencyReview? {
        do {
            let saved = try store.load(scope: scope)
            guard saved == nil || saved?.matches(scope) == true else { throw HomeResidencyReviewError.storage }
            storageFailed = false
            return saved
        } catch { storageFailed = true
            throw HomeResidencyReviewError.storage
        }
    }

    private func replace(expected: PendingHomeResidencyReview?, next: PendingHomeResidencyReview?) throws {
        do { try store.replace(scope: scope, expected: expected, next: next)
            storageFailed = false
        } catch { storageFailed = true
            throw HomeResidencyReviewError.storage
        }
    }
}
