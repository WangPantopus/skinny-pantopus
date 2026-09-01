//
//  PlaceLaunchView.swift
//  Pantopus
//
//  A1 / A2 / C0 / A6 — the signed-out acquisition funnel and the app's
//  front door (per the product model: lead with the address payoff,
//  defer the wall, keep Sign in one tap away). Ported from
//  place-launch.jsx / place-preview.jsx / place-region.jsx.
//

import SwiftUI

/// The signed-out front door: the Place launch funnel, with the existing
/// auth screen presented over it for sign-in / account creation. Once the
/// session flips to signed-in, `RootView` swaps in `RootTabView` and the
/// stashed place is saved by `HubTabRoot`.
struct PlaceLaunchHost: View {
    @State private var showAuth = false
    @State private var deepLink = DeepLinkRouter.shared

    var body: some View {
        PlaceLaunchView(
            onSignIn: { showAuth = true },
            onCreateAccount: { showAuth = true }
        )
        .fullScreenCover(isPresented: $showAuth) {
            LoginView()
        }
        // Workstream 1.4 — RN AuthGate parity: a deferred protected (or
        // auth-owned) deep link auto-presents the existing Sign-in cover
        // without replacing the Place funnel underneath.
        //
        // The trigger is `DeepLinkRouter.prefersLoginPresentation`, NOT the
        // presence of a stashed link. The stash survives process death for
        // 24h, so keying off it would force Sign-in over the Place funnel on
        // every launch after a link the user chose not to sign in for. A link
        // that arrives during this process — including the one that
        // cold-started the app — always sets the flag before this host
        // appears, and the stash is still replayed by the sign-in transition
        // in `RootView`. Identical on Android (`PantopusNavHost`'s
        // `PlaceLaunchHost`).
        .onAppear {
            presentLoginIfRequested()
        }
        .onChange(of: deepLink.prefersLoginPresentation) { _, _ in
            presentLoginIfRequested()
        }
    }

    private func presentLoginIfRequested() {
        guard deepLink.prefersLoginPresentation else { return }
        showAuth = true
        deepLink.acknowledgeLoginPresentation()
    }
}

struct PlaceLaunchView: View {
    /// Present the existing sign-in screen.
    var onSignIn: () -> Void
    /// Begin account creation (the pending place is already stashed).
    var onCreateAccount: () -> Void

    @State private var viewModel = PlaceLaunchViewModel()
    @FocusState private var addressFocused: Bool

    var body: some View {
        ZStack {
            Theme.Color.appBg.ignoresSafeArea()
            switch viewModel.step {
            case .hero:
                hero
            case let .preview(preview):
                PlacePreviewBody(
                    preview: preview,
                    onSignIn: onSignIn,
                    onCreateAccount: onCreateAccount
                ) { viewModel.backToHero() }
            case let .region(message):
                PlaceComingRegionBody(message: message, onBrowse: onCreateAccount) { viewModel.backToHero() }
            }
        }
    }

    // MARK: - A1 hero

    private var hero: some View {
        VStack(spacing: 0) {
            HStack {
                brandLockup
                Spacer()
                Button("Sign in", action: onSignIn)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.horizontal, 20)
            .padding(.top, Spacing.s2)

            Spacer(minLength: 0)

            VStack(alignment: .leading, spacing: 16) {
                regionPill
                Text("See what's true about your address.")
                    .font(.system(size: 31, weight: .bold))
                    .kerning(-0.87)
                    .lineSpacing(4)
                    .foregroundStyle(Theme.Color.appText)
                Text("Your flood risk, today's air, your home's value, and who your verified neighbors are — free, no account.")
                    .font(.system(size: 15))
                    .lineSpacing(3)
                    .foregroundStyle(Theme.Color.appTextSecondary)

                addressField

                if viewModel.isTyping && !viewModel.suggestions.isEmpty {
                    suggestionList
                } else {
                    seePlaceButton
                    Button { onCreateAccount() } label: {
                        Text("Just here to follow someone or browse?")
                            .font(.system(size: 13.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)
                }
            }
            .padding(.horizontal, 24)

            Spacer(minLength: 0)

            HStack(spacing: 6) {
                Icon(.lock, size: 13, strokeWidth: 2, color: Theme.Color.appTextMuted)
                Text("Private by default. Verification builds trust, not exposure.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.bottom, Spacing.s6)
        }
    }

    private var brandLockup: some View {
        HStack(spacing: 7) {
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Theme.Color.homeBg)
                Icon(.mapPin, size: 16, strokeWidth: 2.25, color: Theme.Color.home)
            }
            .frame(width: 28, height: 28)
            Text("Pantopus")
                .font(.system(size: 17, weight: .bold))
                .kerning(-0.3)
                .foregroundStyle(Theme.Color.appText)
        }
    }

    private var regionPill: some View {
        HStack(spacing: 5) {
            Text("🇺🇸").font(.system(size: 13))
            Text("United States")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Theme.Color.appSurface)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
    }

    private var addressField: some View {
        HStack(spacing: 10) {
            Icon(.mapPin, size: 18, strokeWidth: 2, color: addressFocused ? Theme.Color.primary600 : Theme.Color.appTextMuted)
            TextField("Type your home address", text: $viewModel.query)
                .focused($addressFocused)
                .font(Theme.Font.body)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .onSubmit { if !viewModel.query.isEmpty { viewModel.loadPreview(address: viewModel.query) } }
            if !viewModel.query.isEmpty {
                Button { viewModel.query = "" } label: {
                    Icon(.x, size: 16, strokeWidth: 2, color: Theme.Color.appTextMuted)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(addressFocused ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: addressFocused ? 1.5 : 1)
        )
    }

    private var suggestionList: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.suggestions) { s in
                Button { viewModel.select(s) } label: {
                    HStack(spacing: 11) {
                        Icon(.mapPin, size: 16, strokeWidth: 2, color: Theme.Color.appTextMuted)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(s.primaryText).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                            if let secondary = s.secondaryText {
                                Text(secondary).font(.system(size: 12.5)).foregroundStyle(Theme.Color.appTextMuted)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 11)
                    .padding(.horizontal, 14)
                }
                .buttonStyle(.plain)
                if s.id != viewModel.suggestions.last?.id {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 41)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
    }

    private var seePlaceButton: some View {
        PrimaryButton(
            title: "See your place",
            isLoading: viewModel.isLoadingPreview,
            isEnabled: !viewModel.query.trimmingCharacters(in: .whitespaces).isEmpty
        ) {
            viewModel.loadPreview(address: viewModel.query)
        }
    }
}
