//
//  BookResourceViewModel.swift
//  Pantopus
//
//  Stream I12 — F12 Book a Resource. A tz-aware hour grid validated against the
//  resource's rules (max duration) and its existing bookings (taken hours).
//  `POST …/resources/:rid/book` is authoritative: a 409 SLOT_CONFLICT /
//  RESOURCE_UNAVAILABLE surfaces the Foundation SlotTakenSheet (never a dead
//  end). `requires_approval` resources resolve to the approval-requested state.
//

import Observation
import SwiftUI

@Observable
@MainActor
final class BookResourceViewModel {
    /// Per-cell render state for the hour grid.
    enum CellState: Equatable {
        case free, selected, selectedConflict, taken, off
    }

    /// The When-section status line tone.
    enum StatusTone: Equatable {
        case ok, conflict, warning
    }

    enum Phase: Equatable {
        case loading
        case form
        case error(message: String)
        case success(approval: Bool)
    }

    /// First (8 AM) and last (7 PM) bookable hour shown on the grid.
    static let firstHour = 8
    static let lastHour = 19

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var resourceName = ""
    private(set) var ruleChips: [ResourceDetailViewModel.RuleChipModel] = []
    var selectedDay = Calendar.current.startOfDay(for: Date())
    private(set) var selectionStart: Int?
    private(set) var selectionCount = 0
    var forWhom: ResourceHomeMember?
    private(set) var members: [ResourceHomeMember] = []
    /// Optional free-text note captured on the "Notes" section. NOTE: the
    /// `POST …/resources/:rid/book` route and `BookResourceRequest` DTO do not
    /// yet carry a note field, so this is captured view-only and not transmitted
    /// until the shared DTO + backend route gain a `note` param.
    var note = ""
    private(set) var isSubmitting = false
    var saveError: String?
    /// Drives the Foundation SlotTakenSheet.
    var slotConflict: SlotConflictPresentation?

    /// Success-screen copy. `successNote` drives the `calendar-check` note pill
    /// shown between the body and the "Back to calendar" CTA.
    private(set) var successTitle = ""
    private(set) var successBody = ""
    private(set) var successNote = ""

    // MARK: Dependencies

    let homeId: String
    let resourceId: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private var maxDurationMin: Int?
    private var availableHours: AvailableHours?
    /// Hours occupied by other live bookings of this resource, keyed by day.
    private var bookings: [ResourceBooking] = []

    init(
        homeId: String,
        resourceId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.homeId = homeId
        self.resourceId = resourceId
        self.push = push
        self.client = client
    }

    private var owner: SchedulingOwner {
        .home(homeId: homeId)
    }

    // MARK: Load

    func load() async {
        if case .form = phase { return }
        phase = .loading
        do {
            let resources: ResourcesResponse = try await client.request(
                SchedulingEndpoints.getResources(owner: owner)
            )
            if let booked: ResourceBookingsResponse = try? await client.request(
                SchedulingEndpoints.getBookings(owner: owner)
            ) {
                bookings = booked.bookings.filter { $0.resourceId == resourceId && $0.isLive }
            }
            members = await fetchMembers()
            forWhom = members.first

            guard let resource = resources.resources.first(where: { $0.id == resourceId }) else {
                phase = .error(message: "This resource is no longer available.")
                return
            }
            resourceName = resource.name
            maxDurationMin = resource.maxDurationMin
            availableHours = AvailableHours(json: resource.availableHours)
            ruleChips = Self.reminderChips(resource)
            phase = .form
        } catch let error as SchedulingError {
            phase = .error(message: error.userMessage ?? "Couldn't open this resource.")
        } catch {
            phase = .error(message: "Couldn't open this resource.")
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

    private static func reminderChips(_ resource: ResourceDTO) -> [ResourceDetailViewModel.RuleChipModel] {
        var chips: [ResourceDetailViewModel.RuleChipModel] = []
        if let minutes = resource.maxDurationMin, minutes > 0 {
            let hours = minutes / 60
            chips.append(.init(icon: .timer, text: hours >= 1 ? "\(hours) hr max" : "\(minutes) min max"))
        }
        let approval = resource.requiresApproval ?? false
        chips.append(.init(icon: approval ? .clock : .check, text: approval ? "Needs approval" : "No approval"))
        chips.append(.init(icon: .users, text: "All members"))
        return chips
    }

    // MARK: Day navigation

    var dayLabel: String {
        ResourceTime.dayStripLabel(selectedDay)
    }

    func stepDay(_ delta: Int) {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        guard let next = cal.date(byAdding: .day, value: delta, to: selectedDay) else { return }
        // Don't navigate into the past.
        if next < cal.startOfDay(for: Date()) { return }
        selectedDay = next
        clearSelection()
    }

    var canStepBack: Bool {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        return selectedDay > cal.startOfDay(for: Date())
    }

    // MARK: Grid

    var hours: [Int] {
        Array(Self.firstHour...Self.lastHour)
    }

    private var takenHours: Set<Int> {
        var set = Set<Int>()
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        for booking in bookings {
            guard let startISO = booking.startAt, let start = SchedulingTime.parseUTC(startISO) else { continue }
            guard cal.isDate(start, inSameDayAs: selectedDay) else { continue }
            let end = booking.endAt.flatMap(SchedulingTime.parseUTC) ?? start.addingTimeInterval(3600)
            let startHour = cal.component(.hour, from: start)
            let endComps = cal.dateComponents([.hour, .minute], from: end)
            let endHour = (endComps.hour ?? startHour) + ((endComps.minute ?? 0) > 0 ? 1 : 0)
            for hour in startHour..<max(startHour + 1, endHour) {
                set.insert(hour)
            }
        }
        return set
    }

    private var offHours: Set<Int> {
        guard let hours = availableHours else { return [] }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        let weekday = cal.component(.weekday, from: selectedDay)
        guard hours.days.contains(weekday) else { return Set(self.hours) }
        let startHour = Int(hours.start.split(separator: ":").first ?? "0") ?? Self.firstHour
        let endHour = Int(hours.end.split(separator: ":").first ?? "23") ?? Self.lastHour
        return Set(self.hours.filter { $0 < startHour || $0 >= endHour })
    }

    func cellState(for hour: Int) -> CellState {
        let inSelection = selectionStart.map { hour >= $0 && hour < $0 + selectionCount } ?? false
        if inSelection { return takenHours.contains(hour) ? .selectedConflict : .selected }
        if takenHours.contains(hour) { return .taken }
        if offHours.contains(hour) { return .off }
        return .free
    }

    func tap(hour: Int) {
        // Off hours are genuinely unavailable; ignore.
        if offHours.contains(hour) { return }
        let maxHours = maxDurationMin.map { max(1, $0 / 60) } ?? 24
        if let start = selectionStart {
            if hour == start + selectionCount, selectionCount < maxHours + 1 {
                selectionCount += 1 // allow one past max so the warn state can show
            } else if hour >= start, hour < start + selectionCount {
                selectionCount = hour - start + 1
            } else {
                selectionStart = hour
                selectionCount = 1
            }
        } else {
            selectionStart = hour
            selectionCount = 1
        }
    }

    private func clearSelection() {
        selectionStart = nil
        selectionCount = 0
    }

    // MARK: Validation / status

    private var overlapsTaken: Bool {
        guard let start = selectionStart else { return false }
        return (start..<start + selectionCount).contains { takenHours.contains($0) }
    }

    private var exceedsMax: Bool {
        guard let max = maxDurationMin else { return false }
        return selectionCount * 60 > max
    }

    var canSubmit: Bool {
        selectionStart != nil && selectionCount > 0 && !overlapsTaken && !exceedsMax && !isSubmitting
    }

    var statusLine: (tone: StatusTone, text: String)? {
        guard let start = selectionStart, selectionCount > 0 else { return nil }
        if exceedsMax, let max = maxDurationMin {
            return (.warning, "That's longer than the \(max / 60) hr max")
        }
        if overlapsTaken {
            return (.conflict, conflictText(start: start))
        }
        return (.ok, "This slot is free · \(selectionRangeLabel)")
    }

    private func conflictText(start: Int) -> String {
        // Name the clashing booking when we can.
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        let clash = bookings.first { booking in
            guard let iso = booking.startAt, let date = SchedulingTime.parseUTC(iso),
                  cal.isDate(date, inSameDayAs: selectedDay) else { return false }
            let hour = cal.component(.hour, from: date)
            let end = booking.endAt.flatMap(SchedulingTime.parseUTC).map { cal.component(.hour, from: $0) } ?? hour + 1
            return (start..<start + selectionCount).contains { $0 >= hour && $0 < max(hour + 1, end) }
        }
        if let clash {
            let who = clash.inviteeName ?? members.first { $0.id == clash.createdBy }?.name ?? "Someone"
            let range = ResourceTime.rangeLabel(startISO: clash.startAt, endISO: clash.endAt)
            return "Taken — \(who) has it \(range) · pick another time"
        }
        return "Taken — pick another time"
    }

    private var selectionRangeLabel: String {
        guard let start = selectionStart,
              let startDate = ResourceTime.combine(day: selectedDay, hour: start),
              let endDate = ResourceTime.combine(day: selectedDay, hour: start + selectionCount)
        else { return "" }
        return ResourceTime.rangeLabel(startISO: ResourceTime.utcISO(startDate), endISO: ResourceTime.utcISO(endDate))
    }

    // MARK: Submit

    func submit() async {
        guard canSubmit, let start = selectionStart,
              let startDate = ResourceTime.combine(day: selectedDay, hour: start) else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        let request = BookResourceRequest(
            startAt: ResourceTime.utcISO(startDate),
            durationMin: selectionCount * 60,
            name: forWhom?.name
        )
        do {
            let response: ResourceBookingResponse = try await client.request(
                SchedulingEndpoints.bookResource(owner: owner, resourceId: resourceId, request)
            )
            let approval = response.booking.status == "pending"
            let range = selectionRangeLabel
            let slotLabel = "\(resourceName) · \(dayLabel) · \(range)"
            if approval {
                // F12 approval-requested: title + notify body + slot note pill.
                successTitle = "Request sent to an admin"
                successBody = "We'll notify you when your booking is approved."
                successNote = slotLabel
            } else {
                // F12 confirmed: title "Booked" + slot body + calendar note pill.
                successTitle = "Booked"
                successBody = slotLabel
                successNote = "Added to the home calendar"
            }
            phase = .success(approval: approval)
        } catch let error as SchedulingError {
            await handleConflict(error)
        } catch {
            saveError = "Couldn't book this resource. Please try again."
        }
    }

    private func handleConflict(_ error: SchedulingError) async {
        // Refresh taken hours so the grid reflects the live state either way.
        if let refreshed: ResourceBookingsResponse = try? await client.request(
            SchedulingEndpoints.getBookings(owner: owner)
        ) {
            bookings = refreshed.bookings.filter { $0.resourceId == resourceId && $0.isLive }
        }

        if error.code == "SLOT_CONFLICT" || error.code == "SLOT_TAKEN"
            || error.code == "RESOURCE_UNAVAILABLE" || !error.alternatives.isEmpty {
            slotConflict = SlotConflictPresentation(
                alternatives: error.alternatives,
                takenLabel: selectionRangeLabel
            )
        } else {
            saveError = error.userMessage ?? "Couldn't book this resource. Please try again."
        }
    }

    /// Apply a SlotTakenSheet alternative back onto the grid.
    func applyAlternative(_ alternative: SchedulingSlotAlternative) {
        slotConflict = nil
        guard let start = SchedulingTime.parseUTC(alternative.start) else { return }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        selectedDay = cal.startOfDay(for: start)
        let startHour = cal.component(.hour, from: start)
        let end = SchedulingTime.parseUTC(alternative.end)
        let endHour = end.map { cal.component(.hour, from: $0) } ?? startHour + 1
        selectionStart = startHour
        selectionCount = max(1, endHour - startHour)
    }

    func dismissConflict() {
        slotConflict = nil
    }

    func backToCalendar() {
        push(.homeCalendar(homeId: homeId))
    }

    /// SlotTakenSheet driver.
    struct SlotConflictPresentation: Identifiable {
        let id = UUID()
        let alternatives: [SchedulingSlotAlternative]
        let takenLabel: String?
    }
}
