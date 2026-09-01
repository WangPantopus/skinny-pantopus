//
//  RescheduleReassignViewModel.swift
//  Pantopus
//
//  E4 Reschedule / Reassign (Stream I8) — the slot-picker view-model. Fetches
//  host reschedule slots (`GET /bookings/:id/available-slots`, always passing
//  `tz`), drives propose vs reschedule-now, recovers 409 SLOT_CONFLICT via the
//  SlotTakenSheet, and surfaces PAST_DEADLINE / INVALID_HOST inline. The sheet
//  view lives in `RescheduleReassignSheet.swift`.
//

import SwiftUI

/// One teammate offered in the E4 "Assign to" avatar rail
/// (reschedule-frames FrameMemberPicker). Ids only — the named roster awaits a
/// cross-stream source, so the rail shows id-initials (mirroring Android's
/// `MemberOption`).
struct ReassignCandidate: Identifiable, Hashable {
    let id: String
    let initials: String
    let label: String
}

/// One chip in the E4 horizontal weekday strip (reschedule-frames DayStrip).
struct DayStripEntry: Identifiable, Hashable {
    let date: Date
    let weekday: String
    let dayNumber: String
    let isSelected: Bool
    var id: Date {
        date
    }
}

@Observable
@MainActor
final class RescheduleReassignViewModel {
    enum Phase: Equatable { case loading, ready, error(message: String) }

    let owner: SchedulingOwner
    let booking: BookingDTO
    private let actions: BookingActions

    private(set) var phase: Phase = .loading
    private(set) var rangeSlots: [SlotDTO] = []
    private(set) var timezoneId: String
    private(set) var monthAnchor: Date
    private(set) var selectedDate: Date
    private(set) var selectedSlot: SlotDTO?

    var mode: RescheduleMode = .propose
    var notifyInvitee = true
    /// Reassign the booking to an available teammate (home/business). The named
    /// roster isn't in this stream's data (whos-free / team-availability return
    /// ids only, booking detail returns host_user_id only), so reassignment
    /// targets the first eligible host for the chosen slot; the named member
    /// picker awaits a roster source (cross-stream gap).
    var reassign = false
    /// The teammate id the host picked from the "Assign to" avatar rail
    /// (FrameMemberPicker). `nil` = keep the original host (the "All" affordance).
    /// Ids only — the named roster awaits a cross-stream source, so the rail
    /// renders id-initials, mirroring Android's `MemberOption`.
    var selectedReassignHostId: String?

    private(set) var submitting = false
    private(set) var succeeded = false
    private(set) var proposalSent = false
    var error: String?

    private(set) var conflictAlternatives: [SchedulingSlotAlternative] = []
    var showSlotTaken = false

    private var didLoad = false
    private var fetchGeneration = 0

    var accent: Color {
        owner.theme.accent
    }

    var canReassign: Bool {
        BookingsPillar.supportsReassign(owner)
    }

    init(
        owner: SchedulingOwner,
        booking: BookingDTO,
        actions: BookingActions,
        tz: String
    ) {
        self.owner = owner
        self.booking = booking
        self.actions = actions
        timezoneId = tz
        let cal = BookingsCalendar.calendar(tz: tz)
        monthAnchor = cal.startOfDay(for: Date())
        selectedDate = cal.startOfDay(for: Date())
    }

    // MARK: - Derived

    var availableDays: Set<Date> {
        BookingsCalendar.availableDays(rangeSlots, tz: timezoneId)
    }

    var daySlots: [SlotDTO] {
        BookingsCalendar.slots(rangeSlots, on: selectedDate, tz: timezoneId)
    }

    /// The horizontal weekday strip (JSX DayStrip): every day with at least one
    /// open slot in the visible range, soonest-first, with the selected flag.
    var dayStripEntries: [DayStripEntry] {
        let cal = BookingsCalendar.calendar(tz: timezoneId)
        let selectedDay = cal.startOfDay(for: selectedDate)
        let weekdayFmt = DateFormatter()
        weekdayFmt.calendar = cal
        weekdayFmt.timeZone = cal.timeZone
        weekdayFmt.locale = .current
        weekdayFmt.dateFormat = "EEE"
        let dayFmt = DateFormatter()
        dayFmt.calendar = cal
        dayFmt.timeZone = cal.timeZone
        dayFmt.dateFormat = "d"
        return availableDays.sorted().map { day in
            DayStripEntry(
                date: day,
                weekday: weekdayFmt.string(from: day),
                dayNumber: dayFmt.string(from: day),
                isSelected: cal.isDate(day, inSameDayAs: selectedDay)
            )
        }
    }

    /// JSX SlotRow label — the full "Tue, Oct 21 · 2:00–2:30 PM · PT" line.
    func slotRowLabel(_ slot: SlotDTO) -> String {
        BookingsTime.headerWhen(startUTC: slot.start, endUTC: slot.end, tz: timezoneId)
    }

    var timezoneLabel: String {
        TimeZone(identifier: timezoneId)?.localizedName(for: .generic, locale: .current) ?? timezoneId
    }

    var slotPickerState: SlotPicker.LoadState {
        switch phase {
        case .loading: return .loading
        case .error: return .noAvailability
        case .ready:
            if availableDays.isEmpty { return .noAvailability }
            return daySlots.isEmpty ? .dayFull : .loaded
        }
    }

    var currentTimeLabel: String {
        BookingsTime.relativeWhen(startUTC: booking.startAt, tz: timezoneId)
    }

    var newTimeLabel: String? {
        selectedSlot.map { BookingsTime.headerWhen(startUTC: $0.start, endUTC: $0.end, tz: timezoneId) }
    }

    /// Copy for the "Proposal sent" confirmation.
    var proposalSentDetail: String {
        let name = booking.inviteeName ?? "Your invitee"
        let time = newTimeLabel ?? "the new time"
        return "\(name) will get a push and a message to accept \(time)."
    }

    /// Teammates free at the chosen slot (drives the reassign subtitle).
    var eligibleHostCount: Int {
        let hosts = selectedSlot?.eligibleHosts ?? []
        return hosts.filter { $0 != booking.hostUserId }.count
    }

    /// The "Assign to" avatar rail (reschedule-frames FrameMemberPicker). The
    /// host id ("keep" — the design's `+`/`All` trailing avatar) plus each
    /// teammate free at the selected slot. Ids only; initials are the first two
    /// id characters until a named roster source lands (the same data-gap form
    /// Android's `MemberOption` uses).
    var reassignCandidates: [ReassignCandidate] {
        let hosts = (selectedSlot?.eligibleHosts ?? []).filter { $0 != booking.hostUserId }
        return hosts.map { ReassignCandidate(id: $0, initials: BookingsAvatar.initials(fromId: $0), label: "Member") }
    }

    /// CTA copy. After a failed submit the design's error frame swaps the
    /// primary to "Try again" / `rotate-cw` (reschedule-frames.jsx FrameError);
    /// otherwise it follows the apply mode.
    var ctaTitle: String {
        if error != nil { return "Try again" }
        return mode == .propose ? "Send proposal" : "Reschedule now"
    }

    var ctaIcon: PantopusIcon {
        if error != nil { return .rotateCw }
        return mode == .propose ? .send : .calendarCheck
    }

    var canSubmit: Bool {
        selectedSlot != nil && !submitting
    }

    // MARK: - Loading

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await fetchRange()
        if phase == .ready, availableDays.isEmpty { await jumpNextAvailable() }
    }

    func refresh() async {
        await fetchRange()
    }

    private func fetchRange() async {
        fetchGeneration &+= 1
        let generation = fetchGeneration
        phase = .loading
        let (from, to) = BookingsCalendar.monthRange(monthAnchor: monthAnchor, tz: timezoneId)
        do {
            let slots = try await actions.availableSlots(id: booking.id, from: from, to: to, tz: timezoneId)
            guard generation == fetchGeneration else { return }
            rangeSlots = slots
            phase = .ready
            selectFirstAvailableDayIfNeeded()
        } catch let error as SchedulingError {
            guard generation == fetchGeneration else { return }
            phase = .error(message: error.userMessage ?? "Couldn't load open times.")
        } catch {
            guard generation == fetchGeneration else { return }
            phase = .error(message: "Couldn't load open times.")
        }
    }

    // MARK: - Interaction

    func selectDate(_ date: Date) {
        selectedDate = date
        selectedSlot = nil
    }

    func selectSlot(_ slot: SlotDTO) {
        selectedSlot = slot
        if eligibleHostCount == 0 {
            reassign = false
            selectedReassignHostId = nil
        } else if let picked = selectedReassignHostId,
                  !(slot.eligibleHosts ?? []).contains(picked) {
            // The teammate picked for the previous slot isn't free here.
            selectedReassignHostId = nil
            reassign = false
        }
    }

    /// Pick (or clear, when re-tapped / "All") the reassign teammate from the rail.
    func selectReassignHost(_ id: String?) {
        guard canReassign else { return }
        if selectedReassignHostId == id || id == nil {
            selectedReassignHostId = nil
            reassign = false
        } else {
            selectedReassignHostId = id
            reassign = true
        }
    }

    func changeMonth(_ delta: Int) async {
        let cal = BookingsCalendar.calendar(tz: timezoneId)
        guard let newAnchor = cal.date(byAdding: .month, value: delta, to: monthAnchor) else { return }
        let currentMonthStart = cal.dateInterval(of: .month, for: Date())?.start ?? cal.startOfDay(for: Date())
        guard let newMonthStart = cal.dateInterval(of: .month, for: newAnchor)?.start,
              newMonthStart >= currentMonthStart else { return }
        monthAnchor = newAnchor
        if let interval = cal.dateInterval(of: .month, for: newAnchor) {
            selectedDate = max(interval.start, cal.startOfDay(for: Date()))
        }
        selectedSlot = nil
        await fetchRange()
    }

    func changeTimezone(_ identifier: String) async {
        guard identifier != timezoneId else { return }
        timezoneId = identifier
        let cal = BookingsCalendar.calendar(tz: identifier)
        monthAnchor = cal.startOfDay(for: monthAnchor)
        selectedDate = cal.startOfDay(for: selectedDate)
        await fetchRange()
    }

    func jumpNextAvailable() async {
        let cal = BookingsCalendar.calendar(tz: timezoneId)
        let afterStart = cal.startOfDay(for: selectedDate)
        if let next = availableDays.filter({ $0 > afterStart }).min() {
            selectDate(next)
            return
        }
        let savedAnchor = monthAnchor
        for _ in 0..<6 {
            guard let nextAnchor = cal.date(byAdding: .month, value: 1, to: monthAnchor) else { break }
            monthAnchor = nextAnchor
            await fetchRange()
            guard phase == .ready else { break }
            if let first = availableDays.min() {
                selectDate(first)
                return
            }
        }
        monthAnchor = savedAnchor
        selectedSlot = nil
        await fetchRange()
    }

    private func selectFirstAvailableDayIfNeeded() {
        guard daySlots.isEmpty else { return }
        let cal = BookingsCalendar.calendar(tz: timezoneId)
        let todayStart = cal.startOfDay(for: Date())
        if let first = availableDays.filter({ $0 >= todayStart }).min() { selectedDate = first }
    }

    // MARK: - Submit

    /// Returns whether the booking was rescheduled now (so the view can chain
    /// `onCompleted`). A successful *proposal* returns `false` — the view re-renders
    /// to the proposal-sent confirmation instead.
    @discardableResult
    func submit() async -> Bool {
        guard let slot = selectedSlot else { return false }
        submitting = true
        error = nil
        let host = reassignHostUserId(for: slot)
        do {
            if mode == .propose {
                _ = try await actions.proposeReschedule(id: booking.id, startAt: slot.start, hostUserId: host)
                proposalSent = true
            } else {
                _ = try await actions.reschedule(id: booking.id, startAt: slot.start, hostUserId: host)
                succeeded = true
            }
        } catch let scheduling as SchedulingError {
            handle(scheduling)
        } catch {
            self.error = "Couldn't save the new time — try again."
        }
        submitting = false
        return succeeded
    }

    /// Recovery from the SlotTakenSheet: take an alternative and submit it.
    func chooseAlternative(_ alt: SchedulingSlotAlternative) async {
        showSlotTaken = false
        let slot = SlotDTO(start: alt.start, end: alt.end, startLocal: alt.startLocal)
        selectedSlot = slot
        if let date = SchedulingTime.parseUTC(alt.start) {
            selectedDate = BookingsCalendar.calendar(tz: timezoneId).startOfDay(for: date)
        }
        await submit()
    }

    func dismissSlotTaken() {
        showSlotTaken = false
    }

    private func reassignHostUserId(for slot: SlotDTO) -> String? {
        guard reassign, canReassign else { return nil }
        let eligible = (slot.eligibleHosts ?? []).filter { $0 != booking.hostUserId }
        // Honor the rail's explicit pick; otherwise take the first free teammate.
        if let picked = selectedReassignHostId, eligible.contains(picked) { return picked }
        return eligible.first
    }

    private func handle(_ scheduling: SchedulingError) {
        switch scheduling {
        case let .slotConflict(_, _, alternatives):
            conflictAlternatives = alternatives
            showSlotTaken = true
        case let .conflict(code, message):
            switch code {
            case "PAST_DEADLINE": error = "It's past the reschedule cutoff for this booking."
            case "INVALID_HOST": error = "That teammate can't take this booking."
            case "INVALID_TIME": error = "That time isn't open anymore — pick another."
            default: error = message ?? "Couldn't save the new time — try again."
            }
        default:
            error = scheduling.userMessage ?? "Couldn't save the new time — try again."
        }
    }
}
