//
//  AddGuestFormView.swift
//  Pantopus
//
//  A13.1 — Add Guest form. Issues a short-term guest pass for a home.
//  Presented as a full-screen modal (tab bar hidden) and built on the
//  shared `FormShell` archetype with a sticky "Send pass" CTA.
//

// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

public struct AddGuestFormView: View {
    @State private var viewModel: AddGuestFormViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var showsCustomRange = false
    @State private var customStart = Date()
    @State private var customEnd = Date().addingTimeInterval(86400)

    /// A13.6 — "Share this pass now?" confirm, raised the moment the
    /// create call returns the one-time token (RN parity:
    /// `src/app/homes/[id]/share.tsx:60-70`).
    @State private var shareOffer: GuestPassShare?
    /// Non-nil while the OS share sheet is presented.
    @State private var sharePayload: GuestPassShare?

    public init(viewModel: AddGuestFormViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        FormShell(
            title: "Add guest",
            rightActionLabel: nil,
            bottomActionLabel: "Send pass",
            bottomActionIcon: .keyRound,
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: commit,
            // swiftlint:disable:next trailing_closure
            content: {
                AddGuestFormContent(viewModel: viewModel)
            }
        )
        .toolbar(.hidden, for: .tabBar)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("addGuestForm")
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s12)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toast = nil
                    }
                    .transition(.opacity)
                    .accessibilityIdentifier("addGuestToast")
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .onChange(of: viewModel.duration) { _, newValue in
            guard newValue == AddGuestSampleData.durationCustomId else { return }
            customStart = viewModel.customStart ?? Date()
            customEnd = viewModel.customEnd ?? Date().addingTimeInterval(86400)
            showsCustomRange = true
        }
        .onChange(of: viewModel.shouldDismiss) { _, shouldDismiss in
            guard shouldDismiss else { return }
            viewModel.acknowledgeDismiss()
            Task {
                try? await Task.sleep(nanoseconds: 600_000_000)
                dismiss()
            }
        }
        .onChange(of: viewModel.createdShare) { _, share in
            shareOffer = share
        }
        .confirmationDialog(
            "Guest pass created",
            isPresented: Binding(
                get: { shareOffer != nil },
                set: { if !$0 { shareOffer = nil } }
            ),
            titleVisibility: .visible,
            presenting: shareOffer
        ) { offer in
            Button("Share") {
                shareOffer = nil
                // Let the dialog finish dismissing before the activity
                // controller presents — chaining them in the same runloop
                // tick drops the sheet on iOS.
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 250_000_000)
                    sharePayload = offer
                }
            }
            .accessibilityIdentifier("addGuest_shareNow")
            Button("Later", role: .cancel) {
                shareOffer = nil
                viewModel.acknowledgeShare()
            }
            .accessibilityIdentifier("addGuest_shareLater")
        } message: { _ in
            Text("Share this pass now?")
        }
        // Hosted on a zero-size background so it doesn't collide with the
        // custom-range `.sheet` attached to the same view below — SwiftUI
        // only honours one `.sheet` per view level.
        .background {
            Color.clear
                .sheet(
                    item: $sharePayload,
                    onDismiss: { viewModel.acknowledgeShare() }
                ) { payload in
                    SystemShareSheet(items: payload.activityItems)
                        .accessibilityIdentifier("addGuest_shareSheet")
                }
        }
        .sheet(isPresented: $showsCustomRange) {
            GuestDateRangeSheet(
                start: $customStart,
                end: $customEnd,
                onDone: {
                    viewModel.setCustomRange(customStart, customEnd)
                    showsCustomRange = false
                },
                onClear: {
                    viewModel.clearCustomRange()
                    showsCustomRange = false
                }
            )
            .presentationDetents([.medium])
        }
    }

    private func commit() {
        Task { await viewModel.submit() }
    }
}

// MARK: - Custom date-range picker sheet

private struct GuestDateRangeSheet: View {
    @Binding var start: Date
    @Binding var end: Date
    let onDone: () -> Void
    let onClear: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack {
                Text("Custom range")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Clear", action: onClear)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("customRange_clear")
            }
            .padding(Spacing.s4)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)

            VStack(alignment: .leading, spacing: Spacing.s4) {
                DatePicker(
                    "Starts",
                    selection: $start,
                    displayedComponents: [.date]
                )
                .accessibilityIdentifier("customRange_start")
                DatePicker(
                    "Ends",
                    selection: $end,
                    in: start...,
                    displayedComponents: [.date]
                )
                .accessibilityIdentifier("customRange_end")
            }
            .padding(Spacing.s4)

            Spacer(minLength: Spacing.s0)

            Button(action: onDone) {
                Text("Use these dates")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .padding(Spacing.s4)
            .accessibilityIdentifier("customRange_done")
        }
        .background(Theme.Color.appSurface)
    }
}

#Preview("Initial") {
    NavigationStack {
        AddGuestFormView(viewModel: AddGuestFormViewModel(homeId: "preview"))
    }
}

#Preview("Filled") {
    let viewModel = AddGuestFormViewModel(homeId: "preview")
    viewModel.updateName(AddGuestSampleData.Filled.name)
    viewModel.updateContact(AddGuestSampleData.Filled.contact)
    viewModel.duration = AddGuestSampleData.Filled.durationId
    viewModel.selectedAreas = AddGuestSampleData.Filled.areaIds
    viewModel.updateWelcome(AddGuestSampleData.Filled.welcome)
    return NavigationStack {
        AddGuestFormView(viewModel: viewModel)
    }
}
