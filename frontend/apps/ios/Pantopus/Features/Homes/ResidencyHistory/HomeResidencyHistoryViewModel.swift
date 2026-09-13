import Foundation
import Observation

@MainActor
@Observable
final class HomeResidencyHistoryViewModel {
    enum State: Equatable {
        case loading
        case list(HomeResidencyHistoryPage)
        case detail(HomeResidencyHistoryItem)
        case failure(HomeResidencyHistoryError)
    }

    private enum Operation {
        case recent
        case more(HomeResidencyHistoryPage)
        case detail(String)
    }

    let identity: HomeResidencyHistoryIdentity
    private let transport: any HomeResidencyHistoryTransport
    private let current: () -> Bool
    private var storedState: State = .loading
    private var generation = 0
    private var visible = false
    private var working = false
    private var retryOperation: Operation = .recent

    var isCurrent: Bool {
        current() && identity.isValid
    }

    var state: State {
        !isCurrent ? .failure(.sessionChanged) : visible ? storedState : .loading
    }

    var isWorking: Bool {
        isCurrent && visible && working
    }

    init(identity: HomeResidencyHistoryIdentity, transport: any HomeResidencyHistoryTransport, isCurrent: @escaping () -> Bool) {
        self.identity = identity
        self.transport = transport
        current = isCurrent
    }

    static func live(homeId: String, api: APIClient = .shared) -> HomeResidencyHistoryViewModel {
        let auth = api.authProvider ?? AuthManager.shared
        let actorId: String = if case let .signedIn(user) = auth.state { user.id.lowercased() } else { "" }
        let scope = HomeClaimSessionScope(api: api)
        return Self(
            identity: .init(homeId: homeId.lowercased(), actorId: actorId),
            transport: APIHomeResidencyHistoryTransport(api: api)
        ) { scope.isCurrent }
    }

    /// Synchronous lifecycle entry; queued reads cannot reactivate a suspended screen.
    func resume() {
        generation += 1
        visible = true
        working = false
        storedState = .loading
        retryOperation = .recent
    }

    func suspend() {
        generation += 1
        visible = false
        working = false
        storedState = .loading
        retryOperation = .recent
    }

    func refresh() async {
        await perform(.recent)
    }

    func retry() async {
        guard !isWorking else { return }
        await perform(retryOperation)
    }

    func loadMore() async {
        guard !isWorking, case let .list(page) = state, page.nextCursor != nil else { return }
        await perform(.more(page))
    }

    func open(_ receiptId: String) async {
        guard !isWorking, case let .list(page) = state, page.items.contains(where: { $0.id == receiptId }) else { return }
        await perform(.detail(receiptId))
    }

    private func require(_ revision: Int) throws {
        guard revision == generation, visible, !Task.isCancelled else { throw CancellationError() }
        guard isCurrent else { throw HomeResidencyHistoryError.sessionChanged }
    }

    private func perform(_ operation: Operation) async {
        guard visible, !Task.isCancelled else { return }
        generation += 1
        let revision = generation
        visible = true
        working = true
        storedState = .loading
        retryOperation = operation
        defer { if revision == generation { working = false } }
        do {
            try require(revision)
            let session = try await transport.session(actorId: identity.actorId)
            try require(revision)
            guard session.actorId == identity.actorId, HomeClaimReviewSnapshot.validToken(session.scope) else {
                throw HomeResidencyHistoryError.sessionChanged
            }
            switch operation {
            case .recent:
                let page = try await transport.list(identity: identity, session: session, after: nil)
                try require(revision)
                storedState = .list(page)
            case let .more(prior):
                guard let cursor = prior.nextCursor else { throw HomeResidencyHistoryError.cursorInvalid }
                let next = try await transport.list(identity: identity, session: session, after: cursor)
                try require(revision)
                guard Set(prior.items.map(\.id)).isDisjoint(with: next.items.map(\.id)),
                      next.items.first.map({ cursor.precedes($0) }) != false else { throw HomeResidencyHistoryError.cursorInvalid }
                storedState = .list(.init(items: prior.items + next.items, nextCursor: next.nextCursor))
            case let .detail(receiptId):
                let item = try await transport.detail(identity: identity, session: session, receiptId: receiptId)
                try require(revision)
                storedState = .detail(item)
            }
            // A ready result is never used as the authority for a later retry.
            retryOperation = .recent
        } catch {
            guard revision == generation, visible, !Task.isCancelled else { return }
            let error = isCurrent ? (error as? HomeResidencyHistoryError ?? .unavailable) : .sessionChanged
            storedState = .failure(error)
            if [.cursorInvalid, .forbidden, .homeUnavailable, .sessionChanged, .notFound].contains(error) { retryOperation = .recent }
        }
    }
}
