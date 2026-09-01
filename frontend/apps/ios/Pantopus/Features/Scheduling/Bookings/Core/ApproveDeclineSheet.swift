//
//  ApproveDeclineSheet.swift
//  Pantopus
//
//  E3 Approve / Decline Request Sheet (Stream I8). A locally-presented bottom
//  sheet off the inbox/detail for approval-required bookings: review (requester
//  + slot + intake preview + note → Approve) toggling into decline (reason chips
//  + propose-another-time + note → Decline request). Submitting shows an inline
//  spinner; ALREADY_* / PAST_DEADLINE / INVALID_STATUS surface as inline errors
//  with the actions re-enabled.
//

import SwiftUI

@Observable
@MainActor
final class ApproveDeclineViewModel {
    enum Mode: Equatable { case review, decline }

    let owner: SchedulingOwner
    let booking: BookingDTO
    let eventName: String?
    private let actions: BookingActions

    var mode: Mode
    var declineReason: DeclineReason?
    var note = ""
    private(set) var submitting = false
    private(set) var succeeded = false
    var error: String?

    init(
        owner: SchedulingOwner,
        booking: BookingDTO,
        eventName: String?,
        startInDecline: Bool,
        actions: BookingActions
    ) {
        self.owner = owner
        self.booking = booking
        self.eventName = eventName
        self.actions = actions
        mode = startInDecline ? .decline : .review
    }

    var title: String {
        mode == .review ? "Review request" : "Decline request"
    }

    func switchToDecline() {
        mode = .decline
        error = nil
    }

    /// Returns whether the action succeeded, so the view can chain `onCompleted`
    /// without reading MainActor state across the `await`.
    @discardableResult
    func approve() async -> Bool {
        await submit { try await actions.approve(id: booking.id) }
    }

    @discardableResult
    func decline() async -> Bool {
        let reason = composedReason()
        return await submit { try await actions.decline(id: booking.id, reason: reason) }
    }

    private func submit(_ work: () async throws -> BookingDTO) async -> Bool {
        submitting = true
        error = nil
        do {
            _ = try await work()
            succeeded = true
        } catch {
            self.error = message(for: error)
        }
        submitting = false
        return succeeded
    }

    private func composedReason() -> String? {
        let parts = [declineReason?.label, note.trimmingCharacters(in: .whitespacesAndNewlines)]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " — ")
    }

    private func message(for error: Error) -> String {
        let verb = mode == .review ? "approve" : "decline"
        guard let scheduling = error as? SchedulingError else { return "Couldn't \(verb) — try again" }
        switch scheduling {
        case let .conflict(code, message):
            switch code {
            case "ALREADY_APPROVED": return "This booking was already approved."
            case "ALREADY_DECLINED": return "This booking was already declined."
            case "PAST_DEADLINE": return "It's past the deadline to \(verb) this booking."
            case "INVALID_STATUS": return "This booking can no longer be \(verb)d."
            default: return message ?? "Couldn't \(verb) — try again"
            }
        default:
            return scheduling.userMessage ?? "Couldn't \(verb) — try again"
        }
    }
}

struct ApproveDeclineSheet: View {
    @State private var viewModel: ApproveDeclineViewModel
    let onCompleted: () async -> Void
    /// "Propose another time" hand-off (the parent swaps in the reschedule sheet
    /// in propose mode). Hidden when nil.
    var onProposeTime: (() -> Void)?
    /// View-only conflict signal (design frame 3): when true the review mode shows
    /// the amber "This slot overlaps a confirmed booking" banner. There is no
    /// overlap flag on `BookingDTO` yet, so this stays `false` until the host can
    /// supply it (see deferredBackend).
    var showConflictWarning: Bool
    /// "View conflict" hand-off. Hidden when nil.
    var onViewConflict: (() -> Void)?

    init(
        viewModel: ApproveDeclineViewModel,
        onCompleted: @escaping () async -> Void,
        onProposeTime: (() -> Void)? = nil,
        showConflictWarning: Bool = false,
        onViewConflict: (() -> Void)? = nil
    ) {
        _viewModel = State(wrappedValue: viewModel)
        self.onCompleted = onCompleted
        self.onProposeTime = onProposeTime
        self.showConflictWarning = showConflictWarning
        self.onViewConflict = onViewConflict
    }

    var body: some View {
        @Bindable var viewModel = viewModel
        return ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                SheetTitle(text: viewModel.title)
                BookingRequesterCard(booking: viewModel.booking)
                BookingSlotCard(booking: viewModel.booking, accent: viewModel.owner.theme.accent)
                if viewModel.mode == .review {
                    if showConflictWarning {
                        conflictBanner
                    }
                    IntakeAnswersDisclosure(answers: viewModel.booking.intakeAnswers)
                        .padding(.vertical, Spacing.s1)
                } else {
                    reasonSection($viewModel.declineReason)
                }
                BookingNoteField(
                    placeholder: "Add a note (optional)",
                    text: $viewModel.note,
                    accessibilityID: "scheduling.approveDecline.note"
                )
                if let error = viewModel.error {
                    inlineError(error)
                }
                actions
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
            .padding(.bottom, Spacing.s6)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("scheduling.approveDeclineSheet")
    }

    private func reasonSection(_ selection: Binding<DeclineReason?>) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Reason")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextMuted)
            ReasonChipRow(reasons: DeclineReason.allCases, label: { $0.label }, selected: selection)
            if let onProposeTime {
                Button(action: onProposeTime) {
                    HStack(spacing: Spacing.s2) {
                        Icon(.calendarPlus, size: 15, color: Theme.Color.primary600)
                        Text("Propose another time")
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(Theme.Color.primary600)
                    }
                }
                .buttonStyle(.plain)
                .padding(.top, Spacing.s1)
            }
        }
    }

    @ViewBuilder
    private var actions: some View {
        switch viewModel.mode {
        case .review:
            VStack(spacing: Spacing.s2) {
                SheetCTAButton(title: "Approve", icon: .check, tone: .primary, isLoading: viewModel.submitting) {
                    if await viewModel.approve() { await onCompleted() }
                }
                Button { viewModel.switchToDecline() } label: {
                    Text("Decline")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.error)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .disabled(viewModel.submitting)
                .accessibilityIdentifier("scheduling.approveDecline.toggleDecline")
            }
            .padding(.top, Spacing.s2)
        case .decline:
            SheetCTAButton(title: "Decline request", icon: .x, tone: .destructive, isLoading: viewModel.submitting) {
                if await viewModel.decline() { await onCompleted() }
            }
            .padding(.top, Spacing.s2)
            .accessibilityIdentifier("scheduling.approveDecline.declineSubmit")
        }
    }

    /// Design frame 3 — amber overlap warning shown above the actions in review
    /// mode. `triangle-alert` glyph + copy + trailing "View conflict" hand-off.
    private var conflictBanner: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.triangleAlert, size: 17, color: Theme.Color.warning)
            Text("This slot overlaps a confirmed booking")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.warning)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let onViewConflict {
                Button(action: onViewConflict) {
                    Text("View conflict")
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Theme.Color.warning)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("scheduling.approveDecline.conflictBanner")
    }

    private func inlineError(_ message: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 16, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.error)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.errorLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

#if DEBUG
#Preview("Review") {
    Color.clear.sheet(isPresented: .constant(true)) {
        ApproveDeclineSheet(
            viewModel: ApproveDeclineViewModel(
                owner: .business(id: "b"),
                booking: .preview(status: "pending", ownerType: "business"),
                eventName: "Studio consultation",
                startInDecline: false,
                actions: BookingActions(owner: .business(id: "b"))
            ),
            onCompleted: {},
            onProposeTime: {}
        )
    }
}

#Preview("Review · conflict") {
    Color.clear.sheet(isPresented: .constant(true)) {
        ApproveDeclineSheet(
            viewModel: ApproveDeclineViewModel(
                owner: .business(id: "b"),
                booking: .preview(status: "pending", ownerType: "business"),
                eventName: "Studio consultation",
                startInDecline: false,
                actions: BookingActions(owner: .business(id: "b"))
            ),
            onCompleted: {},
            onProposeTime: {},
            showConflictWarning: true
        )
    }
}
#endif
