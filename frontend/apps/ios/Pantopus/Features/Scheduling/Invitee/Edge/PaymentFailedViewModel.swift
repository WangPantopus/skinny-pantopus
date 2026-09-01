//
//  PaymentFailedViewModel.swift
//  Pantopus
//
//  D6 Payment Failed / Retry (Stream I7) — gated behind `SchedulingFeatureFlags
//  .paidEnabled` (Stripe TEST mode; payout settlement deferred). Loads the
//  booking by manage token and reads `payment.payment_status` to pick the state:
//  `failed` → declined (with a client-side slot hold that lapses to "hold
//  released"), `pending` → "we're not sure that went through", `succeeded` →
//  morph + hand off. The backend exposes no dedicated retry endpoint, so "retry"
//  re-reads the manage state (idempotent, never double-charges). Tokens only.
//

import SwiftUI

@Observable
@MainActor
final class PaymentFailedViewModel {
    enum Stage: Equatable {
        case loading
        /// Card declined; the slot is held for `holdRemaining` seconds.
        case declined
        /// The hold lapsed while waiting — the time opened back up.
        case holdExpired
        /// The connection dropped before we heard back; re-check is idempotent.
        case uncertain
        /// Payment went through; hand off to the booking.
        case succeeded
        /// Paid surfaces are off — nothing to retry.
        case notApplicable
        case error(message: String)
    }

    let token: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var stage: Stage = .loading
    private(set) var response: ManageBookingResponse?
    /// Seconds left on the client-side slot hold (declined / uncertain states).
    private(set) var holdRemaining = 0
    let holdDuration = 300

    private var didLoad = false
    private var isFetching = false
    private var holdTask: Task<Void, Never>?

    init(
        token: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.token = token
        self.push = push
        self.client = client
    }

    var paidEnabled: Bool {
        SchedulingFeatureFlags.paidEnabled
    }

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        guard paidEnabled else {
            stage = .notApplicable
            return
        }
        await fetch()
    }

    func stop() {
        holdTask?.cancel()
        holdTask = nil
    }

    private func fetch() async {
        guard !isFetching else { return }
        isFetching = true
        defer { isFetching = false }
        do {
            let response: ManageBookingResponse = try await client.request(
                SchedulingPublicEndpoints.manage(token: token)
            )
            self.response = response
            applyPaymentStatus(response.payment?.paymentStatus)
        } catch let error as SchedulingError {
            stage = .error(message: error.userMessage ?? "We couldn't check your payment.")
        } catch {
            stage = .error(message: "We couldn't check your payment.")
        }
    }

    private func applyPaymentStatus(_ status: String?) {
        switch (status ?? "").lowercased() {
        case "succeeded", "paid":
            stage = .succeeded
            scheduleHandoff()
        case "failed", "requires_payment_method", "canceled", "cancelled":
            stage = .declined
            startHold()
        case "pending", "processing", "requires_action", "requires_confirmation":
            stage = .uncertain
            startHold()
        case "":
            // No payment recorded — not a priced booking; nothing to retry.
            stage = .notApplicable
        default:
            stage = .declined
            startHold()
        }
    }

    // MARK: - Hold countdown

    private func startHold() {
        holdTask?.cancel()
        holdRemaining = holdDuration
        holdTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard let self, !Task.isCancelled else { return }
                guard stage == .declined || stage == .uncertain else { return }
                if holdRemaining <= 1 {
                    holdRemaining = 0
                    stage = .holdExpired
                    return
                }
                holdRemaining -= 1
            }
        }
    }

    /// `4:48` — the hold countdown label.
    var holdLabel: String {
        let minutes = holdRemaining / 60
        let seconds = holdRemaining % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    // MARK: - Actions

    /// "Try another card" / "Check again" — re-read the manage state. The backend
    /// has no retry endpoint; re-reading is idempotent and never double-charges.
    func retry() async {
        stage = .loading
        await fetch()
    }

    /// "Use a different time" / "Pick a time again" — hand off to the manage
    /// surface where reschedule lives.
    func pickAnotherTime() {
        push(.inviteeManageBooking(token: token))
    }

    /// Hand off to the booking once payment succeeds.
    func continueToBooking() {
        push(.inviteeManageBooking(token: token))
    }

    private func scheduleHandoff() {
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            guard let self, stage == .succeeded else { return }
            continueToBooking()
        }
    }

    // MARK: - Presentation helpers

    func tz() -> String {
        response?.booking.inviteeTimezone
            ?? response?.page?.timezone
            ?? SchedulingTime.deviceTimeZoneIdentifier
    }

    var amountLabel: String? {
        EdgeFormat.money(cents: response?.payment?.amountTotal, currency: response?.payment?.currency)
    }

    var slotTimeLabel: String? {
        EdgeFormat.time(response?.booking.startAt, tz: tz())
    }
}

#if DEBUG
extension PaymentFailedViewModel {
    static func preview(_ stage: Stage) -> PaymentFailedViewModel {
        let viewModel = PaymentFailedViewModel(token: "tok", push: { _ in }, client: .shared)
        let json = #"""
        {
          "booking": {"id":"b1","status":"pending","start_at":"2026-06-17T21:00:00Z","invitee_timezone":"America/Los_Angeles"},
          "payment": {"amount_total":4800,"currency":"usd","payment_status":"failed"},
          "eventType": {"id":"et1","name":"Consultation","default_duration":30,"price_cents":4800,"currency":"usd"},
          "page": {"slug":"maria","title":"Maria Kessler","owner_type":"user","timezone":"America/Los_Angeles"}
        }
        """#
        if let data = json.data(using: .utf8), let response = try? JSONDecoder().decode(ManageBookingResponse.self, from: data) {
            viewModel.response = response
        }
        viewModel.stage = stage
        viewModel.holdRemaining = 288
        viewModel.didLoad = true
        return viewModel
    }
}
#endif
