//
//  MailPartyView.swift
//  Pantopus
//
//  Family Mail Party — two frames behind one view-model. The discover
//  frame lists the household's live sessions plus the Home-drawer items a
//  party can start from; joining or starting swaps in the live-session
//  frame (reactions + hand-it-to roster).
//
//  Both frames ship the four states (`Features/…` state rule): shimmer
//  skeleton, `EmptyState`, loaded body, `ErrorState` with Retry.
//
//  Mirrors `ui/screens/mailbox/mail_party/MailPartyScreen.kt`.
//

import SwiftUI

// swiftlint:disable type_body_length

@MainActor
struct MailPartyView: View {
    @State private var viewModel: MailPartyViewModel
    private let onClose: @MainActor () -> Void

    /// Split init (see `MailRoutingQueueView`): avoids the Swift 6.1.2 /
    /// Xcode 16.4 SILGen crash in the defaulted-view-model argument
    /// generator.
    init(viewModel: MailPartyViewModel, onClose: @escaping @MainActor () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
    }

    init(
        onOpenMail: @escaping (String) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.init(
            viewModel: MailPartyViewModel(onOpenMail: onOpenMail),
            onClose: onClose
        )
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            if viewModel.live != nil {
                liveFrame
            } else {
                discoverFrame
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .accessibilityIdentifier("mailParty")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .overlay(alignment: .bottom) { toastOverlay }
        .task { await viewModel.load() }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: Spacing.s3) {
            Button(action: { Task { await tapBack() } }, label: {
                Icon(.arrowLeft, size: 20, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            })
            .buttonStyle(.plain)
            .accessibilityLabel(viewModel.live == nil ? "Back to Mailbox" : "Leave this party")
            .accessibilityIdentifier("mailParty_back")
            VStack(alignment: .leading, spacing: 1) {
                Text("Mail Party")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s2)
    }

    /// The live frame owns Back while it is up, so leaving a party lands
    /// on the discover list rather than popping the whole screen.
    private func tapBack() async {
        if viewModel.live == nil {
            onClose()
        } else {
            await viewModel.closeSession()
        }
    }

    private var subtitle: String {
        guard let session = viewModel.liveSession else {
            return viewModel.discoverSubtitle
        }
        return session.status.label
    }

    // MARK: - Discover frame

    @ViewBuilder
    private var discoverFrame: some View {
        switch viewModel.discover {
        case .loading:
            skeleton
                .accessibilityIdentifier("mailParty_discoverLoading")
        case .empty:
            EmptyState(
                icon: .partyPopper,
                headline: "No mail party right now",
                subcopy: "Household mail lands in your Home drawer. When something "
                    + "arrives worth opening together, start a party here.",
                cta: EmptyState.CTA(title: "Refresh") { await viewModel.refresh() },
                tint: Theme.Color.homeBg,
                accent: Theme.Color.home
            )
            .accessibilityIdentifier("mailParty_discoverEmpty")
        case let .loaded(sessions, startable):
            discoverBody(sessions: sessions, startable: startable)
        case let .error(message):
            ErrorState(
                headline: "Couldn't load mail parties",
                message: message
            ) {
                await viewModel.refresh()
            }
            .accessibilityIdentifier("mailParty_discoverError")
        }
    }

    private func discoverBody(
        sessions: [MailPartySessionCard],
        startable: [MailPartyStartableItem]
    ) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                if !sessions.isEmpty {
                    sectionHeader("HAPPENING NOW")
                    VStack(spacing: Spacing.s2) {
                        ForEach(sessions) { session in
                            sessionCard(session)
                        }
                    }
                }
                if !startable.isEmpty {
                    sectionHeader("START A PARTY")
                    VStack(spacing: Spacing.s2) {
                        ForEach(startable) { item in
                            startableRow(item)
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("mailParty_discoverList")
    }

    private func sessionCard(_ session: MailPartySessionCard) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: Spacing.s2) {
                    Text(session.title)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                    Spacer(minLength: Spacing.s0)
                    StatusChip(
                        session.status.label,
                        variant: session.status == .active ? .success : .warning
                    )
                }
                Text(session.senderDisplay)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            HStack(spacing: Spacing.s2) {
                CompactButton(title: "Join", variant: .primary, size: .footer) {
                    Task { await viewModel.join(session) }
                }
                .accessibilityIdentifier("mailParty_join.\(session.id)")
                CompactButton(title: "Open solo", variant: .ghost, size: .footer) {
                    Task { await viewModel.decline(session) }
                }
                .accessibilityIdentifier("mailParty_decline.\(session.id)")
            }
            .disabled(!viewModel.canStart)
            .opacity(viewModel.canStart ? 1 : 0.5)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("mailParty_session.\(session.id)")
    }

    private func startableRow(_ item: MailPartyStartableItem) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.homeBg)
                Icon(.mailbox, size: 16, strokeWidth: 2.2, color: Theme.Color.home)
            }
            .frame(width: 32, height: 32)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(item.senderDisplay)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
            CompactButton(title: "Start", variant: .primary, size: .inlineAction) {
                Task { await viewModel.startParty(with: item) }
            }
            .accessibilityIdentifier("mailParty_start.\(item.id)")
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .disabled(!viewModel.canStart)
        .opacity(viewModel.canStart ? 1 : 0.5)
        .accessibilityIdentifier("mailParty_startable.\(item.id)")
    }

    // MARK: - Live-session frame

    @ViewBuilder
    private var liveFrame: some View {
        if let live = viewModel.live {
            switch live {
            case .loading:
                skeleton
                    .accessibilityIdentifier("mailParty_sessionLoading")
            case let .empty(session):
                liveBody(session, rosterIsEmpty: true)
            case let .loaded(session):
                liveBody(session, rosterIsEmpty: false)
            case let .error(message):
                ErrorState(
                    headline: "Couldn't open the party",
                    message: message
                ) {
                    await viewModel.retryLiveSession()
                }
                .accessibilityIdentifier("mailParty_sessionError")
            }
        }
    }

    private func liveBody(_ session: MailPartyLiveSession, rosterIsEmpty: Bool) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                openingCard(session)
                sectionHeader("REACT")
                reactionRow
                sectionHeader("HAND IT TO")
                if rosterIsEmpty {
                    rosterEmptyCard
                } else {
                    VStack(spacing: Spacing.s2) {
                        ForEach(session.members) { member in
                            memberRow(member)
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityIdentifier("mailParty_session")
    }

    private func openingCard(_ session: MailPartyLiveSession) -> some View {
        VStack(spacing: Spacing.s2) {
            Icon(.partyPopper, size: 28, color: Theme.Color.primary600)
                .accessibilityHidden(true)
            Text(session.title)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(session.senderDisplay)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            StatusChip(
                session.status.label,
                variant: session.status == .active ? .success : .warning
            )
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
        .accessibilityIdentifier("mailParty_sessionHeader")
    }

    private var reactionRow: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(MailPartyReaction.allCases) { reaction in
                Button(action: { Task { await viewModel.send(reaction) } }, label: {
                    Text(reaction.glyph)
                        .font(.system(size: 22))
                        .frame(width: 48, height: 48)
                        .background(Theme.Color.appSurface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
                })
                .buttonStyle(.plain)
                .disabled(viewModel.sendingReaction != nil)
                .accessibilityLabel(reaction.label)
                .accessibilityIdentifier("mailParty_reaction.\(reaction.rawValue)")
            }
            Spacer(minLength: Spacing.s0)
            if let echo = viewModel.reactionEcho {
                Text(echo.glyph)
                    .font(.system(size: 20))
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 36)
                    .background(Theme.Color.successBg)
                    .clipShape(Capsule())
                    .accessibilityLabel("You reacted")
                    .accessibilityIdentifier("mailParty_reactionEcho")
                    .task(id: echo.id) {
                        try? await Task.sleep(
                            nanoseconds: UInt64(max(echo.ttlSeconds, 1)) * 1_000_000_000
                        )
                        viewModel.clearReactionEcho()
                    }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var rosterEmptyCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("No one to hand this to")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("Only household members can take this item. Invite someone to your home first.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("mailParty_rosterEmpty")
    }

    private func memberRow(_ member: MailPartyMember) -> some View {
        let busy = viewModel.isAssigning(member)
        return Button(action: { Task { await viewModel.assign(to: member) } }, label: {
            HStack(spacing: Spacing.s3) {
                Icon(.user, size: 18, color: Theme.Color.appTextMuted)
                VStack(alignment: .leading, spacing: 1) {
                    Text(member.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if let roleLabel = member.roleLabel {
                        Text(roleLabel)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
                Spacer(minLength: Spacing.s0)
                if busy {
                    ProgressView()
                        .tint(Theme.Color.primary600)
                } else {
                    Icon(.chevronRight, size: 14, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .contentShape(Rectangle())
        })
        .buttonStyle(.plain)
        .disabled(viewModel.assigningMemberId != nil)
        .accessibilityLabel("Hand it to \(member.name)")
        .accessibilityIdentifier("mailParty_assign.\(member.id)")
    }

    // MARK: - Shared chrome

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .pantopusTextStyle(.overline)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .accessibilityAddTraits(.isHeader)
    }

    private var skeleton: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(width: 160, height: 14, cornerRadius: Radii.xs)
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(height: 84, cornerRadius: Radii.lg)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

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
