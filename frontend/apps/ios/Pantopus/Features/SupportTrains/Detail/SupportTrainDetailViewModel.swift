//
//  SupportTrainDetailViewModel.swift
//  Pantopus
//
//  A10.9 — VM for the participant-facing Support Train detail screen.
//  Distinct from the organizer-only `ReviewSignupsViewModel`. `load()`
//  fetches `GET /api/support-trains/:id` (`SupportTrainsEndpoints.detail`)
//  and projects the privacy-gated payload into `SupportTrainDetailContent`
//  via `project(_:)`. The state machine matches the four-state mobile
//  contract (loading / loaded / error); fully-covered is *not* empty —
//  it's a celebrated loaded variant.
//
//  Previews + chrome tests still seed deterministic state via
//  `init(seedState:)` / `init(content:)`, and QA can inject the offline
//  `resolver` (defaulting to `SupportTrainDetailSampleData`). When neither
//  is supplied the VM hits the backend.
//
//  PROJECTION GAPS (degrade gracefully): the detail endpoint returns each
//  slot's filled/capacity counts but not the helper or dish that covered
//  it (that's the organizer-only `/:id/reservations` feed), and carries no
//  recipient identity tag / verified flag / full contributor roster. So
//  covered rows render without a dish author, the contributor strip is
//  built from `organizers`, and the recipient identity defaults to `.home`.
//

// swiftlint:disable file_length

import Foundation
import Observation

@Observable
@MainActor
public final class SupportTrainDetailViewModel {
    public enum State: Equatable, Sendable {
        case loading
        case loaded(SupportTrainDetailContent)
        case error(message: String)
    }

    public typealias Resolver = @MainActor @Sendable (String) -> SupportTrainDetailContent?

    public private(set) var state: State = .loading

    /// Set while a reserve / leave / deliver round-trip is in flight so
    /// the affordances disable instead of double-firing.
    public private(set) var isSubmitting = false
    /// Transient confirmation copy ("You're signed up").
    public var toast: String?
    /// Last action failure, surfaced as an inline banner + alert.
    public var actionError: String?
    /// Slot the reserve sheet is open for. `nil` hides the sheet;
    /// `.some(nil)` opens it on the slot-picker step.
    public var reserveSelection: ReserveSheetSelection?
    /// A signup landed while the sheet was up — refresh on dismissal.
    private var pendingReserveRefresh = false

    private let trainId: String
    private let api: APIClient
    /// Offline override. When set, `load()` resolves from it instead of the
    /// network — used by QA / previews to swap variants on a row tap.
    private let resolver: Resolver?
    /// When a caller seeds an explicit state (previews / tests for the
    /// loading + error chrome), `load()` becomes a no-op so the seed sticks.
    private let seeded: Bool

    /// Public entry point — carries no `APIClient` (the client and `.shared`
    /// are module-internal) so views / previews / QA construct the screen
    /// without referencing it.
    public convenience init(trainId: String, resolver: Resolver? = nil) {
        self.init(trainId: trainId, api: .shared, resolver: resolver)
    }

    /// Designated init — module-internal because `APIClient` is. Tests
    /// inject a stubbed client here.
    init(
        trainId: String,
        api: APIClient,
        resolver: Resolver? = nil
    ) {
        self.trainId = trainId
        self.api = api
        self.resolver = resolver
        seeded = false
    }

    /// Seed an explicit state — used by previews and tests to exercise the
    /// loading / error chrome deterministically. `load()` does nothing once
    /// seeded.
    public init(seedState: State, trainId: String = "seeded") {
        self.trainId = trainId
        api = .shared
        resolver = nil
        state = seedState
        seeded = true
    }

    /// Convenience for previews — seed with a known content payload.
    public convenience init(content: SupportTrainDetailContent) {
        self.init(seedState: .loaded(content), trainId: content.trainId)
    }

    public func load() async {
        guard !seeded else { return }
        if case .loading = state {} else { state = .loading }
        if let resolver {
            guard let content = resolver(trainId) else {
                state = .error(message: "Couldn't load this support train.")
                return
            }
            state = .loaded(content)
            return
        }
        do {
            let dto: SupportTrainDetailDTO = try await api.request(
                SupportTrainsEndpoints.detail(supportTrainId: trainId)
            )
            state = .loaded(Self.project(dto))
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load this support train."
            state = .error(message: message)
        }
    }

    public func refresh() async {
        guard !seeded else { return }
        await load()
    }

    /// Convenience accessor used by the dock-handler hook in the view.
    public var currentContent: SupportTrainDetailContent? {
        if case let .loaded(content) = state { return content }
        return nil
    }

    public var isFullyCovered: Bool {
        currentContent?.isFullyCovered ?? false
    }

    // MARK: - Helper actions (S1)

    /// Open the reserve sheet. Pass a slot id to skip the picker step.
    public func startReserve(slotId: String? = nil) {
        guard let content = currentContent, !content.reserveOptions.isEmpty else {
            actionError = "There are no open dates left on this train."
            return
        }
        let resolved = slotId.flatMap { candidate in
            content.reserveOptions.first { $0.id == candidate }?.id
        }
        reserveSelection = ReserveSheetSelection(slotId: resolved)
    }

    /// Closes the sheet and — when a signup landed — refreshes the
    /// screen. The refresh is deferred to dismissal on purpose: calling
    /// `load()` while the sheet is up would blank `currentContent` for a
    /// frame and tear down the sheet's success step.
    public func dismissReserve() {
        reserveSelection = nil
        guard pendingReserveRefresh else { return }
        pendingReserveRefresh = false
        Task { await load() }
    }

    /// `POST /:id/slots/:slotId/reserve`. Returns an error message on
    /// failure (the sheet renders it inline, matching RN's ReserveSheet
    /// error box) and `nil` on success.
    public func reserve(slotId: String, body: ReserveSlotBody) async -> String? {
        guard !isSubmitting else { return nil }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            _ = try await api.request(
                SupportTrainActionsEndpoints.reserve(
                    supportTrainId: trainId,
                    slotId: slotId,
                    body: body
                ),
                as: EmptyResponse.self
            )
            pendingReserveRefresh = true
            toast = "You're signed up"
            return nil
        } catch {
            return Self.reserveFailureMessage(for: error)
        }
    }

    /// `POST /:id/reservations/:rid/cancel` with `helper_reason` — the
    /// helper leaving their own slot (RN `handleLeaveSlot`).
    public func leaveSlot(reservationId: String, reason: String?) async {
        await perform(
            SupportTrainActionsEndpoints.cancelReservation(
                supportTrainId: trainId,
                reservationId: reservationId,
                body: CancelReservationBody(helperReason: reason?.isEmpty == true ? nil : reason)
            ),
            success: "Slot reopened",
            failure: "Failed to leave this slot."
        )
    }

    /// `POST /:id/reservations/:rid/deliver` — helper marks their own
    /// contribution delivered.
    public func markDelivered(reservationId: String) async {
        await perform(
            SupportTrainActionsEndpoints.markDelivered(
                supportTrainId: trainId,
                reservationId: reservationId
            ),
            success: "Marked delivered",
            failure: "Failed to mark this as delivered."
        )
    }

    /// `POST /:id/reservations/:rid/confirm` — recipient / organizer
    /// confirms a delivered contribution.
    public func confirmDelivery(reservationId: String) async {
        await perform(
            SupportTrainActionsEndpoints.confirmDelivery(
                supportTrainId: trainId,
                reservationId: reservationId
            ),
            success: "Delivery confirmed",
            failure: "Failed to confirm this delivery."
        )
    }

    private func perform(_ endpoint: Endpoint, success: String, failure: String) async {
        guard !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            _ = try await api.request(endpoint, as: EmptyResponse.self)
            await load()
            toast = success
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? failure
        }
    }

    public func acknowledgeToast() {
        toast = nil
    }

    public func acknowledgeActionError() {
        actionError = nil
    }

    /// RN maps the three reserve-specific 409 codes onto friendlier copy
    /// (`components/support-trains/ReserveSheet.tsx:138`); mirror it.
    nonisolated static func reserveFailureMessage(for error: any Error) -> String {
        let raw = (error as? APIError)?.errorDescription ?? "\(error)"
        if raw.contains("SLOT_FULL") || raw.contains("SLOT_NOT_OPEN") || raw.contains("no longer open") {
            return "This slot was just filled. Please refresh and try another."
        }
        if raw.contains("ALREADY_RESERVED") || raw.contains("already have a reservation") {
            return "You already have a reservation on this slot."
        }
        return raw.isEmpty ? "Failed to reserve. Please try again." : raw
    }

    // MARK: - Default resolver

    /// Static offline resolver — returns the fully-covered fixture when the
    /// caller passes a `covered` / `full` train id, otherwise the populated
    /// fixture. Inject via `init(trainId:resolver:)` for QA without a
    /// backend round-trip.
    @MainActor
    public static let defaultResolver: Resolver = { trainId in
        let lowered = trainId.lowercased()
        if lowered.contains("covered") || lowered.contains("full") {
            return SupportTrainDetailSampleData.fullyCovered
        }
        return SupportTrainDetailSampleData.populated
    }
}

// MARK: - Projection (DTO → content)

extension SupportTrainDetailViewModel {
    /// Pure mapping from the `GET /:id` payload to the render model.
    /// `nonisolated` so unit tests can assert it without an actor hop.
    nonisolated static func project(_ dto: SupportTrainDetailDTO) -> SupportTrainDetailContent {
        let slots = dto.slots ?? []
        let reservations = dto.myReservations ?? []
        let organizers = dto.organizers ?? []

        let covered = slots.filter(\.isCovered)
        let slotsTotal = slots.count
        let slotsFilled = covered.count
        let title = dto.title ?? dto.recipientSummary ?? "Support train"
        let primary = organizers.first
        let primaryName = primary?.user?.name ?? primary?.user?.username

        let typeDates = TypeDatesCardContent(
            kind: kind(from: dto.supportModes),
            title: title,
            dateRange: dateRange(slots: slots),
            daysLeft: daysLeft(slots: slots),
            slotsFilled: slotsFilled,
            slotsTotal: slotsTotal,
            contributors: contributorBubbles(organizers),
            extraCount: max(0, slotsFilled - min(organizers.count, 4))
        )

        let isFull = typeDates.isFullyCovered

        let mineSlotIds = Set(reservations.compactMap(\.slotId))
        let openSlots = slots
            .filter { !$0.isCovered && ($0.status ?? "open") == "open" && !mineSlotIds.contains($0.id) }
            .sorted { ($0.slotDate ?? "") < ($1.slotDate ?? "") }

        return SupportTrainDetailContent(
            trainId: dto.id,
            recipient: recipient(dto: dto, primaryName: primaryName),
            typeDates: typeDates,
            calendarDays: calendar(slots: slots, reservations: reservations),
            sections: sections(slots: slots, reservations: reservations),
            hostedBy: hostedBy(primaryName: primaryName),
            dock: isFull ? .sendCardAndBackup : .signUp(label: "Sign up for a slot"),
            celebrationBanner: isFull
                ? SupportTrainDetailContent.CelebrationBanner(
                    title: "Every slot is covered",
                    body: "Every slot is spoken for. Sign up as backup in case someone can't make it."
                )
                : nil,
            reserveOptions: openSlots.map(reserveOption(for:)),
            reserveContext: ReserveSheetContext(
                enabledModes: enabledModes(dto.supportModes),
                restrictionChips: (dto.dietaryRestrictions ?? []) + (dto.dietaryPreferences ?? []),
                contactlessPreferred: dto.contactlessPreferred ?? false
            ),
            viewerRole: viewerRole(dto),
            exactAddress: dto.address?.singleLineLabel.isEmpty == false
                ? dto.address?.singleLineLabel
                : nil,
            deliveryInstructions: dto.deliveryInstructions
        )
    }

    /// `viewer_level` + `viewer_support_train_role` → the client-side
    /// permission gate (`backend/routes/supportTrains.js:3693`).
    nonisolated static func viewerRole(_ dto: SupportTrainDetailDTO) -> SupportTrainViewerRole {
        switch dto.viewerSupportTrainRole {
        case "primary": .primaryOrganizer
        case "co_organizer", "recipient_delegate": .coOrganizer
        case "recipient": .recipient
        case "helper": .helper
        default:
            dto.viewerLevel == "organizer" ? .coOrganizer : .viewer
        }
    }

    private nonisolated static func enabledModes(
        _ modes: SupportTrainModesDTO?
    ) -> [SupportTrainContributionMode] {
        guard let modes else { return SupportTrainContributionMode.allCases }
        var out: [SupportTrainContributionMode] = []
        if modes.homeCookedMeals == true { out.append(.cook) }
        if modes.takeout == true { out.append(.takeout) }
        if modes.groceries == true { out.append(.groceries) }
        return out
    }

    private nonisolated static func reserveOption(for slot: SupportTrainSlotDTO) -> ReserveSlotOption {
        let date = parseSlotDate(slot.slotDate)
        return ReserveSlotOption(
            id: slot.id,
            dateLabel: date.map { format($0, "EEEE, MMMM d") } ?? (slot.slotDate ?? ""),
            slotLabel: slot.slotLabel ?? slot.supportMode?.capitalized ?? "Slot",
            windowLabel: windowLabel(slot)
        )
    }

    private nonisolated static func windowLabel(_ slot: SupportTrainSlotDTO) -> String? {
        guard let start = slot.startTime, !start.isEmpty else { return nil }
        guard let end = slot.endTime, !end.isEmpty else { return "\(shortTime(start))+" }
        return "\(shortTime(start)) – \(shortTime(end))"
    }

    // MARK: Recipient / host

    private nonisolated static func recipient(
        dto: SupportTrainDetailDTO,
        primaryName: String?
    ) -> RecipientCardContent {
        let name = dto.title ?? dto.recipientSummary ?? "Support train"
        return RecipientCardContent(
            initials: initials(from: name),
            householdName: name,
            identityTag: .home,
            verified: false,
            address: locationLabel(dto.coarseLocation),
            proximity: nil,
            quote: dto.story ?? dto.recipientSummary ?? "",
            quoteAttribution: primaryName
        )
    }

    private nonisolated static func hostedBy(primaryName: String?) -> HostedByFooter {
        let name = primaryName ?? "Organizer"
        return HostedByFooter(
            organizerInitials: initials(from: name),
            organizerDisplayName: name,
            neighborHint: nil
        )
    }

    private nonisolated static func locationLabel(_ loc: SupportTrainCoarseLocationDTO?) -> String {
        guard let loc else { return "" }
        switch (loc.city, loc.state) {
        case let (city?, state?): return "\(city), \(state)"
        case let (city?, nil): return city
        case let (nil, state?): return state
        default: return ""
        }
    }

    private nonisolated static func kind(from modes: SupportTrainModesDTO?) -> SupportTrainDetailKind {
        guard let modes else { return .generic }
        if modes.homeCookedMeals == true || modes.takeout == true { return .meals }
        if modes.groceries == true { return .errands }
        return .generic
    }

    private nonisolated static func contributorBubbles(_ organizers: [SupportTrainOrganizerDTO]) -> [ContributorBubble] {
        let tones: [ContributorBubble.ContributorTone] = [.warning, .primary, .business, .success]
        return organizers.prefix(4).enumerated().map { index, organizer in
            let display = organizer.user?.name ?? organizer.user?.username ?? "Helper"
            return ContributorBubble(
                id: organizer.id,
                initials: initials(from: display),
                tone: tones[index % tones.count]
            )
        }
    }

    // MARK: Calendar

    private nonisolated static func calendar(
        slots: [SupportTrainSlotDTO],
        reservations: [SupportTrainMyReservationDTO]
    ) -> [SlotCalendarDay] {
        let cal = utcCalendar()
        let today = cal.startOfDay(for: Date())
        let slotDates = slots.compactMap { parseSlotDate($0.slotDate) }
        let earliest = slotDates.min().map { cal.startOfDay(for: $0) } ?? today
        let weekday = cal.component(.weekday, from: earliest) // 1 = Sunday
        let start = cal.date(byAdding: .day, value: -(weekday - 1), to: earliest) ?? earliest

        let coveredDates = Set(slots.filter(\.isCovered).compactMap { parseSlotDate($0.slotDate).map(cal.startOfDay) })
        let openDates = Set(slots.filter { !$0.isCovered }.compactMap { parseSlotDate($0.slotDate).map(cal.startOfDay) })
        let slotById = Dictionary(uniqueKeysWithValues: slots.map { ($0.id, $0) })
        let mineDates = Set(reservations.compactMap { reservation -> Date? in
            guard let slotId = reservation.slotId, let slot = slotById[slotId] else { return nil }
            return parseSlotDate(slot.slotDate).map(cal.startOfDay)
        })

        return (0..<28).map { index in
            let date = cal.date(byAdding: .day, value: index, to: start) ?? start
            let day = cal.component(.day, from: date)
            let state: SlotCalendarState = if date < today {
                .past
            } else if cal.isDate(date, inSameDayAs: today) {
                .today
            } else if mineDates.contains(date) {
                .mine
            } else if coveredDates.contains(date) {
                .filled
            } else if openDates.contains(date) {
                .open
            } else {
                // No slot scheduled that future day — inert/muted tile.
                .past
            }
            return SlotCalendarDay(id: "day-\(index)", date: date, dayNumber: day, state: state)
        }
    }

    // MARK: Sections

    private nonisolated static func sections(
        slots: [SupportTrainSlotDTO],
        reservations: [SupportTrainMyReservationDTO]
    ) -> [SlotSection] {
        var sections: [SlotSection] = []
        let slotById = Dictionary(uniqueKeysWithValues: slots.map { ($0.id, $0) })

        let mineRows = reservations.map { reservationRow($0, slot: $0.slotId.flatMap { slotById[$0] }) }
        if !mineRows.isEmpty {
            sections.append(SlotSection(id: "mine", overline: "Your commitment", rows: mineRows))
        }

        let sortedOpen = slots.filter { !$0.isCovered }.sorted { ($0.slotDate ?? "") < ($1.slotDate ?? "") }
        if !sortedOpen.isEmpty {
            let shown = Array(sortedOpen.prefix(4)).map { slotRow($0, covered: false) }
            sections.append(SlotSection(
                id: "open",
                overline: "Open slots near you",
                actionLabel: sortedOpen.count > shown.count ? "See all \(sortedOpen.count)" : nil,
                rows: shown
            ))
        }

        let sortedCovered = slots.filter(\.isCovered).sorted { ($0.slotDate ?? "") < ($1.slotDate ?? "") }
        if !sortedCovered.isEmpty {
            let shown = Array(sortedCovered.prefix(4)).map { slotRow($0, covered: true) }
            sections.append(SlotSection(
                id: "covered",
                overline: "Already on the train",
                actionLabel: sortedCovered.count > shown.count ? "See all \(sortedCovered.count)" : nil,
                rows: shown
            ))
        }
        return sections
    }

    private nonisolated static func slotRow(_ slot: SupportTrainSlotDTO, covered: Bool) -> SlotRowContent {
        let date = parseSlotDate(slot.slotDate)
        let label = slot.slotLabel ?? slot.supportMode?.capitalized ?? "a slot"
        return SlotRowContent(
            id: slot.id,
            dayLabel: date.map { format($0, "EEE") } ?? "",
            dateLabel: date.map { format($0, "d") } ?? "",
            state: covered ? .covered : .open,
            author: nil, // detail endpoint omits the per-slot helper
            title: covered ? label : "Open · \(label)",
            subtitle: dropWindow(slot.endTime),
            mine: false,
            slotId: slot.id
        )
    }

    private nonisolated static func reservationRow(
        _ reservation: SupportTrainMyReservationDTO,
        slot: SupportTrainSlotDTO?
    ) -> SlotRowContent {
        let date = slot.flatMap { parseSlotDate($0.slotDate) }
        let title = reservation.dishTitle
            ?? reservation.restaurantName
            ?? reservation.contributionMode?.capitalized
            ?? "Your contribution"
        return SlotRowContent(
            id: reservation.id,
            dayLabel: date.map { format($0, "EEE") } ?? "",
            dateLabel: date.map { format($0, "d") } ?? "",
            state: .covered,
            author: SlotRowContent.SlotAuthor(initials: "YO", displayName: "You", tone: .primary),
            title: title,
            subtitle: arrivalLabel(reservation.estimatedArrivalAt) ?? reservation.noteToRecipient,
            mine: true,
            slotId: reservation.slotId,
            reservationId: reservation.id,
            reservationStatus: reservation.status
        )
    }

    private nonisolated static func dropWindow(_ end: String?) -> String? {
        guard let end, !end.isEmpty else { return nil }
        return "Drop off by \(shortTime(end))"
    }

    // MARK: Date / string helpers

    private nonisolated static func dateRange(slots: [SupportTrainSlotDTO]) -> String {
        let dates = slots.compactMap { parseSlotDate($0.slotDate) }
        guard let min = dates.min(), let max = dates.max() else { return "" }
        return "\(format(min, "EEE MMM d")) → \(format(max, "EEE MMM d"))"
    }

    private nonisolated static func daysLeft(slots: [SupportTrainSlotDTO]) -> Int {
        let cal = utcCalendar()
        let dates = slots.compactMap { parseSlotDate($0.slotDate) }
        guard let max = dates.max() else { return 0 }
        let days = cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: max)).day ?? 0
        return Swift.max(0, days)
    }

    private nonisolated static func arrivalLabel(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }

    /// "18:00" / "18:00:00" → "6:00 pm".
    private nonisolated static func shortTime(_ hhmm: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for inputFormat in ["HH:mm:ss", "HH:mm"] {
            formatter.dateFormat = inputFormat
            if let date = formatter.date(from: hhmm) {
                formatter.dateFormat = "h:mm a"
                return formatter.string(from: date).lowercased()
            }
        }
        return hhmm
    }

    private nonisolated static func parseSlotDate(_ string: String?) -> Date? {
        guard let string else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(string.prefix(10)))
    }

    private nonisolated static func format(_ date: Date, _ pattern: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }

    private nonisolated static func utcCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        return calendar
    }

    private nonisolated static func initials(from name: String) -> String {
        let words = name.split(separator: " ").prefix(2)
        let letters = words.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return letters.isEmpty ? "ST" : letters
    }
}
