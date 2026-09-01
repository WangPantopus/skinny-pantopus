//
//  CancelRefundSheet.swift
//  Pantopus
//
//  E5 Cancel & Refund Sheet (Stream I8). A destructive bottom sheet off the
//  inbox/detail: reason chips, an optional note to the other party, a notify
//  toggle, and — for paid bookings behind the paid flag — a refund-policy note
//  (the backend applies refund logic from the cancellation policy; the cancel
//  endpoint takes no amount, and the booking carries no price, so the concrete
//  figure / preset UI awaits the pricing surfaces). On success it surfaces
//  `refund_issued`; ALREADY_CANCELLED / PAST_DEADLINE / REFUND_FAILED handled.
//

import SwiftUI

// swiftlint:disable file_length

@Observable
@MainActor
final class CancelRefundViewModel {
    let owner: SchedulingOwner
    let booking: BookingDTO
    let eventName: String?
    private let actions: BookingActions

    var reason: CancelReason?
    var otherDetail = ""
    var note = ""
    var notifyInvitee = true

    /// View-only refund-mode selector (E5 frames 2–4). The cancel endpoint takes
    /// no amount and the owner-side `BookingDTO` carries no price, so this drives
    /// the segmented control + policy copy only; the concrete figure / settlement
    /// awaits the pricing payload (see `deferredBackend`).
    var refundPreset: RefundPreset = .full
    /// Restore-credit intent for package-credit bookings (E5 frame 5). The cancel
    /// endpoint can't restore a credit yet, so this is captured for intent only.
    var restoreCredit = true

    private(set) var submitting = false
    private(set) var succeeded = false
    private(set) var refundIssued: Bool?
    private(set) var refundFailed = false
    var error: String?

    init(owner: SchedulingOwner, booking: BookingDTO, eventName: String?, actions: BookingActions) {
        self.owner = owner
        self.booking = booking
        self.eventName = eventName
        self.actions = actions
    }

    /// Paid surfaces stay behind the flag + Stripe TEST mode.
    var isPaid: Bool {
        booking.paymentId != nil && SchedulingFeatureFlags.paidEnabled
    }

    /// Package-credit bookings (E5 frame 5) show the "Restore credit" switch in
    /// place of the money refund section. Driven by the real `package_credit_id`.
    var creditRedeemed: Bool {
        booking.packageCreditId != nil && SchedulingFeatureFlags.paidEnabled
    }

    /// Whether to render the money/preset refund section (E5 frames 2–4). A
    /// credit booking takes the restore-credit switch instead.
    var showsRefundSection: Bool {
        isPaid && !creditRedeemed
    }

    /// Non-refundable deposit (E5 frame 4) dims the whole refund section, disables
    /// the preset control, renders the refund value in the muted tone, and swaps in
    /// the "non-refundable" explainer. There's no `non_refundable` signal on the
    /// owner-side `BookingDTO` yet, so this stays `false` (see `deferredBackend`);
    /// the rendering path is wired so the state is faithful once pricing lands.
    var refundNonRefundable: Bool {
        false
    }

    /// Per-preset policy explainer under the refund money rows (E5 frames 2–4).
    /// The free-cancellation-window / 50% copy mirrors the design; the concrete
    /// amounts are deferred until the pricing payload lands.
    var refundPolicyCopy: String {
        if refundNonRefundable { return "This deposit is non-refundable" }
        switch refundPreset {
        case .full: return "You're within the free-cancellation window — full refund"
        case .partial: return "A partial refund applies per your cancellation policy"
        case .perPolicy: return "Within 24h of start — 50% refund per your cancellation policy"
        }
    }

    /// Already-terminal bookings render the read-only summary frame.
    var alreadyCancelled: Bool {
        switch SchedulingPillStatus(backend: booking.status) {
        case .cancelled, .declined: true
        default: false
        }
    }

    /// Did a refund land for the terminal summary (E5 frames 5 fallthrough · 8)?
    /// Prefers the in-session outcome (post-cancel), falling back to the loaded
    /// booking's `refund_issued` so a freshly-opened already-cancelled booking
    /// still shows its "Refunded to card" row.
    var terminalRefundIssued: Bool {
        isPaid && (refundIssued ?? booking.refundIssued ?? false)
    }

    /// Body line for the already-cancelled read-only frame (E5 frame 8). The
    /// design reads "This booking was cancelled … and refunded in full" — we
    /// reflect the booking's real `refund_issued` (a concrete date/amount isn't
    /// on the owner payload, so we keep the sentence amount-free).
    var alreadyCancelledBody: String {
        if terminalRefundIssued {
            return "This booking was cancelled and refunded in full."
        }
        if isPaid {
            return "This booking was cancelled. No refund was due per your cancellation policy."
        }
        return "This booking was cancelled and is no longer active."
    }

    var subtitle: String {
        [eventName, booking.inviteeName, BookingsTime.shortWhen(startUTC: booking.startAt)]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    var confirmTitle: String {
        if refundFailed { return "Retry refund" }
        return isPaid ? "Cancel & refund" : "Cancel booking"
    }

    /// Frame 7 retry uses lucide `rotate-cw` (not `refresh-cw`); default is `x-circle`.
    var confirmIcon: PantopusIcon {
        refundFailed ? .rotateCw : .xCircle
    }

    func cancel() async {
        submitting = true
        error = nil
        refundFailed = false
        do {
            let updated = try await actions.cancel(id: booking.id, reason: composedReason())
            refundIssued = updated.refundIssued
            succeeded = true
        } catch let scheduling as SchedulingError {
            handle(scheduling)
        } catch {
            self.error = "Couldn't cancel — try again."
        }
        submitting = false
    }

    private func composedReason() -> String? {
        let detail = reason == .other ? otherDetail : nil
        let parts = [reason?.label, detail, note]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " — ")
    }

    private func handle(_ scheduling: SchedulingError) {
        switch scheduling {
        case let .conflict(code, message):
            switch code {
            case "ALREADY_CANCELLED": error = "This booking was already cancelled."
            case "PAST_DEADLINE": error = "It's past the cancellation cutoff for this booking."
            case "REFUND_FAILED":
                refundFailed = true
                error = "The refund couldn't be processed — try again or contact support."
            default: error = message ?? "Couldn't cancel — try again."
            }
        default:
            error = scheduling.userMessage ?? "Couldn't cancel — try again."
        }
    }
}

// swiftlint:disable:next type_body_length
struct CancelRefundSheet: View {
    @State private var viewModel: CancelRefundViewModel
    let onCompleted: () async -> Void

    init(viewModel: CancelRefundViewModel, onCompleted: @escaping () async -> Void) {
        _viewModel = State(wrappedValue: viewModel)
        self.onCompleted = onCompleted
    }

    var body: some View {
        Group {
            if viewModel.alreadyCancelled {
                terminalView
            } else if viewModel.succeeded {
                cancelledView
            } else {
                formView
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("scheduling.cancelSheet")
    }

    // MARK: - Form

    private var formView: some View {
        @Bindable var viewModel = viewModel
        return VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        Text("Cancel this booking?")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(viewModel.subtitle)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    // Refund-failed banner sits directly under the header (E5 frame 7).
                    if viewModel.refundFailed, let error = viewModel.error { inlineError(error) }
                    reasonSection($viewModel.reason, otherDetail: $viewModel.otherDetail)
                    BookingNoteField(
                        placeholder: "Note to the other party (optional)",
                        text: $viewModel.note,
                        accessibilityID: "scheduling.cancel.note"
                    )
                    if viewModel.showsRefundSection { refundCard($viewModel.refundPreset) }
                    if viewModel.creditRedeemed { restoreCreditCard($viewModel.restoreCredit) }
                    notifyRow($viewModel.notifyInvitee)
                    // Non-refund errors render inline at the foot of the form.
                    if !viewModel.refundFailed, let error = viewModel.error { inlineError(error) }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
                .padding(.bottom, Spacing.s4)
            }
            footer
        }
    }

    private func reasonSection(_ selection: Binding<CancelReason?>, otherDetail: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Reason")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ReasonChipRow(reasons: CancelReason.allCases, label: { $0.label }, selected: selection)
            if selection.wrappedValue == .other {
                BookingNoteField(
                    placeholder: "Tell us what happened",
                    text: otherDetail,
                    accessibilityID: "scheduling.cancel.otherDetail"
                )
            }
        }
    }

    /// E5 frames 2–4 · Refund section: `receipt` overline, a Full/Partial/Per-policy
    /// segmented control, Paid + Refund money rows, and a per-preset policy line.
    /// The owner-side booking carries no price, so the figures render as a deferred
    /// placeholder (see `deferredBackend`) — the structure/preset/copy are faithful.
    private func refundCard(_ preset: Binding<RefundPreset>) -> some View {
        let disabled = viewModel.refundNonRefundable
        return VStack(alignment: .leading, spacing: Spacing.s3) {
            BookingOverline(icon: .receipt, text: "Refund")
            refundPresetPicker(preset, disabled: disabled)
            VStack(spacing: Spacing.s0) {
                refundMoneyRow(label: "Paid", value: deferredAmount, strong: false, color: Theme.Color.appText)
                Rectangle()
                    .fill(Theme.Color.appBorder)
                    .frame(height: 1)
                    .padding(.vertical, 2)
                refundMoneyRow(
                    label: "Refund to card",
                    value: deferredAmount,
                    strong: true,
                    // Non-refundable (E5 frame 4) renders the refund value muted (fg4)
                    // rather than the success tone.
                    color: disabled ? Theme.Color.appTextMuted : Theme.Color.success
                )
            }
            Text(viewModel.refundPolicyCopy)
                .font(.system(size: 10.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        // E5 frame 4 · the whole refund section dims when the deposit is non-refundable.
        .opacity(disabled ? 0.55 : 1)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
        )
    }

    /// Full/Partial/Per-policy segmented control matching the design's inset pills.
    private func refundPresetPicker(_ preset: Binding<RefundPreset>, disabled: Bool) -> some View {
        HStack(spacing: 3) {
            ForEach(RefundPreset.allCases, id: \.self) { mode in
                let isOn = preset.wrappedValue == mode
                Button {
                    preset.wrappedValue = mode
                } label: {
                    Text(mode.label)
                        .font(.system(size: 11, weight: isOn ? .bold : .semibold))
                        .foregroundStyle(isOn ? Theme.Color.appText : Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity, minHeight: 30)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                                .fill(isOn ? Theme.Color.appSurface : Color.clear)
                                .shadow(color: isOn ? Color.black.opacity(0.08) : .clear, radius: 1, y: 1)
                        )
                }
                .buttonStyle(.plain)
                .disabled(disabled)
            }
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
        )
        .accessibilityIdentifier("scheduling.cancel.refundPreset")
    }

    /// A Paid / Refund money row. The amount is a deferred placeholder until the
    /// pricing payload is available.
    private func refundMoneyRow(label: String, value: String, strong: Bool, color: Color) -> some View {
        HStack {
            Text(label)
                .font(.system(size: strong ? 13.5 : 12.5, weight: strong ? .bold : .medium))
                .foregroundStyle(strong ? Theme.Color.appText : Theme.Color.appTextStrong)
            Spacer(minLength: Spacing.s2)
            Text(value)
                .font(.system(size: strong ? 15 : 13, weight: .bold))
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .padding(.vertical, 7)
    }

    /// Deferred money placeholder — the owner booking payload has no price.
    private var deferredAmount: String {
        "—"
    }

    /// E5 frame 5 · Restore-credit switch for package-credit bookings.
    private func restoreCreditCard(_ isOn: Binding<Bool>) -> some View {
        HStack(spacing: Spacing.s3) {
            // Pillar-tinted tile + toggle — the design's blue50/blue600 is the
            // personal-pillar accent in the mock; accent follows owner context.
            Icon(.ticket, size: 18, color: viewModel.accent)
                .frame(width: 36, height: 36)
                .background(viewModel.accentBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text("Restore session credit")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Paid with a session package")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(viewModel.accent)
        }
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
        )
        .accessibilityIdentifier("scheduling.cancel.restoreCredit")
    }

    private func notifyRow(_ notify: Binding<Bool>) -> some View {
        Toggle(isOn: notify) {
            HStack(spacing: Spacing.s2) {
                Icon(.bell, size: 17, color: Theme.Color.appTextStrong)
                Text("Notify invitee")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
        }
        .tint(viewModel.accent)
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private var footer: some View {
        SheetCTAButton(
            title: viewModel.confirmTitle,
            icon: viewModel.confirmIcon,
            tone: .destructive,
            isLoading: viewModel.submitting,
            isEnabled: !viewModel.submitting
        ) {
            // On success the body re-renders to the cancelled confirmation
            // (which surfaces refund_issued); Done there calls onCompleted.
            await viewModel.cancel()
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s5)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
        .accessibilityIdentifier("scheduling.cancel.submit")
    }

    // MARK: - Cancelled confirmation (surfaces refund_issued)

    private var cancelledView: some View {
        terminalScaffold(
            icon: .circleSlash,
            iconTint: Theme.Color.appTextSecondary,
            iconBg: Theme.Color.appSurfaceSunken,
            title: "Booking cancelled",
            body: refundOutcomeCopy,
            showsRefundRow: viewModel.terminalRefundIssued
        )
    }

    private var refundOutcomeCopy: String {
        if viewModel.isPaid {
            if viewModel.refundIssued == true {
                return "A refund was issued to the card. The invitee has been notified."
            }
            return "No refund was due per your cancellation policy. The invitee has been notified."
        }
        return "The invitee has been notified."
    }

    // MARK: - Already cancelled (read-only)

    private var terminalView: some View {
        terminalScaffold(
            icon: .circleSlash,
            iconTint: Theme.Color.appTextSecondary,
            iconBg: Theme.Color.appSurfaceSunken,
            title: "Already cancelled",
            body: viewModel.alreadyCancelledBody,
            showsRefundRow: viewModel.terminalRefundIssued
        )
    }

    private func terminalScaffold(
        icon: PantopusIcon,
        iconTint: Color,
        iconBg: Color,
        title: String,
        body: String,
        showsRefundRow: Bool = false
    ) -> some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle().fill(iconBg).frame(width: 64, height: 64)
                Icon(icon, size: 28, color: iconTint)
            }
            VStack(spacing: Spacing.s2) {
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(body)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
            if showsRefundRow {
                // E5 frame 8 · "Refunded to card" summary. The row only renders when a
                // refund is confirmed issued, so the value reads "Issued"; the concrete
                // amount is a deferred placeholder until the pricing payload lands.
                refundMoneyRow(
                    label: "Refunded to card",
                    value: "Issued",
                    strong: true,
                    color: Theme.Color.success
                )
                .padding(.horizontal, Spacing.s3)
                .background(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                        )
                )
            }
            // Frame 8 · the terminal "Done" is an outlined/ghost button, not filled.
            GhostButton(title: "Done") { await onCompleted() }
                .padding(.top, Spacing.s2)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity)
    }

    private func inlineError(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertCircle, size: 16, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.error)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Theme.Color.errorLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

private extension CancelRefundViewModel {
    var accent: Color {
        owner.theme.accent
    }

    var accentBg: Color {
        owner.theme.accentBg
    }
}

#if DEBUG
#Preview("Cancel") {
    Color.clear.sheet(isPresented: .constant(true)) {
        CancelRefundSheet(
            viewModel: CancelRefundViewModel(
                owner: .personal,
                booking: .preview(status: "confirmed", ownerType: "user"),
                eventName: "30-min intro call",
                actions: BookingActions(owner: .personal)
            )
        ) {}
    }
}
#endif
