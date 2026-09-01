//
//  CommunityMailView.swift
//  Pantopus
//
//  A17.4 — Community mail. The neighborhood / civic feed: a type-filter
//  chip row, pull-to-refresh, the four reaction types, RSVP on
//  neighborhood events, and flag-for-review behind a destructive confirm.
//
//  Four states per the Block 2F rule: shimmer skeleton, `EmptyState`,
//  loaded feed, `ErrorState` with Retry wired to `refresh()`.
//
//  Mirrors `ui/screens/mailbox/community/CommunityMailScreen.kt`.
//

import SwiftUI

public struct CommunityMailView: View {
    @State private var viewModel: CommunityMailViewModel

    public init(viewModel: CommunityMailViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            filterChips
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .accessibilityIdentifier("communityMail")
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .overlay(alignment: .bottom) { toastOverlay }
        .confirmationDialog(
            "Flag this item?",
            isPresented: Binding(
                get: { viewModel.pendingFlagItemId != nil },
                set: { if !$0 { viewModel.cancelFlag() } }
            ),
            titleVisibility: .visible
        ) {
            Button("Flag", role: .destructive) {
                Task { await viewModel.confirmFlag() }
            }
            .accessibilityIdentifier("communityMail_flagConfirm")
            Button("Cancel", role: .cancel) { viewModel.cancelFlag() }
        } message: {
            Text(flagMessage)
        }
    }

    private var flagMessage: String {
        if let title = viewModel.pendingFlagTitle {
            return "This will report \u{201C}\(title)\u{201D} for review."
        }
        return "This will report the item for review."
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: Spacing.s3) {
            Button(action: { viewModel.tapBack() }, label: {
                Icon(.arrowLeft, size: 20, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            })
            .buttonStyle(.plain)
            .accessibilityLabel("Back to Mailbox")
            .accessibilityIdentifier("communityMail_back")
            VStack(alignment: .leading, spacing: 1) {
                Text("Community Mail")
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

    private var subtitle: String {
        guard case let .loaded(_, total) = viewModel.state else {
            return "Your neighborhood feed"
        }
        return "\(total) item\(total == 1 ? "" : "s") in your neighborhood"
    }

    // MARK: - Filter chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(CommunityFeedFilter.allCases) { filter in
                    let active = viewModel.selectedFilter == filter
                    Button(action: { viewModel.selectFilter(filter) }, label: {
                        HStack(spacing: Spacing.s1) {
                            Icon(
                                filter.icon,
                                size: 14,
                                color: active
                                    ? Theme.Color.appTextInverse
                                    : Theme.Color.appTextSecondary
                            )
                            Text(filter.label)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(
                                    active
                                        ? Theme.Color.appTextInverse
                                        : Theme.Color.appTextSecondary
                                )
                        }
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, 6)
                        .background(active ? Theme.Color.business : Theme.Color.appSurfaceSunken)
                        .clipShape(Capsule())
                    })
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("communityMail_filter_\(filter.rawValue)")
                    .accessibilityAddTraits(active ? [.isSelected] : [])
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .frame(height: 44)
        .padding(.bottom, Spacing.s2)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            skeleton
        case let .loaded(items, _):
            feed(items)
        case .empty:
            ScrollView {
                EmptyState(
                    icon: .megaphone,
                    headline: "No community items",
                    subcopy: """
                    Civic notices, neighborhood events, and shared mail from your \
                    block will appear here.
                    """,
                    cta: EmptyState.CTA(title: "Refresh") {
                        await viewModel.refresh()
                    },
                    tint: Theme.Color.businessBg,
                    accent: Theme.Color.business
                )
                .frame(maxWidth: .infinity, minHeight: 360)
            }
            .refreshable { await viewModel.refresh() }
            .accessibilityIdentifier("communityMail_empty")
        case let .error(message):
            ScrollView {
                ErrorState(
                    headline: "Couldn't load community mail",
                    message: message
                ) {
                    await viewModel.refresh()
                }
                .frame(maxWidth: .infinity, minHeight: 360)
            }
            .refreshable { await viewModel.refresh() }
            .accessibilityIdentifier("communityMail_error")
        }
    }

    private func feed(_ items: [CommunityFeedItem]) -> some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s3) {
                ForEach(items) { item in
                    CommunityFeedCard(
                        item: item,
                        onReact: { reaction in
                            Task { await viewModel.react(itemId: item.id, reaction: reaction) }
                        },
                        onRsvp: {
                            Task { await viewModel.rsvp(itemId: item.id) }
                        },
                        onFlag: { viewModel.requestFlag(itemId: item.id) }
                    )
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s10)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("communityMail_feed")
    }

    private var skeleton: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                ForEach(0..<4, id: \.self) { _ in
                    FeedSkeletonCard(withTitle: true)
                        .padding(Spacing.s3)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .accessibilityIdentifier("communityMail_loading")
    }

    // MARK: - Toast

    @ViewBuilder
    private var toastOverlay: some View {
        if let toast = viewModel.toast {
            Text(toast)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appText.opacity(0.9))
                .clipShape(Capsule())
                .padding(.bottom, Spacing.s10)
                .accessibilityIdentifier("communityMail_toast")
                .task {
                    try? await Task.sleep(nanoseconds: 2_200_000_000)
                    viewModel.consumeToast()
                }
        }
    }
}
