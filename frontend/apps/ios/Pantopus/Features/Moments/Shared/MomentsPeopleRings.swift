//
//  MomentsPeopleRings.swift
//  Pantopus
//
//  Who has Moments to watch, for the rings around profile pictures. A circle
//  that comes on screen asks about its person; the asks of one screenful go
//  to the server together (`GET /api/moments/people`, contract v3.7), and an
//  answer is kept for a minute. The server decides who may see what, by the
//  map's rules: someone with nothing for you to watch simply has no ring.
//

import Foundation
import Observation

@Observable
@MainActor
final class MomentsPeopleRings {
    static let shared = MomentsPeopleRings()

    /// The ring of each person who has Moments you may see, by account id.
    private(set) var rings: [String: MomentRingDTO] = [:]

    /// An answer older than this is asked for again the next time the person's circle comes on screen.
    static let keepFor: TimeInterval = 60
    /// The circles of one screenful appear within a moment of each other: their asks go as one request.
    static let gatherFor: Duration = .milliseconds(120)
    /// The most people one request asks about (the server's limit).
    static let mostPerRequest = 100

    @ObservationIgnored private var account: String?
    @ObservationIgnored private var answeredAt: [String: Date] = [:]
    @ObservationIgnored private var waiting: Set<String> = []
    @ObservationIgnored private var sending: Task<Void, Never>?
    /// A server from before this read: it isn't asked again until the app starts again.
    @ObservationIgnored private var unsupported = false

    private init() {}

    /// The person's ring, without the Moments that have ended since it was read; nil when nothing is left.
    func ring(for userId: String?) -> MomentRingDTO? {
        guard let userId, var ring = rings[userId] else { return nil }
        let now = Date()
        ring.moments.removeAll { ($0.expiresAtDate ?? .distantFuture) <= now }
        return ring.moments.isEmpty ? nil : ring
    }

    /// A circle showing this person is on screen: their ring is read unless it was within the last minute.
    func want(_ userId: String?) {
        guard let userId, !userId.isEmpty, !unsupported, MomentsFlags.shared.moments, let me = signedInId else { return }
        if me != account { reset(for: me) }
        if let at = answeredAt[userId], Date().timeIntervalSince(at) < Self.keepFor { return }
        waiting.insert(userId)
        gather()
    }

    /// Reads this person's ring again now (their Moments came back after a mute was undone).
    func refresh(_ userId: String) {
        answeredAt[userId] = nil
        want(userId)
    }

    /// A Moment was watched: its part of the ring goes grey at once.
    func watched(_ momentId: String) {
        for (userId, ring) in rings {
            guard let index = ring.moments.firstIndex(where: { $0.id == momentId }), !ring.moments[index].seen else { continue }
            rings[userId]?.moments[index].seen = true
        }
    }

    /// This person was muted or blocked: their ring leaves every circle at once.
    func hide(_ userId: String) {
        rings[userId] = nil
        answeredAt[userId] = nil
    }

    private var signedInId: String? {
        if case let .signedIn(user) = AuthManager.shared.state { return user.id }
        return nil
    }

    /// Another account signed in: nothing read for the last one is shown to this one.
    private func reset(for newAccount: String) {
        account = newAccount
        rings = [:]
        answeredAt = [:]
        waiting = []
        sending?.cancel()
        sending = nil
    }

    private func gather() {
        guard sending == nil else { return }
        let asker = account
        sending = Task { [weak self] in
            try? await Task.sleep(for: Self.gatherFor)
            guard !Task.isCancelled else { return }
            await self?.send(as: asker)
        }
    }

    private func send(as asker: String?) async {
        let ids = Array(waiting.prefix(Self.mostPerRequest))
        waiting.subtract(ids)
        defer {
            sending = nil
            if !waiting.isEmpty, asker == account { gather() }
        }
        guard !ids.isEmpty, asker == account else { return }
        // Marked before the answer, so a circle that scrolls back in meanwhile doesn't ask twice.
        let now = Date()
        for id in ids {
            answeredAt[id] = now
        }
        do {
            let answer = try await MomentsAPI.send(MomentsEndpoints.people(ids: ids), as: MomentsMapResponse.self)
            guard asker == account else { return }
            var next = rings
            for id in ids {
                next[id] = nil
            }
            for ring in answer.rings where !ring.moments.isEmpty {
                next[ring.author.id] = ring
            }
            if next != rings { rings = next }
        } catch MomentsFailure.notFound {
            unsupported = true
        } catch {
            // No connection, or Moments just went off: no rings change; these people are asked about again later.
            for id in ids {
                answeredAt[id] = nil
            }
        }
    }
}
