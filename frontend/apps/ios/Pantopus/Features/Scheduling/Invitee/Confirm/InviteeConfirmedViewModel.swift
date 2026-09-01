//
//  InviteeConfirmedViewModel.swift
//  Pantopus
//
//  D3 Booking Confirmed / Thank-You (Stream I6). Reached after a successful
//  commit on D2 carrying the one-time `manageToken`. Re-fetches the booking via
//  `GET /api/public/booking/:token` to render the success (or pending-approval)
//  hero, the summary card, an optional receipt capsule (paid), and the add-to-
//  calendar cluster. Links to D4 (Manage) carrying the same token.
//

import SwiftUI

@Observable
@MainActor
final class InviteeConfirmedViewModel {
    enum State: Equatable {
        case loading
        case loaded
        case error(message: String)
    }

    let manageToken: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private(set) var response: ManageBookingResponse?

    private var didLoad = false

    init(
        manageToken: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.manageToken = manageToken
        self.push = push
        self.client = client
    }

    // MARK: - Derived

    private var booking: PublicBookingDTO? {
        response?.booking
    }

    private var eventType: PublicEventTypeView? {
        response?.eventType
    }

    private var page: PublicPageView? {
        response?.page
    }

    private var payment: ManagePayment? {
        response?.payment
    }

    var accent: Color {
        DiscoveryTheme.accent(forOwnerType: page?.ownerType)
    }

    /// Pending host approval → info hero + timeline; else success hero.
    var isPending: Bool {
        (booking?.status.lowercased() == "pending") || (booking?.requiresApproval ?? false)
    }

    var heroTitle: String {
        isPending ? "Request sent" : "You're booked"
    }

    /// The success-hero variant, derived from the payment shape. Each carries its
    /// own body copy mirroring the design's per-frame thank-you lines.
    enum ConfirmedVariant: Equatable { case free, paid, deposit, sending }

    /// Pending → request; deposit booking → deposit-paid; email still in flight →
    /// sending; any settled charge → paid; otherwise the free path.
    var variant: ConfirmedVariant {
        guard showsReceipt else { return .free }
        if receiptProcessing { return .sending }
        if isDeposit { return .deposit }
        return .paid
    }

    var heroBody: String {
        if isPending {
            return "The host reviews each request before it's confirmed. We'll email you the moment it's set."
        }
        switch variant {
        case .deposit:
            return "Your deposit is in. The rest is due when you arrive."
        case .paid:
            return "We've sent the details and receipt to your email."
        case .sending:
            return "We're sending the details to your email."
        case .free:
            return "We've sent the details to your email."
        }
    }

    /// Opens the host's public booking page so the invitee can reach out — the
    /// same affordance the Policy-Blocked surface uses for "Message host".
    var messageHostURL: URL? {
        page?.slug.flatMap { URL(string: "https://pantopus.com/book/\($0)") }
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
            pillarTitle: nil,
            dateLine: booking?.startAt.map { ConfirmFormat.dayAndTime(startUTC: $0, endUTC: endAtISO, tz: tz) },
            tzLabel: ConfirmFormat.tzChipLabel(tz: tz),
            locationTitle: location ?? "Details to follow",
            locationSub: isPending
                ? "Join link is sent once the host confirms."
                : (location == nil ? nil : "Join link is in your email and calendar invite.")
        )
    }

    var bookingTz: String {
        booking?.inviteeTimezone ?? page?.timezone ?? SchedulingTime.deviceTimeZoneIdentifier
    }

    var eventRecap: String {
        let name = eventType?.name ?? "Your booking"
        guard let start = booking?.startAt else { return name }
        return "\(name) · \(ConfirmFormat.dayAndTime(startUTC: start, endUTC: booking?.endAt, tz: bookingTz))"
    }

    /// Receipt capsule shown only for paid bookings when the flag is on.
    var showsReceipt: Bool {
        SchedulingFeatureFlags.paidEnabled && (payment?.amountTotal ?? 0) > 0
    }

    var receiptAmount: String? {
        guard let cents = receiptChargeCents else { return nil }
        return ConfirmFormat.money(cents: cents, currency: payment?.currency)
    }

    var receiptProcessing: Bool {
        let status = (payment?.paymentStatus ?? "").lowercased()
        return status == "processing" || status == "pending" || payment?.paidAt == nil
    }

    /// A booking is a deposit when the event type defines a deposit that is
    /// strictly smaller than the total charged — i.e. a balance remains.
    var isDeposit: Bool {
        guard let deposit = eventType?.depositCents, deposit > 0,
              let total = payment?.amountTotal, deposit < total else { return false }
        return true
    }

    /// The amount the invitee actually paid now — the deposit for a deposit
    /// booking, otherwise the full total.
    private var receiptChargeCents: Int? {
        if isDeposit { return eventType?.depositCents }
        return payment?.amountTotal
    }

    /// "Deposit received" for a partial deposit, else "Payment received".
    var receiptTitle: String {
        if receiptProcessing { return "Payment processing" }
        return isDeposit ? "Deposit received" : "Payment received"
    }

    /// e.g. "$40.00 due at your visit" — the remaining balance after a deposit.
    var depositBalanceLabel: String? {
        guard isDeposit, let total = payment?.amountTotal,
              let deposit = eventType?.depositCents else { return nil }
        let balance = total - deposit
        guard balance > 0 else { return nil }
        return "\(ConfirmFormat.money(cents: balance, currency: payment?.currency)) due at your visit"
    }

    // swiftlint:disable:next large_tuple
    var timelineSteps: [(label: String, sub: String?, state: TimelineStepState)] {
        [
            ("Submitted", "Just now", .done),
            ("Awaiting host", nil, .current),
            ("Confirmed", nil, .pending)
        ]
    }

    enum TimelineStepState { case done, current, pending }

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
                SchedulingPublicEndpoints.manage(token: manageToken)
            )
            self.response = response
            state = .loaded
        } catch let error as SchedulingError {
            state = .error(message: error.userMessage ?? "We couldn't load your booking.")
        } catch {
            state = .error(message: "We couldn't load your booking.")
        }
    }

    // MARK: - Navigation

    func openManage() {
        push(.inviteeManageBooking(token: manageToken))
    }

    private func endISO(for start: Date, durationMin: Int) -> String {
        let end = start.addingTimeInterval(TimeInterval(durationMin * 60))
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: end)
    }
}

#if DEBUG
extension InviteeConfirmedViewModel {
    static func previewConfirmed() -> InviteeConfirmedViewModel {
        make(status: "confirmed")
    }

    static func previewPending() -> InviteeConfirmedViewModel {
        make(status: "pending")
    }

    static func previewPaid() -> InviteeConfirmedViewModel {
        make(
            status: "confirmed",
            paymentJSON: #""payment":{"amount_total":4800,"currency":"usd","payment_status":"paid","paid_at":"2026-06-13T16:41:00Z"},"#
        )
    }

    static func previewDeposit() -> InviteeConfirmedViewModel {
        make(
            status: "confirmed",
            depositCents: 2000,
            paymentJSON: #""payment":{"amount_total":6000,"currency":"usd","payment_status":"paid","paid_at":"2026-06-13T16:41:00Z"},"#
        )
    }

    static func previewSending() -> InviteeConfirmedViewModel {
        make(status: "confirmed", paymentJSON: #""payment":{"amount_total":4800,"currency":"usd","payment_status":"processing"},"#)
    }

    private static func make(
        status: String,
        depositCents: Int? = nil,
        paymentJSON: String = ""
    ) -> InviteeConfirmedViewModel {
        // Paid-bearing previews must light the paid surface, which defaults OFF;
        // mirrors the InviteeReviewConfirm preview factory.
        if !paymentJSON.isEmpty { SchedulingFeatureFlags.paidEnabled = true }
        let viewModel = InviteeConfirmedViewModel(manageToken: "tok_preview", push: { _ in }, client: .shared)
        let depositField = depositCents.map { ",\"deposit_cents\":\($0)" } ?? ""
        let json = """
        {"booking":{"id":"b1","status":"\(
            status
        )","start_at":"2026-06-17T16:30:00Z","end_at":"2026-06-17T17:00:00Z",
        "invitee_timezone":"America/Los_Angeles","location_mode":"video"},
        "actions":{"can_cancel":true,"can_reschedule":true},
        \(paymentJSON)
        "eventType":{"id":"et1","name":"Intro call","slug":"intro","default_duration":30,"location_mode":"video"\(depositField)},
        "page":{"slug":"ada","title":"Maria Kessler","owner_type":"user","timezone":"America/Los_Angeles"}}
        """
        if let data = json.data(using: .utf8), let response = try? JSONDecoder().decode(ManageBookingResponse.self, from: data) {
            viewModel.response = response
            viewModel.state = .loaded
        }
        return viewModel
    }
}
#endif
