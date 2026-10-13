//
//  PlanScreenViewModel.swift
//  Pantopus
//
//  One plan, for whoever opens it (boards J1 to J9, H9). The plan is read
//  with the `sensitive` store kind on every open: the exact place, the
//  host's note and the people going are never kept on the phone, so a
//  removed guest never sees them again. A list row seeds the screen (area
//  only) until the read answers.
//

import Foundation
import Observation

/// What the viewer sees on a plan.
enum PlanScreenMode: Equatable {
    /// J1 / J2: not in yet.
    case browsing
    /// J5: asked, waiting for the host.
    case requested
    /// J6: on the waitlist.
    case waitlisted
    /// J7: in.
    case going
    /// J8: declined, removed, or the request expired.
    case notThisTime(PlanRequestStatus)
    /// H9: hosting.
    case hosting
    /// The plan was cancelled or has ended.
    case closed
}

@Observable
@MainActor
final class PlanScreenViewModel {
    enum Phase: Equatable {
        case loading
        case loaded
        /// A playdate shared with someone without a verified address (J9).
        case needsVerification(city: String?)
        case unavailable
        case error(String)
    }

    let planId: String
    private(set) var phase: Phase = .loading
    private(set) var plan: PlanDetailDTO?
    /// The viewer's own request, as sent here (J5 until the server returns it).
    private(set) var sentRequest: SentPlanRequest?
    private(set) var isWorking = false
    /// A sentence for a failed action, shown under the footer.
    var actionError: String?
    /// The plan became "in" while this screen was open: play the reveal.
    private(set) var revealToken = 0
    /// Other plans nearby, for J8.
    private(set) var otherPlans: [PlanCardDTO] = []
    /// The host's pending and waitlisted requests (names on H9's card).
    private(set) var hostRequests: PlanRequestsResponse?

    private let api: APIClient
    private let store: ScreenStore

    init(planId: String, seed: PlanCardDTO? = nil, api: APIClient = .shared) {
        self.planId = planId
        self.api = api
        store = ScreenStore.store(for: api)
        if let seeded = seed.map(PlanDetailDTO.init(card:)) ?? PlansStoreReads.seeded(id: planId, store: store) {
            plan = seeded
            phase = .loaded
        }
        sentRequest = SentPlanRequest.load(planId: planId)
    }

    var card: PlanCardDTO? {
        plan?.card
    }

    /// What the viewer sent, for "Change who's coming": the server's copy,
    /// else what was sent from this phone.
    var askPrefill: PlanAskPrefill? {
        if let mine = card?.myRequest {
            return PlanAskPrefill(
                partySize: mine.partySize ?? 1,
                note: mine.note,
                kidsCount: mine.kidsCount,
                kidsAgeBands: mine.kidsAgeBands ?? []
            )
        }
        return sentRequest.map { PlanAskPrefill(partySize: $0.partySize, note: $0.note, kidsCount: nil, kidsAgeBands: []) }
    }

    var mode: PlanScreenMode {
        guard let card else { return .browsing }
        if card.viewer?.isHost == true { return .hosting }
        if card.state == .cancelled || card.state == .ended { return .closed }
        let status = plan?.myRequest?.status ?? card.viewer?.requestStatus
        switch status {
        case .accepted: return .going
        case .pending: return .requested
        case .waitlisted: return .waitlisted
        case .declined, .removed, .expired: return .notThisTime(status ?? .declined)
        case .withdrawn, .left, nil: return .browsing
        }
    }

    // MARK: - Reading

    func load() async {
        let wasIn = mode == .going
        do {
            let detail = try await PlansStoreReads.detail(id: planId, store: store)
            plan = detail
            phase = .loaded
            // The reveal plays when the plan turns "in" here, or the first
            // time the viewer opens it after a yes that came by push.
            if mode == .going, detail.place != nil, !wasIn || !PlanReveal.hasPlayed(planId) {
                PlanReveal.markPlayed(planId)
                revealToken += 1
            }
            if case .notThisTime = mode { await loadOtherPlans() }
            if mode == .hosting { hostRequests = try? await PlansStoreReads.requests(planId: planId, store: store) }
            if mode == .browsing || mode == .going || mode == .hosting { SentPlanRequest.clear(planId: planId) }
        } catch is CancellationError {
            return
        } catch let error as APIError {
            if case .notFound = error {
                plan = nil
                phase = await publicPlaydate() ?? .unavailable
            } else if plan == nil {
                phase = .error(error.errorDescription ?? "We couldn't load this plan.")
            }
        } catch {
            if plan == nil { phase = .error("We couldn't load this plan.") }
        }
    }

    /// A 404 for a playdate the viewer can't see yet (no verified address)
    /// says so, with only the kind and the city (J9).
    private func publicPlaydate() async -> Phase? {
        guard let reply = try? await api.requestDataResponse(PlansEndpoints.detail(id: planId), includingNotFound: true),
              reply.response.statusCode == 404,
              let body = try? JSONDecoder().decode(PlanNotFoundDTO.self, from: reply.data),
              body.error == "needs_verified_address" else { return nil }
        return .needsVerification(city: body.plan?.city)
    }

    private func loadOtherPlans() async {
        // Opened from a link or a push, the map may not have set a center yet:
        // the viewer's home, else a fix when location is already allowed.
        var center = PlansStoreReads.lastCenter
        if center == nil, let home = try? await HomesStoreReads.myHomes(store: store).value.homes.lazy.compactMap(\.location).first {
            center = UserCoordinate(latitude: home.latitude, longitude: home.longitude, accuracyMeters: 50)
        }
        let location = DeviceLocationProvider.shared
        if center == nil, location.canLocateWithoutAsking { center = await location.requestCurrent(timeoutSeconds: 4) }
        guard let center else { return }
        if let snapshot = try? await PlansStoreReads.list(
            latitude: center.latitude,
            longitude: center.longitude,
            window: .week,
            kinds: [],
            store: store
        ) {
            otherPlans = Array(snapshot.value.items.filter { $0.id != planId && $0.viewer?.canAsk == true }.prefix(2))
        }
    }

    // MARK: - Joining

    /// J3 / J4 "Send request". Returns true when it went through.
    func ask(_ body: AskToJoinBody) async -> Bool {
        await perform {
            let reply: PlanAskResponse = try await api.request(PlansEndpoints.ask(planId: planId, body))
            let wasIn = mode == .going
            plan = reply.plan
            sentRequest = SentPlanRequest(partySize: body.partySize, note: body.note, sentAt: Date())
            sentRequest?.save(planId: planId)
            if reply.request.status == .accepted, !wasIn {
                // A rule let them in at once: read the private half now (the reveal plays there).
                await load()
            }
        }
    }

    /// J5 "Withdraw request", J6 "Leave the waitlist", J7 "Can't make it".
    func withdraw() async -> Bool {
        await perform {
            _ = try await api.request(PlansEndpoints.withdraw(planId: planId), as: EmptyResponse.self)
            SentPlanRequest.clear(planId: planId)
            await load()
        }
    }

    /// "On my way": a line in the plan's chat, no push.
    func onMyWay() async -> Bool {
        await perform {
            _ = try await api.request(PlansEndpoints.onMyWay(planId: planId), as: EmptyResponse.self)
            await load()
        }
    }

    /// "Still coming?" (H11 / the PLAN_CHANGED push). False leaves the plan.
    func stillComing(_ coming: Bool) async -> Bool {
        await perform {
            _ = try await api.request(PlansEndpoints.stillComing(planId: planId, coming: coming), as: EmptyResponse.self)
            await load()
        }
    }

    // MARK: - Hosting

    func cancelPlan(note: String?) async -> Bool {
        await perform {
            _ = try await api.request(PlansEndpoints.cancel(id: planId, note: note), as: EmptyResponse.self)
            await load()
        }
    }

    func remove(requestId: String) async -> Bool {
        await perform {
            _ = try await api.request(PlansEndpoints.remove(planId: planId, requestId: requestId), as: EmptyResponse.self)
            await load()
        }
    }

    func update(_ body: UpdatePlanBody) async -> Bool {
        await perform {
            let updated: PlanDetailDTO = try await api.request(PlansEndpoints.update(id: planId, body))
            plan = updated
        }
    }

    /// The request behind someone going, for "Remove from plan".
    func requestId(for person: PlanPersonDTO) -> String? {
        person.requestId
    }

    // MARK: - Safety

    /// Files a report on the plan's post (the existing post report queue).
    func report(reason: String) async -> Bool {
        await perform {
            _ = try await api.request(PlansEndpoints.report(planId: planId, reason: reason), as: EmptyResponse.self)
        }
    }

    /// Blocks the host: their plans and requests disappear both ways.
    func blockHost() async -> Bool {
        guard let hostId = card?.host.userId else { return false }
        return await perform {
            _ = try await api.request(BlocksEndpoints.block(userId: hostId), as: EmptyResponse.self)
            store.markStale(topics: [ScreenTopic.profileMe, ScreenTopic.chats])
        }
    }

    // MARK: - Helpers

    private func perform(_ work: () async throws -> Void) async -> Bool {
        isWorking = true
        actionError = nil
        defer { isWorking = false }
        do {
            try await work()
            PlansStoreReads.changed(planId: planId, store: store)
            return true
        } catch {
            actionError = PlanErrors.sentence(for: error)
            return false
        }
    }
}

/// A plan's 404: `{ error, message, plan? }`; for a playdate the viewer
/// can't see yet, `plan` holds only its kind and city.
struct PlanNotFoundDTO: Decodable {
    struct Teaser: Decodable {
        let kind: String?
        let city: String?
    }

    let error: String?
    let plan: Teaser?
}

/// An earlier request, to start "Change who's coming" from.
struct PlanAskPrefill: Equatable {
    let partySize: Int
    let note: String?
    let kidsCount: Int?
    let kidsAgeBands: [PlanKidsAgeBand]
}

/// What the viewer sent, kept on the phone only for their own J5 card
/// (their party size and hello) until the server returns the request.
struct SentPlanRequest: Codable, Equatable {
    let partySize: Int
    let note: String?
    let sentAt: Date

    @MainActor
    func save(planId: String) {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.key(planId))
        }
    }

    @MainActor
    static func load(planId: String) -> SentPlanRequest? {
        guard let data = UserDefaults.standard.data(forKey: key(planId)) else { return nil }
        return try? JSONDecoder().decode(SentPlanRequest.self, from: data)
    }

    @MainActor
    static func clear(planId: String) {
        UserDefaults.standard.removeObject(forKey: key(planId))
    }

    @MainActor
    private static func key(_ planId: String) -> String {
        "pantopus.plans.sent.\(ScreenStore.accountKey).\(planId.lowercased())"
    }
}

/// Which plans already played their reveal for this account.
@MainActor
enum PlanReveal {
    static func hasPlayed(_ planId: String) -> Bool {
        played.contains(planId.lowercased())
    }

    static func markPlayed(_ planId: String) {
        var ids = played
        ids.insert(planId.lowercased())
        UserDefaults.standard.set(Array(ids.suffix(200)), forKey: key)
    }

    private static var played: Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
    }

    private static var key: String {
        "pantopus.plans.revealed.\(ScreenStore.accountKey)"
    }
}

/// Error sentences for Plans actions. The server's own sentence wins
/// (`{ error, message }`); a few codes get the boards' words.
enum PlanErrors {
    static func sentence(for error: any Error) -> String {
        guard let apiError = error as? APIError else { return "Something went wrong. Please try again." }
        switch apiError {
        case let .clientError(status, body):
            if status == 409, code(in: body) == "full" { return "That plan just filled up." }
            return apiError.errorDescription ?? "Something went wrong. Please try again."
        case .transport:
            return "Can't reach Pantopus. Check your connection and try again."
        default:
            return apiError.errorDescription ?? "Something went wrong. Please try again."
        }
    }

    /// The Plans API's machine code (`error`) from a raw body.
    static func code(in body: String?) -> String? {
        guard let body, let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return (json["error"] as? String) ?? (json["code"] as? String)
    }
}

extension ScreenStore {
    /// The signed-in account, for per-account keys on the phone.
    static var accountKey: String {
        account(of: AuthManager.shared) ?? "anon"
    }
}
