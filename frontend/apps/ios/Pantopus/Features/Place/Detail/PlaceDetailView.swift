//
//  PlaceDetailView.swift
//  Pantopus
//
//  The Place group-detail container (W2.3). One curated group per page,
//  reached by tapping a dashboard card. Sticky header + a scroll of the
//  group's sections rendered in the designed detail layouts; degrades
//  section-by-section per the contract envelope. Ported from the
//  `place-*-detail.jsx` design kit.
//

import SwiftUI

struct PlaceDetailView: View {
    @State private var viewModel: PlaceDetailViewModel
    var onBack: () -> Void

    init(viewModel: PlaceDetailViewModel, onBack: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
        .sheet(isPresented: $viewModel.showVerify) {
            PlaceVerifySheet(
                address: verifyAddress,
                homeId: viewModel.savedPlaceId == nil ? viewModel.homeId : nil,
                onStart: { method in
                    viewModel.showVerify = false
                    viewModel.onStartVerify?(method)
                },
                onClose: { viewModel.showVerify = false }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
        }
    }

    private var verifyAddress: String {
        if case let .loaded(intel) = viewModel.state { return intel.place.label }
        return ""
    }

    private var header: some View {
        PlaceDetailHeader(
            title: viewModel.group.title,
            address: headerAddress,
            onBack: onBack
        )
    }

    private var headerAddress: String {
        if case let .loaded(intel) = viewModel.state { return placeDetailAddress(intel.place) }
        return ""
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            PlaceDetailSkeleton()
        case let .loaded(intel):
            if intel.leavesOut(viewModel.group) {
                // The server leaves out what doesn't apply to this viewer;
                // a link to it gets a straight answer, not empty cards.
                notForViewer(role: intel.viewer?.role)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        groupContent(intel)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, Spacing.s10)
                }
            }
        case let .error(message):
            if viewModel.accessDenied {
                PlaceDeniedState()
            } else {
                ErrorState(message: message) { await viewModel.refresh() }
            }
        }
    }

    /// What a viewer is told on a detail page that isn't part of their view of a Home.
    private func notForViewer(role: String?) -> some View {
        let guest = role == "nonresident"
        let headline = if !guest {
            "Money signals are for the owner or renter"
        } else if viewModel.group == .money {
            "Money signals are for the household"
        } else {
            "Home records are for the household"
        }
        let subcopy = guest
            ? "Guests and service providers see this address's public information: "
            + "today, risk and readiness, the block and civic details."
            : "Bill comparisons, rent and property-tax checks belong to whoever owns or rents this home. "
            + "Your Place still shows the home's details, its risks and today's conditions."
        let back = onBack
        return EmptyState(
            icon: .mapPin,
            headline: headline,
            subcopy: subcopy,
            cta: .init(title: "Back to your Place") { back() }
        )
        .accessibilityIdentifier("place.detail.notForViewer")
    }

    @ViewBuilder
    private func groupContent(_ intel: PlaceIntelligence) -> some View {
        switch viewModel.group {
        case .today: PlaceTodayDetailContent(intel: intel, vm: viewModel)
        case .yourHome: PlaceHomeDetailContent(intel: intel, vm: viewModel)
        case .risk: PlaceRiskDetailContent(intel: intel, vm: viewModel)
        case .block: PlaceBlockDetailContent(intel: intel, vm: viewModel)
        case .money: PlaceMoneyDetailContent(intel: intel, vm: viewModel)
        case .civic: PlaceCivicDetailContent(intel: intel, vm: viewModel)
        case .identity: PlaceIdentityDetailContent(intel: intel, vm: viewModel)
        }
    }
}

// MARK: - Detail skeleton

struct PlaceDetailSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                PlaceSkeleton(width: 96, height: 11)
                    .padding(.top, 26)
                ForEach(0..<3, id: \.self) { _ in
                    PlaceSkeleton(widthFraction: 1, height: 96, radius: 16)
                }
            }
            .padding(.horizontal, 16)
        }
        .accessibilityLabel("Loading section details")
    }
}

// MARK: - Shared section helpers used across detail pages

extension PlaceDetailViewModel {
    /// A detail "fallback" card for a section with no bespoke layout:
    /// the live value/caption (or the unavailable copy) + the provider.
    @ViewBuilder
    func fallbackCard(_ env: PlaceSectionEnvelope) -> some View {
        let cfg = PlacePresentation.config(for: env.id)
        if env.access == .locked {
            // Before verification every lock is the verify-by-mail step; a lock
            // waiting on the ownership review (T3/T4) has nothing to tap.
            PlaceLockedCard(
                icon: cfg.icon,
                title: cfg.title,
                reason: PlacePresentation.lockReason(env),
                cta: PlacePresentation.lockCta(env.band, verifiesFirst: verifiesFirst),
                onTap: verifiesFirst || env.band == .d ? verifyAction : nil
            )
        } else {
            liveOrUnavailableCard(env, cfg: cfg)
        }
    }

    @ViewBuilder
    private func liveOrUnavailableCard(_ env: PlaceSectionEnvelope, cfg: PlaceSectionDisplayConfig) -> some View {
        let state = PlacePresentation.cardState(env)
        let isLive = state == .loaded || state == .stale
        let reading = isLive ? PlacePresentation.reading(for: env) : PlaceSectionReading()
        // "Try again" on a section that failed to load re-reads this page.
        let retry: () -> Void = { Task { await self.refresh() } }
        PlaceSectionCard(
            icon: cfg.icon,
            title: cfg.title,
            asOf: isLive ? PlacePresentation.asOf(for: env) : nil,
            state: state,
            value: reading.value,
            caption: state == .unavailable ? env.unavailableReason : reading.caption,
            chip: reading.chip,
            statusDot: reading.statusDot,
            sparkline: false,
            inline: false,
            onTap: nil,
            onRetry: retry
        )
    }
}
