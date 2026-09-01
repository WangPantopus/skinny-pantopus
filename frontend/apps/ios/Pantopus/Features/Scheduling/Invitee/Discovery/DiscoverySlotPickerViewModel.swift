//
//  DiscoverySlotPickerViewModel.swift
//  Pantopus
//
//  C6 Date + Time Slot Picker (Stream I5) — drives the Foundation `SlotPicker`.
//  Fetches public slots for the visible month (`GET …/:eventTypeSlug/slots` or
//  the one-off `…/book/o/:token`), always passing `tz` (IANA) and rendering the
//  returned `startLocal`. Month paging, timezone change (re-fetch), and
//  jump-to-next-available are all here. `status:'paused'` is a calm state.
//  Selecting a slot hands off to C6→D1 (`.inviteeIntakeForm`); this stream
//  stops at slot selection.
//

import SwiftUI

@Observable
@MainActor
final class DiscoverySlotPickerViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case paused
        case error(message: String)
    }

    let slug: String
    let eventTypeSlug: String
    let oneOffToken: String?
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var phase: Phase = .loading
    private(set) var eventType: PublicEventTypeView?
    private(set) var timezoneId: String
    private(set) var monthAnchor: Date
    private(set) var selectedDate: Date
    private(set) var selectedSlotStart: String?
    /// All slots fetched for the visible month range.
    private(set) var rangeSlots: [SlotDTO] = []

    /// Set when a race condition takes a previously selected slot (Frame 6).
    /// The slot-picker toast "That time was just taken" is shown while this is non-nil.
    /// Cleared whenever the user selects a new slot or changes the date.
    private(set) var takenSlotStart: String?

    private var didLoad = false
    /// Bumped on every fetch; stale completions (overlapping nav taps) are dropped.
    private var fetchGeneration = 0

    /// Host name + pillar, fetched from the booking page (the slots route carries
    /// neither) — drives the "with {host}" summary line and the pillar accent.
    private(set) var hostName: String?
    private(set) var ownerType: String?

    /// The host pillar accent (sky / green / violet) for today/selected.
    var accent: Color {
        DiscoveryTheme.accent(forOwnerType: ownerType)
    }

    /// The lightest pillar tint for the summary icon tile.
    var accentBg: Color {
        DiscoveryTheme.accentBg(forOwnerType: ownerType)
    }

    init(
        slug: String,
        eventTypeSlug: String,
        tz: String,
        oneOffToken: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.slug = slug
        self.eventTypeSlug = eventTypeSlug
        timezoneId = tz
        self.oneOffToken = oneOffToken
        self.push = push
        self.client = client
        let cal = DiscoveryCalendar.calendar(tz: tz)
        monthAnchor = cal.startOfDay(for: Date())
        selectedDate = cal.startOfDay(for: Date())
    }

    // MARK: - Derived

    var timezoneLabel: String {
        DiscoveryTimeZone.abbreviation(for: timezoneId)
    }

    var availableDays: Set<Date> {
        DiscoveryCalendar.availableDays(rangeSlots, tz: timezoneId)
    }

    var daySlots: [SlotDTO] {
        DiscoveryCalendar.slots(rangeSlots, on: selectedDate, tz: timezoneId)
    }

    var dstHint: String? {
        DiscoveryCalendar.dstHint(monthAnchor: monthAnchor, tz: timezoneId)
    }

    /// `true` while a slot-taken race condition is active (Frame 6 toast is visible).
    var slotJustTaken: Bool {
        takenSlotStart != nil
    }

    var slotPickerState: SlotPicker.LoadState {
        switch phase {
        case .loading:
            return .loading
        case .error, .paused:
            return .noAvailability
        case .ready:
            if availableDays.isEmpty { return .noAvailability }
            return daySlots.isEmpty ? .dayFull : .loaded
        }
    }

    var summaryDetail: String? {
        guard let eventType else { return nil }
        let duration = (eventType.defaultDuration ?? eventType.durations?.first).map { "\($0) min" }
        let trailing = hostName.map { "with \($0)" }
            ?? DiscoveryLocation.label(mode: eventType.locationMode, detail: eventType.locationDetail)
        return [duration, trailing].compactMap { $0 }.joined(separator: " · ")
    }

    // MARK: - Loading

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await loadHostInfo()
        await fetchRange()
        // If the current month has nothing open, advance to the first month that
        // does — so an invitee (incl. the C8 "see open times" hand-off) lands on
        // real availability instead of an empty current month.
        if phase == .ready, availableDays.isEmpty {
            await jumpNextAvailable()
        }
    }

    /// Best-effort fetch of the booking page for the host name + pillar. Failures
    /// are silent — the picker still works, just without the host name/accent.
    private func loadHostInfo() async {
        guard hostName == nil, ownerType == nil, !slug.isEmpty else { return }
        let view: PublicBookView? = try? await client.request(SchedulingPublicEndpoints.bookPage(slug: slug))
        guard let view else { return }
        hostName = view.page.title
        ownerType = view.page.ownerType
    }

    func refresh() async {
        await fetchRange()
    }

    private func fetchRange() async {
        fetchGeneration &+= 1
        let generation = fetchGeneration
        phase = .loading
        let (from, to) = DiscoveryCalendar.monthRange(monthAnchor: monthAnchor, tz: timezoneId)
        do {
            if let oneOffToken {
                let view: OneOffBookView = try await client.request(
                    SchedulingPublicEndpoints.oneOffView(token: oneOffToken, tz: timezoneId, from: from, to: to)
                )
                guard generation == fetchGeneration else { return }
                eventType = view.eventType
                rangeSlots = view.slots
                phase = .ready
            } else {
                let response: PublicSlotsResponse = try await client.request(
                    SchedulingPublicEndpoints.slots(
                        slug: slug, eventTypeSlug: eventTypeSlug, from: from, to: to, tz: timezoneId
                    )
                )
                guard generation == fetchGeneration else { return }
                eventType = response.eventType
                rangeSlots = response.slots
                switch response.status {
                case .paused:
                    phase = .paused
                case .unavailable, .expired:
                    phase = .error(message: "This link isn't available")
                case .active, .secret, .unknown:
                    phase = .ready
                }
            }
            if phase == .ready { selectFirstAvailableDayIfNeeded() }
        } catch let error as SchedulingError {
            guard generation == fetchGeneration else { return }
            phase = .error(message: message(for: error))
        } catch {
            guard generation == fetchGeneration else { return }
            phase = .error(message: "Something went wrong. Try again.")
        }
    }

    // MARK: - Interaction

    func selectDate(_ date: Date) {
        selectedDate = date
        selectedSlotStart = nil
        takenSlotStart = nil
    }

    func selectSlot(_ slot: SlotDTO) {
        selectedSlotStart = slot.start
        takenSlotStart = nil
        // FOUNDATION GAP: `.inviteeIntakeForm` (frozen I0b route) carries no
        // `oneOffToken`, so one-off-link bookings (oneOffToken != nil) cannot
        // commit via POST /book/o/:token in I6. Latent today — no in-app path
        // reaches the picker with a non-nil token — but I6/Foundation must thread
        // `oneOffToken` through the intake route before one-off entry ships.
        push(.inviteeIntakeForm(
            slug: slug,
            eventTypeSlug: eventTypeSlug,
            start: slot.start,
            tz: timezoneId
        ))
    }

    /// Called when the confirm flow returns a 409 conflict (the slot was booked
    /// by someone else between pick and confirm). Marks the slot as just-taken
    /// so the picker shows the Frame 6 WARN toast and the taken row treatment.
    /// The booker stays on the picker to pick another time.
    func markSlotTaken(_ slotStart: String) {
        takenSlotStart = slotStart
        selectedSlotStart = nil
    }

    /// Consume a pending D2 "Pick another time" hand-off for this flow (the
    /// `SlotTakenRelay` seam) when the picker re-appears after the unwind.
    func consumeSlotTakenSignal() {
        guard let start = SlotTakenRelay.shared.consume(slug: slug, eventTypeSlug: eventTypeSlug) else { return }
        markSlotTaken(start)
    }

    func changeMonth(_ delta: Int) async {
        let cal = DiscoveryCalendar.calendar(tz: timezoneId)
        guard let newAnchor = cal.date(byAdding: .month, value: delta, to: monthAnchor) else { return }
        // Never page before the current month — past days are all unbookable and
        // would hand the backend an inverted (from > to) range.
        let currentMonthStart = cal.dateInterval(of: .month, for: Date())?.start ?? cal.startOfDay(for: Date())
        guard let newMonthStart = cal.dateInterval(of: .month, for: newAnchor)?.start,
              newMonthStart >= currentMonthStart else { return }
        monthAnchor = newAnchor
        if let interval = cal.dateInterval(of: .month, for: newAnchor) {
            selectedDate = max(interval.start, cal.startOfDay(for: Date()))
        }
        selectedSlotStart = nil
        await fetchRange()
    }

    func changeTimezone(_ identifier: String) async {
        guard identifier != timezoneId else { return }
        timezoneId = identifier
        // Re-normalize anchors to the new zone so the visible month / selected day
        // don't drift by a day at zone/DST boundaries.
        let cal = DiscoveryCalendar.calendar(tz: identifier)
        monthAnchor = cal.startOfDay(for: monthAnchor)
        selectedDate = cal.startOfDay(for: selectedDate)
        await fetchRange()
    }

    /// Move to the next day with availability — within the loaded range first,
    /// then scanning forward up to six months. Honors the "next-horizon paging"
    /// contract so the booker is never dead-ended.
    func jumpNextAvailable() async {
        let cal = DiscoveryCalendar.calendar(tz: timezoneId)
        let afterStart = cal.startOfDay(for: selectedDate)
        if let next = availableDays.filter({ $0 > afterStart }).min() {
            selectDate(next)
            return
        }
        let savedAnchor = monthAnchor
        let savedSelected = selectedDate
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
        // Nothing open in the scanned horizon — restore the starting month rather
        // than stranding the booker in a far-future empty month.
        monthAnchor = savedAnchor
        selectedDate = savedSelected
        selectedSlotStart = nil
        await fetchRange()
    }

    // MARK: - Helpers

    private func selectFirstAvailableDayIfNeeded() {
        guard daySlots.isEmpty else { return }
        let cal = DiscoveryCalendar.calendar(tz: timezoneId)
        let todayStart = cal.startOfDay(for: Date())
        if let first = availableDays.filter({ $0 >= todayStart }).min() {
            selectedDate = first
        }
    }

    private func message(for error: SchedulingError) -> String {
        switch error {
        case .notFound:
            "This link isn't available"
        default:
            error.userMessage ?? "Something went wrong. Try again."
        }
    }
}

#if DEBUG
extension DiscoverySlotPickerViewModel {
    /// Fixture-seeded slot-just-taken state for Frame 6 `#Preview`.
    static func previewSlotTaken() -> DiscoverySlotPickerViewModel {
        let vm = previewLoaded()
        // Simulate the race condition: the first slot (9 AM) was just snatched.
        if let takenStart = vm.rangeSlots.first?.start {
            vm.takenSlotStart = takenStart
        }
        return vm
    }

    /// Fixture-seeded loaded state (today populated) for `#Preview` / screenshots.
    static func previewLoaded() -> DiscoverySlotPickerViewModel {
        let tz = "America/Los_Angeles"
        let viewModel = DiscoverySlotPickerViewModel(
            slug: "ada", eventTypeSlug: "intro", tz: tz, oneOffToken: nil, push: { _ in }, client: .shared
        )
        let etJSON = #"{"id":"et1","name":"Intro call","slug":"intro","durations":[30],"default_duration":30,"location_mode":"video"}"#
        if let data = etJSON.data(using: .utf8) {
            viewModel.eventType = try? JSONDecoder().decode(PublicEventTypeView.self, from: data)
        }
        let cal = DiscoveryCalendar.calendar(tz: tz)
        let formatter = ISO8601DateFormatter()
        let today = cal.startOfDay(for: Date())
        let selectedDay = cal.date(byAdding: .day, value: 3, to: today) ?? today
        func slot(_ day: Date, hour: Int) -> SlotDTO? {
            guard let start = cal.date(bySettingHour: hour, minute: 0, second: 0, of: day),
                  let end = cal.date(byAdding: .minute, value: 30, to: start) else { return nil }
            return SlotDTO(start: formatter.string(from: start), end: formatter.string(from: end))
        }
        var slots: [SlotDTO] = []
        for hour in [9, 10, 11, 14, 15] {
            if let entry = slot(selectedDay, hour: hour) { slots.append(entry) }
        }
        for offset in [2, 4, 5, 6] {
            if let day = cal.date(byAdding: .day, value: offset, to: today), let entry = slot(day, hour: 10) {
                slots.append(entry)
            }
        }
        viewModel.rangeSlots = slots
        viewModel.selectedDate = selectedDay
        viewModel.phase = .ready
        viewModel.hostName = "Maria Kessler"
        viewModel.ownerType = "user"
        viewModel.didLoad = true
        return viewModel
    }
}
#endif
