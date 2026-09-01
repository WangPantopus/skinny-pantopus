//
//  FindATimeSetupViewModel.swift
//  Pantopus
//
//  Stream I11 — F4 Find a Time · Setup. Composes the family's personal
//  availability into a find-a-time request: a who's-needed list with a
//  required/optional control, a collective vs round-robin mode, a duration and
//  a date window. Pressing Next runs `POST /find-a-time` (home alias) to verify
//  overlap, then hands the draft to F5 via `onProceed`. Never edits anyone's
//  calendar — it only composes free time. See `reference/calendarly-backend-api.md`.
//

import Foundation

@Observable
@MainActor
final class FindATimeSetupViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case error(message: String)
    }

    enum DurationMode: Equatable, Hashable {
        case thirty
        case hour
        case custom
    }

    // Dependencies / route context.
    let homeId: String
    let tz: String
    private let initialDraft: FindATimeDraft?
    private let onProceed: @MainActor (FindATimeDraft) -> Void
    private let client: SchedulingClient

    private var owner: SchedulingOwner {
        .home(homeId: homeId)
    }

    // State.
    private(set) var phase: Phase = .loading
    private(set) var isComputing = false
    private(set) var noOverlapMessage: String?
    var computeError: String?

    // Editable form fields.
    var title = ""
    var rows: [FindATimePickRow] = []
    var mode: FindATimeMode = .collective
    var roundRobinRule: RoundRobinRule = .fairRotation
    var durationMode: DurationMode = .thirty
    var customMinutes = 45
    var fromDate = Calendar.current.startOfDay(for: Date())
    var toDate = Calendar.current.date(byAdding: .day, value: 6, to: Calendar.current.startOfDay(for: Date())) ?? Date()
    var explainerExpanded = false
    var showDateSheet = false

    init(
        homeId: String,
        tz: String,
        initialDraft: FindATimeDraft?,
        onProceed: @escaping @MainActor (FindATimeDraft) -> Void,
        client: SchedulingClient
    ) {
        self.homeId = homeId
        self.tz = tz
        self.initialDraft = initialDraft
        self.onProceed = onProceed
        self.client = client
    }

    // MARK: - Derived

    var durationMin: Int {
        switch durationMode {
        case .thirty: 30
        case .hour: 60
        case .custom: max(5, customMinutes)
        }
    }

    var requiredMemberIds: [String] {
        rows.filter { $0.requirement == .required }.map(\.member.id)
    }

    var requiredMembers: [FindATimeMember] {
        rows.filter { $0.requirement == .required }.map(\.member)
    }

    var hasRequiredMember: Bool {
        !requiredMemberIds.isEmpty
    }

    var dateRangeValid: Bool {
        fromDate <= toDate
    }

    var isValid: Bool {
        hasRequiredMember && dateRangeValid
    }

    var effectiveTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Family time" : trimmed
    }

    var dateRangeLabel: String {
        "\(Self.dayString(fromDate, tz: tz)) — \(Self.dayString(toDate, tz: tz))"
    }

    var composingNames: String {
        let names = requiredMembers.map(\.displayName)
        switch names.count {
        case 0: return "everyone"
        case 1: return names[0]
        case 2: return "\(names[0]) and \(names[1])"
        default: return "\(names.dropLast().joined(separator: ", ")) and \(names.last ?? "")"
        }
    }

    // MARK: - Load

    func load() async {
        if case .ready = phase { return }
        phase = .loading
        do {
            let response: OccupantsResponse = try await client.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            let members = response.occupants
                .filter(\.isActive)
                .map(FindATimeMember.init(occupant:))

            if let draft = initialDraft {
                seed(from: draft, members: members)
            } else {
                rows = members.map { FindATimePickRow(member: $0, requirement: .required) }
            }
            phase = .ready
        } catch {
            phase = .error(message: Self.message(for: error))
        }
    }

    private func seed(from draft: FindATimeDraft, members: [FindATimeMember]) {
        title = draft.title == "Family time" ? "" : draft.title
        mode = draft.mode
        switch draft.durationMin {
        case 30: durationMode = .thirty
        case 60: durationMode = .hour
        default:
            durationMode = .custom
            customMinutes = draft.durationMin
        }
        // Parse day strings at DEVICE-zone midnight: `fromDate`/`toDate` live in
        // the device zone (defaults + DatePicker edits), and `currentDraft`
        // re-serializes them in that zone — UTC midnights would drift a day.
        if let from = Self.parseDay(draft.from) { fromDate = from }
        if let to = Self.parseDay(draft.to) { toDate = to }
        let required = Set(draft.requiredMemberIds)
        rows = members.map {
            FindATimePickRow(member: $0, requirement: required.contains($0.id) ? .required : .optional)
        }
    }

    // MARK: - Mutations

    func setRequirement(_ requirement: FindATimeRequirement, for memberId: String) {
        guard let index = rows.firstIndex(where: { $0.member.id == memberId }) else { return }
        rows[index].requirement = requirement
        noOverlapMessage = nil
    }

    func selectMode(_ newMode: FindATimeMode) {
        mode = newMode
        noOverlapMessage = nil
    }

    func selectDuration(_ newMode: DurationMode) {
        durationMode = newMode
        noOverlapMessage = nil
    }

    /// No-overlap recovery: drop the first still-required member to optional and
    /// recompute.
    func makeFirstRequiredOptional() {
        guard let index = rows.firstIndex(where: { $0.requirement == .required }) else { return }
        rows[index].requirement = .optional
        Task { await next() }
    }

    /// No-overlap recovery: widen the window by a week and recompute.
    func widenWindow() {
        toDate = Calendar.current.date(byAdding: .day, value: 7, to: toDate) ?? toDate
        Task { await next() }
    }

    // MARK: - Next (compute + hand off)

    func next() async {
        guard isValid, !isComputing else { return }
        isComputing = true
        noOverlapMessage = nil
        computeError = nil

        let draft = currentDraft(precomputed: nil)
        do {
            let response: FindATimeResponse = try await client.request(
                SchedulingEndpoints.findATime(owner: owner, draft.request)
            )
            isComputing = false
            if response.slots.isEmpty {
                noOverlapMessage = noOverlapCopy
            } else {
                onProceed(currentDraft(precomputed: response.slots))
            }
        } catch {
            isComputing = false
            computeError = Self.message(for: error)
        }
    }

    private func currentDraft(precomputed: [SlotDTO]?) -> FindATimeDraft {
        FindATimeDraft(
            homeId: homeId,
            title: effectiveTitle,
            members: requiredMembers,
            requiredMemberIds: requiredMemberIds,
            mode: mode,
            durationMin: durationMin,
            // `fromDate`/`toDate` are device-zone instants (defaults + picker
            // edits) — serialize the day in the SAME zone; the UTC overload
            // shifts the window by a day for non-UTC devices.
            from: SchedulingTime.isoDay(fromDate, tz: SchedulingTime.deviceTimeZoneIdentifier),
            to: SchedulingTime.isoDay(toDate, tz: SchedulingTime.deviceTimeZoneIdentifier),
            tz: tz,
            precomputedSlots: precomputed
        )
    }

    /// Recovery hint shown as the no-overlap banner body. The banner title
    /// already states "No time works for all N", so this is just the next-step
    /// guidance — naming a specific member like the design ("Try making Dad
    /// optional, or widen the date window.").
    private var noOverlapCopy: String {
        if let name = requiredMembers.first?.displayName {
            return "Try making \(name) optional, or widen the date window."
        }
        return "Try making someone optional, or widen the date window."
    }

    // MARK: - Helpers

    /// Parse a `YYYY-MM-DD` day string at device-zone midnight (the zone
    /// `fromDate`/`toDate` are computed and re-serialized in).
    private static func parseDay(_ day: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: day)
    }

    private static func dayString(_ date: Date, tz: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: tz) ?? .current
        formatter.dateFormat = "EEE MMM d"
        return formatter.string(from: date)
    }

    private static func message(for error: Error) -> String {
        if let schedulingError = error as? SchedulingError {
            return schedulingError.userMessage ?? "Something went wrong. Please try again."
        }
        return "Something went wrong. Please try again."
    }
}
