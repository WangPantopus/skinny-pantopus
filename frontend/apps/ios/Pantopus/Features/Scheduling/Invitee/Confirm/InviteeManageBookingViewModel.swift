//
//  InviteeManageBookingViewModel.swift
//  Pantopus
//
//  D4 Manage your booking (Stream I6). Token-authed surface reached from the
//  confirmation/reminder email link, the deeplink, or D3. Fetches the booking
//  via `GET /api/public/booking/:token` and computes can_reschedule / can_cancel
//  from the response `actions`. Reschedule opens the Foundation SlotPicker (local
//  sheet) → `POST …/reschedule`; Cancel opens a local confirm sheet →
//  `POST …/cancel`. When the change window is closed it routes to the I7
//  Policy-Blocked edge surface. A 404 renders the token-expired state.
//

import SwiftUI

@Observable
@MainActor
final class InviteeManageBookingViewModel {
    enum State: Equatable {
        case loading
        case loaded
        /// 404 — token invalid/expired (TokenAccept-style error halo).
        case expired
        case error(message: String)
    }

    enum Lifecycle { case confirmed, past, cancelled, pending }

    let token: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private(set) var response: ManageBookingResponse?
    private(set) var actionInFlight = false
    private(set) var inlineBanner: String?

    // Local sheets
    var showCancelSheet = false
    var showReschedule = false

    private var didLoad = false

    init(
        token: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.token = token
        self.push = push
        self.client = client
    }

    // MARK: - Derived

    private var booking: PublicBookingDTO? {
        response?.booking
    }

    private var actions: ManageActions? {
        response?.actions
    }

    private var eventType: PublicEventTypeView? {
        response?.eventType
    }

    private var page: PublicPageView? {
        response?.page
    }

    var accent: Color {
        DiscoveryTheme.accent(forOwnerType: page?.ownerType)
    }

    var accentBg: Color {
        DiscoveryTheme.accentBg(forOwnerType: page?.ownerType)
    }

    var bookingTz: String {
        booking?.inviteeTimezone ?? page?.timezone ?? SchedulingTime.deviceTimeZoneIdentifier
    }

    var slug: String? {
        page?.slug
    }

    var lifecycle: Lifecycle {
        let status = (booking?.status ?? "").lowercased()
        if status == "cancelled" || status == "declined" { return .cancelled }
        if status == "pending" { return .pending }
        if status == "completed" { return .past }
        if let start = booking?.startAt, let date = SchedulingTime.parseUTC(start), date < Date() { return .past }
        return .confirmed
    }

    var pillStatus: String {
        switch lifecycle {
        case .cancelled: "cancelled"
        case .past: "past"
        case .pending: "pending"
        case .confirmed: "confirmed"
        }
    }

    var canReschedule: Bool {
        (actions?.canReschedule ?? false) && lifecycle == .confirmed
    }

    var canCancel: Bool {
        (actions?.canCancel ?? false) && lifecycle == .confirmed
    }

    /// Confirmed + still in the future but neither action allowed → window closed.
    var windowClosed: Bool {
        guard lifecycle == .confirmed else { return false }
        return !(actions?.canReschedule ?? false) && !(actions?.canCancel ?? false)
    }

    var showsActions: Bool {
        lifecycle == .confirmed
    }

    var summary: BookingSummary {
        let duration = eventType?.bookingDuration ?? 30
        let endAtISO = booking?.endAt ?? booking?.startAt.flatMap { start in
            SchedulingTime.parseUTC(start).map { endISO(for: $0, durationMin: duration) }
        }
        let tz = bookingTz
        let location = DiscoveryLocation.label(
            mode: eventType?.locationMode ?? booking?.locationMode,
            detail: eventType?.locationDetail ?? booking?.locationDetail
        )
        return BookingSummary(
            initials: ConfirmFormat.initials(from: page?.title),
            avatarColors: DiscoveryTheme.avatarColors(forOwnerType: page?.ownerType),
            accent: accent,
            eventName: eventType?.name ?? "Booking",
            hostName: page?.title,
            pillarTitle: ConfirmPillar.title(forOwnerType: page?.ownerType),
            dateLine: booking?.startAt.map { ConfirmFormat.dayAndTime(startUTC: $0, endUTC: endAtISO, tz: tz) },
            tzLabel: ConfirmFormat.tzChipLabel(tz: tz),
            locationTitle: location ?? "Details to follow",
            locationSub: location == nil ? nil : "Join link is in your email and calendar invite.",
            attendeePrimary: booking?.inviteeName.map { "\($0) (you)" }
        )
    }

    var eventRecap: String {
        let name = eventType?.name ?? "Your booking"
        guard let start = booking?.startAt else { return name }
        return "\(name) · \(ConfirmFormat.dayAndTime(startUTC: start, endUTC: booking?.endAt, tz: bookingTz))"
    }

    var cancelledOnLabel: String? {
        guard lifecycle == .cancelled else { return nil }
        return "This booking was cancelled."
    }

    var policySentence: String {
        if let window = eventType?.cancellationWindowMin, window > 0 {
            return "You can reschedule or cancel up to \(max(1, window / 60)) hours before the start time."
        }
        return "Review the host's cancellation policy before making changes."
    }

    /// Window-closed-specific policy copy (design Frame 4): leads with the cutoff
    /// then reassures that the host can still help directly.
    var windowClosedPolicySentence: String {
        let host = hostFirstName.isEmpty ? "Your host" : hostFirstName
        if let window = eventType?.cancellationWindowMin, window > 0 {
            return "Changes close \(max(1, window / 60)) hours before the start time. \(host) can still help directly."
        }
        return "Changes are closed online. \(host) can still help directly."
    }

    var hostFirstName: String {
        DiscoveryTheme.firstName(from: page?.title)
    }

    /// Display name for the host used in "Contact <host>" affordances.
    var hostContactName: String {
        let first = hostFirstName
        return first.isEmpty ? "host" : first
    }

    /// The public booking page the invitee is sent to for "Contact host" /
    /// "Request a new link" — mirrors the Policy-Blocked `messageHost` behavior.
    var bookingPageURL: URL? {
        guard let slug, !slug.isEmpty else { return nil }
        return URL(string: "https://pantopus.com/book/\(slug)")
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
        state = .loading
        do {
            let response: ManageBookingResponse = try await client.request(
                SchedulingPublicEndpoints.manage(token: token)
            )
            self.response = response
            state = .loaded
        } catch let error as SchedulingError {
            switch error {
            case .notFound: state = .expired
            default: state = .error(message: error.userMessage ?? "We couldn't load your booking.")
            }
        } catch {
            state = .error(message: "We couldn't load your booking.")
        }
    }

    // MARK: - Actions

    func tapReschedule() {
        if canReschedule { showReschedule = true } else { push(.inviteePolicyBlocked(token: token)) }
    }

    func tapCancel() {
        if canCancel { showCancelSheet = true } else { push(.inviteePolicyBlocked(token: token)) }
    }

    /// "Contact host" / "Contact <host>" — opens the public booking page so the
    /// invitee can reach the host (mirrors Policy-Blocked's `messageHost`).
    func contactHost(_ openURL: OpenURLAction) {
        guard let url = bookingPageURL else { return }
        openURL(url)
    }

    func cancel(reason: String?) async {
        actionInFlight = true
        inlineBanner = nil
        defer { actionInFlight = false }
        let trimmed = reason?.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = PublicCancelRequest(reason: (trimmed?.isEmpty ?? true) ? nil : trimmed)
        do {
            let _: PublicBookingResponse = try await client.request(
                SchedulingPublicEndpoints.cancel(token: token, request)
            )
            showCancelSheet = false
            await fetch()
        } catch let error as SchedulingError {
            showCancelSheet = false
            inlineBanner = error.userMessage ?? "We couldn't cancel your booking."
        } catch {
            showCancelSheet = false
            inlineBanner = "We couldn't cancel your booking."
        }
    }

    /// Called by the reschedule sub-flow after a successful reschedule.
    func didReschedule() {
        showReschedule = false
        Task { await fetch() }
    }

    func bookAgain() {
        guard let slug, !slug.isEmpty else { return }
        push(.inviteeLanding(slug: slug))
    }

    func makeRescheduleViewModel() -> InviteeRescheduleViewModel {
        InviteeRescheduleViewModel(
            token: token,
            tz: bookingTz,
            accent: accent,
            currentStart: booking?.startAt,
            client: client
        )
    }

    private func endISO(for start: Date, durationMin: Int) -> String {
        let end = start.addingTimeInterval(TimeInterval(durationMin * 60))
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: end)
    }
}

#if DEBUG
extension InviteeManageBookingViewModel {
    static func previewConfirmed() -> InviteeManageBookingViewModel {
        make(status: "confirmed", canAct: true)
    }

    static func previewWindowClosed() -> InviteeManageBookingViewModel {
        make(status: "confirmed", canAct: false)
    }

    static func previewCancelled() -> InviteeManageBookingViewModel {
        make(status: "cancelled", canAct: false)
    }

    static func previewExpired() -> InviteeManageBookingViewModel {
        let viewModel = InviteeManageBookingViewModel(token: "tok", push: { _ in }, client: .shared)
        viewModel.state = .expired
        return viewModel
    }

    private static func make(status: String, canAct: Bool) -> InviteeManageBookingViewModel {
        let viewModel = InviteeManageBookingViewModel(token: "tok", push: { _ in }, client: .shared)
        // swiftlint:disable line_length
        let json = """
        {"booking":{"id":"b1","status":"\(
            status
        )","start_at":"2026-09-17T16:30:00Z","end_at":"2026-09-17T17:00:00Z","invitee_name":"Maya Chen","invitee_timezone":"America/Los_Angeles","location_mode":"video"},
        "actions":{"can_cancel":\(canAct),"can_reschedule":\(canAct)},
        "eventType":{"id":"et1","name":"Intro call","slug":"intro","default_duration":30,"location_mode":"video","cancellation_window_min":1440},
        "page":{"slug":"ada","title":"Maria Kessler","owner_type":"user","timezone":"America/Los_Angeles"}}
        """
        // swiftlint:enable line_length
        if let data = json.data(using: .utf8), let response = try? JSONDecoder().decode(ManageBookingResponse.self, from: data) {
            viewModel.response = response
            viewModel.state = .loaded
        }
        return viewModel
    }
}
#endif
