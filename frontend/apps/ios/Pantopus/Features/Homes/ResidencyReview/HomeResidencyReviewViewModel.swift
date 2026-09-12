import Foundation
import Observation

@Observable
@MainActor
final class HomeResidencyReviewViewModel: Identifiable {
    let id = UUID()
    let requestedClaim: String?
    private let scope: HomeResidencyReviewScope
    private let session: HomeClaimSessionScope
    private let api: APIClient
    private let coordinator: HomeResidencyReviewCoordinator
    private let initialAction: HomeResidencyDecision
    private var generation = 0
    private var visible = false
    private(set) var isWorking = false
    private(set) var opened = false
    private(set) var error: String?
    private(set) var claimant: String?
    var reviewed = false
    var action: HomeResidencyDecision {
        didSet { if action != oldValue { reviewed = false } }
    }

    var role = HomeResidencyReviewRole.member {
        didSet { if role != oldValue { reviewed = false } }
    }

    var reason = "" {
        didSet { if reason != oldValue { reviewed = false } }
    }

    init(
        scope: HomeResidencyReviewScope,
        requestedClaim: String?,
        action: HomeResidencyDecision,
        api: APIClient,
        session: HomeClaimSessionScope,
        store: any PendingHomeResidencyReviewStoring,
        transport: (any HomeResidencyReviewTransport)? = nil
    ) {
        self.scope = scope
        self.requestedClaim = requestedClaim
        self.action = action
        initialAction = action
        self.api = api
        self.session = session
        coordinator = HomeResidencyReviewCoordinator(
            scope: scope, store: store, transport: transport ?? APIHomeResidencyReviewTransport(api: api)
        ) { try session.requireCurrent() }
    }

    static func live(homeId: String, claimId: String? = nil, action: HomeResidencyDecision = .approve, api: APIClient = .shared) -> Self {
        let auth = api.authProvider ?? AuthManager.shared
        let actor: String = if case let .signedIn(user) = auth.state { user.id } else { "" }
        return Self(
            scope: HomeResidencyReviewScope(origin: api.apiBaseURL.absoluteString, actorId: actor, homeId: homeId.lowercased()),
            requestedClaim: claimId?.lowercased(),
            action: action,
            api: api,
            session: HomeClaimSessionScope(api: api),
            store: PendingHomeResidencyReviewStore()
        )
    }

    var isCurrent: Bool {
        session.isCurrent && scope.isValid && (requestedClaim == nil || HomePostalValidation.uuid(requestedClaim))
    }

    var review: HomeResidencyCurrentReview? {
        visible && isCurrent ? coordinator.review : nil
    }

    var pending: PendingHomeResidencyReview? {
        review != nil ? coordinator.pending : nil
    }

    var receipt: HomeResidencyReviewReceipt? {
        pending != nil ? coordinator.receipt : nil
    }

    var storageFailed: Bool {
        coordinator.storageFailed
    }

    var showsDecisionForm: Bool {
        coordinator.pending == nil && review?.canDecide(actorId: scope.actorId) == true
    }

    var unavailableDecisionMessage: String {
        if review?.applicantId == scope.actorId { return "You cannot approve or reject your own membership." }
        return "This claim is no longer pending. Review its current membership and any saved original decision."
    }

    var canDecide: Bool {
        visible && isCurrent && !isWorking && !coordinator.isBusy && !storageFailed
            && coordinator.pending == nil && review?.canDecide(actorId: scope.actorId) == true
    }

    var canSubmit: Bool {
        canDecide && reviewed && (action == .approve || reason.utf16.count <= 2000)
    }

    var canAcknowledge: Bool {
        !isWorking && !storageFailed && pending != nil && (pending?.receipt != nil || coordinator.canDiscard)
    }

    var canRetry: Bool {
        !isWorking && pending != nil && pending?.receipt == nil
    }

    var isRecoveringAnotherClaim: Bool {
        if let requestedClaim, let pending { return pending.claimId != requestedClaim }
        return false
    }

    func suspend() {
        generation += 1
        visible = false
        isWorking = false
        opened = false
        error = nil
        claimant = nil
        resetForm()
        coordinator.hide()
    }

    func open() async {
        guard !isWorking else { return }
        visible = true
        guard isCurrent else { error = HomeResidencyReviewError.sessionChanged.localizedDescription
            return
        }
        resetForm()
        await run { revision in
            try await self.coordinator.open(requestedClaim: self.requestedClaim)
            guard self.current(revision) else { return }
            self.opened = true
            await self.loadClaimant(revision)
        }
    }

    func submit() async {
        guard canSubmit else { return }
        let selectedAction = action
        let selectedRole = role
        let selectedReason = reason
        await run { revision in
            try self.coordinator.prepare(action: selectedAction, role: selectedRole, reason: selectedReason)
            self.reason = ""
            self.reviewed = false
            try await self.coordinator.resolve()
            await self.loadClaimant(revision)
        }
    }

    func retry() async {
        guard canRetry else { return }
        await run { revision in
            try await self.coordinator.resolve()
            await self.loadClaimant(revision)
        }
    }

    func acknowledge() async {
        guard canAcknowledge else { return }
        await run { revision in
            try await self.coordinator.acknowledge(requestedClaim: self.requestedClaim)
            self.resetForm()
            await self.loadClaimant(revision)
        }
    }

    private func resetForm() {
        action = initialAction
        role = .member
        reason = ""
        reviewed = false
    }

    private func current(_ revision: Int) -> Bool {
        visible && isCurrent && generation == revision
    }

    private func run(_ task: (Int) async throws -> Void) async {
        guard !isWorking, visible, isCurrent else { return }
        let revision = generation
        isWorking = true
        error = nil
        claimant = nil
        defer { if current(revision) { isWorking = false } }
        do {
            try await task(revision)
        } catch {
            guard current(revision) else { return }
            reviewed = false
            self.error = (error as? HomeResidencyReviewError)?.localizedDescription
                ?? HomeResidencyReviewError.unavailable.localizedDescription
        }
    }

    private func loadClaimant(_ revision: Int) async {
        guard current(revision), let applicant = review?.applicantId else { return }
        // Public identity is descriptive; only the exact prepared review above
        // establishes which applicant and Home the decision concerns.
        let value: JSONValue? = try? await api.request(Endpoint(method: .get, path: "/api/users/id/\(applicant)"))
        guard current(revision), review?.applicantId == applicant else { return }
        let fields = value?.dictValue?["user"]?.dictValue ?? value?.dictValue
        guard fields?["id"]?.stringValue == applicant else { return }
        claimant = fields?["name"]?.stringValue ?? fields?["username"]?.stringValue
    }
}
