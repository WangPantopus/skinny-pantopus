//
//  WaitingRoomView.swift
//  Pantopus
//
//  A18.4 — the persistent waiting room. Bespoke single-frame layout that
//  reuses the A18.2/A18.3 ceremonial primitives (`HaloCircle`,
//  `StatusTimelineView`, `StatusPillView`) but adds the room-only chrome the
//  one-shot `StatusWaitingView` doesn't carry: a back-chevron + bell top bar,
//  a monospace claim-ref address row, an optional reviewer-note card, and a
//  2-column "Manage this claim" inline-action grid.
//
//  Pure presentational — the caller (`WaitingRoomViewModel`) owns the content
//  + the stubbed action handlers; `onBack` is the only live navigation.
//

import SwiftUI

public struct WaitingRoomView: View {
    @State private var viewModel: WaitingRoomViewModel
    private let onBack: @MainActor () -> Void
    private let onNav: @MainActor (WaitingRoomNav) -> Void

    public init(
        viewModel: WaitingRoomViewModel,
        onBack: @escaping @MainActor () -> Void = {},
        onNav: @escaping @MainActor (WaitingRoomNav) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onNav = onNav
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            WaitingRoomTopBar(
                title: topBarTitle,
                onBack: onBack
            ) {
                viewModel.openNotifications()
            }
            switch viewModel.phase {
            case .loading:
                WaitingRoomLoadingFrame()
            case let .verification(content):
                // RN's Verification Center — served on the same route
                // when the caller has no claim in review but their
                // occupancy still isn't verified.
                HomeVerificationFrame(
                    content: content,
                    onAction: { viewModel.handleVerificationAction($0) },
                    onDone: onBack
                )
            case let .notice(notice):
                WaitingRoomNoticeFrame(notice: notice) {
                    if notice.isRetry {
                        Task { await viewModel.refresh() }
                    } else {
                        onBack()
                    }
                }
            case let .approved(content):
                // A18.2 "You're the owner". `StatusWaitingView` carries its
                // own sticky dock, so no extra chrome is added here.
                StatusWaitingView(
                    content: content,
                    onPrimary: { viewModel.handlePrimary($0) },
                    onSecondary: { viewModel.handleSecondary($0) }
                )
                .accessibilityIdentifier("waitingRoomApproved")
            case .loaded:
                loadedFrame
            }
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("waitingRoom")
        .task { await viewModel.refresh() }
        .onChange(of: viewModel.pendingNav) { _, nav in
            guard let nav else { return }
            onNav(nav)
            viewModel.consumeNav()
        }
    }

    // MARK: - Body slots

    /// The Verification Center frame retitles the bar; every other phase
    /// keeps the claim room's "Waiting for approval".
    private var topBarTitle: String {
        if case .verification = viewModel.phase {
            return HomeVerificationContent.screenTitle
        }
        return viewModel.content.title
    }

    @ViewBuilder
    private var loadedFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s5) {
                HaloCircle(
                    tone: viewModel.content.halo.tone,
                    icon: viewModel.content.halo.icon,
                    isPulsing: viewModel.content.halo.isPulsing
                )
                .padding(.top, Spacing.s2)
                headlineBlock
                addressRow
                if let note = viewModel.content.reviewerNote {
                    WaitingRoomReviewerNoteCard(note: note)
                }
                timelineCard
                StatusPillView(pill: viewModel.content.etaPill)
                manageSection
                Spacer(minLength: Spacing.s4)
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.vertical, Spacing.s4)
            .frame(maxWidth: .infinity)
        }
        stickyDock
    }

    private var headlineBlock: some View {
        VStack(spacing: Spacing.s2) {
            Text(viewModel.content.headline)
                .font(.system(size: 23, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("waitingRoomHeadline")
            Text(viewModel.content.subcopy)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 290)
                .accessibilityIdentifier("waitingRoomSubcopy")
        }
        .frame(maxWidth: .infinity)
    }

    private var addressRow: some View {
        WaitingRoomAddressRow(
            address: viewModel.content.address,
            claimRef: viewModel.content.claimRef
        )
    }

    private var timelineCard: some View {
        StatusTimelineView(
            stages: viewModel.content.timeline,
            currentStageId: nil,
            paused: viewModel.content.timelinePaused
        )
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("waitingRoomTimeline")
    }

    private var manageSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(viewModel.content.manageSectionTitle.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextMuted)
                .kerning(0.6)
                .frame(maxWidth: .infinity, alignment: .leading)
            WaitingRoomInlineActionGrid(
                actions: viewModel.content.inlineActions
            ) {
                viewModel.handleInlineAction($0)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("waitingRoomManage")
    }

    private var stickyDock: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            VStack(spacing: Spacing.s2) {
                Button { viewModel.handlePrimary(viewModel.content.primaryCta) } label: {
                    HStack(spacing: 7) {
                        if let icon = viewModel.content.primaryCta.icon {
                            Icon(icon, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                        }
                        Text(viewModel.content.primaryCta.label)
                            .font(.system(size: 14.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .shadow(color: Theme.Color.primary600.opacity(0.3), radius: 9, x: 0, y: 8)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("waitingRoomPrimaryCta")

                Button {
                    viewModel.handleSecondary(viewModel.content.secondaryCta)
                    onBack()
                } label: {
                    Text(viewModel.content.secondaryCta.label)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("waitingRoomSecondaryCta")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s6)
            .background(Theme.Color.appSurface)
        }
    }
}

// MARK: - Previews

#Preview("A18.4 Active wait") {
    WaitingRoomView(viewModel: WaitingRoomViewModel(homeId: "home-1", state: .active))
}

#Preview("A18.4 More info requested") {
    WaitingRoomView(viewModel: WaitingRoomViewModel(homeId: "home-1", state: .moreInfoRequested))
}
