//
//  MailboxItemDetailView.swift
//  Pantopus
//
// swiftlint:disable multiple_closures_with_trailing_closure

import Foundation
import SwiftUI

/// Mailbox Item Detail screen. Category-aware; each category renders its
/// bespoke body, and any category without one renders `GenericMailBody`
/// (the readable message surface) rather than a placeholder.
///
/// NOT ROUTED (M5 parity sweep): `HubTabRoot` / `YouTabRoot` push
/// `MailDetailView` for `.mailItemDetail`, so nothing reaches this view at
/// runtime — its `MailboxItemDetailViewModel` is therefore the only caller
/// of `MailboxV2Endpoints.itemAction` outside the A17.1 ACTIONS row. Kept
/// because its shell + category bodies remain the reference for the A17
/// variant work and it carries its own snapshot coverage; the per-category
/// actions were added to `MailDetail/Variants/GenericMailDetailLayout.swift`,
/// the layout that actually renders. Mirrors Android
/// `ui/screens/mailbox/item_detail/MailboxItemDetailScreen.kt`.
/// Identifiable wrapper around `URL` so we can drive a `.sheet(item:)`.
private struct TermsSheetItem: Identifiable {
    let id = UUID()
    let url: URL
}

struct MailboxItemDetailView: View {
    @State private var viewModel: MailboxItemDetailViewModel
    @State private var termsSheet: TermsSheetItem?
    @State private var showsConfirmGate = false
    @State private var didAutoPresentConfirmGate = false
    private let onBack: () -> Void
    private let onOpenSenderProfile: (@MainActor (String) -> Void)?

    init(
        mailId: String,
        onBack: @escaping () -> Void,
        onOpenSenderProfile: (@MainActor (String) -> Void)? = nil
    ) {
        _viewModel = State(initialValue: MailboxItemDetailViewModel(mailId: mailId))
        self.onBack = onBack
        self.onOpenSenderProfile = onOpenSenderProfile
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingLayout(onBack: onBack)
            case let .loaded(content):
                loadedLayout(content)
            case let .error(message):
                ErrorLayout(message: message, onBack: onBack) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.ctaFlags.errorToast {
                Text(toast)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s2)
                    .background(Theme.Color.error.opacity(0.95))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                    .padding(.bottom, 100)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.ctaFlags.errorToast = nil
                    }
            }
        }
    }

    private func loadedLayout(_ content: MailboxItemDetailContent) -> some View {
        MailboxItemDetailShell(
            category: content.category,
            trust: content.trust,
            sender: content.sender,
            aiElf: content.aiElf,
            keyFacts: content.keyFacts,
            timeline: content.category == .package ? [] : content.timeline,
            cta: ctaContent(for: content),
            onBack: onBack,
            onAIChip: { kind in
                // AI suggestion chips are shortcuts for the bottom CTAs.
                switch kind {
                case .primary: handlePrimary(for: content)
                case .secondary: handleGhost(for: content)
                }
            },
            onPrimary: { handlePrimary(for: content) },
            onGhost: { handleGhost(for: content) },
            onSenderAvatarTap: onOpenSenderProfile
        ) { categoryBody(for: content) }
            .onAppear {
                guard !didAutoPresentConfirmGate,
                      shouldShowConfirmGate(for: content) else { return }
                didAutoPresentConfirmGate = true
                showsConfirmGate = true
            }
            .sheet(item: $termsSheet) { item in
                CertifiedTermsSheet(termsURL: item.url) { termsSheet = nil }
            }
            .sheet(isPresented: $showsConfirmGate) {
                if case let .certified(certified) = content.payload {
                    CertifiedConfirmGate(
                        senderName: content.sender.displayName,
                        referenceNumber: certified.referenceNumber,
                        deadlineLabel: formatDeadline(certified.acknowledgeBy),
                        isSigning: viewModel.ctaFlags.primaryLoading,
                        onReviewFirst: { showsConfirmGate = false },
                        onSign: {
                            viewModel.certifiedAckChecked = true
                            showsConfirmGate = false
                            Task { await viewModel.performPrimaryAction() }
                        }
                    )
                }
            }
    }

    private func handlePrimary(for content: MailboxItemDetailContent) {
        if shouldShowConfirmGate(for: content), !viewModel.certifiedAckChecked {
            showsConfirmGate = true
            return
        }
        Task { await viewModel.performPrimaryAction() }
    }

    /// Ghost CTA dispatcher. For certified mail this surfaces the
    /// View-terms sheet directly; for other categories the VM handles
    /// the action via `performGhostAction`.
    private func handleGhost(for content: MailboxItemDetailContent) {
        if content.category == .certified,
           case let .certified(detail) = content.payload,
           let url = detail.termsURL {
            termsSheet = TermsSheetItem(url: url)
            return
        }
        Task { await viewModel.performGhostAction() }
    }

    private func shouldShowConfirmGate(for content: MailboxItemDetailContent) -> Bool {
        guard content.category == .certified,
              case let .certified(detail) = content.payload else { return false }
        return content.isUnread
            && !content.isArchived
            && !detail.isAcknowledged
            && content.ctaEnabled
    }

    @ViewBuilder
    private func categoryBody(for content: MailboxItemDetailContent) -> some View {
        switch (content.category, content.payload) {
        case (.package, _):
            if let pkg = content.packageInfo {
                PackageBody(
                    content: pkg,
                    isReceiveEnabled: content.ctaEnabled && !viewModel.ctaFlags.primaryCompleted,
                    isReceiveLoading: viewModel.ctaFlags.primaryLoading,
                    isReceived: viewModel.ctaFlags.primaryCompleted
                ) {
                    Task { await viewModel.performPrimaryAction() }
                }
            } else {
                genericBody(for: content)
            }
        case let (.coupon, .coupon(coupon)):
            CouponBody(coupon: coupon)
        case let (.booklet, .booklet(booklet)):
            BookletBody(booklet: booklet)
        case let (.certified, .certified(certified)):
            CertifiedBody(
                certified: certified
            ) {
                if let url = certified.termsURL {
                    termsSheet = TermsSheetItem(url: url)
                }
            }
        case let (.community, .community(community)):
            CommunityBody(
                community: community,
                authorName: content.sender.displayName,
                authorInitials: content.sender.initials
            )
        case let (.gig, .gig(gig)):
            GigBody(gig: gig) {
                Task { await viewModel.acceptGigBid() }
            }
        case let (.memory, .memory(memory)):
            MemoryBody(memory: memory, isSaved: memory.isSaved)
        default:
            genericBody(for: content)
        }
    }

    /// Generic readable body for any category without a bespoke layout. Uses
    /// the projected `genericBody` content (body text / attachments / tags),
    /// falling back to the category explainer if the projection is absent so
    /// no known category ever renders an empty or placeholder surface.
    private func genericBody(for content: MailboxItemDetailContent) -> some View {
        GenericMailBody(
            content: content.genericBody ?? GenericMailBodyContent(category: content.category)
        )
    }

    private func ctaContent(for content: MailboxItemDetailContent) -> MailboxCTAShelfContent? {
        switch content.category {
        case .package:
            nil
        case .coupon:
            MailboxCTAShelfContent(
                primaryTitle: viewModel.ctaFlags.primaryCompleted ? "Added to wallet" : "Add to wallet",
                ghostTitle: "Save for later",
                primaryLoading: viewModel.ctaFlags.primaryLoading,
                ghostLoading: viewModel.ctaFlags.ghostLoading,
                primaryEnabled: content.ctaEnabled && !viewModel.ctaFlags.primaryCompleted
            )
        case .booklet:
            MailboxCTAShelfContent(
                primaryTitle: "Save to library",
                ghostTitle: nil,
                primaryLoading: viewModel.ctaFlags.primaryLoading,
                ghostLoading: false,
                primaryEnabled: content.ctaEnabled
            )
        case .certified:
            MailboxCTAShelfContent(
                primaryTitle: viewModel.ctaFlags.primaryCompleted
                    ? "Signed"
                    : "Sign for delivery",
                ghostTitle: "View terms",
                primaryLoading: viewModel.ctaFlags.primaryLoading,
                ghostLoading: viewModel.ctaFlags.ghostLoading,
                primaryEnabled: content.ctaEnabled
                    && viewModel.certifiedAckChecked
                    && !viewModel.ctaFlags.primaryCompleted
            )
        case .memory:
            memoryCTA(content)
        default:
            nil
        }
    }

    /// Memory CTA shelf — "Save to Vault" flips to a disabled "Saved to
    /// Vault" once kept; "Share" stays available in both states.
    private func memoryCTA(_ content: MailboxItemDetailContent) -> MailboxCTAShelfContent {
        let saved: Bool = if case let .memory(memory) = content.payload {
            memory.isSaved
        } else {
            false
        }
        return MailboxCTAShelfContent(
            primaryTitle: saved ? "Saved to Vault" : "Save to Vault",
            ghostTitle: "Share",
            primaryLoading: viewModel.ctaFlags.primaryLoading,
            ghostLoading: viewModel.ctaFlags.ghostLoading,
            primaryEnabled: !saved
        )
    }

    private func formatDeadline(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let full = ISO8601DateFormatter()
        full.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        let parsed = full.date(from: iso) ?? plain.date(from: iso) ?? Self.dateOnlyFormatter.date(from: iso)
        guard let parsed else { return iso }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE MMM d, yyyy"
        return formatter.string(from: parsed)
    }

    private static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private struct LoadingLayout: View {
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 4)
            ContentDetailTopBar(title: nil, onBack: onBack, action: nil)
            VStack(spacing: Spacing.s3) {
                Shimmer(width: 120, height: 22, cornerRadius: Radii.pill)
                Shimmer(height: 56, cornerRadius: Radii.md)
                Shimmer(height: 120, cornerRadius: Radii.lg)
                Shimmer(height: 180, cornerRadius: Radii.lg)
            }
            .padding(Spacing.s4)
            Spacer()
        }
        .background(Theme.Color.appBg)
    }
}

private struct ErrorLayout: View {
    let message: String
    let onBack: () -> Void
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.error).frame(height: 4)
            ContentDetailTopBar(title: nil, onBack: onBack, action: nil)
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load this item",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await MainActor.run { onRetry() } }
            )
            .frame(maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
    }
}

#Preview {
    MailboxItemDetailView(mailId: "preview") {}
}
