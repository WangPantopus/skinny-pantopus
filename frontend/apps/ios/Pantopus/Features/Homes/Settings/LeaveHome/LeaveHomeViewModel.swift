import Foundation

/// Settings and the waiting room use the same protected self-removal original.
@MainActor
@Observable
public final class LeaveHomeViewModel {
    public let homeId: String
    private let scope: HomeCreationScope
    var actorId: String {
        scope.actorId
    }

    let removal: HomeMemberRemovalViewModel

    init(homeId: String, api: APIClient = .shared, store: any PendingHomeMemberRemovalStoring = PendingHomeMemberRemovalStore()) {
        self.homeId = homeId
        let scope = HomeInvitationDecisionViewModel.scope(api: api)
        self.scope = scope
        removal = HomeMemberRemovalViewModel(target: .init(homeId: homeId, userId: scope.actorId), api: api, store: store)
    }

    func acknowledgedSelfRemoval(_ original: PendingHomeMemberRemoval?) -> Bool {
        original?.matches(scope) == true && original?.homeId == homeId && original?.targetId == actorId
            && original?.outcome?.state == "completed"
    }
}
