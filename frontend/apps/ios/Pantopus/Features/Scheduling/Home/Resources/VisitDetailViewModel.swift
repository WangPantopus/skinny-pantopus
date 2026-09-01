//
//  VisitDetailViewModel.swift
//  Pantopus
//
//  Stream I12 — F14 Visit Detail. Contract-first: a visit is a HomeCalendarEvent
//  read via `GET …/events/:eventId`. Status is derived from time (Confirmed
//  when upcoming, Done when past); Reschedule / Edit write through
//  `PUT …/events/:eventId`, Cancel deletes the event, Book again re-opens F13.
//  (The design's offer/reserve/link lifecycle has no v1 backend.)
//

import Observation
import SwiftUI

@Observable
@MainActor
final class VisitDetailViewModel {
    enum ViewState: Equatable {
        case loading
        case loaded
        case error(message: String)
        case removed
    }

    /// Derived lifecycle for a concrete visit.
    enum Lifecycle: Equatable {
        case confirmed
        case done
    }

    /// View-only projection of the design's 4-step status timeline
    /// (Offered → Reserved → Confirmed → Done). The concrete-visit model only
    /// distinguishes Confirmed (upcoming) from Done (past), so a confirmed
    /// visit lands on step 2 (Confirmed) and a done visit on step 3 (Done);
    /// the earlier Offered/Reserved steps render as completed. The offer/
    /// reserve/link lifecycle the design also draws has no v1 backend.
    var statusStep: Int {
        lifecycle == .done ? 3 : 2
    }

    /// The design renders a header terminal chip in the Completed/Cancelled/
    /// No-show states. The only terminal state this model derives is `done` →
    /// Completed (check / success tones).
    var terminalChip: (label: String, icon: PantopusIcon)? {
        lifecycle == .done ? ("Completed", .check) : nil
    }

    // MARK: State

    private(set) var state: ViewState = .loading
    private(set) var title = ""
    private(set) var kind: VisitKind = .vendor
    private(set) var lifecycle: Lifecycle = .confirmed
    private(set) var timeText = ""
    private(set) var hostMembers: [ResourceHomeMember] = []
    private(set) var hostSummary = ""
    private(set) var entryNote: String?
    var actionError: String?
    var showCancelConfirm = false
    private(set) var isMutating = false

    // MARK: Edit sheet

    var isEditing = false
    var editTitle = ""
    var editKind: VisitKind = .vendor
    var editWhoIsHome: Set<String> = []
    var editDate = Date()
    var editStart = Date()
    var editDuration = 1
    var editNote = ""
    private(set) var members: [ResourceHomeMember] = []
    private(set) var isSavingEdit = false

    // MARK: Dependencies

    let homeId: String
    let eventId: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    init(
        homeId: String,
        eventId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.homeId = homeId
        self.eventId = eventId
        self.push = push
        self.client = client
    }

    private var isLoaded: Bool {
        if case .loaded = state { return true }
        return false
    }

    // MARK: Load

    func load() async {
        await fetch(showLoading: !isLoaded)
    }

    func refresh() async {
        await fetch(showLoading: false)
    }

    private func fetch(showLoading: Bool) async {
        if showLoading { state = .loading }
        do {
            let response: HomeEventDetailResponse = try await client.request(
                HomesEndpoints.getHomeEvent(homeId: homeId, eventId: eventId)
            )
            let roster = await fetchMembers()
            apply(event: response.event, members: roster)
            state = .loaded
        } catch let error as SchedulingError {
            if case .notFound = error {
                state = .removed
            } else {
                state = .error(message: error.userMessage ?? "Couldn't load this visit.")
            }
        } catch {
            state = .error(message: "Couldn't load this visit.")
        }
    }

    private func fetchMembers() async -> [ResourceHomeMember] {
        do {
            let response: OccupantsResponse = try await client.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            return ResourceHomeMember.from(occupants: response.occupants)
        } catch {
            return []
        }
    }

    private func apply(event: CalendarEventDTO, members roster: [ResourceHomeMember]) {
        members = roster
        title = event.title
        kind = VisitKind(wire: event.eventType)

        let now = Date()
        let start = SchedulingTime.parseUTC(event.startAt)
        let end = event.endAt.flatMap(SchedulingTime.parseUTC) ?? start?.addingTimeInterval(3600)
        let isPast = (end ?? now) < now
        lifecycle = isPast ? .done : .confirmed
        timeText = isPast
            ? "Done · \(ResourceTime.shortDate(event.startAt))"
            : ResourceTime.longRangeLabel(startISO: event.startAt, endISO: event.endAt)

        let ids = event.assignedTo ?? []
        hostMembers = ids.compactMap { id in roster.first { $0.id == id } }
        hostSummary = Self.hostSummary(members: hostMembers, ids: ids)
        entryNote = event.locationNotes?.isEmpty == false ? event.locationNotes : nil

        // Seed the edit sheet from the live event.
        editTitle = event.title
        editKind = kind
        editWhoIsHome = Set(ids)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        if let start {
            editDate = cal.startOfDay(for: start)
            editStart = start
        }
        if let start, let end {
            editDuration = max(1, Int((end.timeIntervalSince(start) / 3600).rounded()))
        }
        editNote = event.locationNotes ?? ""
    }

    private static func hostSummary(members: [ResourceHomeMember], ids: [String]) -> String {
        if !members.isEmpty {
            let names = members.map(\.name)
            switch names.count {
            case 1: return "\(names[0]) must be home"
            case 2: return "\(names[0]) & \(names[1]) must be home"
            default: return "\(names[0]) + \(names.count - 1) must be home"
            }
        }
        if ids.isEmpty { return "No host required" }
        return ids.count == 1 ? "1 host must be home" : "\(ids.count) hosts must be home"
    }

    // MARK: Actions

    func beginEdit() {
        isEditing = true
    }

    func bookAgain() {
        push(.scheduleVisit(homeId: homeId))
    }

    /// The design footer carries a trailing message affordance. There is no
    /// visit-messaging endpoint in v1, so this is a no-op placeholder until a
    /// thread/contact destination is wired up (see deferredBackend).
    func messageVisitor() {}

    var editValid: Bool {
        !editTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !editWhoIsHome.isEmpty
            && editDuration > 0
    }

    func toggleEditHost(_ id: String) {
        if editWhoIsHome.contains(id) { editWhoIsHome.remove(id) } else { editWhoIsHome.insert(id) }
    }

    private var editStartInstant: Date? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        let time = cal.dateComponents([.hour, .minute], from: editStart)
        return cal.date(bySettingHour: time.hour ?? 9, minute: time.minute ?? 0, second: 0, of: editDate)
    }

    func saveEdit() async {
        guard editValid, !isSavingEdit, let start = editStartInstant else { return }
        isSavingEdit = true
        defer { isSavingEdit = false }
        let end = start.addingTimeInterval(TimeInterval(editDuration * 3600))
        let note = editNote.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = UpdateHomeEventRequest(
            eventType: editKind.rawValue,
            title: editTitle.trimmingCharacters(in: .whitespacesAndNewlines),
            startAt: ResourceTime.utcISO(start),
            endAt: ResourceTime.utcISO(end),
            locationNotes: note.isEmpty ? nil : note,
            assignedTo: Array(editWhoIsHome)
        )
        do {
            _ = try await client.request(
                HomesEndpoints.updateHomeEvent(homeId: homeId, eventId: eventId, request: request),
                as: HomeEventResponse.self
            )
            isEditing = false
            await fetch(showLoading: false)
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Couldn't update this visit."
        } catch {
            actionError = "Couldn't update this visit."
        }
    }

    /// Returns true on success so the view can dismiss.
    func cancelVisit() async -> Bool {
        guard !isMutating else { return false }
        isMutating = true
        defer { isMutating = false }
        do {
            try await client.send(HomesEndpoints.deleteHomeEvent(homeId: homeId, eventId: eventId))
            return true
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Couldn't cancel this visit."
            return false
        } catch {
            actionError = "Couldn't cancel this visit."
            return false
        }
    }
}
