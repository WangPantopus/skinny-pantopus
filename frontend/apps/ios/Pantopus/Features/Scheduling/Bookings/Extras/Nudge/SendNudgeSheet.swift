//
//  SendNudgeSheet.swift
//  Pantopus
//
//  Stream I9 — E11 Send a Nudge. A bottom sheet reusing the SendUpdateForm
//  idiom: message composer + char counter, single-select audience chips with
//  recipient counts, Push/Email channel toggles, and a recipient-count CTA.
//  Present from a parent via `.sheet(isPresented:)`.
//

import SwiftUI

struct SendNudgeSheet: View {
    @State private var viewModel: SendNudgeViewModel
    let onClose: () -> Void

    init(viewModel: SendNudgeViewModel, onClose: @escaping () -> Void) {
        _viewModel = State(wrappedValue: viewModel)
        self.onClose = onClose
    }

    private var theme: SchedulingIdentityTheme {
        viewModel.owner.theme
    }

    var body: some View {
        ZStack {
            sheetBody
            if viewModel.didSend { successOverlay }
        }
        .background(Theme.Color.appSurface)
        .presentationDetents([.large])
        .presentationDragIndicator(.hidden)
        .accessibilityIdentifier("scheduling.sendNudge")
        .task(id: viewModel.didSend) {
            guard viewModel.didSend else { return }
            try? await Task.sleep(for: .seconds(1.3))
            onClose()
        }
    }

    private var sheetBody: some View {
        VStack(spacing: 0) {
            ExtrasSheetGrabber()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    header
                    composer
                    audienceSection
                    channels
                    if let message = viewModel.errorMessage {
                        ExtrasInlineError(message: message)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s1)
                .padding(.bottom, Spacing.s3)
            }
            ExtrasStickyFooter {
                ExtrasSolidButton(
                    title: viewModel.ctaTitle,
                    icon: .send,
                    accent: theme.accent,
                    isEnabled: viewModel.canSend,
                    isBusy: viewModel.isSending
                ) {
                    Task { await viewModel.send() }
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Message attendees")
                .font(.system(size: 16.5, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(viewModel.eventSubtitle)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var composer: some View {
        @Bindable var viewModel = viewModel
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            ExtrasChipButton(title: "Use a template", icon: .fileText, accent: theme.accent) {
                Task { await viewModel.presentTemplatePicker() }
            }
            .confirmationDialog(
                "Use a template",
                isPresented: $viewModel.isTemplatePickerPresented,
                titleVisibility: .visible
            ) {
                ForEach(viewModel.templates) { template in
                    Button(template.name) { viewModel.apply(template) }
                }
            }
            ExtrasMessageBox(
                text: $viewModel.message,
                placeholder: "Write a message to your attendees…",
                minHeight: 96,
                limit: viewModel.characterLimit
            )
            if viewModel.isOverLimit {
                HStack(spacing: Spacing.s1 + 1) {
                    Icon(.alertCircle, size: 13, color: Theme.Color.error)
                    Text("Shorten your message")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.error)
                }
            }
        }
    }

    private var audienceSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2 + 1) {
            ExtrasOverline(text: "Audience")
            ExtrasFlowLayout {
                ForEach(NudgeAudience.allCases) { audience in
                    ExtrasPillChip(
                        title: audience.label,
                        count: viewModel.counts.count(for: audience),
                        isSelected: audience == viewModel.audience,
                        selectedForeground: theme.accent,
                        selectedBackground: theme.accentBg
                    ) {
                        viewModel.select(audience)
                    }
                }
            }
            if !viewModel.hasRecipients {
                HStack(spacing: Spacing.s2) {
                    Icon(.usersRound, size: 15, color: Theme.Color.appTextMuted)
                    Text("No one to message in this group")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
        }
    }

    private var channels: some View {
        @Bindable var viewModel = viewModel
        return VStack(spacing: Spacing.s2 + 1) {
            ExtrasChannelRow(icon: .bell, label: "Push", isOn: $viewModel.pushOn, accent: theme.accent)
            ExtrasChannelRow(icon: .mail, label: "Email", isOn: $viewModel.emailOn, accent: theme.accent)
        }
    }

    private var successOverlay: some View {
        ZStack {
            VStack(spacing: Spacing.s4) {
                ExtrasIconDisc(
                    icon: .check,
                    background: Theme.Color.successBg,
                    foreground: Theme.Color.success,
                    diameter: 72
                )
                Text("Update sent")
                    .font(.system(size: 16.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            VStack {
                Spacer()
                sentToast
                    .padding(.horizontal, Spacing.s4)
                    .padding(.bottom, Spacing.s8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurface)
        .transition(.opacity)
    }

    /// Dark bottom toast bar — "Update sent to N attendees" with a success check.
    private var sentToast: some View {
        HStack(spacing: Spacing.s2 + 2) {
            Icon(.checkCircle2, size: 18, color: Theme.Color.successLight)
            Text(viewModel.sentConfirmation)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(.white)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s3 + 2)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appText)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 1, style: .continuous))
        .shadow(color: Theme.Color.appText.opacity(0.3), radius: 12, y: 8)
    }
}

#if DEBUG
#Preview {
    Color.black.sheet(isPresented: .constant(true)) {
        SendNudgeSheet(
            viewModel: SendNudgeViewModel(
                owner: .personal,
                bookingId: "b1",
                eventTitle: "Group class",
                eventSubtitle: "Group class · Sat, Jun 14",
                counts: NudgeAudienceCounts(all: 12, confirmed: 10, noShows: 0),
                client: .shared
            )
        ) {}
    }
}
#endif
