//
//  PolicyBlockedViewModel.swift
//  Pantopus
//
//  D10 Reschedule/Cancel Cutoff & Policy-Blocked (Stream I7). Loads the booking
//  by manage token (`GET /api/public/booking/:token`) and reads the server-
//  computed `actions` bundle (`can_reschedule`/`can_cancel`,
//  `reschedule_deadline`/`free_cancel_until`, `refund_estimate_cents`) to decide
//  which honest policy state to show. The full policy is presented via the
//  Foundation `CancellationPolicySheet`. Cancel is the only mutation here and it
//  is explicit. Tokens only.
//

import SwiftUI

/// The five honest policy states the manage `actions` resolve to.
enum PolicyState: Equatable {
    /// Free to change — render the reschedule / cancel action rows.
    case withinPolicy(canReschedule: Bool, canCancel: Bool, freeUntil: String?)
    /// Reschedule window closed; cancelling may still be open.
    case rescheduleCutoff(deadline: String?, cancelUntil: String?)
    /// Too late to cancel for a refund; can still cancel without one.
    case cancelCutoffNoRefund(deadline: String?)
    /// Cancelling now refunds only part of what was paid.
    case partialRefund(refundCents: Int, paidCents: Int, fullRefundUntil: String?)
    /// The host handles all changes off-platform.
    case changeNotAllowed
}

@Observable
@MainActor
final class PolicyBlockedViewModel {
    enum State: Equatable {
        case loading
        case loaded(ManageBookingResponse, PolicyState)
        /// Cancellation completed in-place.
        case cancelled
        case error(message: String)
    }

    let token: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private(set) var isCancelling = false
    /// Drives the Foundation `CancellationPolicySheet`.
    var showPolicySheet = false
    private var didLoad = false
    private var isFetching = false

    init(
        token: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.token = token
        self.push = push
        self.client = client
    }

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
            let response: ManageBookingResponse = try await client.request(
                SchedulingPublicEndpoints.manage(token: token)
            )
            state = .loaded(response, Self.derive(actions: response.actions, payment: response.payment))
        } catch let error as SchedulingError {
            state = .error(message: error.userMessage ?? "We couldn't load this booking.")
        } catch {
            state = .error(message: "We couldn't load this booking.")
        }
    }

    // MARK: - Policy derivation

    static func derive(actions: ManageActions?, payment: ManagePayment?) -> PolicyState {
        let canReschedule = actions?.canReschedule ?? actions?.inviteeRescheduleAllowed ?? true
        let canCancel = actions?.canCancel ?? actions?.inviteeCancelAllowed ?? true
        let paid = payment?.amountTotal ?? 0
        let refund = actions?.refundEstimateCents
        let stillFree = isFuture(actions?.freeCancelUntil)

        if !canReschedule, !canCancel {
            return .changeNotAllowed
        }
        // A partial refund takes precedence — the invitee must see the amount.
        if canCancel, let refund, paid > 0, refund > 0, refund < paid {
            return .partialRefund(refundCents: refund, paidCents: paid, fullRefundUntil: actions?.freeCancelUntil)
        }
        // Paid, the free window has passed, and there's no refund left.
        if canCancel, paid > 0, (refund ?? 0) == 0, !stillFree {
            return .cancelCutoffNoRefund(deadline: actions?.freeCancelUntil)
        }
        if !canReschedule, canCancel {
            return .rescheduleCutoff(deadline: actions?.rescheduleDeadline, cancelUntil: actions?.freeCancelUntil)
        }
        return .withinPolicy(
            canReschedule: canReschedule,
            canCancel: canCancel,
            freeUntil: actions?.freeCancelUntil
        )
    }

    private static func isFuture(_ iso: String?) -> Bool {
        guard let iso, let date = SchedulingTime.parseUTC(iso) else { return false }
        return date > Date()
    }

    // MARK: - Actions

    /// Reschedule lives on the manage surface (D4); hand off there.
    func reschedule() {
        push(.inviteeManageBooking(token: token))
    }

    /// Cancel the booking via the public manage token. Explicit, destructive.
    func cancel() async {
        guard !isCancelling else { return }
        isCancelling = true
        defer { isCancelling = false }
        do {
            _ = try await client.send(SchedulingPublicEndpoints.cancel(token: token))
            state = .cancelled
        } catch let error as SchedulingError {
            state = .error(message: error.userMessage ?? "We couldn't cancel this booking.")
        } catch {
            state = .error(message: "We couldn't cancel this booking.")
        }
    }

    // MARK: - Presentation helpers

    func tz(_ response: ManageBookingResponse) -> String {
        response.booking.inviteeTimezone
            ?? response.page?.timezone
            ?? SchedulingTime.deviceTimeZoneIdentifier
    }

    /// Build the read-only policy snapshot (D10 reuses `CancellationPolicySheet`).
    func policyDisplay(_ response: ManageBookingResponse) -> CancellationPolicyDisplay {
        let eventType = response.eventType
        let zone = tz(response)
        return CancellationPolicyDisplay(
            name: refundPolicyLabel(eventType?.refundPolicy),
            freeCancellationWindow: windowLabel(minutes: eventType?.cancellationWindowMin)
                ?? EdgeFormat.deadline(response.actions?.freeCancelUntil, tz: zone),
            refundAfterCutoff: refundAfterCutoff(eventType?.refundPolicy),
            depositNonRefundable: (eventType?.depositCents ?? 0) > 0 && eventType?.depositRefundable == false,
            rescheduleCutoff: windowLabel(minutes: eventType?.rescheduleCutoffMin)
                ?? EdgeFormat.deadline(response.actions?.rescheduleDeadline, tz: zone),
            noShowHandling: nil
        )
    }

    private func windowLabel(minutes: Int?) -> String? {
        guard let minutes, minutes > 0 else { return nil }
        if minutes % 1440 == 0 {
            let days = minutes / 1440
            return days == 1 ? "24 hours before" : "\(days) days before"
        }
        if minutes >= 60 {
            let hours = minutes / 60
            return hours == 1 ? "1 hour before" : "\(hours) hours before"
        }
        return "\(minutes) minutes before"
    }

    private func refundPolicyLabel(_ policy: String?) -> String? {
        switch (policy ?? "").lowercased() {
        case "full": "Flexible"
        case "partial": "Moderate"
        case "none": "Strict"
        case "deposit_only": "Deposit only"
        default: nil
        }
    }

    private func refundAfterCutoff(_ policy: String?) -> String? {
        switch (policy ?? "").lowercased() {
        case "full": "Full refund"
        case "partial": "Partial refund"
        case "none": "No refund"
        case "deposit_only": "Deposit kept"
        default: nil
        }
    }
}

#if DEBUG
extension PolicyBlockedViewModel {
    static func preview(_ state: PolicyState) -> PolicyBlockedViewModel {
        let viewModel = PolicyBlockedViewModel(token: "tok", push: { _ in }, client: .shared)
        // swiftlint:disable line_length
        let json = #"""
        {
          "booking": {"id":"b1","status":"confirmed","start_at":"2026-06-17T16:30:00Z","end_at":"2026-06-17T17:00:00Z","invitee_timezone":"America/Los_Angeles"},
          "actions": {"can_cancel":true,"can_reschedule":false,"reschedule_deadline":"2026-06-16T16:30:00Z","free_cancel_until":"2026-06-16T16:30:00Z"},
          "payment": {"amount_total":4800,"currency":"usd","payment_status":"succeeded"},
          "eventType": {"id":"et1","name":"Intro call","default_duration":30,"refund_policy":"none","cancellation_window_min":1440,"reschedule_cutoff_min":1440},
          "page": {"slug":"maria","title":"Maria Kessler","owner_type":"user","timezone":"America/Los_Angeles"}
        }
        """#
        // swiftlint:enable line_length
        if let data = json.data(using: .utf8), let response = try? JSONDecoder().decode(ManageBookingResponse.self, from: data) {
            viewModel.state = .loaded(response, state)
        }
        viewModel.didLoad = true
        return viewModel
    }
}
#endif
