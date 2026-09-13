import Foundation
import Observation

@MainActor
@Observable
final class HomeResidencyQueueViewModel {
    enum State: Equatable {
        case loading
        case ready(HomeResidencyQueuePage)
        case failure(HomeResidencyQueueError)
    }

    let identity: HomeResidencyQueueIdentity
    private let transport: any HomeResidencyQueueTransport
    private let current: () -> Bool
    private var storedState: State = .loading
    private var generation = 0
    private var visible = false

    var isCurrent: Bool {
        current() && identity.isValid
    }

    var state: State {
        !isCurrent ? .failure(.sessionChanged) : visible ? storedState : .loading
    }

    init(identity: HomeResidencyQueueIdentity, transport: any HomeResidencyQueueTransport, isCurrent: @escaping () -> Bool) {
        self.identity = identity
        self.transport = transport
        current = isCurrent
    }

    static func live(homeId: String, api: APIClient = .shared) -> HomeResidencyQueueViewModel {
        let auth = api.authProvider ?? AuthManager.shared
        let actorId: String = if case let .signedIn(user) = auth.state { user.id.lowercased() } else { "" }
        let scope = HomeClaimSessionScope(api: api)
        return Self(identity: .init(homeId: homeId.lowercased(), actorId: actorId), transport: APIHomeResidencyQueueTransport(api: api)) {
            scope.isCurrent
        }
    }

    func resume() {
        generation += 1
        visible = true
        storedState = .loading
    }

    func suspend() {
        generation += 1
        visible = false
        storedState = .loading
    }

    /// A displayed reference never bypasses a current-session check at the tap.
    /// Retire the collection before opening the separately authorized review.
    func beginReview(claimId: String) -> Bool {
        guard case let .ready(page) = state, page.claims.contains(where: { $0.id == claimId }) else { return false }
        suspend()
        return true
    }

    func refresh() async {
        guard visible, !Task.isCancelled else { return }
        generation += 1
        let revision = generation
        storedState = .loading
        do {
            try require(revision)
            let session = try await transport.session(actorId: identity.actorId)
            try require(revision)
            let page = try await transport.list(identity: identity, session: session)
            try require(revision)
            storedState = .ready(page)
        } catch {
            guard revision == generation, visible, !Task.isCancelled else { return }
            storedState = .failure(isCurrent ? (error as? HomeResidencyQueueError ?? .unavailable) : .sessionChanged)
        }
    }

    private func require(_ revision: Int) throws {
        guard revision == generation, visible, !Task.isCancelled else { throw CancellationError() }
        guard isCurrent else { throw HomeResidencyQueueError.sessionChanged }
    }
}
