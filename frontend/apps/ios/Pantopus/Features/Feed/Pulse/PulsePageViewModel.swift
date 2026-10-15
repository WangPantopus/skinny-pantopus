//
//  PulsePageViewModel.swift
//  Pantopus
//
//  The Pulse page (Pulse S6; build spec §3, contract §2.3). Reads
//  `GET /api/pulse/feed` through the screen store (a saved copy shows at
//  once, then a re-read when it is out of date), keeps new conversations
//  behind a count the person taps, and moves the last-seen marker once the
//  end of the page has been on screen. Nothing loads by itself: pull to
//  refresh, the "↑ N new conversations" pill and "Show earlier" are the only
//  ways items arrive. Same behavior as Android (PA's `PulsePageViewModel.kt`).
//

import Foundation
import Observation

/// The page's views. Known arrives with S12; until then it isn't offered.
public enum PulsePageMode: String, Sendable, Hashable, CaseIterable {
    case nearby
    case following

    public var label: String {
        switch self {
        case .nearby: "Nearby"
        case .following: "Following"
        }
    }
}

@Observable
@MainActor
public final class PulsePageViewModel {
    public enum State: Equatable {
        case loading
        case loaded(PulsePageContent)
        case error(message: String)
    }

    /// "Show earlier" below the end card: not asked yet, loading, more to
    /// show, or nothing older.
    public enum EarlierPhase: Equatable {
        case idle
        case loading
        case more
        case done
    }

    public private(set) var state: State = .loading
    /// The town the page reads, kept while another view or topic loads.
    public private(set) var areaName: String?
    /// Another area chosen from the pill; nil reads the viewer's own town.
    public private(set) var selectedAreaId: String?
    /// The viewer's own town, from the default page.
    private(set) var homeAreaId: String?
    public private(set) var mode: PulsePageMode = .nearby
    public private(set) var activeTopic: PulseTopic?
    /// How many conversations wait behind "↑ N new conversations".
    public private(set) var newCount = 0
    public private(set) var earlierPhase: EarlierPhase = .idle
    /// The older conversations "Show earlier" brought in, as one EARLIER
    /// group under the end card (nil until there are some).
    public private(set) var earlierGroup: PulsePageGroup?
    /// A refresh failed while a copy is on screen: when that copy is from.
    public private(set) var staleSince: Date?
    public private(set) var refreshNotice: String?
    public var toastMessage: String? {
        // Every message is an error unless `showToast` says otherwise.
        didSet { if toastMessage != nil { toastKind = .error } }
    }

    public private(set) var toastKind: ToastKind = .error
    /// The card whose "Close this question?" is showing (Pulse S7).
    public var closingAskCardId: String?
    /// "Seeing too much?" is due (Pulse S10.6, `PulseSeeingTooMuchLine.swift`).
    var seeingTooMuchDue = false

    // Internal for the card actions (`PulsePageCardActions.swift`).
    let store: ScreenStore
    let api: APIClient
    let moderation: FeedModerationStore
    private var lastResponse: PulseFeedResponse?
    private var lastReadAt: Date?
    private var readGeneration = 0
    private var seenThrough: Date?
    /// The read whose acknowledgment is in flight; a newer read may still send its own.
    private var seenRequestReadAt: Date?
    private var mutationRevision = 0
    private var cardMutationRevisions: [String: Int] = [:]
    /// The viewer's own taps before the server answers: card id → done.
    private var actionOverrides: [String: Bool] = [:]
    var keptOpen: Set<String> = []
    var savedOverrides: [String: Bool] = [:]
    var followingOverrides: [String: Bool] = [:]
    /// Cards with a Going, Seen it or save request still out.
    var pending: Set<String> = []
    var removed: Set<String> = []
    private var earlierCards: [PulsePageCard] = []
    private var earlierTitle = "EARLIER"
    private var earlierCursor: String?
    private var earlierEnd: PulsePageEnd?

    public convenience init() {
        self.init(store: .shared, api: .shared, moderation: .shared)
    }

    init(store: ScreenStore, api: APIClient, moderation: FeedModerationStore) {
        self.store = store
        self.api = api
        self.moderation = moderation
    }

    // MARK: - Reading

    /// Tab entry and every return: what is on screen stays, a first entry
    /// shows the saved copy at once, and the page reads again once it is out
    /// of date.
    public func load() async {
        await read(force: false)
    }

    /// Pull to refresh, Retry and the new-conversations pill: read now.
    public func refresh() async {
        await read(force: true)
    }

    public func selectMode(_ next: PulsePageMode) async {
        guard next != mode else { return }
        mode = next
        await switchQuery()
    }

    /// A topic chip filters; nil is "All". Picking a topic joins nothing.
    public func selectTopic(_ topic: PulseTopic?) async {
        guard topic != activeTopic else { return }
        activeTopic = topic
        await switchQuery()
    }

    private func switchQuery() async {
        newCount = 0
        resetEarlier()
        seenThrough = nil
        lastResponse = nil
        lastReadAt = nil
        staleSince = nil
        refreshNotice = nil
        seenRequestReadAt = nil
        state = .loading
        await read(force: false)
    }

    private func read(force: Bool) async {
        readGeneration += 1
        let generation = readGeneration
        let startedAt = Date()
        let revision = mutationRevision
        do {
            try await store.show(
                endpoint(),
                as: PulseFeedResponse.self,
                kind: .nearby,
                topics: [ScreenTopic.posts],
                force: force
            ) { snapshot in
                guard generation == readGeneration else { return }
                apply(snapshot, readStartedAt: startedAt, mutationRevision: revision)
            }
        } catch is CancellationError {
            return
        } catch {
            guard generation == readGeneration else { return }
            if clearRefusedPage(error) { return }
            if case .loaded = state {
                // Forced reads rethrow after the store marks its copy stale.
                // Reflect that notice as well as the transient error toast.
                if let copy = store.peek(endpoint(), as: PulseFeedResponse.self) {
                    apply(copy, readStartedAt: startedAt, mutationRevision: revision)
                }
                if force { toastMessage = "Couldn't refresh Pulse." }
            } else {
                let message = (error as? APIError)?.errorDescription
                state = .error(message: message ?? "Something went wrong. Please try again.")
            }
        }
    }

    private func apply(_ snapshot: ScreenSnapshot<PulseFeedResponse>, readStartedAt: Date, mutationRevision: Int) {
        let newRead = snapshot.fetchedAt != lastReadAt
        if selectedAreaId == nil, let area = snapshot.value.area?.id { homeAreaId = area }
        lastResponse = snapshot.value
        lastReadAt = snapshot.fetchedAt
        staleSince = snapshot.refreshFailed ? snapshot.fetchedAt : nil
        refreshNotice = snapshot.refreshNotice(afterEveryFailure: true)
        if snapshot.isFresh, newRead {
            // A fresh read shows what the pill was counting, and the server's
            // own state of every tap that has landed.
            newCount = 0
            resetEarlier()
            if snapshot.fetchedAt >= readStartedAt {
                // A read already in flight when a tap landed may still carry
                // the old value. Keep that tap until a later read confirms it.
                let keep: (String) -> Bool = { id in
                    self.pending.contains(id) || (self.cardMutationRevisions[id] ?? 0) > mutationRevision
                }
                actionOverrides = actionOverrides.filter { keep($0.key) }
                savedOverrides = savedOverrides.filter { keep($0.key) }
                followingOverrides = followingOverrides.filter { keep($0.key) }
            }
        }
        rebuild()
    }

    /// The page again from the last response, with the viewer's own changes
    /// on top (a hide, a mute, a Going tapped a moment ago).
    func rebuild() {
        guard let response = lastResponse, let readAt = lastReadAt else { return }
        var content = response.pageContent(readAt: readAt)
        if let earlierEnd { content.end = earlierEnd }
        areaName = content.areaName
        content.groups = content.groups.compactMap(adjusted)
        state = .loaded(content)
        earlierGroup = adjusted(PulsePageGroup(key: "earlier", title: earlierTitle, cards: earlierCards))
    }

    private func resetEarlier() {
        earlierPhase = .idle
        earlierCards = []
        earlierCursor = nil
        earlierGroup = nil
        earlierEnd = nil
    }

    private func adjusted(_ group: PulsePageGroup) -> PulsePageGroup? {
        var group = group
        group.cards = group.cards.filter(isVisible).map { card in
            var card = card
            if let done = actionOverrides[card.id], done != card.actionDone {
                // The going count moves with the tap, as the server's will.
                if card.actionKind == "going", let count = card.goingCount {
                    card.goingCount = max(0, count + (done ? 1 : -1))
                }
                card.actionDone = done
            }
            if keptOpen.contains(card.id) { card.canKeepOpen = false }
            if let saved = savedOverrides[card.id] { card.saved = saved }
            if let following = followingOverrides[card.id] { card.following = following }
            return card
        }
        return group.cards.isEmpty ? nil : group
    }

    private func isVisible(_ card: PulsePageCard) -> Bool {
        guard !removed.contains(card.id) else { return false }
        // Your own posts are never hidden by a topic mute, as on the server.
        return moderation.isVisible(
            postId: card.id,
            userId: card.authorId,
            businessAuthorId: nil,
            topic: card.isAuthor ? nil : card.topic?.rawValue,
            areaId: card.areaId
        )
    }

    // MARK: - New conversations, the end, earlier

    /// About once a minute while the page is on screen: how many
    /// conversations arrived since it was read.
    public func pollNewCount() async {
        guard case let .loaded(content) = state, let through = content.readThrough else { return }
        let generation = readGeneration
        let endpoint = PulseEndpoints.feedNewCount(
            view: mode.rawValue,
            topic: activeTopic?.queryValue,
            areaId: lastResponse?.area?.id,
            after: through
        )
        do {
            let response = try await api.request(endpoint, as: PulseFeedNewCountResponse.self)
            // A refresh that landed meanwhile already shows what this counted.
            guard generation == readGeneration, !Task.isCancelled,
                  case let .loaded(shown) = state, shown.readThrough == through else { return }
            newCount = max(0, response.count)
        } catch {
            guard generation == readGeneration, !Task.isCancelled else { return }
            _ = clearRefusedPage(error)
        }
    }

    /// The end card has been on screen: move the last-seen marker, once per
    /// read of the page, and only when nothing newer was left behind. The
    /// marker is the view's, not a topic's (contract §2.3), so a topic's end
    /// leaves it alone: the other topics' new posts haven't been seen.
    public func endShown() async {
        // The marker belongs to the view: another area's page, like a topic's,
        // leaves it alone so the home page's unseen posts stay new (as Android).
        guard activeTopic == nil, selectedAreaId == nil, case let .loaded(content) = state, content.end.caughtUp,
              let through = content.readThrough, staleSince == nil,
              seenThrough.map({ $0 < content.readAt }) ?? true,
              seenRequestReadAt.map({ $0 < content.readAt }) ?? true else { return }
        let readAt = content.readAt
        let generation = readGeneration
        seenRequestReadAt = readAt
        defer { if seenRequestReadAt == readAt { seenRequestReadAt = nil } }
        do {
            let response = try await api.request(
                PulseEndpoints.markFeedSeen(view: mode.rawValue, through: through),
                as: PulseFeedSeenResponse.self
            )
            guard generation == readGeneration, !Task.isCancelled, response.ok == true,
                  let acknowledged = PulsePageWords.parseDate(response.through) else { return }
            seenThrough = max(seenThrough ?? acknowledged, acknowledged)
        } catch {
            // Retry when the end is shown again or on the next visible poll.
            guard generation == readGeneration, !Task.isCancelled else { return }
            _ = clearRefusedPage(error)
        }
    }

    // MARK: - The card's action

    /// Going and Seen it are the existing like toggle; the other actions live
    /// in the conversation, which the caller opens (this returns false).
    public func tapAction(cardId: String) async -> Bool {
        guard let card = card(cardId), card.actionKind == "going" || card.actionKind == "seen_it" else { return false }
        guard beginMutation(cardId) else { return true }
        let done = !(actionOverrides[cardId] ?? card.actionDone)
        actionOverrides[cardId] = done
        defer { finishMutation(cardId) }
        rebuild()
        do {
            _ = try await api.request(PostsEndpoints.toggleLike(id: cardId, liked: done), as: PostLikeResponse.self)
        } catch {
            actionOverrides[cardId] = !done
            rebuild()
            toastMessage = "Couldn't save that. Try again."
        }
        return true
    }

    // MARK: - Helpers

    /// Losing access while polling or paging also invalidates the page,
    /// including its saved copy. Network failures leave the copy alone.
    private func clearRefusedPage(_ error: any Error) -> Bool {
        guard let error = error as? APIError else { return false }
        switch error {
        case .unauthorized, .forbidden, .notFound:
            store.remove(endpoint())
            lastResponse = nil
            lastReadAt = nil
            newCount = 0
            resetEarlier()
            state = .error(message: error.errorDescription ?? "Couldn't load Pulse.")
            return true
        default: return false
        }
    }

    func beginMutation(_ id: String) -> Bool {
        guard pending.insert(id).inserted else { return false }
        mutationRevision += 1
        cardMutationRevisions[id] = mutationRevision
        return true
    }

    func finishMutation(_ id: String) {
        pending.remove(id)
        mutationRevision += 1
        cardMutationRevisions[id] = mutationRevision
        store.markStale(topics: [ScreenTopic.posts])
    }

    public func card(_ id: String) -> PulsePageCard? {
        guard case let .loaded(content) = state else { return nil }
        let shown = content.groups.flatMap(\.cards) + (earlierGroup?.cards ?? [])
        return shown.first { $0.id == id }
    }

    func showToast(_ text: String, kind: ToastKind) {
        toastMessage = text
        toastKind = kind
    }
}

extension PulsePageViewModel {
    var displayedAreaId: String? {
        lastResponse?.area?.id ?? selectedAreaId
    }

    func selectArea(_ area: PulseAreaChoice) async {
        guard area.id != displayedAreaId else { return }
        // Choosing the own town again returns to the default page.
        selectedAreaId = area.id == homeAreaId ? nil : area.id
        areaName = area.title
        await switchQuery()
    }

    private func endpoint(earlierBefore: String? = nil) -> Endpoint {
        PulseEndpoints.feed(
            view: mode.rawValue,
            topic: activeTopic?.queryValue,
            areaId: earlierBefore == nil ? selectedAreaId : lastResponse?.area?.id,
            earlierBefore: earlierBefore
        )
    }
}

// MARK: - Show earlier

public extension PulsePageViewModel {
    /// "Show earlier": the next older items, below the end card and the
    /// ones shown before.
    func showEarlier() async {
        guard case let .loaded(content) = state else { return }
        let cursor: String?
        switch earlierPhase {
        case .idle: cursor = content.end.canShowEarlier ? content.end.earlierCursor : nil
        case .more: cursor = earlierCursor
        case .loading, .done: return
        }
        guard let cursor else { return }
        let phase = earlierPhase
        earlierPhase = .loading
        let generation = readGeneration
        do {
            let response: PulseFeedResponse = try await api.request(endpoint(earlierBefore: cursor))
            guard generation == readGeneration else {
                // The page was read again meanwhile; unless that reset the
                // earlier pages, "Show earlier" comes back instead of spinning.
                if earlierPhase == .loading { earlierPhase = phase }
                return
            }
            let page = response.pageContent(readAt: content.readAt)
            earlierEnd = page.end
            var ids = Set(content.groups.flatMap(\.cards).map(\.id) + earlierCards.map(\.id))
            earlierCards += page.groups.flatMap(\.cards).filter { ids.insert($0.id).inserted }
            if let title = page.groups.first?.title, !title.isEmpty { earlierTitle = title }
            earlierCursor = page.end.canShowEarlier && page.end.earlierCursor != cursor ? page.end.earlierCursor : nil
            earlierPhase = earlierCursor == nil ? .done : .more
            rebuild()
        } catch {
            guard generation == readGeneration else {
                if earlierPhase == .loading { earlierPhase = phase }
                return
            }
            if clearRefusedPage(error) { return }
            earlierPhase = phase
            toastMessage = "Couldn't load earlier conversations. Try again."
        }
    }
}
