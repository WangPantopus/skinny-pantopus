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

    /// One job: get a stranger from a postcard or a share card to type their
    /// address. The field is the hero, the proof line answers the privacy
    /// objection, and the example card shows what comes back. Scrolls only
    /// when the keyboard or a small screen makes it.
    private var hero: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                brandLockup
                regionPill
                Spacer()
                Button("Sign in", action: onSignIn)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.horizontal, 20)
            .padding(.top, Spacing.s2)

            ScrollView(showsIndicators: false) {
                heroBody
                    .padding(.horizontal, 24)
                    .padding(.top, Spacing.s8)
                    .padding(.bottom, Spacing.s6)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var heroBody: some View {
        VStack(alignment: .leading, spacing: 16) {
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
                privacyProof
                exampleCard
                    .padding(.top, Spacing.s2)
                Button { onCreateAccount() } label: {
                    Text("Just here to follow someone or browse?")
                        .font(.system(size: 13.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 4)
            }
        }
    }

    /// The privacy answer where the decision is made: what a neighbor sees,
    /// and what they never see.
    private var privacyProof: some View {
        HStack(alignment: .top, spacing: 8) {
            Icon(.shieldCheck, size: 15, strokeWidth: 2.1, color: Theme.Color.home)
                .padding(.top, 2)
            (Text("Neighbors see a first name and a street. ")
                + Text("Never your house number.").fontWeight(.semibold).foregroundColor(Theme.Color.appText))
                .font(.system(size: 13))
                .lineSpacing(3)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 4)
        .accessibilityIdentifier("startPrivacyProof")
    }

    /// A glimpse of the answer in the dashboard's own row grammar. Static
    /// and labeled as an example; nothing here pretends to be the reader's.
    private var exampleCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("EXAMPLE")
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.9)
                    .foregroundStyle(Theme.Color.appTextMuted)
                Spacer()
                Text("A home in Camas, WA")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 8)

            ForEach(Array(Self.exampleReadings.enumerated()), id: \.offset) { index, reading in
                if index > 0 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 60)
                }
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Theme.Color.appBg)
                        Icon(reading.icon, size: 16, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                    }
                    .frame(width: 32, height: 32)
                    Text(reading.label)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    HStack(spacing: 6) {
                        Circle().fill(reading.tone).frame(width: 6, height: 6)
                        Text(reading.value)
                            .font(.system(size: 13.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    // The reading wins the width; the short label yields first.
                    .layoutPriority(1)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(reading.label): \(reading.value)")
            }

            Text("Yours takes about three seconds and stays on this screen until you save it.")
                .font(.system(size: 12))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextMuted)
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 14)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Example of what an address shows")
        .accessibilityIdentifier("startExampleCard")
    }

    private struct ExampleReading {
        let icon: PantopusIcon
        let label: String
        let value: String
        let tone: Color
    }

    private static let exampleReadings: [ExampleReading] = [
        ExampleReading(icon: .wind, label: "Air today", value: "Good · AQI 24", tone: Theme.Color.home),
        ExampleReading(icon: .waves, label: "Flood zone", value: "X · minimal", tone: Theme.Color.home),
        ExampleReading(icon: .testTube, label: "Radon", value: "Zone 1 · test it", tone: Theme.Color.warning),
        ExampleReading(icon: .trash2, label: "Next pickup", value: "Tue · garbage + recycling", tone: Theme.Color.appTextMuted)
    ]

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

    /// Demoted to the top bar so the address field is the first control.
    private var regionPill: some View {
        HStack(spacing: 4) {
            Text("🇺🇸").font(.system(size: 11))
            Text("United States")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
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
