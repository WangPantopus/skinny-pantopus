//
//  InviteeIntakeFormViewModel.swift
//  Pantopus
//
//  D1 Intake / Booking details form (Stream I6). Loads the public booking page
//  (`GET /api/public/book/:slug`), resolves the chosen event type, and builds a
//  schema-driven intake form from `eventType.questions` (text / textarea /
//  select / multiselect / checkbox / phone + required). Collects name + email +
//  answers + guests, then hands the draft to D2 (Review & Confirm) via the
//  in-session draft store + the frozen `.inviteeReviewConfirm` route.
//
//  This screen does NOT commit the booking — the POST happens on D2.
//

import SwiftUI

/// Optional signed-in invitee identity used to prefill D1 ("Booking as …").
struct InviteePrefill: Hashable {
    let name: String
    let email: String
}

@Observable
@MainActor
// swiftlint:disable:next type_body_length
final class InviteeIntakeFormViewModel {
    enum State: Equatable {
        case loading
        case ready
        /// Page paused / secret-unavailable / expired — a calm state, not an error.
        case unavailable(title: String, message: String)
        case error(message: String)
    }

    // Route payload
    let slug: String
    let eventTypeSlug: String
    let start: String
    let tz: String

    private let prefill: InviteePrefill?
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private(set) var eventType: PublicEventTypeView?
    private(set) var page: PublicPageView?

    /// The booker's display/booking timezone (starts at the route `tz`; the
    /// header chip lets them change it before reviewing).
    var selectedTz: String

    /// One guest email row. Identity is value-stable (not the array offset) so
    /// removing a row never re-points a still-mounted TextField — with its
    /// focus and uncommitted edit buffer — at a different guest's slot.
    struct GuestEntry: Identifiable, Hashable {
        let id = UUID()
        var email: String = ""
    }

    // Form fields
    var firstName = ""
    var lastName = ""
    var email = ""
    var answers: [String: InviteeAnswer] = [:]
    var guests: [GuestEntry] = []
    var showGuests = false

    /// Logged-in invitee: collapse name/email into a "Booking as" chip.
    private(set) var isPrefilled = false
    private(set) var touched: Set<String> = []

    /// Set by the host app layer when the typed email matches a known Pantopus
    /// account (unauthenticated path, Frame 4). Surfaces a "You have an account —
    /// open in app" info banner below the email field in `yourInfoSection`.
    var existingAccountDetected = false

    // Slot hold countdown (client-side soft hold — backend 409s if truly taken).
    private(set) var holdRemaining = 300
    private(set) var holdExpired = false
    private var holdTask: Task<Void, Never>?

    private var didLoad = false
    private var isFetching = false

    /// Designated, test-injectable initializer. No default arguments (Xcode 16.4
    /// crashes on default-argument `@MainActor` view-model initializers).
    init(
        slug: String,
        eventTypeSlug: String,
        start: String,
        tz: String,
        prefill: InviteePrefill?,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.slug = slug
        self.eventTypeSlug = eventTypeSlug
        self.start = start
        self.tz = tz
        selectedTz = tz
        self.prefill = prefill
        self.push = push
        self.client = client
    }

    // MARK: - Derived presentation

    var accent: Color {
        DiscoveryTheme.accent(forOwnerType: page?.ownerType)
    }

    var accentBg: Color {
        DiscoveryTheme.accentBg(forOwnerType: page?.ownerType)
    }

    var avatarColors: [Color] {
        DiscoveryTheme.avatarColors(forOwnerType: page?.ownerType)
    }

    var hostName: String? {
        page?.title
    }

    var hostFirstName: String {
        DiscoveryTheme.firstName(from: page?.title)
    }

    var hostInitials: String {
        ConfirmFormat.initials(from: page?.title)
    }

    var tzChipLabel: String {
        ConfirmFormat.tzChipLabel(tz: selectedTz)
    }

    /// Textarea ("What should we cover?") placeholder — interpolates the host's
    /// first name when known ("A sentence or two helps Maria prepare."), else a
    /// host-free fallback. Mirrors the design's host-interpolated hint.
    var coverPlaceholder: String {
        let first = hostFirstName.trimmingCharacters(in: .whitespaces)
        return first.isEmpty
            ? "A sentence or two helps."
            : "A sentence or two helps \(first) prepare."
    }

    var dayAndTimeLine: String {
        guard let event = eventType, let date = SchedulingTime.parseUTC(start) else {
            return ConfirmFormat.dayLine(startUTC: start, tz: selectedTz) ?? ""
        }
        let endAtISO = endISO(for: date, durationMin: event.bookingDuration)
        return ConfirmFormat.dayAndTime(startUTC: start, endUTC: endAtISO, tz: selectedTz)
    }

    func changeTimezone(_ identifier: String) {
        selectedTz = identifier
    }

    /// Sorted host questions for the schema-driven form section.
    var questions: [EventTypeQuestionDTO] {
        (eventType?.questions ?? []).sorted { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) }
    }

    var holdLabel: String {
        let minutes = holdRemaining / 60
        let seconds = holdRemaining % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    // MARK: - Loading

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        guard !isFetching else { return }
        isFetching = true
        defer { isFetching = false }
        state = .loading
        do {
            let view: PublicBookView = try await client.request(
                SchedulingPublicEndpoints.bookPage(slug: slug)
            )
            apply(view)
        } catch let error as SchedulingError {
            state = .error(message: errorMessage(for: error))
        } catch {
            state = .error(message: "Something went wrong. Try again.")
        }
    }

    private func apply(_ view: PublicBookView) {
        page = view.page
        switch view.status {
        case .paused:
            state = .unavailable(
                title: "This page isn't taking bookings right now",
                message: "Check back later, or reach out to the host directly."
            )
            return
        case .unavailable, .expired:
            state = .unavailable(
                title: "This link isn't available",
                message: "It may have been turned off or moved."
            )
            return
        case .active, .secret, .unknown:
            break
        }
        guard let event = view.eventTypes.first(where: { $0.slug == eventTypeSlug }) else {
            state = .error(message: "This booking type isn't available")
            return
        }
        eventType = event
        applyPrefill()
        state = .ready
        startHoldCountdown()
    }

    private func applyPrefill() {
        guard let prefill, !isPrefilled else { return }
        isPrefilled = true
        email = prefill.email
        let parts = prefill.name.split(separator: " ", maxSplits: 1).map(String.init)
        firstName = parts.first ?? prefill.name
        lastName = parts.count > 1 ? parts[1] : ""
    }

    private func errorMessage(for error: SchedulingError) -> String {
        switch error {
        case .notFound: "This link isn't available"
        default: error.userMessage ?? "Something went wrong. Try again."
        }
    }

    // MARK: - Hold countdown

    private func startHoldCountdown() {
        holdTask?.cancel()
        holdTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard let self else { return }
                if holdExpired { return }
                if holdRemaining > 0 {
                    holdRemaining -= 1
                } else {
                    holdExpired = true
                    return
                }
            }
        }
    }

    // MARK: - Prefill chip

    func clearPrefill() {
        isPrefilled = false
        firstName = ""
        lastName = ""
        email = ""
    }

    // MARK: - Answer bindings

    func textAnswer(_ id: String) -> String {
        if case let .text(value)? = answers[id] { return value }
        return ""
    }

    func setText(_ id: String, _ value: String) {
        answers[id] = .text(value)
        touched.insert(id)
    }

    func isChoiceSelected(_ id: String, option: String) -> Bool {
        if case let .choices(values)? = answers[id] { return values.contains(option) }
        return false
    }

    /// The single selected option (for `select` fields), if any.
    func isChoiceSelectedFirst(_ id: String) -> String? {
        if case let .choices(values)? = answers[id] { return values.first }
        return nil
    }

    func touchedContains(_ key: String) -> Bool {
        touched.contains(key)
    }

    func selectSingleChoice(_ id: String, option: String) {
        answers[id] = .choices([option])
        touched.insert(id)
    }

    func toggleChoice(_ id: String, option: String) {
        var current: [String] = if case let .choices(values)? = answers[id] { values } else { [] }
        if let index = current.firstIndex(of: option) { current.remove(at: index) } else { current.append(option) }
        answers[id] = .choices(current)
        touched.insert(id)
    }

    func flagAnswer(_ id: String) -> Bool {
        if case let .flag(value)? = answers[id] { return value }
        return false
    }

    func setFlag(_ id: String, _ value: Bool) {
        answers[id] = .flag(value)
        touched.insert(id)
    }

    func markTouched(_ key: String) {
        touched.insert(key)
    }

    // MARK: - Guests

    func addGuest() {
        if !showGuests { showGuests = true }
        if guests.count < 5 { guests.append(GuestEntry()) }
    }

    func removeGuest(id: GuestEntry.ID) {
        guests.removeAll { $0.id == id }
    }

    func guestEmail(id: GuestEntry.ID) -> String {
        guests.first { $0.id == id }?.email ?? ""
    }

    func setGuest(id: GuestEntry.ID, email: String) {
        guard let index = guests.firstIndex(where: { $0.id == id }) else { return }
        guests[index].email = email
    }

    // MARK: - Validation

    var firstNameError: String? {
        guard !isPrefilled, touched.contains("firstName") else { return nil }
        return firstName.trimmingCharacters(in: .whitespaces).isEmpty ? "Enter your first name" : nil
    }

    var lastNameError: String? {
        guard !isPrefilled, touched.contains("lastName") else { return nil }
        return lastName.trimmingCharacters(in: .whitespaces).isEmpty ? "Enter your last name" : nil
    }

    var emailError: String? {
        guard !isPrefilled, touched.contains("email") else { return nil }
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return "Enter your email" }
        return Self.isValidEmail(trimmed) ? nil : "Enter a valid email address"
    }

    func questionError(_ question: EventTypeQuestionDTO) -> String? {
        let key = questionKey(question)
        guard question.required ?? false, touched.contains(key) else { return nil }
        let answered = answers[key]?.isAnswered ?? false
        return answered ? nil : "This question is required"
    }

    var isValid: Bool {
        if !isPrefilled {
            let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
            guard !firstName.trimmingCharacters(in: .whitespaces).isEmpty,
                  !lastName.trimmingCharacters(in: .whitespaces).isEmpty,
                  Self.isValidEmail(trimmedEmail) else { return false }
        }
        for question in questions where question.required ?? false {
            if !(answers[questionKey(question)]?.isAnswered ?? false) { return false }
        }
        return true
    }

    func questionKey(_ question: EventTypeQuestionDTO) -> String {
        question.id ?? question.label
    }

    private static func isValidEmail(_ value: String) -> Bool {
        let pattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        return value.range(of: pattern, options: .regularExpression) != nil
    }

    // MARK: - Navigation

    /// Whether the D2 "Pick another time" unwind should pop this screen too
    /// (D2 → D1 → C6). Checked on re-appear; the C6 picker consumes the relay
    /// entry, so this only peeks.
    var shouldUnwindForSlotTaken: Bool {
        SlotTakenRelay.shared.hasPending(slug: slug, eventTypeSlug: eventTypeSlug)
    }

    /// Build the draft, stash it for D2, and push the review route.
    func reviewBooking() {
        guard isValid, let event = eventType, let page else { return }
        var draft = InviteeBookingDraft(
            firstName: firstName.trimmingCharacters(in: .whitespaces),
            lastName: lastName.trimmingCharacters(in: .whitespaces),
            email: (isPrefilled ? (prefill?.email ?? email) : email).trimmingCharacters(in: .whitespaces),
            answers: answers,
            guests: guests.map(\.email)
        )
        if isPrefilled, let prefill {
            let parts = prefill.name.split(separator: " ", maxSplits: 1).map(String.init)
            draft.firstName = parts.first ?? prefill.name
            draft.lastName = parts.count > 1 ? parts[1] : ""
        }
        let context = InviteeReviewContext(
            slug: slug,
            eventTypeSlug: eventTypeSlug,
            start: start,
            tz: selectedTz,
            eventType: event,
            page: page,
            draft: draft
        )
        InviteeBookingDraftStore.shared.set(context)
        push(.inviteeReviewConfirm(slug: slug, eventTypeSlug: eventTypeSlug, start: start, tz: selectedTz))
    }

    private func endISO(for start: Date, durationMin: Int) -> String {
        let end = start.addingTimeInterval(TimeInterval(durationMin * 60))
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: end)
    }
}

#if DEBUG
extension InviteeIntakeFormViewModel {
    static func previewReady(prefilled: Bool = false) -> InviteeIntakeFormViewModel {
        let viewModel = InviteeIntakeFormViewModel(
            slug: "ada",
            eventTypeSlug: "intro",
            start: "2026-06-17T16:30:00Z",
            tz: "America/Los_Angeles",
            prefill: prefilled ? InviteePrefill(name: "Maya Chen", email: "maya.chen@gmail.com") : nil,
            push: { _ in },
            client: .shared
        )
        let json = #"""
        {
          "page": {"slug": "ada", "title": "Maria Kessler", "owner_type": "user", "timezone": "America/Los_Angeles"},
          "status": "active",
          "eventTypes": [
            {"id": "et1", "name": "Intro call", "slug": "intro", "default_duration": 30, "location_mode": "video",
             "questions": [
               {"id": "q1", "label": "What should we cover?", "field_type": "textarea", "required": true, "sort_order": 0},
               {"id": "q2", "label": "Phone number", "field_type": "phone", "required": true, "sort_order": 1},
               {"id": "q3", "label": "How did you hear about us?", "field_type": "select",
                "options": ["A friend or colleague", "Search", "Social"], "required": false, "sort_order": 2}
             ]}
          ]
        }
        """#
        if let data = json.data(using: .utf8), let view = try? JSONDecoder().decode(PublicBookView.self, from: data) {
            viewModel.page = view.page
            viewModel.eventType = view.eventTypes.first
            if prefilled { viewModel.applyPreviewPrefill() }
            viewModel.state = .ready
        }
        return viewModel
    }

    private func applyPreviewPrefill() {
        isPrefilled = true
        firstName = "Maya"
        lastName = "Chen"
        email = "maya.chen@gmail.com"
    }
}
#endif
