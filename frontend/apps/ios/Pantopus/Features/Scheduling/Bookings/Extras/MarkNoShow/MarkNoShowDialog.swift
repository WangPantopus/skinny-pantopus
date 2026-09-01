//
//  MarkNoShowDialog.swift
//  Pantopus
//
//  Stream I9 — E6 Mark No-Show. A compact centered confirmation dialog over a
//  dimmed Booking Detail. Present from a parent via
//  `.overlay { if showNoShow { MarkNoShowDialog(...) } }`. Renders 1:1 and
//  group (multi-select roster) variants, submitting + inline-error states.
//

import SwiftUI

struct MarkNoShowDialog: View {
    @State private var viewModel: MarkNoShowViewModel
    let onClose: () -> Void
    let onMarked: ([String]) -> Void

    init(
        viewModel: MarkNoShowViewModel,
        onClose: @escaping () -> Void,
        onMarked: @escaping ([String]) -> Void
    ) {
        _viewModel = State(wrappedValue: viewModel)
        self.onClose = onClose
        self.onMarked = onMarked
    }

    var body: some View {
        ExtrasDialog(isDismissable: !viewModel.isSubmitting, onDismiss: onClose) {
            ExtrasIconDisc(
                icon: .userX,
                background: Theme.Color.errorBg,
                foreground: Theme.Color.error
            )
            .padding(.bottom, Spacing.s3)

            Text(viewModel.isGroup ? "Who didn't show?" : "Mark as no-show?")
                .font(.system(size: 16.5, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.s2)

            if viewModel.isGroup {
                groupBody
            } else {
                Text("This closes the booking. You can still message the invitee or send a rebook link afterward.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(2)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, Spacing.s4)
            }

            if let message = viewModel.errorMessage {
                ExtrasInlineError(message: message)
                    .padding(.bottom, Spacing.s3)
            }

            buttons
        }
        .accessibilityIdentifier("scheduling.markNoShow")
    }

    // MARK: Group multi-select

    private var groupBody: some View {
        VStack(spacing: Spacing.s3) {
            Text("Select the attendees who didn't attend.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)

            VStack(spacing: 7) {
                ForEach(viewModel.targets) { target in
                    attendeeRow(target)
                }
            }

            noteField
        }
        .padding(.bottom, Spacing.s4)
    }

    private func attendeeRow(_ target: NoShowTarget) -> some View {
        let checked = viewModel.selectedIds.contains(target.bookingId)
        return Button {
            viewModel.toggle(target.bookingId)
        } label: {
            HStack(spacing: Spacing.s3) {
                avatar(target.initials)
                Text(target.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                checkbox(checked)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, Spacing.s2)
            .background(checked ? Theme.Color.errorBg : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(checked ? Theme.Color.errorLight : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isSubmitting)
        .accessibilityIdentifier("scheduling.markNoShow.attendee.\(target.bookingId)")
        .accessibilityAddTraits(checked ? .isSelected : [])
    }

    private func avatar(_ initials: String, size: CGFloat = 30) -> some View {
        Circle()
            .fill(viewModel.owner.theme.accent)
            .frame(width: size, height: size)
            .overlay(
                Text(initials)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
            )
    }

    private func checkbox(_ checked: Bool) -> some View {
        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
            .fill(checked ? Theme.Color.error : Theme.Color.appSurface)
            .frame(width: 21, height: 21)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .strokeBorder(checked ? Theme.Color.error : Theme.Color.appBorderStrong, lineWidth: 1.5)
            )
            .overlay {
                if checked { Icon(.check, size: 13, strokeWidth: 3, color: .white) }
            }
    }

    private var noteField: some View {
        @Bindable var viewModel = viewModel
        return TextField("Add a note (optional)", text: $viewModel.note, axis: .vertical)
            .font(.system(size: 12))
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 9)
            .frame(maxWidth: .infinity, minHeight: 38, alignment: .topLeading)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .disabled(viewModel.isSubmitting)
    }

    // MARK: Buttons

    private var buttons: some View {
        HStack(spacing: 9) {
            ExtrasGhostButton(title: "Keep open", isEnabled: !viewModel.isSubmitting) {
                onClose()
            }
            ExtrasSolidButton(
                title: viewModel.confirmTitle,
                tone: .destructive,
                isEnabled: viewModel.canConfirm,
                isBusy: viewModel.isSubmitting
            ) {
                Task {
                    let ids = Array(viewModel.selectedIds)
                    if await viewModel.confirm() {
                        onMarked(ids)
                        onClose()
                    }
                }
            }
        }
    }
}

#if DEBUG
#Preview("1:1") {
    Color.white.overlay {
        MarkNoShowDialog(
            viewModel: MarkNoShowViewModel(
                owner: .personal,
                targets: [NoShowTarget(bookingId: "b1", name: "Mara Reyes")],
                client: .shared
            ),
            onClose: {},
            onMarked: { _ in }
        )
    }
}

#Preview("Group") {
    Color.white.overlay {
        MarkNoShowDialog(
            viewModel: MarkNoShowViewModel(
                owner: .business(id: "biz"),
                targets: [
                    NoShowTarget(bookingId: "b1", name: "Jordan Liu"),
                    NoShowTarget(bookingId: "b2", name: "Sam Nguyen"),
                    NoShowTarget(bookingId: "b3", name: "Bea Dunn")
                ],
                client: .shared
            ),
            onClose: {},
            onMarked: { _ in }
        )
    }
}
#endif
