//
//  PulsePreferencesSummary.swift
//  Pantopus
//
//  Pulse preferences' list of everything the reader follows, the updates
//  those follows send and everything muted, each with its undo (Pulse
//  S10.3; build spec §7, contract §2.9). The server's summary lists the
//  items and the request that undoes each one; a followed conversation's
//  words, a muted person's name and an area's name come from the routes
//  that already own them. Topic mutes keep S4's rows, words and ids.
//

import Observation
import SwiftUI

/// The reader's follows, alerts and mutes as the page lists them.
struct PulsePreferencesLists: Equatable {
    var follows: [PulsePreferencesFollow]
    var alerts: [PulsePreferencesFollow]
    /// The twelve Pulse topics, everywhere or in one area (Pulse S4).
    var topicMutes: [PulsePreferencesMute] = []
    /// Kinds of post an older app muted ("Event posts").
    var typeMutes: [PulsePreferencesMute] = []
    /// People and businesses.
    var people: [PulsePreferencesMute] = []
}

@Observable
@MainActor
final class PulsePreferencesSummaryModel {
    enum State: Equatable {
        case loading
        case loaded(PulsePreferencesLists)
        case error
    }

    private(set) var state: State = .loading
    /// Rows whose undo is on its way; their buttons wait.
    private(set) var pending: Set<String> = []
    /// The last refusal, shown under the lists.
    private(set) var message: String?
    /// Followed conversations' words, read one at a time after the list.
    private(set) var titles: [String: String] = [:]
    /// Muted people's and businesses' names (`GET /api/posts/mute`).
    private(set) var names: [String: String] = [:]
    /// The reader's own areas' names (`GET /api/pulse/areas/mine`).
    private(set) var areaNames: [String: String] = [:]

    private let api: APIClient
    private let moderation: FeedModerationStore
    private var generation = 0

    init(api: APIClient = .shared, moderation: FeedModerationStore = .shared) {
        self.api = api
        self.moderation = moderation
    }

    /// Reads the summary with the names beside it. A failed re-read keeps
    /// the lists on screen and says so.
    func load() async {
        generation += 1
        let request = generation
        let api = api
        let mutedRead = Task { () -> MutedEntitiesResponse? in try? await api.request(FeedActionsEndpoints.mutedEntities()) }
        let areasRead = Task { () -> PulseMyAreasResponse? in try? await api.request(PulseEndpoints.myAreas()) }
        do {
            let summary: PulsePreferencesSummaryResponse = try await api.request(PulseEndpoints.preferencesSummary())
            let muted = await mutedRead.value
            let areas = await areasRead.value
            guard request == generation, !Task.isCancelled else { return }
            apply(summary, muted: muted, areas: areas)
            await loadTitles()
        } catch {
            mutedRead.cancel()
            areasRead.cancel()
            guard request == generation, !Task.isCancelled else { return }
            if case .loaded = state {
                message = "Couldn't refresh this list."
            } else {
                state = .error
            }
        }
    }

    /// "Stop following": the follow's own undo.
    func stopFollowing(_ item: PulsePreferencesFollow) async -> Bool {
        guard await undo("follow-\(item.id)", item.undo, refusal: "Couldn't stop following. Try again.") else { return false }
        update { lists in
            lists.follows.removeAll { $0.id == item.id }
            lists.alerts.removeAll { $0.id == item.id }
        }
        PulsePostsRefresh.notifyPostsDidChange()
        await load()
        return true
    }

    /// "Turn off": the follow stays, its notifications go off.
    func turnOffUpdates(_ item: PulsePreferencesFollow) async -> Bool {
        guard await undo("alert-\(item.id)", item.undo, refusal: "Couldn't turn off updates. Try again.") else { return false }
        update { lists in lists.alerts.removeAll { $0.id == item.id } }
        await load()
        return true
    }

    /// "Unmute": the posts come back at once on every surface.
    func unmute(_ mute: PulsePreferencesMute) async -> Bool {
        let refusal = mute.entityType == "topic" ? "Couldn't unmute that topic." : "Couldn't unmute. Try again."
        guard await undo("mute-\(mute.id)", mute.undo, refusal: refusal) else { return false }
        update { lists in
            lists.topicMutes.removeAll { $0.id == mute.id }
            lists.typeMutes.removeAll { $0.id == mute.id }
            lists.people.removeAll { $0.id == mute.id }
        }
        release(mute)
        ScreenStore.store(for: api).markStale(topics: [ScreenTopic.posts])
        await load()
        return true
    }

    /// "Mute a topic" in the area the page reads (where "Seeing too much?"
    /// leads): the same mute as a card's "Mute this topic in this area".
    func muteTopic(_ topic: PulseTopic, areaId: String) async -> Bool {
        let row = "mute-topic-\(topic.rawValue)"
        guard !pending.contains(row) else { return false }
        pending.insert(row)
        message = nil
        defer { pending.remove(row) }
        do {
            _ = try await api.request(FeedActionsEndpoints.mutePulseTopic(topic.rawValue, areaId: areaId), as: EmptyResponse.self)
        } catch {
            message = "Couldn't mute \(topic.label)."
            return false
        }
        moderation.addTopicMute(topic.rawValue, areaId: areaId)
        ScreenStore.store(for: api).markStale(topics: [ScreenTopic.posts])
        await load()
        return true
    }

    /// The topics not muted in this area yet (nor everywhere).
    func topicsToMute(areaId: String) -> [PulseTopic] {
        guard case let .loaded(lists) = state else { return [] }
        let muted = Set(lists.topicMutes.filter { $0.areaId == nil || $0.areaId == areaId }.compactMap(\.entityId))
        return PulseTopic.allCases.filter { !muted.contains($0.rawValue) }
    }

    /// "Food in Camas", a followed conversation's words, or a place's name.
    func title(_ follow: PulseFollowDTO) -> String {
        switch follow.targetType {
        case "post":
            return follow.targetId.flatMap { titles[$0] } ?? "A conversation you follow"
        case "topic":
            let topic = PulseTopic(stored: follow.targetId)?.label ?? "A topic"
            return "\(topic) \(areaWords(follow.areaId))"
        case "place":
            return follow.targetId.flatMap { areaNames[$0] } ?? "A place you follow"
        default:
            return "Something you follow"
        }
    }

    /// "in Camas", or "in one area" for an area this list can't name.
    func areaWords(_ areaId: String?) -> String {
        areaId.flatMap { areaNames[$0] }.map { "in \($0)" } ?? "in one area"
    }

    /// "Conversation · Notifications off · Until it ends".
    static func detail(_ follow: PulseFollowDTO, timeZone: TimeZone = .current) -> String {
        let kind = switch follow.targetType {
        case "topic": "Topic"
        case "place": "Place"
        default: "Conversation"
        }
        let updates = switch follow.notify {
        case "recap": "Daily recap"
        case "each": "Each update"
        default: "Notifications off"
        }
        let duration: String = switch follow.ends {
        case "on_resolve": "Until it ends"
        case "week": PulsePageWords.parseDate(follow.untilAt)
            .map { "Until \(PulsePostStatus.endsFormat($0, timeZone: timeZone))" } ?? "For a week"
        default: "Keep following"
        }
        return [kind, updates, duration].joined(separator: " · ")
    }

    // MARK: - Private

    private func apply(_ summary: PulsePreferencesSummaryResponse, muted: MutedEntitiesResponse?, areas: PulseMyAreasResponse?) {
        if let muted {
            names = Dictionary(muted.muted.map { ($0.entityId, $0.name) }) { first, _ in first }
        }
        for area in [areas?.town, areas?.neighborhood, areas?.street].compactMap(\.self) {
            if let id = area.id, let name = area.name ?? area.title, !name.isEmpty { areaNames[id] = name }
        }
        var lists = PulsePreferencesLists(follows: summary.follows, alerts: summary.alerts)
        var seen = Set<String>()
        for mute in summary.mutes {
            guard let type = mute.entityType, let entity = mute.entityId, !entity.isEmpty else { continue }
            switch type {
            case "topic" where PulseTopic(stored: entity) != nil:
                if seen.insert("topic|\(entity)|\(mute.areaId ?? "")").inserted { lists.topicMutes.append(mute) }
            case "topic":
                // An older app muted a kind of post once per surface; one undo clears them all.
                if seen.insert("type|\(entity)").inserted { lists.typeMutes.append(mute) }
            case "user", "business":
                // A mute of a deleted account names no one and has no effect.
                if muted == nil || names[entity] != nil { lists.people.append(mute) }
            default:
                continue
            }
        }
        state = .loaded(lists)
    }

    /// A followed conversation's opening words, one read at a time; one
    /// that can't be read keeps the generic words.
    private func loadTitles() async {
        guard case let .loaded(lists) = state else { return }
        for item in lists.follows where item.follow.targetType == "post" {
            guard let id = item.follow.targetId, titles[id] == nil, !Task.isCancelled else { continue }
            let response: PulseConversationResponse? = try? await api.request(PulseEndpoints.conversation(postId: id))
            guard let post = response?.post else { continue }
            let words = [post.text, post.title]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first { !$0.isEmpty }
            if let words { titles[id] = words }
        }
    }

    /// Sends one row's undo, the request the summary gave for it. True once
    /// the server took it.
    private func undo(_ row: String, _ undo: PulseUndoDTO?, refusal: String) async -> Bool {
        guard let undo, let endpoint = PulseEndpoints.undo(undo), !pending.contains(row) else { return false }
        pending.insert(row)
        message = nil
        defer { pending.remove(row) }
        do {
            _ = try await api.request(endpoint, as: EmptyResponse.self)
            return true
        } catch {
            message = refusal
            return false
        }
    }

    private func update(_ change: (inout PulsePreferencesLists) -> Void) {
        guard case var .loaded(lists) = state else { return }
        change(&lists)
        state = .loaded(lists)
    }

    /// The session's mute layer lets the posts back in before the next read.
    private func release(_ mute: PulsePreferencesMute) {
        guard let entity = mute.entityId else { return }
        switch mute.entityType {
        case "user": moderation.removeMute(entityType: .user, entityId: entity)
        case "business": moderation.removeMute(entityType: .business, entityId: entity)
        case "topic":
            if let areaId = mute.areaId {
                moderation.removeTopicMute(entity, areaId: areaId)
            } else {
                moderation.removeTopicMute(entity)
            }
        default: break
        }
    }
}
