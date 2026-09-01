//
//  FindATimeSuggestedViewModel.swift
//  Pantopus
//
//  Stream I11 — F5 Find a Time · Suggested Slots. Renders the `find-a-time`
//  results composed from members' personal availability: ranked slots with a
//  per-member free/busy split, a one-tap Book (creates a single home calendar
//  event), and Send proposal (opens a time poll). Reads the F4 draft when
//  present, else composes a sensible default. Home-only. See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

@Observable
@MainActor
final class FindATimeSuggestedViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case noOverlap
        case error(message: String)
        case sent
        case booked
    }

    // Dependencies / route context.
    let homeId: String
    private(set) var tz: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    private var activeDraft: FindATimeDraft?

    private var owner: SchedulingOwner {
        .home(homeId: homeId)
    }

    // State.
    private(set) var phase: Phase = .loading
    private(set) var suggested: [SuggestedSlot] = []
    private(set) var members: [FindATimeMember] = []
    private(set) var title = "Family time"
    private(set) var durationMin = 30
    private(set) var mode: FindATimeMode = .collective
    private(set) var bestSlotStart: String?
    var expandedSlotStart: String?

    private(set) var isActing = false
    var actionError: String?

    // Success context.
    private(set) var createdPollId: String?
    private(set) var proposalMemberCount = 0
    private(set) var bookedLabel: String?

    init(
        homeId: String,
        tz: String,
        draft: FindATimeDraft?,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.homeId = homeId
        self.tz = tz
        activeDraft = draft
        self.push = push
        self.client = client
    }

    // MARK: - Derived

    var memberIds: [String] {
        members.map(\.id)
    }

    var isSingleBest: Bool {
        suggested.count == 1
    }

    var headerSummary: String {
        let people = members.count
        let peopleLabel = people == 1 ? "1 person" : "\(people) people"
        return "\(peopleLabel) · \(durationMin) min · this week"
    }

    /// Composing line under the loading title — a grammatical list of the
    /// member names (design: "Composing Mom, Dad and Ava").
    var composingSubtitle: String {
        let names = members.map(\.displayName)
        guard !names.isEmpty else { return "Composing your household's free time" }
        let list: String = switch names.count {
        case 1: names[0]
        case 2: "\(names[0]) and \(names[1])"
        default: "\(names.dropLast().joined(separator: ", ")) and \(names[names.count - 1])"
        }
        return "Composing \(list)"
    }

    // MARK: - Load

    func load() async {
        phase = .loading
        do {
            let draft = try await resolveDraft()
            activeDraft = draft
            members = draft.members
            title = draft.title
            durationMin = draft.durationMin
            mode = draft.mode

            let slots: [SlotDTO]
            if let precomputed = draft.precomputedSlots {
                slots = precomputed
            } else {
                let response: FindATimeResponse = try await client.request(
                    SchedulingEndpoints.findATime(owner: owner, draft.request)
                )
                slots = response.slots
            }
            apply(slots: slots)
        } catch {
            phase = .error(message: Self.message(for: error))
        }
    }

    func refresh() async {
        // Drop any precomputed slots so refresh re-queries the engine.
        if var draft = activeDraft {
            draft.precomputedSlots = nil
            activeDraft = draft
        }
        await load()
    }

    /// Re-run with an edited draft (from the F4 edit sheet).
    func applyDraft(_ draft: FindATimeDraft) async {
        activeDraft = draft
        await load()
    }

    /// Re-query in a new IANA timezone (tz pill) — re-renders `startLocal` and
    /// keeps the stored UTC instants intact.
    func changeTimezone(_ identifier: String) async {
        guard identifier != tz else { return }
        tz = identifier
        if var draft = activeDraft {
            draft = FindATimeDraft(
                homeId: draft.homeId,
                title: draft.title,
                members: draft.members,
                requiredMemberIds: draft.requiredMemberIds,
                mode: draft.mode,
                durationMin: draft.durationMin,
                from: draft.from,
                to: draft.to,
                tz: identifier,
                precomputedSlots: nil
            )
            activeDraft = draft
        }
        await load()
    }

    private func resolveDraft() async throws -> FindATimeDraft {
        if let draft = activeDraft { return draft }
        // Direct entry (no F4 setup): default to all active members, collective,
        // 30 min, this week.
        let response: OccupantsResponse = try await client.request(
            HomesEndpoints.listOccupants(homeId: homeId)
        )
        let resolved = response.occupants.filter(\.isActive).map(FindATimeMember.init(occupant:))
        let today = Calendar.current.startOfDay(for: Date())
        let weekEnd = Calendar.current.date(byAdding: .day, value: 6, to: today) ?? today
        return FindATimeDraft(
            homeId: homeId,
            title: "Family time",
            members: resolved,
            requiredMemberIds: resolved.map(\.id),
            mode: .collective,
            durationMin: 30,
            // Day keys rendered in the SAME zone the start-of-day above was
            // computed in — the UTC overload is off by one for non-UTC devices.
            from: SchedulingTime.isoDay(today, tz: SchedulingTime.deviceTimeZoneIdentifier),
            to: SchedulingTime.isoDay(weekEnd, tz: SchedulingTime.deviceTimeZoneIdentifier),
            tz: tz,
            precomputedSlots: nil
        )
    }

    private func apply(slots: [SlotDTO]) {
        guard !slots.isEmpty else {
            suggested = []
            phase = .noOverlap
            return
        }
        let memberIdSet = Set(members.map(\.id))
        suggested = slots.map { slot in
            let free = slot.eligibleHosts.map { Set($0).intersection(memberIdSet) } ?? memberIdSet
            return SuggestedSlot(slot: slot, members: members, freeMemberIds: free)
        }
        bestSlotStart = suggested.max { lhs, rhs in
            if lhs.freeCount != rhs.freeCount { return lhs.freeCount < rhs.freeCount }
            return lhs.slot.start > rhs.slot.start
        }?.slot.start
        expandedSlotStart = bestSlotStart
        phase = .ready
    }

    // MARK: - Interactions

    func toggleExpand(_ slot: SuggestedSlot) {
        expandedSlotStart = (expandedSlotStart == slot.slot.start) ? nil : slot.slot.start
    }

    func isBest(_ slot: SuggestedSlot) -> Bool {
        slot.slot.start == bestSlotStart
    }

    // MARK: - Book (one calendar event)

    func book(_ slot: SuggestedSlot) async {
        guard !isActing else { return }
        isActing = true
        actionError = nil
        let request = CreateHomeEventRequest(
            eventType: CalendarEventCategory.family.rawValue,
            title: title,
            startAt: slot.slot.start,
            endAt: slot.slot.end,
            assignedTo: memberIds.isEmpty ? nil : memberIds,
            requestRsvp: true
        )
        do {
            let _: HomeEventResponse = try await client.request(
                HomesEndpoints.createHomeEvent(homeId: homeId, request: request)
            )
            bookedLabel = FindATimeFormat.dayTimeLabel(utcISO: slot.slot.start, tz: tz)
            phase = .booked
        } catch {
            actionError = Self.message(for: error)
        }
        isActing = false
    }

    // MARK: - Send proposal (time poll)

    func sendProposal() async {
        guard !isActing, !suggested.isEmpty else { return }
        isActing = true
        actionError = nil
        let options = suggested.map {
            SchedulingCreatePollRequest.Option(start: $0.slot.start, end: $0.slot.end)
        }
        let request = SchedulingCreatePollRequest(
            title: title,
            options: options,
            durationMin: durationMin
        )
        do {
            let response: CreatePollResponse = try await client.request(
                SchedulingEndpoints.createPoll(owner: owner, request)
            )
            createdPollId = response.poll.id
            proposalMemberCount = members.count
            phase = .sent
        } catch {
            actionError = Self.message(for: error)
        }
        isActing = false
    }

    func viewProposalResponses() {
        guard let pollId = createdPollId else { return }
        push(.findATimePollResponse(pollId: pollId))
    }

    // MARK: - Edit sheet hand-off

    /// Build the F4 setup view-model for the in-place edit sheet, prefilled from
    /// the current draft. On Next it hands the recomputed draft back via `onDone`.
    func makeEditViewModel(onDone: @escaping @MainActor (FindATimeDraft) -> Void) -> FindATimeSetupViewModel {
        FindATimeSetupViewModel(
            homeId: homeId,
            tz: tz,
            initialDraft: activeDraft,
            onProceed: onDone,
            client: client
        )
    }

    // MARK: - Helpers

    private static func message(for error: Error) -> String {
        if let schedulingError = error as? SchedulingError {
            return schedulingError.userMessage ?? "Something went wrong. Please try again."
        }
        return "Something went wrong. Please try again."
    }
}
