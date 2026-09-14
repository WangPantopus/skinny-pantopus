import Foundation
import Observation

@Observable
@MainActor
final class HomeRelationshipViewModel: Identifiable {
    enum Failure: LocalizedError, Equatable {
        case changedRequest, storage
        var errorDescription: String? {
            switch self {
            case .changedRequest: "The saved decision changed elsewhere. Reload to recover the original."
            case .storage: "The saved decision could not be read. It has been kept; no new decision was submitted."
            }
        }
    }

    let id = UUID()
    private(set) var review: HomeRelationshipReview?
    private(set) var pending: HomeRelationshipDraft?
    private(set) var loading = false
    private(set) var busy = false
    private(set) var error: String?
    private(set) var canDismiss = false
    private(set) var empty = false
    var action: HomeRelationshipAction {
        didSet { reviewed = false }
    }

    var note = "" {
        didSet { reviewed = false }
    }

    var reviewed = false

    private let homeId: String
    private let requestedClaim: String?
    private let api: APIClient
    private let session: HomeClaimSessionScope
    private let store: any PendingHomeRelationshipStoring
    private let actor: String
    private let origin: String
    private let scope: String
    private var serverSession: String?
    private var visible = false
    private var retired = false
    private var reloadQueued = false
    private(set) var activationRevision = 0
    private static var active = Set<String>()

    init(
        homeId: String,
        claimId: String? = nil,
        action: HomeRelationshipAction = .decline,
        api: APIClient = .shared,
        store: any PendingHomeRelationshipStoring = PendingHomeRelationshipStore()
    ) {
        self.homeId = homeId
        requestedClaim = claimId
        self.action = action
        self.api = api
        self.store = store
        session = HomeClaimSessionScope(api: api)
        if case let .signedIn(user) = (api.authProvider ?? AuthManager.shared).state { actor = user.id } else { actor = "" }
        origin = api.apiBaseURL.absoluteString
        scope = "relationship-v1|\(origin)|\(actor)|\(homeId)"
    }

    var isCurrent: Bool {
        !retired && !actor.isEmpty && session.isCurrent
    }

    var isActive: Bool {
        visible && isCurrent
    }

    var canEdit: Bool {
        isActive && !busy && !loading && pending == nil && review?.claim.canDecide(actor: actor) == true
    }

    var canSubmit: Bool {
        canEdit && reviewed && note.trimmingCharacters(in: .whitespacesAndNewlines).utf16.count <= 1000
    }

    var recoveringAnotherClaim: Bool {
        guard let requestedClaim, let pending else { return false }
        return pending.claimId != requestedClaim
    }

    func activate(ifCurrent revision: Int) async {
        guard revision == activationRevision, !Task.isCancelled else { return }
        visible = true
        await load()
    }

    func load() async {
        guard isActive, !Task.isCancelled else { return }
        if busy { reloadQueued = true
            return
        }
        activationRevision += 1
        let revision = activationRevision
        loading = true
        clearContent()
        error = nil
        do {
            try current(revision)
            let saved = try readSaved()
            if let claim = saved?.claimId ?? requestedClaim {
                let result = try await currentReview(claim, revision)
                guard try readSaved() == saved else { throw Failure.changedRequest }
                try current(revision)
                review = result
                pending = saved
            } else { empty = true }
        } catch { record(error, revision: revision) }
        if revision == activationRevision { loading = false }
    }

    func submit() async {
        guard canSubmit, let claim = review?.claim else { return }
        let draft = HomeRelationshipDraft(
            version: 1,
            origin: origin,
            actorId: actor,
            homeId: homeId,
            claimId: claim.id,
            command: HomeRelationshipCommand(
                action: action,
                note: note.trimmingCharacters(in: .whitespacesAndNewlines),
                requestId: UUID().uuidString.lowercased(),
                reviewToken: claim.reviewToken
            )
        )
        await perform(new: draft)
    }

    func retry() async {
        guard pending != nil, pending?.confirmed == nil else { return }
        await perform(new: nil)
    }

    private func perform(new draft: HomeRelationshipDraft?) async {
        guard begin() else { return }
        let revision = activationRevision
        defer { finish() }
        do {
            try current(revision)
            guard try readSaved() == pending else { throw Failure.changedRequest }
            let original: HomeRelationshipDraft
            if let draft {
                guard pending == nil, draft.matches(origin: origin, actor: actor, home: homeId) else { throw Failure.changedRequest }
                try store.save(draft, scope: scope, matching: nil)
                pending = draft
                original = draft
            } else {
                guard let saved = pending, saved.confirmed == nil else { throw Failure.changedRequest }
                original = saved
            }
            // Current ordinary authority is required even for historical recovery.
            // Keep the original review token: substituting the new one changes intent.
            let before = try await currentReview(original.claimId, revision)
            try current(revision)
            guard try readSaved() == original else { throw Failure.changedRequest }
            review = before
            let result: HomeRelationshipResponse = try await api.request(Endpoint(
                method: .post,
                path: path(original.claimId, suffix: "resolve-relationship"),
                body: original.command,
                headers: headers
            ))
            try current(revision)
            guard result.matches(original, claimant: before.claim.claimantUserId) else { throw APIError.invalidResponse }
            var confirmed = original
            confirmed.confirmed = result.receipt
            try store.save(confirmed, scope: scope, matching: original)
            pending = confirmed
            review = try await currentReview(original.claimId, revision)
            reviewed = false
        } catch { record(error, revision: revision) }
    }

    func acknowledge() async {
        guard let original = pending, original.confirmed != nil || canDismiss, begin() else { return }
        let revision = activationRevision
        defer { finish() }
        do {
            let result = try await currentReview(original.claimId, revision)
            try current(revision)
            guard try readSaved() == original else { throw Failure.changedRequest }
            try store.clear(scope: scope, matching: original)
            pending = nil
            review = result
            note = ""
            reviewed = false
        } catch { record(error, revision: revision) }
    }

    private var headers: [String: String] {
        serverSession.map { ["X-Pantopus-Session-Scope": $0] } ?? [:]
    }

    private func path(_ claim: String, suffix: String) -> String {
        "/api/homes/\(homeId)/ownership-claims/\(claim)/\(suffix)"
    }

    private func currentReview(_ claim: String, _ revision: Int) async throws -> HomeRelationshipReview {
        try current(revision)
        guard UUID(uuidString: homeId) != nil, UUID(uuidString: claim) != nil else { throw APIError.invalidResponse }
        let result: HomeRelationshipReview = try await api.request(Endpoint(
            method: .get,
            path: path(claim, suffix: "relationship-decision"),
            headers: headers,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        ))
        try current(revision)
        guard result.matches(home: homeId, claimId: claim, actor: actor),
              serverSession == nil || serverSession == result.relationshipSession.sessionScope else {
            throw HomeClaimReviewError.sessionChanged
        }
        serverSession = result.relationshipSession.sessionScope
        return result
    }

    private func current(_ revision: Int) throws {
        guard visible, revision == activationRevision else { throw CancellationError() }
        guard isCurrent else { throw HomeClaimReviewError.sessionChanged }
        try Task.checkCancellation()
    }

    private func readSaved() throws -> HomeRelationshipDraft? {
        do {
            let saved = try store.load(scope: scope)
            guard saved == nil || saved?.matches(origin: origin, actor: actor, home: homeId) == true else { throw Failure.storage }
            return saved
        } catch { throw Failure.storage }
    }

    private func begin() -> Bool {
        guard isActive, !busy, !loading, review != nil, Self.active.insert(scope).inserted else { return false }
        busy = true
        error = nil
        canDismiss = false
        return true
    }

    private func finish() {
        busy = false
        Self.active.remove(scope)
        if reloadQueued, isActive {
            reloadQueued = false
            let revision = activationRevision
            Task { await self.activate(ifCurrent: revision) }
        }
    }

    private func record(_ failure: any Error, revision: Int) {
        guard visible, revision == activationRevision else { return }
        guard isCurrent else { retire()
            return
        }
        if failure is HomeClaimReviewError { retire()
            return
        }
        error = failure.localizedDescription
        switch failure {
        case APIError.unauthorized, APIError.forbidden, APIError.notFound: clearContent()
        case let APIError.clientError(status, body):
            let code = APIError.code(in: body) ?? ""
            if code == "SESSION_SCOPE_CHANGED" { retire()
                return
            }
            if [401, 403, 404].contains(status) { clearContent() }
            canDismiss = status == 409 && ["CLAIM_REVIEW_CHANGED", "CLAIM_NOT_ELIGIBLE", "CLAIM_CHALLENGE_REVIEW_REQUIRED"].contains(code)
        default: break
        }
    }

    private func clearContent() {
        review = nil
        pending = nil
        empty = false
        note = ""
        reviewed = false
        canDismiss = false
    }

    func suspend() {
        visible = false
        activationRevision += 1
        clearContent()
        loading = false
        error = nil
        reloadQueued = false
    }

    func retire() {
        suspend()
        retired = true
        serverSession = nil
        error = HomeClaimReviewError.sessionChanged.localizedDescription
    }
}
