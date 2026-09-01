//
//  MailRoutingQueueView.swift
//  Pantopus
//
//  "Who is this mail for?" — one card per unresolved `MailRoutingQueue`
//  row. Opened from the Mailbox root's "N items need routing" banner.
//  Layout follows the A13 Form archetype (FormShell + sticky CTA), the
//  same scaffold the A13.15 Disambiguate form uses.
//

import SwiftUI

// swiftlint:disable multiple_closures_with_trailing_closure

@MainActor
struct MailRoutingQueueView: View {
    @State private var viewModel: MailRoutingQueueViewModel
    private let onClose: @MainActor () -> Void

    /// Split init (see `GigsFeedView` / `MailboxRootView`): avoids the
    /// Swift 6.1.2 / Xcode 16.4 SILGen crash in the defaulted-view-model
    /// argument generator.
    init(
        viewModel: MailRoutingQueueViewModel,
        onClose: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
    }

    init(onClose: @escaping @MainActor () -> Void) {
        self.init(viewModel: MailRoutingQueueViewModel(), onClose: onClose)
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            FormShell(
                title: "Route this mail",
                subtitle: viewModel.counterLabel,
                leading: .back,
                rightActionLabel: nil, // sticky CTA owns submit
                isValid: false,
                isDirty: false,
                isSaving: false,
                onClose: onClose,
                onCommit: {}
            ) {
                stateBody(for: viewModel.state)
            }
            if case .loaded = viewModel.state {
                stickyConfirm
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("mailRoutingQueue")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .overlay(alignment: .bottom) { toastOverlay }
        .task { await viewModel.load() }
        .onChange(of: viewModel.shouldDismiss) { _, dismiss in
            if dismiss {
                viewModel.acknowledgeDismiss()
                onClose()
            }
        }
    }

    // MARK: - States

    @ViewBuilder
    private func stateBody(for state: MailRoutingQueueState) -> some View {
        switch state {
        case .loading:
            loadingSkeleton
        case .empty:
            EmptyState(
                icon: .checkCircle,
                headline: "All clear",
                subcopy: "No items need routing.",
                cta: EmptyState.CTA(title: "Back to Mailbox") {
                    await MainActor.run { onClose() }
                }
            )
            .padding(.top, Spacing.s10)
            .accessibilityIdentifier("mailRoutingQueueEmpty")
        case let .loaded(entry):
            loadedBody(entry)
        case let .error(message):
            errorBody(message)
        }
    }

    private var loadingSkeleton: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Shimmer(width: 200, height: 22, cornerRadius: Radii.xs)
            Shimmer(height: 76, cornerRadius: Radii.lg)
            Shimmer(height: 64, cornerRadius: Radii.lg)
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(height: 62, cornerRadius: Radii.lg)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("mailRoutingQueueLoading")
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Text("Couldn't load the routing queue")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Retry") { await viewModel.refresh() }
                .padding(.top, Spacing.s2)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s10)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("mailRoutingQueueError")
    }

    // MARK: - Loaded

    private func loadedBody(_ entry: MailRoutingQueueEntry) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Who is this mail for?")
                    .pantopusTextStyle(.h2)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("We received mail addressed to:")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            nameCard(entry)
            if !entry.previewText.isEmpty || !entry.senderDisplay.isEmpty {
                previewCard(entry)
            }
            Text("IS THIS FOR:")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: Spacing.s2) {
                ForEach(MailRoutingDrawerOption.allCases) { option in
                    optionRow(option)
                }
            }
            if viewModel.showsAliasToggle {
                aliasRow
            }
        }
        .padding(.horizontal, Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func nameCard(_ entry: MailRoutingQueueEntry) -> some View {
        VStack(spacing: Spacing.s1) {
            Text("\u{201C}\(entry.recipientName)\u{201D}")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("at your address")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("mailRoutingQueueRecipient")
    }

    private func previewCard(_ entry: MailRoutingQueueEntry) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(entry.senderDisplay)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            if !entry.previewText.isEmpty {
                Text(entry.previewText)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("mailRoutingQueuePreview")
    }

    private func optionRow(_ option: MailRoutingDrawerOption) -> some View {
        let isSelected = viewModel.isSelected(option)
        return Button {
            viewModel.select(option)
        } label: {
            HStack(spacing: Spacing.s3) {
                RadioDot(isSelected: isSelected)
                Icon(
                    option.icon,
                    size: 18,
                    color: isSelected ? Theme.Color.appText : Theme.Color.appTextMuted
                )
                VStack(alignment: .leading, spacing: 1) {
                    Text(option.label)
                        .font(.system(size: 14, weight: isSelected ? .bold : .medium))
                        .foregroundStyle(Theme.Color.appText)
                    Text(option.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
            .background(isSelected ? Theme.Color.successBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.success : Theme.Color.appBorder,
                        lineWidth: isSelected ? 1.5 : 1
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("mailRoutingQueueOption.\(option.rawValue)")
    }

    private var aliasRow: some View {
        Toggle(isOn: Binding(
            get: { viewModel.addAlias },
            set: { viewModel.addAlias = $0 }
        )) {
            VStack(alignment: .leading, spacing: 2) {
                Text(viewModel.aliasLabel)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("So future mail with this name routes automatically")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .tint(Theme.Color.success)
        .padding(Spacing.s3)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .accessibilityIdentifier("mailRoutingQueueAliasToggle")
    }

    // MARK: - Sticky CTA

    private var stickyConfirm: some View {
        VStack(spacing: Spacing.s2) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            PrimaryButton(
                title: "Route it",
                isLoading: viewModel.isSubmitting,
                isEnabled: viewModel.canSubmit
            ) { await viewModel.submit() }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s4)
                .accessibilityIdentifier("mailRoutingQueueConfirm")
        }
        .padding(.top, Spacing.s2)
        .background(Theme.Color.appSurface)
    }

    // MARK: - Toast

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s12)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
        }
    }
}

/// Radio dot used by the drawer-choice rows.
private struct RadioDot: View {
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    isSelected ? Theme.Color.success : Theme.Color.appBorderStrong,
                    lineWidth: 2
                )
                .frame(width: 20, height: 20)
            if isSelected {
                Circle()
                    .fill(Theme.Color.success)
                    .frame(width: 10, height: 10)
            }
        }
        .accessibilityHidden(true)
    }
}
