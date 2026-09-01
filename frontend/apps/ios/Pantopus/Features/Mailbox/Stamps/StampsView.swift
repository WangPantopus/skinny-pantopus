//
//  StampsView.swift
//  Pantopus
//
//  A17.11 — Stamps (postage wallet). A standalone mailbox screen reusing
//  the A17 archetype chrome: a top nav with a teal category dot, a white
//  card stack (book hero · sheet · wallet rail · usage history · issuer),
//  the sky-gradient "Elf" AI strip, and a sticky "Buy more" dock.
//
//  Ports `docs/designs/A17/stamps.jsx` (`MailStampsScreen`). Four render
//  states: loading (shimmer), loaded (the populated wallet), empty ("No
//  stamps yet" + starter book), error.
//

// swiftlint:disable file_length

import SwiftUI

public struct StampsView: View {
    @State private var viewModel: StampsViewModel

    public init(viewModel: StampsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            StampsNav { viewModel.tapBack() }
            StampsModeHeader(
                mode: viewModel.mode,
                progressLabel: progressLabel
            ) { viewModel.toggleMode() }
            stateBody
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("stamps")
        .overlay(alignment: .bottom) { toastOverlay }
        .task {
            await viewModel.load()
            Analytics.track(.screenStampsViewed(state: viewModel.state.analyticsTag))
        }
    }

    /// "3 of 13 collected" under the title, matching RN `stamps.tsx:104`.
    /// Nil while the collection hasn't loaded, or in the themes view.
    private var progressLabel: String? {
        guard viewModel.mode == .stamps,
              case let .loaded(collection) = viewModel.collection else { return nil }
        return collection.progressLabel
    }

    @ViewBuilder private var stateBody: some View {
        if viewModel.mode == .themes {
            StampsThemesBody(
                state: viewModel.themes,
                applyingThemeId: viewModel.applyingThemeId,
                onApply: { id in Task { await viewModel.applyTheme(id: id) } },
                onRetry: { Task { await viewModel.fetchThemes() } }
            )
        } else {
            switch viewModel.state {
            case .loading:
                StampsLoadingBody()
            case let .loaded(content):
                StampsPopulatedBody(content: content, collection: viewModel.collection) {
                    viewModel.buyMore()
                }
            case let .empty(content):
                StampsEmptyBody(content: content) { viewModel.purchaseStarterBook() }
            case let .error(message):
                StampsErrorBody(message: message) { Task { await viewModel.refresh() } }
            }
        }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            Text(toast)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appText.opacity(0.9))
                .clipShape(Capsule())
                .padding(.bottom, Spacing.s10)
                .accessibilityIdentifier("stamps_toast")
                .task {
                    try? await Task.sleep(nanoseconds: 2_200_000_000)
                    viewModel.consumeToast()
                }
        }
    }
}

// MARK: - Mode header

/// Title + "N of M collected" subtitle + the Stamps ⇄ Themes toggle.
/// Mirrors RN's header row (`src/app/mailbox/stamps.tsx:94-113`).
private struct StampsModeHeader: View {
    let mode: StampsViewMode
    let progressLabel: String?
    let onToggle: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 1) {
                Text(mode.title)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let progressLabel {
                    Text(progressLabel)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: Spacing.s0)
            Button(action: onToggle) {
                Text(mode.toggleLabel)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 6)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Show \(mode.toggleLabel.lowercased())")
            .accessibilityIdentifier("stamps_modeToggle")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(minHeight: 44)
        .background(Theme.Color.appBg)
    }
}

// MARK: - Top nav

/// Bespoke A17 nav — back-to-Mailbox + centered teal dot eyebrow + the
/// gift / overflow action cluster. Mirrors `StampsNav` in `stamps.jsx`.
private struct StampsNav: View {
    let onBack: () -> Void

    var body: some View {
        ZStack {
            HStack(spacing: Spacing.s1) {
                Circle()
                    .fill(StampInk.local.color)
                    .frame(width: 8, height: 8)
                Text("STAMPS")
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("stampsNavEyebrow")

            HStack(spacing: Spacing.s0) {
                Button(action: onBack) {
                    HStack(spacing: Spacing.s0) {
                        Icon(.chevronLeft, size: 22, color: Theme.Color.primary600)
                        Text("Mailbox")
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.Color.primary600)
                    }
                    .padding(.horizontal, Spacing.s1)
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back to Mailbox")
                .accessibilityIdentifier("stampsNavBack")

                Spacer()

                HStack(spacing: 2) {
                    navIcon(.gift, label: "Gift a stamp", id: "stampsNavGift")
                    navIcon(.moreHorizontal, label: "More actions", id: "stampsNavMore")
                }
            }
            .padding(.horizontal, Spacing.s2)
        }
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private func navIcon(_ icon: PantopusIcon, label: String, id: String) -> some View {
        Button(action: {}, label: {
            Icon(icon, size: 18, color: Theme.Color.appTextStrong)
                .frame(width: 34, height: 34)
                .background(Circle().fill(Theme.Color.appSurfaceSunken))
        })
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(id)
    }
}

// MARK: - Populated body

private struct StampsPopulatedBody: View {
    let content: StampsContent
    /// Live `GET /api/mailbox/v2/p3/stamps` collection. `nil` (the
    /// default) skips the section entirely, so the VM-free snapshot
    /// frames keep rendering the pure wallet stack.
    var collection: StampCollectionState?
    let onBuyMore: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                StampsItemHeader(category: content.categoryLabel, time: content.timeLabel)
                StampBookHero(book: content.book)
                AIElfStripView(content: elf)
                StampSheet(book: content.book)
                if let collection {
                    StampCollectionSection(state: collection)
                }
                WalletRail(stamps: content.wallet, summary: content.walletSummary)
                UsageHistoryCard(usage: content.usage, window: content.usageWindow)
                StampsIssuerCard(issuer: content.issuer)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
        .safeAreaInset(edge: .bottom) {
            StampsDock(onBuyMore: onBuyMore)
        }
    }

    private var elf: AIElfStripContent {
        AIElfStripContent(
            headline: content.elfHeadline,
            summary: content.elfSummary,
            bullets: content.insights.map {
                AIElfBullet(id: $0.id, icon: $0.icon, label: $0.label, text: $0.text)
            }
        )
    }
}

// MARK: - Item header (trust · category · time)

/// The received-item header row — same vocabulary as the other A17
/// variants: a verified trust chip + the Stamps category chip + a
/// relative-time string.
private struct StampsItemHeader: View {
    let category: String
    let time: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            StampsTrustChip()
            StampsCategoryChip(label: category)
            Spacer(minLength: Spacing.s0)
            Text(time)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 2)
        .accessibilityIdentifier("stampsItemHeader")
    }
}

private struct StampsTrustChip: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldCheck, size: 11, color: Theme.Color.success)
            Text("Verified")
                .font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(Theme.Color.success)
        .padding(.leading, 7)
        .padding(.trailing, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.successBg)
        .clipShape(Capsule())
    }
}

private struct StampsCategoryChip: View {
    let label: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Circle()
                .fill(StampInk.local.color)
                .frame(width: 6, height: 6)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
    }
}

// MARK: - Issuer card

/// "From" — the Pantopus Post issuer card with a verified badge.
private struct StampsIssuerCard: View {
    let issuer: StampIssuer

    var body: some View {
        StampCard {
            StampSectionLabel("From") { EmptyView() }
            HStack(spacing: Spacing.s3) {
                avatar
                VStack(alignment: .leading, spacing: 1) {
                    Text(issuer.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(issuer.dept)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    HStack(spacing: Spacing.s1) {
                        chip(icon: .stamp, text: issuer.kindLabel, tint: StampInk.local.color)
                        proofChip
                    }
                    .padding(.top, Spacing.s1)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("From \(issuer.name). \(issuer.dept). \(issuer.kindLabel).")
        .accessibilityIdentifier("stampsIssuer")
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            Text(issuer.initials)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.white)
                .frame(width: 44, height: 44)
                .background(
                    LinearGradient(
                        colors: [StampInk.local.color, StampPalette.issuerDeep],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            Icon(.check, size: 9, color: Color.white)
                .frame(width: 16, height: 16)
                .background(Circle().fill(Theme.Color.success))
                .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                .offset(x: 3, y: 3)
        }
    }

    private var proofChip: some View {
        Text(issuer.proofLabel)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Theme.Color.success)
            .padding(.horizontal, Spacing.s1)
            .padding(.vertical, 2)
            .background(Theme.Color.successBg)
            .clipShape(Capsule())
    }

    private func chip(icon: PantopusIcon, text: String, tint: Color) -> some View {
        HStack(spacing: 3) {
            Icon(icon, size: 9, color: tint)
            Text(text)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(tint)
        }
        .padding(.horizontal, Spacing.s1)
        .padding(.vertical, 2)
        .background(tint.opacity(0.12))
        .clipShape(Capsule())
    }
}

// MARK: - Sticky dock

/// "Buy more stamps" primary CTA + the quick-action chip row. Pinned to
/// the bottom safe area in the populated state.
private struct StampsDock: View {
    let onBuyMore: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Button(action: onBuyMore) {
                HStack(spacing: Spacing.s2) {
                    Icon(.plus, size: 16, color: Color.white)
                    Text("Buy more stamps")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.white)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .shadow(color: Theme.Color.primary600.opacity(0.3), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("stampsBuyMore")

            HStack(spacing: Spacing.s2) {
                StampActionChip(icon: .arrowsRepeat, label: "Auto-refill")
                StampActionChip(icon: .gift, label: "Gift")
                StampActionChip(icon: .send, label: "Send mail")
                StampActionChip(icon: .archive, label: "Archive")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .background(
            Theme.Color.appSurface
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
                .ignoresSafeArea(edges: .bottom)
        )
    }
}

private struct StampActionChip: View {
    let icon: PantopusIcon
    let label: String

    var body: some View {
        Button(action: {}, label: {
            VStack(spacing: Spacing.s1) {
                Icon(icon, size: 17, color: Theme.Color.appTextSecondary)
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        })
        .buttonStyle(.plain)
        .accessibilityIdentifier("stampsAction.\(label)")
    }
}

// MARK: - Empty body

private struct StampsEmptyBody: View {
    let content: StampsEmptyContent
    let onBuy: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s4) {
                hero
                StarterBookCard(book: content.starterBook, onGetBook: onBuy)
                howItWorks
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
            .padding(.bottom, Spacing.s8)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("stampsEmpty")
    }

    private var hero: some View {
        VStack(spacing: Spacing.s0) {
            ZStack(alignment: .bottomTrailing) {
                PerforatedStamp(ink: StampInk.local.color, width: 108, height: 138)
                    .shadow(color: StampInk.local.color.opacity(0.22), radius: 14, x: 0, y: 10)
                Icon(.plus, size: 18, color: Theme.Color.appTextMuted)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Theme.Color.appSurface))
                    .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
                    .shadow(color: Color.black.opacity(0.12), radius: 6, x: 0, y: 3)
                    .offset(x: 10, y: 8)
            }
            .padding(.top, Spacing.s6)
            .padding(.bottom, Spacing.s5)

            Text(content.headline)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.bottom, Spacing.s1)
            Text(content.body)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .frame(maxWidth: 280)
                .padding(.bottom, Spacing.s5)

            Button(action: onBuy) {
                HStack(spacing: Spacing.s2) {
                    Text(content.buyLabel)
                        .font(.system(size: 14, weight: .bold))
                    Icon(.arrowRight, size: 15, color: Color.white)
                }
                .foregroundStyle(Color.white)
                .padding(.horizontal, Spacing.s5)
                .padding(.vertical, Spacing.s3)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .shadow(color: Theme.Color.primary600.opacity(0.3), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("stampsEmptyBuy")
        }
        .frame(maxWidth: .infinity)
    }

    private var howItWorks: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 15, color: Theme.Color.primary700)
                .frame(width: 28, height: 28)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(content.howItWorksTitle)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(content.howItWorksBody)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

/// The previewed starter-book offer on the empty state.
private struct StarterBookCard: View {
    let book: StampStarterBook
    let onGetBook: () -> Void

    var body: some View {
        StampCard(noPad: true) {
            HStack(spacing: 14) {
                PerforatedStamp(ink: StampInk.local.color, width: 58, height: 74, toothRadius: 3, toothGap: 9)
                VStack(alignment: .leading, spacing: 2) {
                    Text(book.title)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(book.detail)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineSpacing(1)
                }
                Spacer(minLength: Spacing.s0)
                VStack(alignment: .trailing, spacing: Spacing.s1) {
                    Text(book.priceLabel)
                        .font(.system(size: 16, weight: .heavy))
                        .foregroundStyle(Theme.Color.appText)
                    Button(action: onGetBook) {
                        Text("Get book")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color.white)
                            .padding(.horizontal, Spacing.s3)
                            .padding(.vertical, 5)
                            .background(StampInk.local.color)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("stampsStarterGetBook")
                }
            }
            .padding(14)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("stampsStarterBook")
    }
}

// MARK: - Loading body

/// Shimmer skeleton mirroring the loaded geometry — never a spinner.
private struct StampsLoadingBody: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Shimmer(width: 160, height: 22, cornerRadius: Radii.pill)
                Shimmer(height: 160, cornerRadius: Radii.xl)
                Shimmer(height: 120, cornerRadius: Radii.xl)
                Shimmer(height: 220, cornerRadius: Radii.xl)
                Shimmer(height: 150, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("stampsLoading")
    }
}

// MARK: - Error body

private struct StampsErrorBody: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load your stamps")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button(action: onRetry) {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.vertical, Spacing.s3)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("stampsRetry")
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("stampsError")
    }
}

// MARK: - Collection section (GET /p3/stamps)

/// The live stamp gallery: a two-column grid of earned stamps followed by
/// the LOCKED catalogue list. Ports RN `stamps.tsx:116-148`.
private struct StampCollectionSection: View {
    let state: StampCollectionState

    var body: some View {
        StampCard {
            StampSectionLabel("Collection") { EmptyView() }
            switch state {
            case .loading:
                loading
            case let .loaded(content):
                loaded(content)
            case .empty:
                emptyBody
            case let .error(message):
                errorBody(message)
            }
        }
        .accessibilityIdentifier("stamps_collection")
    }

    private var loading: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(width: nil, height: 54, cornerRadius: Radii.md)
            }
        }
        .accessibilityIdentifier("stamps_collection_loading")
    }

    private func loaded(_ content: StampCollectionContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if content.earned.isEmpty {
                Text("Nothing collected yet — keep using your mailbox.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                VStack(spacing: Spacing.s2) {
                    ForEach(content.earned) { stamp in
                        CollectedStampRow(stamp: stamp)
                    }
                }
            }
            if !content.locked.isEmpty {
                Text("LOCKED")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.7)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                VStack(spacing: Spacing.s2) {
                    ForEach(content.locked) { stamp in
                        CollectedStampRow(stamp: stamp)
                    }
                }
            }
        }
        .accessibilityIdentifier("stamps_collection_loaded")
    }

    private var emptyBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("No stamps to collect yet")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Stamps unlock as you receive, file and act on mail.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("stamps_collection_empty")
    }

    private func errorBody(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Couldn't load your collection")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("stamps_collection_error")
    }
}

/// One earned / locked stamp row — rarity swatch, name, blurb and either
/// the earned date or a lock glyph.
private struct CollectedStampRow: View {
    let stamp: CollectedStamp

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(stamp.rarity.accentBg)
                Icon(
                    stamp.isLocked ? .lock : .stamp,
                    size: 16,
                    color: stamp.rarity.accent
                )
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(stamp.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(stamp.rarity.label)
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(stamp.rarity.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(stamp.rarity.accentBg)
                        .clipShape(Capsule())
                }
                if let detail = stamp.detail {
                    Text(detail)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let earnedLabel = stamp.earnedLabel {
                    Text(earnedLabel)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .opacity(stamp.isLocked ? 0.55 : 1)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("stamps_collection_row_\(stamp.id)")
    }
}

// MARK: - Themes body (GET /p3/themes)

/// The "Seasonal Themes" half of the screen: an active-theme preview over
/// the available-theme list. Tapping an unlocked row applies it. Ports RN
/// `stamps.tsx:151-195`.
private struct StampsThemesBody: View {
    let state: StampThemesState
    let applyingThemeId: String?
    let onApply: (String) -> Void
    let onRetry: () -> Void

    var body: some View {
        switch state {
        case .loading:
            loading
        case let .loaded(content):
            loaded(content)
        case .empty:
            ScrollView {
                EmptyState(
                    icon: .palette,
                    headline: "No themes yet",
                    subcopy: "Seasonal mailbox themes unlock through the year and with stamp milestones.",
                    cta: EmptyState.CTA(title: "Refresh") { onRetry() },
                    tint: Theme.Color.magicBg,
                    accent: Theme.Color.magic
                )
                .frame(maxWidth: .infinity, minHeight: 360)
            }
            .accessibilityIdentifier("stamps_themes_empty")
        case let .error(message):
            ScrollView {
                ErrorState(headline: "Couldn't load themes", message: message) { onRetry() }
                    .frame(maxWidth: .infinity, minHeight: 360)
            }
            .accessibilityIdentifier("stamps_themes_error")
        }
    }

    private var loading: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                Shimmer(width: nil, height: 140, cornerRadius: Radii.xl)
                ForEach(0..<4, id: \.self) { _ in
                    Shimmer(width: nil, height: 64, cornerRadius: Radii.lg)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
        .accessibilityIdentifier("stamps_themes_loading")
    }

    private func loaded(_ content: StampThemesContent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let active = content.activeTheme {
                    ActiveThemePreview(theme: active)
                }
                Text("AVAILABLE THEMES")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.7)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                VStack(spacing: Spacing.s2) {
                    ForEach(content.themes) { theme in
                        ThemeRow(
                            theme: theme,
                            isActive: theme.id == content.activeThemeId,
                            isApplying: applyingThemeId == theme.id,
                            isBusy: applyingThemeId != nil
                        ) { onApply(theme.id) }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityIdentifier("stamps_themes_loaded")
    }
}

/// Hero preview of the currently-applied theme.
private struct ActiveThemePreview: View {
    let theme: MailboxTheme

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 2) {
                Spacer(minLength: Spacing.s0)
                Text(theme.name)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(theme.season.label)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(Spacing.s5)
            .frame(maxWidth: .infinity, alignment: .leading)
            Text("Active Theme")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, 9)
                .padding(.vertical, 3)
                .background(Theme.Color.appText.opacity(0.3))
                .clipShape(Capsule())
                .padding(10)
        }
        .frame(height: 140)
        .background(theme.season.accentBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("stamps_themes_active")
    }
}

/// One row in "Available themes". Locked rows dim and don't respond.
private struct ThemeRow: View {
    let theme: MailboxTheme
    let isActive: Bool
    let isApplying: Bool
    let isBusy: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(theme.season.accent)
                    .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text(theme.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(theme.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                if isApplying {
                    ProgressView().tint(theme.season.accent)
                } else if isActive {
                    Icon(.checkCircle, size: 18, color: theme.season.accent)
                } else if !theme.isUnlocked {
                    Icon(.lock, size: 16, color: Theme.Color.appTextMuted)
                }
            }
            .padding(13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        isActive ? theme.season.accent : Theme.Color.appBorder,
                        lineWidth: isActive ? 2 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .opacity(theme.isUnlocked ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!theme.isUnlocked || isBusy)
        .accessibilityLabel("\(theme.name), \(theme.subtitle)\(theme.isUnlocked ? "" : ", locked")")
        .accessibilityIdentifier("stamps_themes_row_\(theme.id)")
    }
}

// MARK: - Shared card chrome

/// White rounded card with a hairline border — the A17 card-stack unit.
struct StampCard<Content: View>: View {
    var noPad = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            content()
        }
        .padding(noPad ? 0 : 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .shadow(color: Color.black.opacity(0.03), radius: 1, x: 0, y: 1)
    }
}

/// Uppercase overline used at the head of a card, with a trailing slot.
struct StampSectionLabel<Trailing: View>: View {
    let title: String
    @ViewBuilder let trailing: () -> Trailing

    init(_ title: String, @ViewBuilder trailing: @escaping () -> Trailing) {
        self.title = title
        self.trailing = trailing
    }

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.7)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
            trailing()
        }
        .padding(.bottom, Spacing.s3)
    }
}

// MARK: - VM-free frames (snapshots / previews)

/// Populated frame without a view-model — for snapshot tests + previews.
struct StampsPopulatedFrame: View {
    let content: StampsContent

    var body: some View {
        VStack(spacing: Spacing.s0) {
            StampsNav {}
            StampsPopulatedBody(content: content) {}
        }
        .background(Theme.Color.appBg)
    }
}

/// Empty frame without a view-model — for snapshot tests + previews.
struct StampsEmptyFrame: View {
    let content: StampsEmptyContent

    var body: some View {
        VStack(spacing: Spacing.s0) {
            StampsNav {}
            StampsEmptyBody(content: content) {}
        }
        .background(Theme.Color.appBg)
    }
}

// MARK: - State analytics

private extension StampsState {
    var analyticsTag: String {
        switch self {
        case .loading: "loading"
        case .loaded: "populated"
        case .empty: "empty"
        case .error: "error"
        }
    }
}

// MARK: - Previews

#if DEBUG
#Preview("A17.11 · populated") {
    StampsPopulatedFrame(content: StampsSampleData.populated)
}

#Preview("A17.11 · empty") {
    StampsEmptyFrame(content: StampsSampleData.empty)
}
#endif
