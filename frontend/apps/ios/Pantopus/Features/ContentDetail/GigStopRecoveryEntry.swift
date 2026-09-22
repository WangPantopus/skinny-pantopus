import Foundation
import Observation

/// Recovery remains available when the action itself removed the assignment or
/// ordinary detail access. The protected status route decides current access.
@Observable
@MainActor
final class GigStopRecoveryEntry {
    private var savedOrUnreadable = false
    private let gig: String
    private let actor: String?
    private let api: APIClient
    private let store: any PendingGigStopStoring
    private let identity: () -> GigStopViewModel.Identity?
    private let opening: GigStopViewModel.Identity?

    init(
        gig: String,
        actor: String?,
        api: APIClient,
        store: any PendingGigStopStoring,
        identity: (() -> GigStopViewModel.Identity?)? = nil
    ) {
        self.gig = gig
        self.actor = actor
        self.api = api
        self.store = store
        let resolve = identity ?? { GigStopViewModel.currentIdentity(api: api) }
        self.identity = resolve
        opening = resolve()
    }

    var isCurrent: Bool {
        opening != nil && actor != nil && opening?.actor == actor && identity() == opening
            && UUID(uuidString: actor ?? "") != nil && UUID(uuidString: gig) != nil
    }

    var available: Bool {
        isCurrent && savedOrUnreadable
    }

    func refresh() {
        savedOrUnreadable = false
        guard isCurrent, let opening, let actor else { return }
        do {
            let request = try store.load(scope: GigStopViewModel.storageScope(origin: opening.origin, actor: actor, gig: gig))
            // An unreadable or inconsistent record must remain visible so the
            // user can check it; it never permits inventing another request.
            savedOrUnreadable = request != nil
        } catch { savedOrUnreadable = true }
    }

    func makeRecoveryModel() -> GigStopViewModel? {
        guard available, let actor else { return nil }
        return GigStopViewModel(
            gig: gig,
            actor: actor,
            action: .cancel,
            api: api,
            store: store,
            recoveryOnly: true,
            identity: identity
        )
    }

    func makeModel(action: GigStopAction = .cancel) -> GigStopViewModel? {
        guard isCurrent, let actor else { return nil }
        return GigStopViewModel(gig: gig, actor: actor, action: action, api: api, store: store, identity: identity)
    }
}
