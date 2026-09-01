//
//  WaitlistManagementView.swift
//  Pantopus
//
//  Stream I9 — E13 Waitlist (host management). Capacity header over numbered
//  waitlist rows, each with a "Promote to seat" button (promote notifies the
//  invitee). Loading skeleton / empty / error+retry, offline banner. Owner-
//  polymorphic accent. Routed full screen (fills the E13 stub).
//

import SwiftUI

struct WaitlistManagementView: View {
    @State private var viewModel: WaitlistManagementViewModel

    init(viewModel: WaitlistManagementViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    private var theme: SchedulingIdentityTheme {
        viewModel.owner.theme
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Waitlist")
            .navigationBarTitleDisplayMode(.inline)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .refreshable { await viewModel.refresh() }
            .accessibilityIdentifier("scheduling.waitlist")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case .empty:
            EmptyState(
                icon: .clock,
                headline: "No one's waiting",
                subcopy: "When this event fills up, people who join the waitlist show up here.",
                tint: theme.accentBg,
                accent: theme.accent
            )
        case let .error(message):
            ErrorState(headline: "Couldn't load the waitlist", message: message) {
                await viewModel.refresh()
            }
        case .ready:
            loaded
        }
    }

    private var loaded: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CapacityHeaderCard(
                    filled: viewModel.displayedFilled,
                    total: viewModel.seatTotal,
                    waiting: viewModel.waitingCount,
                    accent: theme.accent
                )
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)

                ExtrasOverline(text: viewModel.sectionOverline)
                    .padding(.horizontal, Spacing.s4 + 2)
                    .padding(.top, Spacing.s4)
                    .padding(.bottom, Spacing.s2 + 1)

                VStack(spacing: Spacing.s2 + 1) {
                    ForEach(viewModel.entries) { person in
                        RosterRow(
                            initials: person.initials,
                            name: person.name,
                            meta: person.meta,
                            accent: theme.accent,
                            accentBackground: theme.accentBg,
                            promote: .init(isEnabled: !viewModel.isFull) {
                                if let entryId = person.promoteEntryId {
                                    Task { await viewModel.promote(entryId: entryId) }
                                }
                            }
                        )
                    }
                }
                .padding(.horizontal, Spacing.s4)

                if let actionError = viewModel.actionError {
                    ExtrasInlineError(message: actionError)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s3)
                }
            }
            .padding(.bottom, Spacing.s8)
        }
    }

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                Shimmer(height: 74, cornerRadius: Radii.xl)
                    .padding(.top, Spacing.s3)
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 84, cornerRadius: Radii.lg + 2)
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
    }
}
