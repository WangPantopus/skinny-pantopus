//
//  MailboxRootView.swift
//  Pantopus
//
//  The Mailbox, drawn as physical mail (Mail tab drawings, boards "Main",
//  "R1-Before", "R2-Delivery", "R4-NoMail"; reskinned in place from the B.1
//  Mailbox root): the side menu, "Mail" and search on top; your mailbox, your
//  address and today's round; the Me · Home · Biz drawers and the Incoming ·
//  Counter · Vault tabs; then the mail itself, each piece drawn as the object
//  it is (`MailPieceView`), by the day it came. No scanning: mail comes from
//  digital senders (founder decision 2026-10-26).
//

import SwiftUI

public struct MailboxRootView: View {
    @State private var viewModel: MailboxRootViewModel
    /// The Mail tab's top screen carries the side menu, as every tab's does;
    /// pushed anywhere else it has Back.
    private let showsMenuButton: Bool
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private static let heroAnchor = "mailboxHero"

    /// Split init (see GigsFeedView): avoids a Swift 6.1.2 / Xcode 16.4 SILGen
    /// crash in the defaulted-view-model argument generator. Behaviour is
    /// unchanged.
    public init(viewModel: MailboxRootViewModel) {
        self.init(viewModel: viewModel, showsMenuButton: false)
    }

    public init(viewModel: MailboxRootViewModel, showsMenuButton: Bool) {
        _viewModel = State(initialValue: viewModel)
        self.showsMenuButton = showsMenuButton
    }

    public init() {
        self.init(viewModel: MailboxRootViewModel())
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            // The header stays put; the mailbox and the mail scroll under it.
            topBar
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s0) {
                        MailboxHero(model: viewModel.hero, accountId: accountId)
                            .padding(.horizontal, Spacing.s4)
                            .padding(.top, 6)
                            .id(Self.heroAnchor)
                        if let hold = viewModel.vacationHold {
                            MailHoldBanner(hold: hold) { viewModel.openVacationHold() }
                                .padding(.horizontal, Spacing.s4)
                                .padding(.top, Spacing.s3)
                        }
                        MailboxRootHeader(viewModel: viewModel)
                        MailboxPieceList(viewModel: viewModel)
                            .padding(.bottom, Spacing.s6)
                    }
                }
                // Scrolling puts the Vault search's keyboard away.
                .scrollDismissesKeyboard(.immediately)
                .refreshable { await viewModel.refresh() }
                // A new round: back to the top, where the mailbox opens and
                // today's mail lies, wherever the list was left.
                .onChange(of: viewModel.hero.roundKey) { _, key in
                    guard MailboxHero.isNew(roundKey: key, accountId: accountId) else { return }
                    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25)) {
                        proxy.scrollTo(Self.heroAnchor, anchor: .top)
                    }
                }
            }
        }
        .overlay(alignment: .bottomTrailing) {
            // Writing letters (Mail extras, off for the first launch).
            if let fab = viewModel.fab {
                FABButton(action: fab)
                    .padding(Spacing.s4)
            }
        }
        .background(Theme.Color.appBg)
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
        // A container, so its buttons keep their own identifiers.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailboxRoot")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .refreshFailureToast($viewModel.refreshFailureMessage)
        .onReceive(NotificationCenter.default.publisher(for: .mailboxMailLeftList)) { note in
            if let mailId = note.object as? String { viewModel.dropLoadedMail(mailId) }
        }
        .onReceive(NotificationCenter.default.publisher(for: .mailboxMailViewed)) { note in
            if let mailId = note.object as? String { viewModel.markLoadedMailViewed(mailId) }
        }
        .onReceive(NotificationCenter.default.publisher(for: .mailboxMailChanged)) { _ in
            viewModel.markListStale()
        }
        .onAppear { Analytics.track(.screenMailboxRootViewed) }
    }

    private var accountId: String {
        if case let .signedIn(user) = AuthManager.shared.state { user.id } else { "" }
    }

    /// ☰ (or Back), "Mail", search, and the "…" menu.
    private var topBar: some View {
        HStack(spacing: Spacing.s1) {
            if showsMenuButton {
                NavigationMenuButton(accessibilityIdentifier: "mail.menu")
            } else {
                Button { dismiss() } label: {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("mailboxRootBack")
            }
            Text(viewModel.title)
                .font(.system(size: 30, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .accessibilityAddTraits(.isHeader)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: viewModel.openSearch) {
                Icon(.search, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Search all mail")
            .accessibilityIdentifier("mailboxRootSearch")
            moreMenu
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s1)
    }

    /// Stamps, vacation hold, mail tasks and Home records. No scanning and no
    /// map: mail comes from digital senders.
    private var moreMenu: some View {
        Menu {
            Button {
                viewModel.openMailTasks()
            } label: {
                Label("Mail tasks", systemImage: "checklist")
            }
            .accessibilityIdentifier("mailboxRootSettings.mailTasks")
            // Launch cut #8 (Mail extras): Mail party and the community
            // mail stream are hidden for the first launch.
            if LaunchFeatures.mailExtras {
                Button {
                    viewModel.openMailParty()
                } label: {
                    Label("Mail party", systemImage: "party.popper")
                }
                .accessibilityIdentifier("mailboxRootSettings.mailParty")
                Button {
                    viewModel.openCommunity()
                } label: {
                    Label("Community mail", systemImage: "megaphone")
                }
                .accessibilityIdentifier("mailboxRootSettings.community")
            }
            Button {
                viewModel.openRecords()
            } label: {
                Label("Home records", systemImage: "house")
            }
            .accessibilityIdentifier("mailboxRootSettings.homeRecords")
            Button {
                viewModel.openStamps()
            } label: {
                Label("Stamps", systemImage: "giftcard")
            }
            .accessibilityIdentifier("mailboxRootSettings.stamps")
            Button {
                viewModel.openVacationHold()
            } label: {
                Label("Hold my mail", systemImage: "calendar")
            }
            .accessibilityIdentifier("mailboxRootSettings.vacationHold")
        } label: {
            Icon(.moreVertical, size: 22, color: Theme.Color.appText)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("More mail options")
        .accessibilityIdentifier("mailboxRootSettings")
    }
}

/// The mail of the selected drawer and tab, or what to say instead: the
/// closed Home box, the Counter's tags and the Vault's folders.
private struct MailboxPieceList: View {
    let viewModel: MailboxRootViewModel

    var body: some View {
        if viewModel.isLive, viewModel.showsClosedHome, let home = viewModel.homesWaitingForProof.first {
            MailClosedHomeDrawer(
                home: home,
                onVerify: { viewModel.onVerifyHome?(home.homeId) },
                onGoToMe: { viewModel.selectDrawer(.me) }
            )
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s5)
        } else {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                // Christmas cards (holiday_cards): the way in, at the top of your own mail.
                if viewModel.showsChristmasCardRow, let cards = viewModel.christmasCards {
                    HolidayCardRow(cards: cards) { viewModel.openChristmasCards() }
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s4)
                }
                if viewModel.isLive, viewModel.selectedDrawer == .home, let waiting = viewModel.homesWaitingForProof.first {
                    MailHomeWaitingBanner(home: waiting) { viewModel.onVerifyHome?(waiting.homeId) }
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s4)
                }
                content
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            VStack(spacing: Spacing.s4) {
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 150, cornerRadius: Radii.sm)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, 18)
            .accessibilityLabel("Loading your mail")
        case .empty where viewModel.isLive && viewModel.currentTab == .vault:
            // The folders and the archive still show when nothing is filed here.
            MailVaultShelf(viewModel: viewModel, filedEmpty: true, hasMore: false)
        case let .empty(content):
            EmptyState(
                icon: content.icon,
                headline: content.headline,
                subcopy: content.subcopy,
                cta: content.ctaTitle.flatMap { title in
                    content.onCTA.map { handler in
                        EmptyState.CTA(title: title) { await MainActor.run { handler() } }
                    }
                }
            )
            .padding(.top, Spacing.s8)
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("mailboxRootEmpty")
        case let .error(message):
            ErrorState(headline: "Couldn't load your mail", message: message) {
                await viewModel.refresh()
            }
            .padding(.top, Spacing.s8)
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("mailboxRootError")
        case let .loaded(sections, hasMore):
            if viewModel.pieceSections.isEmpty {
                // The sample seam (previews and tests) has rows, not pieces.
                VStack(spacing: Spacing.s2) {
                    ForEach(sections.flatMap(\.rows)) { row in
                        RowView(row: row)
                    }
                }
                .padding(Spacing.s4)
            } else if viewModel.currentTab == .counter {
                MailCounterShelf(viewModel: viewModel, hasMore: hasMore)
            } else if viewModel.currentTab == .vault {
                MailVaultShelf(viewModel: viewModel, filedEmpty: false, hasMore: hasMore)
            } else {
                pieces(hasMore: hasMore)
            }
        }
    }

    private func pieces(hasMore: Bool) -> some View {
        LazyVStack(alignment: .leading, spacing: Spacing.s4) {
            ForEach(viewModel.pieceSections) { section in
                Text(section.title)
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.7)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, Spacing.s2)
                    .accessibilityAddTraits(.isHeader)
                ForEach(section.pieces) { piece in
                    MailPieceRow(piece: piece) { viewModel.openMail(piece.id) }
                        .onAppear {
                            if piece.id == viewModel.pieceSections.last?.pieces.last?.id {
                                Task { await viewModel.loadMoreIfNeeded() }
                            }
                        }
                }
            }
            MailLoadMoreFooter(viewModel: viewModel, hasMore: hasMore)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, 18)
    }
}

/// Under a list of mail: the next page's spinner, or why it didn't come.
struct MailLoadMoreFooter: View {
    let viewModel: MailboxRootViewModel
    let hasMore: Bool

    var body: some View {
        if let error = viewModel.loadMoreError {
            VStack(spacing: Spacing.s2) {
                Text(error)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                Button("Try again") { Task { await viewModel.retryLoadMore() } }
                    .font(.system(size: 14, weight: .semibold))
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("mailboxRootLoadMoreRetry")
            }
            .frame(maxWidth: .infinity)
        } else if hasMore {
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 44)
                .accessibilityLabel("Loading more mail")
        }
    }
}

/// A piece and the line under it, opening the piece.
struct MailPieceRow: View {
    let piece: MailPieceModel
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 6) {
                MailPieceView(model: piece)
                metaLine
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(MailPieceButtonStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(piece.spokenWithArrival)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("mailPiece.\(piece.id)")
        // The letter opens out of this piece and goes back into it.
        .itemZoomSource(.mailPiece, id: piece.id)
    }

    private var metaLine: some View {
        (Text(piece.meta.parts.joined(separator: " · "))
            + Text(piece.meta.due.map { " · \($0)" } ?? "")
            .foregroundColor(piece.meta.dueIsSettled ? Theme.Color.success : Theme.Color.warning)
            .fontWeight(.semibold))
            .font(.system(size: 13))
            .foregroundStyle(Theme.Color.appTextMuted)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Pressing a piece lifts it a little, like picking up an envelope.
struct MailPieceButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.985 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

#if DEBUG
// Previews drive the deterministic sample projection (the documented
// preview/test seam) by injecting `dataProvider` — the default init is the
// live path that fetches `GET /api/mailbox/v2/drawer/:drawer`.
#Preview("Me · Incoming") {
    NavigationStack {
        MailboxRootView(viewModel: MailboxRootViewModel(
            initialDrawer: .me,
            initialTab: .incoming,
            dataProvider: MailboxRootSampleData.sections
        ))
    }
}

#Preview("Biz · Counter") {
    NavigationStack {
        MailboxRootView(viewModel: MailboxRootViewModel(
            initialDrawer: .business,
            initialTab: .counter,
            dataProvider: MailboxRootSampleData.sections
        ))
    }
}

#Preview("Earn · empty") {
    NavigationStack {
        MailboxRootView(viewModel: MailboxRootViewModel(
            initialDrawer: .earn,
            initialTab: .incoming,
            dataProvider: MailboxRootSampleData.sections
        ))
    }
}
#endif
