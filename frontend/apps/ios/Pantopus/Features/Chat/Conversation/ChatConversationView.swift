//
//  ChatConversationView.swift
//  Pantopus
//
//  Chat conversation screen (T2.2). One skeleton, three counterparty
//  types (person / group / ai), three frames (populated / empty / AI
//  welcome). Optimistic send with retry, debounced markRead, cursor
//  pagination on scroll-up, socket subscriptions in the VM.
//

// swiftlint:disable file_length

import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// swiftlint:disable multiline_arguments multiple_closures_with_trailing_closure type_body_length

/// Mutable scroll metrics for the conversation timeline, held by
/// reference (via @State) so per-frame writes during scrolling don't
/// invalidate the view tree.
private final class ChatScrollMetrics {
    /// How far the user has scrolled below the top of the loaded
    /// history, in points. Drives the near-top pagination trigger.
    var distanceFromTop: CGFloat = .greatestFiniteMagnitude
}

/// Chat conversation screen.
public struct ChatConversationView: View {
    @State private var viewModel: ChatConversationViewModel
    @State private var attachmentsPresented = false
    @State private var photosPickerSelection: [PhotosPickerItem] = []
    @State private var photosPickerPresented = false
    @State private var cameraPresented = false
    @State private var documentImporterPresented = false
    @State private var gigPickerPresented = false
    @State private var listingPickerPresented = false
    @State private var upgradePromptPresented = false
    /// A15.4 — "Not now" on the upgrade-fan card hides it for the rest of
    /// this visit. There is no server-side dismissal to persist to yet.
    @State private var upgradeCardDismissed = false
    @State private var detailsPresented = false
    @State private var emojiPickerPresented = false
    @State private var isSelecting = false
    @State private var selectedMessageIds: Set<String> = []
    @State private var bulkDeleteConfirmPresented = false
    /// Gates the scroll-to-top pagination trigger: armed ~0.5s after the
    /// populated frame first lays out, so the initial layout passes
    /// (which briefly report near-top geometry before the bottom anchor
    /// settles) can't fetch an older page unprompted.
    @State private var isLoadOlderArmed = false
    /// True while an older-page fetch + scroll restore is in flight —
    /// the near-top geometry check fires continuously during a scroll,
    /// and must not stack requests.
    @State private var isLoadingOlder = false
    /// Scroll metrics held by reference: they update on every scrolled
    /// frame, and a per-frame @State write would re-render the whole
    /// conversation at scroll rate.
    @State private var scrollMetrics = ChatScrollMetrics()
    /// Whether the viewport is at (or within ~120pt of) the newest
    /// message. Gates stay-pinned-on-new-rows scrolling. Only flips on
    /// actual boundary crossings, so it stays a cheap @State.
    @State private var isAtBottom = false
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Presentation mode — drives the AI chrome (avatar, welcome card,
    /// reply bubbles). Default `.dm`.
    private let mode: ChatConversationMode
    private let creatorContext: ChatCreatorThreadContext?
    private let onOpenAudienceProfile: @MainActor () -> Void
    private let onUseAIDraft: @MainActor (ChatAIDraftCard) -> Void
    private let onBack: @MainActor () -> Void

    public init(
        viewModel: ChatConversationViewModel,
        mode: ChatConversationMode = .dm,
        creatorContext: ChatCreatorThreadContext? = nil,
        onOpenAudienceProfile: @escaping @MainActor () -> Void = {},
        onUseAIDraft: @escaping @MainActor (ChatAIDraftCard) -> Void = { _ in },
        onBack: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.mode = mode
        self.creatorContext = creatorContext
        self.onOpenAudienceProfile = onOpenAudienceProfile
        self.onUseAIDraft = onUseAIDraft
        self.onBack = onBack
    }

    public init(
        viewModel: ChatConversationViewModel,
        mode: ChatConversationMode = .dm,
        creatorContext: ChatCreatorThreadContext? = nil,
        onBack: @escaping @MainActor () -> Void
    ) {
        self.init(
            viewModel: viewModel,
            mode: mode,
            creatorContext: creatorContext,
            onOpenAudienceProfile: {},
            onUseAIDraft: { _ in },
            onBack: onBack
        )
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            ChatConversationHeader(
                mode: mode,
                counterparty: viewModel.headerCounterparty,
                creatorContext: resolvedCreatorContext,
                onBack: onBack
            ) {
                detailsPresented = true
            }
            if isSelecting {
                ChatSelectionTopBar(count: selectedMessageIds.count, onCancel: exitSelection)
            }
            gigContextStrip
            if mode == .creatorThread {
                ChatCreatorAudienceStrip(
                    context: resolvedCreatorContext,
                    onOpenAudienceProfile: onOpenAudienceProfile
                )
                if let quota = resolvedCreatorContext.quota {
                    ChatCreatorQuotaMeter(quota: quota)
                    if quota.isMaxed {
                        CreatorQuotaExhaustedPill(
                            tierName: resolvedCreatorContext.fanTierName,
                            fanName: firstWord(viewModel.counterparty.displayName),
                            total: quota.total
                        )
                        if let offer = resolvedCreatorContext.upgradeOffer, !upgradeCardDismissed {
                            CreatorUpgradeFanCard(
                                fanName: firstWord(viewModel.counterparty.displayName),
                                currentTierName: resolvedCreatorContext.fanTierName,
                                offer: offer
                            ) {
                                upgradeCardDismissed = true
                            }
                        }
                    }
                }
            }
            if mode == .fanThread, let entitlement = viewModel.fanEntitlement {
                FanMembershipStripe(entitlement: entitlement) {
                    upgradePromptPresented = true
                }
            }
            if !viewModel.topics.isEmpty {
                ChatTopicStrip(
                    topics: viewModel.topics,
                    selectedTopicId: viewModel.selectedTopicId
                ) { topicId in
                    Task { await viewModel.selectTopic(topicId) }
                }
            }
            content
            if viewModel.isCounterpartyTyping {
                ChatTypingIndicator(initials: incomingInitials ?? initials(of: viewModel.counterparty.displayName))
            }
            if !viewModel.queuedAttachments.isEmpty {
                AttachmentStripView(attachments: viewModel.queuedAttachments) { id in
                    viewModel.removeQueuedAttachment(id: id)
                }
            }
            if mode == .fanThread, let entitlement = viewModel.fanEntitlement {
                FanQuotaGate(entitlement: entitlement) {
                    upgradePromptPresented = true
                }
            }
            if isSelecting {
                ChatSelectionDeleteBar(selectedCount: selectedMessageIds.count) {
                    bulkDeleteConfirmPresented = true
                }
            } else {
                actionBanner
                sendLimitBanner
                ChatComposer(
                    text: Binding(
                        get: { viewModel.composerText },
                        set: { viewModel.composerText = $0 }
                    ),
                    placeholder: composerPlaceholder,
                    canSend: viewModel.canSend && !isCreatorQuotaLocked,
                    // The "−1" send-cost badge is a claim about the fan's
                    // quota — only shown once the allowance is known.
                    showsSendCost: mode == .fanThread && viewModel.fanEntitlement != nil && !isFanReplyLocked,
                    isLockedAction: isFanReplyLocked || isCreatorQuotaLocked,
                    isStreaming: viewModel.isAIStreaming,
                    onAttach: { attachmentsPresented = true },
                    onEmoji: { emojiPickerPresented = true },
                    onSend: { sendOrPromptForUpgrade() },
                    onStop: { viewModel.cancelAIStream() }
                )
                if isCreatorQuotaLocked {
                    CreatorQuotaLockRow(
                        tierName: resolvedCreatorContext.fanTierName,
                        fanName: firstWord(viewModel.counterparty.displayName)
                    )
                }
            }
        }
        .background(Theme.Color.appSurface)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .onDisappear { viewModel.teardown() }
        // RN attach-grid parity: Camera / Photos / Document / Location /
        // Task / Marketplace. Camera hides itself where no capture device
        // exists (simulator).
        .confirmationDialog(
            "Attach",
            isPresented: $attachmentsPresented,
            titleVisibility: .visible
        ) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button("Camera") { cameraPresented = true }
            }
            Button("Photos") { photosPickerPresented = true }
            Button("Document") { documentImporterPresented = true }
            Button("Location") { Task { await viewModel.sendCurrentLocation() } }
            Button("Task") { gigPickerPresented = true }
            Button("Marketplace") { listingPickerPresented = true }
            Button("Cancel", role: .cancel) {}
        }
        .fullScreenCover(isPresented: $cameraPresented) {
            SystemCameraPicker(isPresented: $cameraPresented) { image in
                handleCapturedPhoto(image)
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $gigPickerPresented) {
            ChatShareGigPickerSheet(viewModel: viewModel) { gigPickerPresented = false }
        }
        .sheet(isPresented: $listingPickerPresented) {
            ChatShareListingPickerSheet(viewModel: viewModel) { listingPickerPresented = false }
        }
        .photosPicker(
            isPresented: $photosPickerPresented,
            selection: $photosPickerSelection,
            maxSelectionCount: 5,
            matching: .any(of: [.images, .videos])
        )
        .onChange(of: photosPickerSelection) { _, items in
            handlePickedPhotos(items)
        }
        .fileImporter(
            isPresented: $documentImporterPresented,
            allowedContentTypes: [.item],
            allowsMultipleSelection: true
        ) { result in
            handlePickedDocuments(result)
        }
        .sheet(isPresented: $upgradePromptPresented) {
            if let entitlement = viewModel.fanEntitlement {
                FanTierUpgradePromptSheet(entitlement: entitlement)
                    .presentationDetents([.medium])
            }
        }
        .sheet(isPresented: $detailsPresented) {
            ChatConversationDetailsSheet(viewModel: viewModel) {
                // Blocked — close the drawer and pop the thread.
                detailsPresented = false
                onBack()
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $emojiPickerPresented) {
            ChatEmojiPickerSheet { emoji in
                viewModel.composerText += emoji
            }
            .presentationDetents([.height(340)])
            .presentationDragIndicator(.visible)
        }
        .alert(
            "Delete \(selectedMessageIds.count) message\(selectedMessageIds.count == 1 ? "" : "s")?",
            isPresented: $bulkDeleteConfirmPresented
        ) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                let ids = Array(selectedMessageIds)
                Task {
                    await viewModel.bulkDelete(ids: ids)
                    exitSelection()
                }
            }
        } message: {
            Text("Deleted messages are removed for everyone in this conversation.")
        }
        .accessibilityIdentifier("chatConversation")
    }

    private func exitSelection() {
        isSelecting = false
        selectedMessageIds = []
    }

    /// A15 `.ctx-strip` — pinned gig context under the header of a
    /// gig-room thread. Tapping opens the gig detail through the same
    /// deep-link path the in-thread gig offer cards use.
    @ViewBuilder private var gigContextStrip: some View {
        if let context = viewModel.gigContext {
            Button {
                openGigDetail(gigId: context.gigId)
            } label: {
                HStack(spacing: 10) {
                    Icon(.hammer, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                        .frame(width: 28, height: 28)
                        .background(Theme.Color.primary600)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(context.title)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        if let meta = context.meta {
                            Text(meta)
                                .font(.system(size: 10.5))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: Spacing.s0)
                    Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                        .accessibilityHidden(true)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.primary200, lineWidth: 1)
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s2)
            .accessibilityLabel("Gig: \(context.title)")
            .accessibilityIdentifier("chatGigContextStrip")
        }
    }

    /// Dismissible banner shown when a send was rejected by the gig
    /// room's pre-bid message cap (429 `PRE_BID_LIMIT`).
    @ViewBuilder private var sendLimitBanner: some View {
        if let notice = viewModel.sendLimitNotice {
            HStack(spacing: Spacing.s2) {
                Icon(.alertTriangle, size: 14, strokeWidth: 2.4, color: Theme.Color.warning)
                Text(notice)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: Spacing.s0)
                Button { viewModel.dismissSendLimitNotice() } label: {
                    Icon(.x, size: 13, strokeWidth: 2.5, color: Theme.Color.appTextSecondary)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss message limit notice")
            }
            .padding(.leading, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.warningBg)
            .overlay(alignment: .top) {
                Rectangle().fill(Theme.Color.warningLight).frame(height: 1)
            }
            .accessibilityIdentifier("chatSendLimitNotice")
        }
    }

    private var resolvedCreatorContext: ChatCreatorThreadContext {
        creatorContext ?? .defaults()
    }

    private var composerPlaceholder: String {
        if mode == .aiAssistant { return "Ask Pantopus AI…" }
        if isCreatorQuotaLocked, let quota = resolvedCreatorContext.quota {
            return "Out of replies until \(quota.resetCopy.replacingOccurrences(of: "Resets ", with: ""))"
        }
        if mode == .fanThread, let entitlement = viewModel.fanEntitlement {
            let first = firstWord(viewModel.counterparty.displayName)
            if let required = entitlement.requiredReplyTier {
                return "Upgrade to \(required) to reply…"
            }
            return "Message \(first)… (uses 1 of \(entitlement.messageLimit))"
        }
        switch viewModel.counterparty {
        case let .person(name, _, _, _, _): return "Message \(firstWord(name))…"
        case let .group(name, _): return "Message \(firstWord(name))…"
        case .ai: return "Ask Pantopus AI…"
        }
    }

    /// Only locked once the backend has actually reported the fan's
    /// allowance. An unknown entitlement leaves the composer open rather
    /// than guessing a cap.
    private var isFanReplyLocked: Bool {
        guard mode == .fanThread, let entitlement = viewModel.fanEntitlement else { return false }
        return !entitlement.canReply
    }

    private var isCreatorQuotaLocked: Bool {
        mode == .creatorThread && (resolvedCreatorContext.quota?.isMaxed ?? false)
    }

    @ViewBuilder private var actionBanner: some View {
        if let reply = viewModel.replyingTo {
            ChatComposerContextBanner(
                title: "Replying to \(reply.senderName)",
                subtitle: reply.text,
                style: .reply
            ) { viewModel.cancelMessageAction() }
        } else if viewModel.editingMessageId != nil {
            ChatComposerContextBanner(
                title: "Editing message",
                subtitle: "Make your changes, then send.",
                style: .edit
            ) { viewModel.cancelMessageAction() }
        }
    }

    private func sendOrPromptForUpgrade() {
        if isFanReplyLocked {
            upgradePromptPresented = true
            return
        }
        Task { await viewModel.send() }
    }

    private func firstWord(_ raw: String) -> String {
        raw.split(separator: " ").first.map(String.init) ?? raw
    }

    /// Camera capture → JPEG (~0.8) → the same queued-attachment path the
    /// photo picker feeds, so send/upload behavior is identical.
    private func handleCapturedPhoto(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.8) else { return }
        viewModel.queueAttachment(
            kind: .image,
            filename: "camera-\(UUID().uuidString).jpg",
            mimeType: "image/jpeg",
            data: data
        )
    }

    private func handlePickedPhotos(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            for item in items.prefix(5) {
                guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
                let mimeType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
                let ext = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
                await MainActor.run {
                    viewModel.queueAttachment(
                        kind: mimeType.hasPrefix("image/") ? .image : .document,
                        filename: "chat-\(UUID().uuidString).\(ext)",
                        mimeType: mimeType,
                        data: data
                    )
                }
            }
            await MainActor.run { photosPickerSelection = [] }
        }
    }

    private func handlePickedDocuments(_ result: Result<[URL], any Error>) {
        guard case let .success(urls) = result else { return }
        Task {
            for url in urls.prefix(5) {
                let didStart = url.startAccessingSecurityScopedResource()
                defer {
                    if didStart { url.stopAccessingSecurityScopedResource() }
                }
                guard let data = try? Data(contentsOf: url) else { continue }
                let values = try? url.resourceValues(forKeys: [.contentTypeKey, .localizedNameKey])
                let mimeType = values?.contentType?.preferredMIMEType ?? "application/octet-stream"
                let filename = values?.localizedName ?? url.lastPathComponent
                await MainActor.run {
                    viewModel.queueAttachment(
                        kind: mimeType.hasPrefix("image/") ? .image : .document,
                        filename: filename,
                        mimeType: mimeType,
                        data: data
                    )
                }
            }
        }
    }

    private func openGigDetail(gigId: String) {
        guard let url = URL(string: "pantopus://gigs/\(gigId)") else { return }
        DeepLinkRouter.shared.handle(url: url)
    }

    private func openListingDetail(listingId: String) {
        guard let url = URL(string: "pantopus://listings/\(listingId)") else { return }
        DeepLinkRouter.shared.handle(url: url)
    }

    private func openLocationInMaps(_ card: ChatLocationCard) {
        guard let url = URL(string: "http://maps.apple.com/?ll=\(card.latitude),\(card.longitude)") else { return }
        openURL(url)
    }

    private var incomingInitials: String? {
        guard mode == .dm else { return nil }
        switch viewModel.counterparty {
        case let .person(_, initials, _, _, _): return initials
        case let .group(name, _): return initials(of: name)
        case .ai: return nil
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case .empty: emptyFrame
        case let .loaded(rows): populatedFrame(rows)
        case let .error(message): errorFrame(message)
        }
    }

    // MARK: - Frames

    private var loadingFrame: some View {
        // Alternating left/right pseudo-bubble shimmers approximate the
        // populated chat geometry so the loading state doesn't reflow when
        // messages arrive.
        VStack(spacing: Spacing.s3) {
            ForEach(0..<6, id: \.self) { index in
                HStack {
                    if index.isMultiple(of: 2) { Spacer(minLength: Spacing.s8) }
                    Shimmer(
                        width: index.isMultiple(of: 2) ? 220 : 180,
                        height: index.isMultiple(of: 3) ? 60 : 40,
                        cornerRadius: Radii.xl
                    )
                    if !index.isMultiple(of: 2) { Spacer(minLength: Spacing.s8) }
                }
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading conversation")
        .accessibilityIdentifier("chatConversationLoading")
    }

    @ViewBuilder private var emptyFrame: some View {
        if mode == .aiAssistant {
            aiWelcomeFrame
        } else if mode == .fanThread {
            fanEmptyFrame
        } else {
            switch viewModel.counterparty {
            case .ai:
                aiWelcomeFrame
            case let .person(name, initials, locality, verified, _):
                personEmptyFrame(name: name, initials: initials, locality: locality, verified: verified)
            case let .group(name, _):
                personEmptyFrame(name: name, initials: initials(of: name), locality: nil, verified: false)
            }
        }
    }

    /// A15 / A15.2 `.empty` — 88pt avatar, "Say hi", trust pill, then
    /// full-width suggestion cards that fill the composer when tapped.
    /// The A15.2 person preview card (rating · jobs done · reply time ·
    /// mutual neighbors) is design-only for now — it needs profile-stats
    /// data the thread doesn't load today.
    private func personEmptyFrame(name: String, initials: String, locality: String?, verified: Bool) -> some View {
        VStack(spacing: Spacing.s0) {
            Spacer()
            ChatPersonAvatar(initials: initials, verified: verified, online: false, size: 88)
            Text("Say hi")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.top, 16)
            Text(
                locality.map { "This is the start of your conversation with \(firstWord(name)) from \($0)." }
                    ?? "This is the start of your conversation with \(firstWord(name))."
            )
            .font(.system(size: 13))
            .lineSpacing(5)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .multilineTextAlignment(.center)
            .padding(.top, 6)
            emptyTrustPill
                .padding(.top, 10)
            suggestionCards
                .padding(.top, 18)
            Spacer()
        }
        .padding(.horizontal, 28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("chatConversationEmpty")
    }

    /// A15.5 empty fan thread. The design's "Auto-welcome · free" card is
    /// intentionally absent: personas have no welcome-message field on the
    /// wire (`backend/routes/personaDms.js` / `serializeMembershipForFan`),
    /// and the design's literal fixture ("Welcome to the Diary, Maria." —
    /// "— Wynn") would ship one creator's name to every fan.
    private var fanEmptyFrame: some View {
        ScrollView {
            VStack(spacing: 18) {
                VStack(spacing: Spacing.s3) {
                    Text("Start a conversation")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(fanEmptyBody)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 280)
                    if let entitlement = viewModel.fanEntitlement {
                        FanQuotaHero(entitlement: entitlement)
                    }
                    FanOpeners { label in
                        viewModel.composerText = label
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.top, Spacing.s2)
            }
            .padding(.horizontal, 14)
            .padding(.top, 14)
            .padding(.bottom, Spacing.s4)
        }
        .accessibilityIdentifier("chatConversationFanEmpty")
    }

    private var fanEmptyBody: String {
        let name = firstWord(viewModel.counterparty.displayName)
        guard let tier = viewModel.fanEntitlement?.currentTier else {
            return "You can message \(name) directly."
        }
        return "You can message \(name) directly. Each send uses one of your monthly \(tier) replies."
    }

    /// A15 `.empty .sug` — full-width white suggestion cards. Tapping one
    /// fills the composer (the prior quick-chip behavior, restyled).
    private var suggestionCards: some View {
        VStack(spacing: Spacing.s2) {
            ForEach(viewModel.emptyChips) { chip in
                Button {
                    viewModel.composerText = chip.label
                } label: {
                    HStack(spacing: Spacing.s2) {
                        Text(chip.label)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appText)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: Spacing.s2)
                        Icon(.arrowUpRight, size: 14, color: Theme.Color.appTextMuted)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .shadow(color: .black.opacity(0.04), radius: 1.5, y: 1)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("chatQuickChip_\(chip.id)")
            }
        }
    }

    /// A15 `.empty .trust` — "Private between verified neighbors" pill.
    private var emptyTrustPill: some View {
        HStack(spacing: 5) {
            Icon(.shieldCheck, size: 11, strokeWidth: 2.5, color: Theme.Color.success)
            Text("Private between verified neighbors")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Theme.Color.appSurface)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
    }
}

// MARK: - AI welcome

extension ChatConversationView {
    /// A15.3 `.empty` — "Ask me anything" headline, trust pill, then the
    /// 2×2 categorized prompt grid. Tapping a card sends its question.
    private var aiWelcomeFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                ChatAIAvatar(size: 88)
                Text("Ask me anything")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.top, 16)
                Text("I use your verified neighbors, tasks, and mailbox to give answers that fit your block.")
                    .font(.system(size: 13))
                    .lineSpacing(5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 6)
                aiPrivacyRow
                    .padding(.top, 10)
                aiPromptGrid
                    .padding(.top, 18)
            }
            .padding(.horizontal, 28)
            .padding(.top, Spacing.s10)
            .padding(.bottom, Spacing.s4)
            .frame(maxWidth: .infinity)
        }
        .accessibilityIdentifier("chatConversationAI")
    }

    /// A15.3 `.prompt-grid` — 2×2 categorized prompt cards; tapping one
    /// sends its question as the thread's first message.
    private var aiPromptGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: Spacing.s2), GridItem(.flexible(), spacing: Spacing.s2)],
            spacing: Spacing.s2
        ) {
            ForEach(Self.aiPromptCards) { card in
                Button {
                    Task {
                        await viewModel.sendCapabilityPrompt(
                            ChatPromptChip(id: card.id, label: card.question, icon: card.icon)
                        )
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Icon(card.icon, size: 14, color: Theme.Color.appTextInverse)
                            .frame(width: 26, height: 26)
                            .background(card.tint)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        Text(card.category.uppercased())
                            .font(.system(size: 9.5, weight: .bold))
                            .tracking(0.6)
                            .foregroundStyle(Theme.Color.appTextMuted)
                        Text(card.question)
                            .font(.system(size: 12.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appText)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .shadow(color: .black.opacity(0.04), radius: 1.5, y: 1)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(card.question)
                .accessibilityIdentifier("chatAIPromptCard_\(card.id)")
            }
        }
    }

    /// A15.3 prompt-grid fixtures. Category tints approximate the design's
    /// `--cat-handyman` / `--color-primary` / `--color-identity-home` /
    /// `--cat-goods` swatches with the closest theme tokens.
    private static let aiPromptCards: [AIPromptCard] = [
        AIPromptCard(
            id: "tasks", category: "Tasks", icon: .hammer,
            tint: Theme.Color.warning,
            question: "What's a fair price to mount a 55\" TV?"
        ),
        AIPromptCard(
            id: "pulse", category: "Pulse", icon: .pencil,
            tint: Theme.Color.primary600,
            question: "Draft a post asking for a dog-sitter this weekend."
        ),
        AIPromptCard(
            id: "mailbox", category: "Mailbox", icon: .mailbox,
            tint: Theme.Color.home,
            question: "Summarize today's mail and packages."
        ),
        AIPromptCard(
            id: "marketplace", category: "Marketplace", icon: .shoppingBag,
            tint: Theme.Color.success,
            question: "Price my mid-century sofa for a quick sale."
        )
    ]

    /// A15.3 `.ai-welcome` — capability card pinned at the top of a
    /// populated AI thread. The design's info-bg→white gradient is
    /// approximated with a flat `primary50` fill + `primary200` border.
    private var aiWelcomeCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                ChatAIAvatar(size: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Hi — I'm Pantopus AI")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("I can use your verified neighbors, tasks, and mailbox to help.")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s0)
            }
            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)],
                spacing: 6
            ) {
                ForEach(viewModel.aiPrompts) { chip in
                    AICapabilityChip(chip: chip) {
                        Task { await viewModel.sendCapabilityPrompt(chip) }
                    }
                }
            }
        }
        .padding(14)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("chatAIWelcomeCard")
    }

    /// A15.3 `.ai-trust .row` — privacy pill under the empty headline.
    private var aiPrivacyRow: some View {
        HStack(spacing: 5) {
            Icon(.shieldCheck, size: 11, strokeWidth: 2.5, color: Theme.Color.success)
            Text("Private to your account · never shared with neighbors")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Theme.Color.appSurface)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
    }

    // MARK: - Populated + error

    /// Stable id for the timeline's bottom sentinel — the target of every
    /// land-at-latest / stay-pinned scroll.
    private static let bottomAnchorId = "chat_bottom_anchor"
    /// Named coordinate space of the conversation ScrollView — the frame
    /// of the content in this space drives the near-top pagination
    /// trigger and the at-bottom tracking.
    private static let scrollSpaceName = "chatConversationScroll"

    private func populatedFrame(_ rows: [ChatTimelineRow]) -> some View {
        // Gig context strip is loaded by `ChatConversationViewModel.loadGigContextIfNeeded`.
        GeometryReader { geo in
            ScrollViewReader { proxy in
                ScrollView {
                    // A plain (non-lazy) VStack on purpose: pages are
                    // bounded (60 rows/fetch) and exact row heights are
                    // what make `.defaultScrollAnchor(.bottom)` land on
                    // the newest message. LazyVStack positions by
                    // *estimated* heights, which left the first frame in
                    // blank space past the real content and made every
                    // scrollTo land short.
                    VStack(spacing: Spacing.s0) {
                        // A15.5's "Auto-welcome · free" card is omitted:
                        // no persona welcome-message exists on the wire,
                        // and the design's copy is fixture identity.
                        if mode == .aiAssistant {
                            // A15.3 — the welcome card stays pinned at the top
                            // of the populated AI thread.
                            aiWelcomeCard
                                .padding(.bottom, 10)
                        }
                        ForEach(rows) { row in
                            // Row width is measured once at the list level
                            // (viewport minus the 12pt side paddings) — a
                            // per-row GeometryReader made every bubble lay
                            // out twice and snap from the fallback width
                            // while scrolling.
                            timelineRowView(row, rowWidth: max(0, geo.size.width - 24))
                        }
                        Color.clear
                            .frame(height: 4)
                            .id(Self.bottomAnchorId)
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, Spacing.s3)
                    .background(
                        // Scroll tracking. `onAppear`/`onDisappear` row
                        // sentinels only work in lazy stacks, so the
                        // pagination trigger and at-bottom state read the
                        // content frame instead.
                        GeometryReader { contentGeo in
                            let frame = contentGeo.frame(in: .named(Self.scrollSpaceName))
                            Color.clear
                                .onAppear {
                                    handleScrollGeometry(frame: frame, viewportHeight: geo.size.height, rows: rows, proxy: proxy)
                                }
                                .onChange(of: frame) { _, newFrame in
                                    handleScrollGeometry(frame: newFrame, viewportHeight: geo.size.height, rows: rows, proxy: proxy)
                                }
                        }
                    )
                }
                .coordinateSpace(name: Self.scrollSpaceName)
                // Threads open at the latest message (rows project
                // oldest-first), and the bottom stays anchored when new
                // rows land while the user is already at the bottom.
                .defaultScrollAnchor(.bottom)
                .refreshable { await viewModel.refresh() }
                .accessibilityIdentifier("chatConversationContent")
                .task {
                    guard !isLoadOlderArmed else { return }
                    try? await Task.sleep(nanoseconds: 500_000_000)
                    isLoadOlderArmed = true
                    // A thread too short to scroll never changes its
                    // scroll geometry, so the near-top check never
                    // re-fires — kick one fetch so backward pagination
                    // still works there.
                    if scrollMetrics.distanceFromTop < 200, viewModel.canLoadOlder {
                        loadOlderPreservingPosition(rows: rows, proxy: proxy)
                    }
                }
                .task { await landAtLatestMessage(proxy) }
                .onChange(of: rows.last) { oldLast, newLast in
                    pinToBottomIfNeeded(oldLast: oldLast, newLast: newLast, proxy: proxy)
                }
                .onChange(of: viewModel.pendingScrollTargetId) { _, target in
                    guard let target else { return }
                    if reduceMotion {
                        proxy.scrollTo(target, anchor: .center)
                    } else {
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(target, anchor: .center)
                        }
                    }
                    viewModel.consumePendingScroll()
                }
            }
        }
    }

    /// React to the content frame moving inside the scroll viewport:
    /// update the at-bottom flag and fire backward pagination when the
    /// user nears the top of the loaded history.
    private func handleScrollGeometry(
        frame: CGRect,
        viewportHeight: CGFloat,
        rows: [ChatTimelineRow],
        proxy: ScrollViewProxy
    ) {
        scrollMetrics.distanceFromTop = -frame.minY
        let nearBottom = (frame.maxY - viewportHeight) < 120
        if isAtBottom != nearBottom {
            isAtBottom = nearBottom
        }
        guard isLoadOlderArmed,
              !isLoadingOlder,
              viewModel.canLoadOlder,
              scrollMetrics.distanceFromTop < 200 else { return }
        loadOlderPreservingPosition(rows: rows, proxy: proxy)
    }

    /// Force the thread to open at the latest message. The bottom anchor
    /// positions the first frame, but row content that resolves a beat
    /// later (remote images, link previews) can still nudge the layout —
    /// re-pin across a few passes.
    private func landAtLatestMessage(_ proxy: ScrollViewProxy) async {
        // Opened from Chat Search → the pendingScrollTargetId path
        // positions on the matched message instead.
        guard !viewModel.hasPendingSearchTarget else { return }
        proxy.scrollTo(Self.bottomAnchorId, anchor: .bottom)
        for delayMs: UInt64 in [80, 250, 600] {
            try? await Task.sleep(nanoseconds: delayMs * 1_000_000)
            guard !Task.isCancelled else { return }
            proxy.scrollTo(Self.bottomAnchorId, anchor: .bottom)
        }
    }

    /// Keep the viewport pinned to the newest message: always follow the
    /// user's own outgoing send; otherwise only when they're already
    /// reading the latest messages (never yank them out of history).
    private func pinToBottomIfNeeded(
        oldLast: ChatTimelineRow?,
        newLast: ChatTimelineRow?,
        proxy: ScrollViewProxy
    ) {
        guard let newLast else { return }
        let isNewRow = oldLast?.id != newLast.id
        let isOwnSend: Bool = {
            guard isNewRow, case let .bubble(bubble) = newLast else { return false }
            return bubble.side == .outgoing
        }()
        guard isAtBottom || isOwnSend else { return }
        if isNewRow, !reduceMotion {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(Self.bottomAnchorId, anchor: .bottom)
            }
        } else {
            // Same row growing in place (streamed AI reply) — track the
            // bottom without animating every delta.
            proxy.scrollTo(Self.bottomAnchorId, anchor: .bottom)
        }
    }

    /// Fetch the next older page, then put the row that was at the top of
    /// the viewport back there — prepending shifts the existing content
    /// down, which otherwise lands the user on a random older message.
    /// The anchor is the first BUBBLE row: divider ids (day keys) move to
    /// the top of the merged day when older same-day messages prepend,
    /// while a bubble id stays glued to its message.
    private func loadOlderPreservingPosition(rows: [ChatTimelineRow], proxy: ScrollViewProxy) {
        guard !isLoadingOlder else { return }
        isLoadingOlder = true
        let anchorId = rows.first { row in
            if case .bubble = row { return true }
            return false
        }?.id
        Task {
            await viewModel.loadOlder()
            if let anchorId {
                proxy.scrollTo(anchorId, anchor: .top)
                // Second pass once the prepended rows have laid out.
                try? await Task.sleep(nanoseconds: 50_000_000)
                proxy.scrollTo(anchorId, anchor: .top)
            }
            isLoadingOlder = false
        }
    }

    @ViewBuilder
    private func timelineRowView(_ row: ChatTimelineRow, rowWidth: CGFloat) -> some View {
        switch row {
        case let .dayDivider(divider):
            ChatDayDividerRow(label: divider.label)
        case let .topicDivider(divider):
            ChatTopicDividerRow(label: divider.label)
        case let .broadcastReference(reference):
            ChatBroadcastReferenceCard(reference: reference)
        case let .bubble(bubble):
            bubbleRowView(bubble, rowWidth: rowWidth)
        }
    }

    /// Wraps the bubble in selection chrome while bulk-select is
    /// active: a leading check toggle on the user's own persisted
    /// messages, with row taps toggling membership.
    @ViewBuilder
    private func bubbleRowView(_ bubble: ChatBubbleContent, rowWidth: CGFloat) -> some View {
        // Excludes in-flight (`client_`) rows and AI-thread local rows
        // (`ai_user_` / `ai_assistant_`) — neither is persisted, so the
        // bulk-delete loop could never delete them server-side.
        let selectable = bubble.side == .outgoing && !bubble.id.hasPrefix("client_") && !bubble.id.hasPrefix("ai_")
        if isSelecting {
            let isSelected = selectedMessageIds.contains(bubble.id)
            HStack(alignment: .center, spacing: Spacing.s2) {
                Icon(
                    isSelected ? .checkCircle : .circle,
                    size: 20,
                    strokeWidth: 2,
                    color: isSelected ? Theme.Color.primary600 : Theme.Color.appTextMuted
                )
                .frame(width: 28, height: 28)
                .opacity(selectable ? 1 : 0)
                // 36 = the 28pt check column + the 8pt HStack spacing.
                chatBubbleRow(bubble, rowWidth: max(0, rowWidth - 36))
                    .allowsHitTesting(false)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                guard selectable else { return }
                if isSelected {
                    selectedMessageIds.remove(bubble.id)
                } else {
                    selectedMessageIds.insert(bubble.id)
                }
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityIdentifier("chatSelectableRow_\(bubble.id)")
        } else {
            chatBubbleRow(bubble, rowWidth: rowWidth)
        }
    }

    private func chatBubbleRow(_ bubble: ChatBubbleContent, rowWidth: CGFloat) -> some View {
        ChatBubbleRow(
            content: bubble,
            rowWidth: rowWidth,
            incomingInitials: incomingInitials,
            onLockedAction: { upgradePromptPresented = true },
            onReply: { viewModel.beginReply(to: bubble.id) },
            onEdit: { viewModel.beginEdit(messageId: bubble.id) },
            onDelete: { Task { await viewModel.delete(messageId: bubble.id) } },
            onBeginSelect: {
                isSelecting = true
                selectedMessageIds = [bubble.id]
            },
            onReact: { reaction in Task { await viewModel.react(messageId: bubble.id, reaction: reaction) } },
            onUseAIDraft: onUseAIDraft,
            onOpenGig: openGigDetail,
            onOpenListing: openListingDetail,
            onOpenLocation: openLocationInMaps
        ) {
            if bubble.id.hasPrefix("client_") {
                Task { await viewModel.retry(clientId: bubble.id) }
            }
        }
    }

    private func errorFrame(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load this conversation")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button { Task { await viewModel.refresh() } } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("chatConversationError")
    }

    private func initials(of name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

/// One A15.3 prompt-grid card: a tinted icon square, an uppercase
/// category label, and the question that gets sent on tap.
private struct AIPromptCard: Identifiable {
    let id: String
    let category: String
    let icon: PantopusIcon
    let tint: Color
    let question: String
}

// MARK: - Fan thread chrome

private struct FanMembershipStripe: View {
    let entitlement: ChatFanEntitlement
    let onManage: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                Icon(.crown, size: 10, strokeWidth: 2.6, color: Theme.Color.warning)
                Text(entitlement.currentTier.uppercased())
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.warning)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(Theme.Color.warningBg)
            .clipShape(Capsule())

            HStack(spacing: Spacing.s1) {
                Icon(.calendar, size: 11, color: Theme.Color.appTextMuted)
                Text("renews ")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(entitlement.renewsOn)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
            }
            Spacer(minLength: Spacing.s0)
            Button(action: onManage) {
                HStack(spacing: 3) {
                    Text("Manage")
                    Icon(.chevronRight, size: 11, strokeWidth: 2.5, color: Theme.Color.primary600)
                }
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
                .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("chatFanManageMembership")
        }
        .padding(.leading, 14)
        .padding(.trailing, Spacing.s2)
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("chatFanMembershipStripe")
    }
}

private struct FanQuotaGate: View {
    let entitlement: ChatFanEntitlement
    let onUpgrade: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                Icon(.messageSquare, size: 11, strokeWidth: 2.4, color: gateColor)
                Text("\(entitlement.messagesLeft)")
                    .font(.system(size: 11, weight: .heavy))
                Text("of \(entitlement.messageLimit) left")
                    .font(.system(size: 10.5, weight: .bold))
            }
            .foregroundStyle(gateColor)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(entitlement.canReply ? Theme.Color.infoBg : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .stroke(entitlement.canReply ? Theme.Color.infoLight : Theme.Color.warningLight, lineWidth: 1)
            )
            .clipShape(Capsule())

            Text(entitlement.requiredReplyTier.map { "\($0) required" } ?? entitlement.resetCopy)
                .font(.system(size: 10.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
            Spacer(minLength: Spacing.s0)
            Button(action: onUpgrade) {
                HStack(spacing: 3) {
                    Text("Upgrade")
                    Icon(.arrowUpRight, size: 11, strokeWidth: 2.5, color: Theme.Color.primary600)
                }
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Theme.Color.primary600)
                .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("chatFanQuotaUpgrade")
        }
        .padding(.leading, 14)
        .padding(.trailing, Spacing.s2)
        .frame(height: 50)
        .background(entitlement.canReply ? Theme.Color.appSurface : Theme.Color.warningBg)
        .overlay(alignment: .top) {
            Rectangle().fill(entitlement.canReply ? Theme.Color.appBorder : Theme.Color.warningLight).frame(height: 1)
        }
        .accessibilityIdentifier("chatFanQuotaGate")
    }

    private var gateColor: Color {
        entitlement.canReply ? Theme.Color.primary700 : Theme.Color.warning
    }
}

private struct FanQuotaHero: View {
    let entitlement: ChatFanEntitlement

    var body: some View {
        HStack(spacing: 6) {
            Icon(.messageSquare, size: 13, strokeWidth: 2.5, color: Theme.Color.primary700)
            Text("\(entitlement.messageLimit) messages")
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(Theme.Color.primary700)
            Text("this period")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.primary700)
            Text("·")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.primary300)
            Text(entitlement.resetCopy)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.primary600)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 6)
        .background(Theme.Color.infoBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                .stroke(Theme.Color.infoLight, lineWidth: 1)
        )
        .clipShape(Capsule())
        .accessibilityIdentifier("chatFanQuotaHero")
    }
}

private struct FanOpeners: View {
    let onSelect: @MainActor (String) -> Void

    /// Persona-neutral openers. The design's copy is sourdough-specific
    /// fixture text; there is no per-persona suggested-prompt payload on
    /// the wire, so these stay generic rather than pretending to know what
    /// this creator is about.
    private let openers: [FanOpener] = [
        FanOpener(
            id: "question",
            icon: .helpCircle,
            label: "Ask a question",
            title: "I have a question about"
        ),
        FanOpener(
            id: "photo",
            icon: .image,
            label: "Share something",
            title: "Sending a photo for your feedback"
        ),
        FanOpener(
            id: "hello",
            icon: .messageSquare,
            label: "Say hi",
            title: "Just joined — happy to be here!"
        )
    ]

    var body: some View {
        VStack(spacing: Spacing.s2) {
            ForEach(openers, id: \.id) { opener in
                Button {
                    onSelect(opener.title)
                } label: {
                    HStack(spacing: 10) {
                        Icon(opener.icon, size: 14, color: Theme.Color.business)
                            .frame(width: 30, height: 30)
                            .background(Theme.Color.businessBg)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(opener.label.uppercased())
                                .font(.system(size: 9.5, weight: .bold))
                                .tracking(0.6)
                                .foregroundStyle(Theme.Color.appTextMuted)
                            Text(opener.title)
                                .font(.system(size: 12.5, weight: .medium))
                                .foregroundStyle(Theme.Color.appText)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: Spacing.s0)
                        Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .frame(minHeight: 50)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("chatFanOpener_\(opener.id)")
            }
        }
        .accessibilityIdentifier("chatFanOpeners")
    }
}

private struct FanOpener: Identifiable {
    let id: String
    let icon: PantopusIcon
    let label: String
    let title: String
}

struct FanTierUpgradePromptSheet: View {
    let entitlement: ChatFanEntitlement

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HStack(spacing: Spacing.s3) {
                Icon(.lock, size: 20, color: Theme.Color.primary600)
                    .frame(width: 44, height: 44)
                    .background(Theme.Color.primary50)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 3) {
                    Text("Upgrade to \(entitlement.requiredReplyTier ?? "Silver")")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Your \(entitlement.currentTier) support does not unlock this reply yet.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                FanUpgradeBenefit(icon: .messageSquare, title: "Read tier-locked replies")
                FanUpgradeBenefit(icon: .arrowUpRight, title: "Reply without the current tier gate")
                FanUpgradeBenefit(icon: .crown, title: "Keep supporting this creator")
            }

            Button {} label: {
                Text("Upgrade membership")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("chatFanUpgradeConfirm")
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s6)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("chatFanUpgradePromptSheet")
    }
}

private struct FanUpgradeBenefit: View {
    let icon: PantopusIcon
    let title: String

    var body: some View {
        HStack(spacing: 10) {
            Icon(icon, size: 14, color: Theme.Color.primary600)
                .frame(width: 28, height: 28)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
    }
}

// MARK: - Header

private struct ChatConversationHeader: View {
    let mode: ChatConversationMode
    let counterparty: ChatCounterparty
    let creatorContext: ChatCreatorThreadContext
    let onBack: @MainActor () -> Void
    /// Opens the conversation-details drawer (topics + safety actions).
    var onOpenDetails: @MainActor () -> Void = {}

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 20, color: Theme.Color.appText)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            avatar
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    // A15 `.chat-id .name` — 14pt / 700.
                    Text(counterparty.displayName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if mode == .aiAssistant { aiBadge }
                    if mode == .fanThread { personaPill }
                    if mode == .creatorThread {
                        CreatorTierChip(
                            name: creatorContext.fanTierName,
                            rank: creatorContext.fanTierRank
                        )
                    }
                }
                if let presence {
                    HStack(spacing: 5) {
                        if presenceOnline {
                            Circle().fill(Theme.Color.success).frame(width: 6, height: 6)
                        }
                        // A15 `.chat-id .sub` — 11pt regular.
                        Text(presence)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
            }
            Spacer(minLength: Spacing.s0)
            trailingActions
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(height: mode == .creatorThread ? 64 : 56)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("chatConversationHeader")
    }

    @ViewBuilder private var avatar: some View {
        if mode == .aiAssistant {
            ChatAIAvatar(size: 36)
        } else if mode == .fanThread {
            ChatFanPersonaAvatar(initials: fanInitials, size: 36)
        } else if mode == .creatorThread {
            switch counterparty {
            case let .person(_, initials, _, verified, online):
                ChatPersonAvatar(
                    initials: initials,
                    verified: verified,
                    online: online,
                    size: 36,
                    ringColor: creatorTierColor(rank: creatorContext.fanTierRank)
                )
            case let .group(name, _):
                ChatPersonAvatar(
                    initials: groupInitials(name),
                    verified: false,
                    online: false,
                    size: 36,
                    ringColor: creatorTierColor(rank: creatorContext.fanTierRank)
                )
            case .ai:
                ChatAIAvatar(size: 36)
            }
        } else {
            switch counterparty {
            case let .person(_, initials, _, verified, online):
                ChatPersonAvatar(initials: initials, verified: verified, online: online, size: 36)
            case let .group(name, _):
                ChatPersonAvatar(initials: groupInitials(name), verified: false, online: false, size: 36)
            case .ai:
                ChatAIAvatar(size: 36)
            }
        }
    }

    @ViewBuilder private var trailingActions: some View {
        if mode == .fanThread {
            HStack(spacing: Spacing.s0) {
                Icon(.externalLink, size: 18, color: Theme.Color.appText).frame(width: 34, height: 34)
                Icon(.moreHorizontal, size: 18, color: Theme.Color.appText).frame(width: 34, height: 34)
            }
            .accessibilityHidden(true)
        } else if mode == .creatorThread {
            HStack(spacing: Spacing.s0) {
                Icon(.user, size: 18, color: Theme.Color.appText).frame(width: 34, height: 34)
                Icon(.moreHorizontal, size: 18, color: Theme.Color.appText).frame(width: 34, height: 34)
            }
            .accessibilityHidden(true)
        } else {
            switch counterparty {
            case .person:
                // A15 / A15.2 header actions: phone then info. Calling
                // ships later — the phone button is a no-op affordance
                // for now, per design.
                HStack(spacing: 2) {
                    Button {} label: {
                        Icon(.phone, size: 20, color: Theme.Color.appTextStrong)
                            .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Call")
                    Button(action: onOpenDetails) {
                        Icon(.info, size: 20, color: Theme.Color.appTextStrong)
                            .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Conversation details")
                }
            case .ai:
                // A15.3 header actions: square-pen "New chat" then
                // more-horizontal. The VM has no AI-thread reset API yet
                // (history is session-scoped in AIConversationStore) — the
                // button is a no-op until reset lands.
                HStack(spacing: 2) {
                    Button {} label: {
                        Icon(.squarePen, size: 18, color: Theme.Color.appTextStrong)
                            .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("New chat")
                    Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextStrong)
                        .frame(width: 34, height: 34)
                        .accessibilityHidden(true)
                }
            case .group:
                Icon(.moreVertical, size: 18, color: Theme.Color.appText)
                    .frame(width: 34, height: 34)
                    .accessibilityHidden(true)
            }
        }
    }

    /// A15.3 `.ai-badge` — "AI" mini-badge in the name row (sparkles
    /// glyph, primary50 on primary700).
    private var aiBadge: some View {
        HStack(spacing: 3) {
            Icon(.sparkles, size: 8, strokeWidth: 3, color: Theme.Color.primary700)
            Text("AI")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.primary700)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 1)
        .background(Theme.Color.primary50)
        .clipShape(Capsule())
    }

    private var personaPill: some View {
        HStack(spacing: 3) {
            Icon(.briefcase, size: 9, strokeWidth: 2.6, color: Theme.Color.business)
            Text("Persona")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.business)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(Theme.Color.businessBg)
        .clipShape(Capsule())
    }

    private var presence: String? {
        if mode == .fanThread {
            switch counterparty {
            case let .person(_, _, locality, _, _):
                return locality.map { "\($0) · creator" } ?? "Creator"
            default:
                return "Creator"
            }
        }
        if mode == .creatorThread {
            return creatorContext.fanSubtitle
        }
        switch counterparty {
        case let .person(_, _, locality, _, online):
            let prefix = online ? "Active now" : "Verified neighbor"
            if let locality { return "\(prefix) · \(locality)" }
            return prefix
        case let .group(_, memberCount):
            return memberCount.map { "\($0) members" }
        case .ai:
            return "Replies in seconds · powered by Pantopus AI"
        }
    }

    private var presenceOnline: Bool {
        if mode == .fanThread { return true }
        if mode == .creatorThread {
            return creatorContext.fanTierRank > 1
        }
        if case let .person(_, _, _, _, online) = counterparty { return online }
        return false
    }

    private var fanInitials: String {
        switch counterparty {
        case let .person(_, initials, _, _, _): initials
        case let .group(name, _): groupInitials(name)
        case .ai: "AI"
        }
    }

    private func groupInitials(_ name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

// MARK: - Creator chrome

private struct ChatCreatorAudienceStrip: View {
    let context: ChatCreatorThreadContext
    let onOpenAudienceProfile: @MainActor () -> Void

    var body: some View {
        Button(action: onOpenAudienceProfile) {
            HStack(spacing: 10) {
                Icon(.users, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    .frame(width: 28, height: 28)
                    .background(Theme.Color.business)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(context.personaName.map { "Creator inbox · \($0)" } ?? "Creator inbox")
                        .font(.system(size: 11.5, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(Theme.Color.business)
                        .textCase(.uppercase)
                        .lineLimit(1)
                    // Reach / engagement line only when the caller has real
                    // analytics — there is no per-thread analytics payload.
                    if let summary = context.audienceSummary {
                        Text(summary)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, strokeWidth: 2.4, color: Theme.Color.business)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.businessBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.business.opacity(0.18), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s3)
        .padding(.top, 10)
        .accessibilityLabel("Open audience profile")
        .accessibilityIdentifier("chatCreatorAudienceStrip")
    }
}

private struct ChatCreatorQuotaMeter: View {
    let quota: ChatCreatorQuota

    private var progress: CGFloat {
        guard quota.total > 0 else { return 0 }
        return min(max(CGFloat(quota.used) / CGFloat(quota.total), 0), 1)
    }

    private var fillColor: Color {
        quota.isMaxed ? Theme.Color.error : Theme.Color.primary600
    }

    private var countColor: Color {
        quota.isMaxed ? Theme.Color.error : Theme.Color.appText
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                HStack(spacing: 5) {
                    Icon(.messageSquare, size: 11, strokeWidth: 2.5, color: Theme.Color.business)
                    Text("Replies this week")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                Text("\(quota.used) of \(quota.total) replies this week")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(countColor)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                    RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                        .fill(fillColor)
                        .frame(width: proxy.size.width * progress)
                }
            }
            .frame(height: 4)
            HStack(spacing: Spacing.s1) {
                Icon(.refreshCw, size: 10, strokeWidth: 2.4, color: Theme.Color.appTextMuted)
                Text(quota.resetCopy)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier(quota.isMaxed ? "chatCreatorQuotaMeterMaxed" : "chatCreatorQuotaMeter")
    }
}

private struct CreatorQuotaExhaustedPill: View {
    let tierName: String
    let fanName: String
    let total: Int

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertTriangle, size: 12, strokeWidth: 2.4, color: Theme.Color.warning)
            Text("You've used your \(total) weekly \(tierName) replies with \(fanName)")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.warningLight).frame(height: 1)
        }
        .accessibilityIdentifier("chatCreatorQuotaExhaustedPill")
    }
}

/// A15.4 `.upgrade-card` — head, optional creator-authored body, perk
/// rows, and the "Not now" / "Send offer" pair. Every string comes from
/// `ChatCreatorUpgradeOffer` (real tier data); nothing is synthesised
/// here, and the whole card is omitted upstream when the offer is nil.
private struct CreatorUpgradeFanCard: View {
    let fanName: String
    let currentTierName: String
    let offer: ChatCreatorUpgradeOffer
    let onDismiss: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            head
            if let summary = offer.summary {
                Text(summary)
                    .font(.system(size: 12))
                    .lineSpacing(5)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !offer.perks.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    ForEach(offer.perks, id: \.self) { perk in
                        HStack(spacing: 6) {
                            Icon(.check, size: 12, strokeWidth: 2.5, color: Theme.Color.success)
                            Text(perk)
                                .font(.system(size: 11.5))
                                .foregroundStyle(Theme.Color.appTextStrong)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(.vertical, 2)
                .accessibilityIdentifier("chatCreatorUpgradeFanPerks")
            }
            actions
            if !offer.canSendOffer {
                Text("Sending upgrade offers isn't available yet.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .accessibilityIdentifier("chatCreatorUpgradeFanCardUnavailable")
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .accessibilityIdentifier("chatCreatorUpgradeFanCard")
    }

    private var head: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.crown, size: 15, strokeWidth: 2.4, color: Theme.Color.warning)
                .frame(width: 30, height: 30)
                .background(Theme.Color.warningLight)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text("Invite \(fanName) to \(offer.tierName)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    /// Price plus the fan's current tier — both known values, no perk claim.
    private var subtitle: String? {
        guard let price = offer.priceLabel else { return nil }
        return "\(price) · currently on \(currentTierName)"
    }

    private var actions: some View {
        HStack(spacing: 6) {
            Button(action: onDismiss) {
                Text("Not now")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("chatCreatorUpgradeFanDismiss")
            // Enabled only once a creator→fan upgrade-offer endpoint
            // exists; there is none on the wire today.
            Button {} label: {
                HStack(spacing: 5) {
                    Icon(.send, size: 13, strokeWidth: 2.5, color: Theme.Color.appTextInverse)
                    Text("Send offer")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(offer.canSendOffer ? Theme.Color.warning : Theme.Color.appTextMuted)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .opacity(offer.canSendOffer ? 1 : 0.6)
            }
            .buttonStyle(.plain)
            .disabled(!offer.canSendOffer)
            .accessibilityIdentifier("chatCreatorUpgradeFanSend")
        }
    }
}

/// A15.4 `.lock-row` — sits under the composer while the creator's weekly
/// reply allowance for this fan is spent.
private struct CreatorQuotaLockRow: View {
    let tierName: String
    let fanName: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.alertTriangle, size: 11, strokeWidth: 2.4, color: Theme.Color.warning)
            Text("\(tierName) cap reached. Upgrade \(fanName) or wait for the reset.")
                .font(.system(size: 10.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .accessibilityIdentifier("chatCreatorQuotaLockRow")
    }
}

private struct CreatorTierChip: View {
    let name: String
    let rank: Int

    var body: some View {
        HStack(spacing: 3) {
            if rank >= 4 {
                Icon(.crown, size: 9, strokeWidth: 2.4, color: creatorTierColor(rank: rank))
            } else if rank >= 2 {
                Icon(.shield, size: 9, strokeWidth: 2.4, color: creatorTierColor(rank: rank))
            }
            Text(name.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(creatorTierColor(rank: rank))
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(creatorTierBgColor(rank: rank))
        .clipShape(Capsule())
        .accessibilityIdentifier("chatCreatorTierChip")
    }
}

private func creatorTierColor(rank: Int) -> Color {
    switch rank {
    case 1:
        Theme.Color.appTextSecondary
    case 2:
        Theme.Color.warning
    case 3:
        Theme.Color.appTextStrong
    case 4:
        Theme.Color.warning
    default:
        Theme.Color.appTextSecondary
    }
}

private func creatorTierBgColor(rank: Int) -> Color {
    switch rank {
    case 1:
        Theme.Color.appSurfaceSunken
    case 2:
        Theme.Color.warningBg
    case 3:
        Theme.Color.appSurfaceSunken
    case 4:
        Theme.Color.warningLight
    default:
        Theme.Color.appSurfaceSunken
    }
}

private struct ChatFanPersonaAvatar: View {
    let initials: String
    let size: CGFloat

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(Theme.Color.business)
                .frame(width: size, height: size)
            Circle()
                .strokeBorder(Theme.Color.appSurface, lineWidth: 2)
                .overlay(
                    Circle()
                        .strokeBorder(Theme.Color.businessBg, lineWidth: 3)
                        .padding(2)
                )
                .frame(width: size, height: size)
            Text(initials)
                .font(.system(size: size * 0.38, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(width: size, height: size)
            Circle()
                .fill(Theme.Color.success)
                .frame(width: 10, height: 10)
                .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
        }
        .frame(width: size + 4, height: size + 4)
        .accessibilityHidden(true)
    }
}

// MARK: - Avatars

private struct ChatPersonAvatar: View {
    let initials: String
    let verified: Bool
    let online: Bool
    let size: CGFloat
    var ringColor: Color?

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(Theme.Color.primary500)
                Text(initials)
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(width: size, height: size)
            .overlay {
                if let ringColor {
                    Circle()
                        .stroke(Theme.Color.appSurface, lineWidth: 4)
                    Circle()
                        .stroke(ringColor, lineWidth: 2)
                        .padding(1)
                }
            }
            if verified {
                // A15 `.vb` — verified badge is SUCCESS green (Theme.Color.success),
                // 14pt on the 36 header avatar, capped at 24pt on the
                // 88 empty-state avatar.
                Icon(.check, size: min(12, max(6, size * 0.22)), strokeWidth: 3.5, color: Theme.Color.appTextInverse)
                    .frame(width: min(24, max(12, size * 0.4)), height: min(24, max(12, size * 0.4)))
                    .background(Theme.Color.success)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 1, y: 1)
            }
            if online {
                Circle()
                    .fill(Theme.Color.success)
                    .frame(width: 9, height: 9)
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: -2, y: -size + 3)
            }
        }
        .frame(width: size + 4, height: size + 4)
    }
}

// MARK: - Day divider + bubble rows

private struct ChatDayDividerRow: View {
    let label: String

    var body: some View {
        // A15 `.day` — 10.5pt / 700 uppercase label flanked by 1px
        // `appBorder` lines.
        HStack(spacing: Spacing.s2) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextMuted)
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .padding(.vertical, 6)
    }
}

/// Topic-divider row — marks where the "All" view crosses into a
/// different conversation topic (task / listing / general).
private struct ChatTopicDividerRow: View {
    let label: String

    var body: some View {
        HStack(spacing: 10) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            HStack(spacing: Spacing.s1) {
                Icon(.tag, size: 10, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 3)
            .background(Theme.Color.appSurfaceMuted)
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Topic \(label)")
        .accessibilityIdentifier("chatTopicDivider")
    }
}

// MARK: - Bulk-selection chrome

private struct ChatSelectionTopBar: View {
    let count: Int
    let onCancel: @MainActor () -> Void

    var body: some View {
        HStack {
            Text("\(count) selected")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s0)
            Button(action: onCancel) {
                Text("Cancel")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("chatSelectionCancel")
        }
        .padding(.horizontal, Spacing.s4)
        .frame(height: 44)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("chatSelectionTopBar")
    }
}

private struct ChatSelectionDeleteBar: View {
    let selectedCount: Int
    let onDelete: @MainActor () -> Void

    var body: some View {
        Button(action: onDelete) {
            HStack(spacing: Spacing.s2) {
                Icon(
                    .trash2,
                    size: 15,
                    strokeWidth: 2.4,
                    color: selectedCount == 0 ? Theme.Color.appTextMuted : Theme.Color.appTextInverse
                )
                Text("Delete")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(selectedCount == 0 ? Theme.Color.appTextMuted : Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(selectedCount == 0 ? Theme.Color.appSurfaceSunken : Theme.Color.error)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(selectedCount == 0)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s6)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityLabel("Delete \(selectedCount) selected messages")
        .accessibilityIdentifier("chatSelectionDelete")
    }
}

private struct ChatBroadcastReferenceCard: View {
    let reference: ChatBroadcastReference

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Icon(.radioTower, size: 15, strokeWidth: 2.5, color: Theme.Color.business)
                .frame(width: 30, height: 30)
                .background(Theme.Color.businessBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Broadcast referenced")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.business)
                    .textCase(.uppercase)
                Text(reference.title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(reference.subtitle)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(2)
                Text(reference.metric)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.business.opacity(0.18), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("chatBroadcastReference_\(reference.id)")
    }
}

/// A15.2 `.link-bubble` preview card — white surface, 1px hairline,
/// 12pt radius, optional image strip, host overline + title +
/// description. Tap opens the URL in the system browser.
private struct ChatLinkPreviewCard: View {
    let metadata: LinkPreviewMetadata
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button { openURL(metadata.url) } label: {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                if let imageURL = metadata.imageURL {
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case let .success(image):
                            image.resizable().scaledToFill()
                        default:
                            Theme.Color.appSurfaceSunken
                        }
                    }
                    .frame(height: 88)
                    .frame(maxWidth: .infinity)
                    .clipped()
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(metadata.host)
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(0.4)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .lineLimit(1)
                    Text(metadata.title)
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                    if let description = metadata.description {
                        Text(description)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .multilineTextAlignment(.leading)
                            .lineLimit(2)
                    }
                }
                .padding(Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Link preview: \(metadata.title)")
        .accessibilityIdentifier("chatLinkPreview_\(metadata.url.absoluteString)")
    }
}

// swiftlint:disable:next type_body_length
private struct ChatBubbleRow: View {
    // A15 `.bubble { max-width: 78% }` (fractional, not fixed) —
    // `rowWidth` is the available row width, measured once at the list
    // level and passed in. Until it resolves, fall back to a sensible
    // fixed cap. AI replies stretch to 82% per `.bubble.ai`.
    private static let fallbackBubbleMaxWidth: CGFloat = 260
    private static let bubbleHorizontalPadding: CGFloat = 12
    private var bubbleMaxWidth: CGFloat {
        let fraction: CGFloat = isAIReplyBody ? 0.82 : 0.78
        return rowWidth > 0 ? rowWidth * fraction : Self.fallbackBubbleMaxWidth
    }

    private var bubbleTextMaxWidth: CGFloat {
        bubbleMaxWidth - (Self.bubbleHorizontalPadding * 2)
    }

    private var isAIReplyBody: Bool {
        if case .aiReply = content.body { return true }
        return false
    }

    let content: ChatBubbleContent
    let rowWidth: CGFloat
    let incomingInitials: String?
    let onLockedAction: @MainActor () -> Void
    let onReply: @MainActor () -> Void
    let onEdit: @MainActor () -> Void
    let onDelete: @MainActor () -> Void
    /// Enters bulk-selection mode seeded with this message (own
    /// persisted messages only).
    let onBeginSelect: @MainActor () -> Void
    let onReact: @MainActor (String) -> Void
    let onUseAIDraft: @MainActor (ChatAIDraftCard) -> Void
    let onOpenGig: @MainActor (String) -> Void
    let onOpenListing: @MainActor (String) -> Void
    let onOpenLocation: @MainActor (ChatLocationCard) -> Void
    let onRetry: @MainActor () -> Void

    var body: some View {
        // A15 `.msg-row { align-items: flex-end }` — mini avatar and
        // bubble align at the bottom edge.
        HStack(alignment: .bottom, spacing: Spacing.s2) {
            if content.side == .outgoing {
                Spacer(minLength: 44)
                bubbleStack
            } else {
                if let incomingInitials, showsIncomingAvatarSlot {
                    ChatMiniAvatar(initials: incomingInitials, hidden: content.isContinuation)
                }
                bubbleStack
                Spacer(minLength: 44)
            }
        }
        .frame(maxWidth: .infinity, alignment: alignmentToFrameAlignment)
        // A15 group rhythm — 2pt above a continuation bubble, 4pt above
        // a new same/other-sender group (`.scroll gap: 4` + `.same -2`).
        .padding(.top, content.isContinuation ? 2 : 4)
        .contextMenu {
            Button { onReply() } label: {
                Text("Reply")
            }
            if let copyText {
                Button { UIPasteboard.general.string = copyText } label: {
                    Text("Copy")
                }
            }
            ForEach(["👍", "❤️", "😂", "🔥"], id: \.self) { reaction in
                Button { onReact(reaction) } label: {
                    Text(reaction)
                }
            }
            // `client_` rows aren't persisted yet; `ai_`-prefixed rows
            // (AI-thread local messages) are never persisted server-side,
            // so Edit/Delete would PUT/DELETE an id that can't exist.
            if content.side == .outgoing && !content.id.hasPrefix("client_") && !content.id.hasPrefix("ai_") {
                Button { onBeginSelect() } label: {
                    Text("Select")
                }
                Button { onEdit() } label: {
                    Text("Edit")
                }
                Button(role: .destructive) { onDelete() } label: {
                    Text("Delete")
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// Plain text carried by the bubble — the context menu's Copy
    /// payload. `nil` for media-only bodies (photo / location / offer
    /// cards), which hides the Copy item.
    private var copyText: String? {
        switch content.body {
        case let .text(text):
            text.isEmpty ? nil : text
        case let .textWithImages(text, _):
            text.isEmpty ? nil : text
        case let .aiReply(text, _, _):
            text.isEmpty ? nil : text
        case .attachment, .image, .systemLink, .locationCard, .gigOfferCard, .listingOfferCard:
            nil
        }
    }

    private var bubbleStack: some View {
        VStack(alignment: alignment, spacing: Spacing.s0) {
            bubbleBody
                // A15 `.reaction` — pills float over the bubble's bottom
                // edge: leading corner for outgoing, trailing for
                // incoming, hanging 10pt below.
                .overlay(alignment: content.side == .outgoing ? .bottomLeading : .bottomTrailing) {
                    if !content.reactions.isEmpty {
                        reactionRow(content.reactions)
                            .offset(x: content.side == .outgoing ? 8 : -8, y: 10)
                    }
                }
                .padding(.bottom, content.reactions.isEmpty ? 0 : 10)
            // A15.2 `.link-bubble` — preview card for the first http(s)
            // URL in a plain text body, below the bubble in the same
            // column. Rendered only once metadata resolved (no
            // skeleton; nothing on failure — the inline link stays
            // tappable either way).
            if let url = linkPreviewURL, let metadata = LinkPreviewStore.shared.metadata(for: url) {
                ChatLinkPreviewCard(metadata: metadata)
                    .padding(.top, Spacing.s1)
            }
            if let tier = content.sentSupportTier, content.side == .outgoing {
                paidSupportFooter(tier: tier)
            }
            if let stamp = content.stamp {
                stampView(stamp)
            }
        }
        // Cap the column at the bubble max width instead of fixing it to
        // its ideal width — `fixedSize(horizontal: true)` forced every
        // Text onto one line, truncating long messages with "…" instead
        // of wrapping them.
        .frame(maxWidth: bubbleMaxWidth, alignment: alignmentToFrameAlignment)
        .task(id: linkPreviewURL?.absoluteString) {
            if let url = linkPreviewURL {
                await LinkPreviewStore.shared.fetchIfNeeded(url)
            }
        }
    }

    /// First http(s) URL in a plain `.text` / `.textWithImages` body —
    /// detection lives in the view layer (A15.2), never the projection.
    /// AI replies and rich cards are excluded by the switch.
    private var linkPreviewURL: URL? {
        switch content.body {
        case let .text(text):
            ChatLinkDetection.firstURL(in: text)
        case let .textWithImages(text, _):
            ChatLinkDetection.firstURL(in: text)
        default:
            nil
        }
    }

    @ViewBuilder private var bubbleBody: some View {
        switch content.body {
        case let .text(text):
            if Self.isEmojiOnly(text) {
                emojiBody(text)
            } else {
                bubbleContainer { textBody(text) }
            }
        case let .textWithImages(text, imageURLs):
            bubbleContainer { textWithImagesBody(text: text, imageURLs: imageURLs) }
        case let .image(url):
            photoBubble(url)
        case let .attachment(filename, sizeLabel):
            bubbleContainer { attachmentBody(filename: filename, sizeLabel: sizeLabel) }
        case let .systemLink(label, sub, accent):
            systemLinkPill(label: label, sub: sub, accent: accent)
        case let .locationCard(card):
            ChatLocationCardView(card: card, isOutgoing: content.side == .outgoing) { onOpenLocation(card) }
        case let .gigOfferCard(card):
            ChatGigOfferCardView(
                card: card,
                isOutgoing: content.side == .outgoing
            ) { if !card.gigId.isEmpty { onOpenGig(card.gigId) } }
        case let .listingOfferCard(card):
            ChatListingOfferCardView(
                card: card,
                isOutgoing: content.side == .outgoing
            ) { if !card.listingId.isEmpty { onOpenListing(card.listingId) } }
        case let .aiReply(text, estimate, drafts):
            aiReplyBubble(text: text, estimate: estimate, drafts: drafts)
        }
    }

    private func bubbleContainer(@ViewBuilder _ inner: () -> some View) -> some View {
        let isOut = content.side == .outgoing
        // A15 `.bubble` — padding 8/12/9, radius 18 with 6pt sender
        // corners, and the shared `--shadow-sm` lift.
        return inner()
            .padding(.horizontal, Self.bubbleHorizontalPadding)
            .padding(.top, 8)
            .padding(.bottom, 9)
            .foregroundStyle(isOut ? Theme.Color.appTextInverse : Theme.Color.appText)
            .background(
                isOut ? Theme.Color.primary600 : Theme.Color.appSurface,
                in: bubbleShape
            )
            // Incoming bubbles are white with a 1px hairline border;
            // outgoing are solid blue with no border.
            .overlay {
                if !isOut {
                    bubbleShape.stroke(Theme.Color.appBorder, lineWidth: 1)
                }
            }
            .overlay(alignment: .bottom) {
                if let tier = content.lockedTier, content.side == .incoming {
                    lockedPaywallOverlay(tier: tier)
                }
            }
            .clipShape(bubbleShape)
            .shadow(color: .black.opacity(0.04), radius: 1.5, y: 1)
    }

    @ViewBuilder private var replyPreview: some View {
        if let reply = content.replyPreview {
            VStack(alignment: .leading, spacing: 2) {
                Text(reply.senderName)
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(content.side == .outgoing ? Theme.Color.appTextInverse.opacity(0.9) : Theme.Color.primary600)
                Text(reply.text)
                    .font(.system(size: 11))
                    .lineLimit(2)
                    .foregroundStyle(content.side == .outgoing ? Theme.Color.appTextInverse.opacity(0.72) : Theme.Color.appTextSecondary)
            }
            .padding(.leading, 7)
            .padding(.vertical, 4)
            .overlay(alignment: .leading) {
                RoundedRectangle(cornerRadius: Radii.xs)
                    .fill(content.side == .outgoing ? Theme.Color.appTextInverse.opacity(0.45) : Theme.Color.primary600)
                    .frame(width: 3)
            }
            .frame(maxWidth: bubbleTextMaxWidth, alignment: .leading)
            .padding(.bottom, 5)
        }
    }

    private func emojiBody(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 48))
            .lineSpacing(8)
            .accessibilityLabel(text)
    }

    private func textBody(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            replyPreview
            // No explicit width frame — the Text wraps at the width the
            // bubble column proposes (≤ 78% of the row) and hugs its
            // wrapped size so short messages keep small bubbles.
            // A15 `.bubble` type: 13.5pt / 18 line-height.
            Text(linkStyled(text))
                .font(.system(size: 13.5))
                .multilineTextAlignment(.leading)
                .lineSpacing(4.5)
        }
    }

    /// A15.2 — http(s) URLs in the body become tappable links (opening
    /// in the system browser via the `.link` attribute), underlined and
    /// tinted to stay readable on both bubble colours: inverse-ish on
    /// the outgoing blue, `primary600` on the incoming white.
    private func linkStyled(_ text: String) -> AttributedString {
        let matches = ChatLinkDetection.linkMatches(in: text)
        guard !matches.isEmpty else { return AttributedString(text) }
        let linkColor = content.side == .outgoing ? Theme.Color.appTextInverse : Theme.Color.primary600
        var result = AttributedString()
        var cursor = text.startIndex
        for match in matches where match.range.lowerBound >= cursor {
            result += AttributedString(String(text[cursor..<match.range.lowerBound]))
            var link = AttributedString(String(text[match.range]))
            link.link = match.url
            link.underlineStyle = .single
            link.foregroundColor = linkColor
            result += link
            cursor = match.range.upperBound
        }
        result += AttributedString(String(text[cursor...]))
        return result
    }

    /// Emoji-only detection via explicit code-point ranges (mirrors
    /// Android's `isEmojiOnly`). `scalar.properties.isEmoji` is wrong
    /// here — UTS #51 marks ASCII digits, `#`, `*`, `©`, `®`, `™` as
    /// Emoji=Yes, so "123" / "#1" / "911" rendered as giant bare emoji.
    /// At least one qualifying emoji scalar is required; variation
    /// selectors, ZWJ, and skin tones count only as glue.
    private static func isEmojiOnly(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 30 else { return false }
        var sawEmoji = false
        for scalar in trimmed.unicodeScalars {
            if isQualifyingEmojiScalar(scalar.value) {
                sawEmoji = true
            } else if !isEmojiGlueScalar(scalar.value) {
                return false
            }
        }
        return sawEmoji
    }

    /// Scalars that qualify a message as emoji on their own.
    private static func isQualifyingEmojiScalar(_ value: UInt32) -> Bool {
        switch value {
        case 0x1F300...0x1FAFF, // misc symbols & pictographs … symbols extended-A
             0x1F1E6...0x1F1FF, // regional indicators (flags)
             0x2600...0x27BF, // misc symbols + dingbats
             0x2300...0x23FF, // misc technical (⌚ ⏰ …)
             0x2B50, 0x2B55, // star, hollow circle
             0x2190...0x21FF: // arrows
            true
        default:
            false
        }
    }

    /// Modifier scalars allowed between emoji (never qualifying alone).
    private static func isEmojiGlueScalar(_ value: UInt32) -> Bool {
        value == 0xFE0F // variation selector-16
            || value == 0x200D // zero-width joiner
            || (0x1F3FB...0x1F3FF).contains(value) // skin tones
    }

    private func textWithImagesBody(text: String, imageURLs: [URL]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if !text.isEmpty {
                textBody(text)
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 72), spacing: 6)], spacing: 6) {
                ForEach(imageURLs, id: \.absoluteString) { url in
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case let .success(image): image.resizable().scaledToFill()
                        case .failure: PhotoBubblePlaceholder()
                        case .empty: PhotoBubblePlaceholder()
                        @unknown default: PhotoBubblePlaceholder()
                        }
                    }
                    .frame(width: 72, height: 72)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
            }
            .frame(maxWidth: bubbleTextMaxWidth, alignment: .leading)
        }
    }

    private func photoBubble(_ url: URL?) -> some View {
        ZStack(alignment: .bottom) {
            imageBody(url)
                .frame(width: 200, height: 130)
                .background(Theme.Color.appSurfaceSunken)
            if let tier = content.lockedTier, content.side == .incoming {
                lockedPaywallOverlay(tier: tier)
            }
        }
        .clipShape(bubbleShape)
        .overlay(
            bubbleShape.stroke(
                content.side == .incoming ? Theme.Color.appBorder : Color.clear,
                lineWidth: content.side == .incoming ? 1 : 0
            )
        )
        .shadow(color: .black.opacity(0.04), radius: 1.5, y: 1)
        .accessibilityLabel("Photo attachment")
        .accessibilityIdentifier("chatPhotoBubble_\(content.id)")
    }

    @ViewBuilder
    private func imageBody(_ url: URL?) -> some View {
        if let url {
            AsyncImage(url: url) { phase in
                switch phase {
                case let .success(image): image.resizable().scaledToFill()
                case .failure: PhotoBubblePlaceholder()
                case .empty: PhotoBubblePlaceholder()
                @unknown default: PhotoBubblePlaceholder()
                }
            }
        } else {
            PhotoBubblePlaceholder()
        }
    }

    private func attachmentBody(filename: String, sizeLabel: String?) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.file, size: 18, color: Theme.Color.primary600)
            VStack(alignment: .leading, spacing: 1) {
                Text(filename)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(content.side == .outgoing ? Theme.Color.appTextInverse : Theme.Color.appText)
                    .lineLimit(2)
                if let sizeLabel {
                    Text(sizeLabel)
                        .font(.system(size: 11))
                        .foregroundStyle(content.side == .outgoing ? Theme.Color.appTextInverse.opacity(0.7) : Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: bubbleTextMaxWidth, alignment: .leading)
        }
    }

    private func systemLinkPill(label: String, sub: String, accent: ChatBubbleContent.SystemLinkAccent) -> some View {
        let fg = accentForeground(accent)
        let bg = accentBackground(accent)
        return HStack(spacing: Spacing.s2) {
            Icon(.info, size: 12, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                .frame(width: 24, height: 24)
                .background(fg)
                .clipShape(Circle())
            HStack(spacing: 5) {
                Text(label)
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(sub)
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(fg)
                    .lineLimit(1)
            }
            Icon(.chevronRight, size: 13, strokeWidth: 2.4, color: fg)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(bg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                .stroke(fg.opacity(0.2), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .frame(maxWidth: bubbleMaxWidth)
    }

    private func lockedPaywallOverlay(tier: String) -> some View {
        VStack {
            Spacer(minLength: Spacing.s3)
            Button(action: onLockedAction) {
                HStack(spacing: 6) {
                    Icon(.lock, size: 12, strokeWidth: 2.6, color: Theme.Color.primary600)
                    Text("Upgrade to read")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.primary600)
                    Text(tier)
                        .font(.system(size: 10.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.horizontal, 10)
                .frame(minHeight: 44)
                .background(Theme.Color.appSurface)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Upgrade to \(tier) to read")
            .accessibilityIdentifier("chatLockedUpgrade_\(content.id)")
        }
        .frame(maxWidth: bubbleMaxWidth)
        .background(
            LinearGradient(
                colors: [
                    Theme.Color.appSurface.opacity(0.15),
                    Theme.Color.appSurface.opacity(0.96)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .accessibilityIdentifier("chatPaywallOverlay_\(content.id)")
    }

    private func paidSupportFooter(tier: String) -> some View {
        HStack(spacing: 5) {
            Icon(.crown, size: 10, strokeWidth: 2.4, color: Theme.Color.warning)
            Text("Sent with \(tier) support")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.Color.warning)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.warningBg)
        .clipShape(Capsule())
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("chatPaidSupportFooter_\(content.id)")
    }

    /// A15 `.reaction` — white capsule pills with a 1px border that
    /// anchor to the bubble's bottom corner (positioned by the caller's
    /// overlay + offset). Tap toggles the reaction.
    private func reactionRow(_ reactions: [ChatBubbleReaction]) -> some View {
        HStack(spacing: 4) {
            ForEach(reactions) { reaction in
                Button { onReact(reaction.reaction) } label: {
                    HStack(spacing: 3) {
                        Text(reaction.reaction)
                            .font(.system(size: 11))
                        Text("\(reaction.count)")
                            .font(.system(size: 9.5, weight: .bold))
                            .foregroundStyle(
                                reaction.reactedByMe ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                            )
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(Theme.Color.appSurface, in: Capsule())
                    .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                    .shadow(color: .black.opacity(0.04), radius: 1.5, y: 1)
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityIdentifier("chatReactions_\(content.id)")
    }

    // MARK: - AI reply

    /// A15.3 `.bubble.in.ai` — white bordered bubble at 82% max width
    /// with the "Pantopus AI" tag pill. While the reply is streaming and
    /// no text has arrived yet, renders the "Thinking…" row instead.
    private func aiReplyBubble(text: String, estimate: ChatEstimate?, drafts: [ChatAIDraftCard]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            aiTag
            if text.isEmpty, estimate == nil, drafts.isEmpty {
                ChatAIThinkingRow()
            } else {
                Text(text)
                    .font(.system(size: 13.5))
                    .lineSpacing(4.5)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: bubbleTextMaxWidth, alignment: .leading)
                    .foregroundStyle(Theme.Color.appText)
            }
            if let estimate {
                AIEstimateCard(estimate: estimate)
            }
            ForEach(drafts) { draft in
                AIDraftCard(draft: draft, onUse: onUseAIDraft)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: bubbleMaxWidth, alignment: .leading)
        .background(Theme.Color.appSurface, in: aiBubbleShape)
        .overlay(aiBubbleShape.stroke(Theme.Color.appBorder, lineWidth: 1))
        .shadow(color: .black.opacity(0.04), radius: 1.5, y: 1)
    }

    /// A15.3 `.ai-tag` — "Pantopus AI" pill: sparkles glyph + 9.5pt bold
    /// uppercase, primary600 on primary50.
    private var aiTag: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.sparkles, size: 9, strokeWidth: 3, color: Theme.Color.primary600)
            Text("PANTOPUS AI")
                .font(.system(size: 9.5, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.primary600)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 1)
        .background(Theme.Color.primary50)
        .clipShape(Capsule())
    }

    private struct AIDraftCard: View {
        let draft: ChatAIDraftCard
        let onUse: @MainActor (ChatAIDraftCard) -> Void

        var body: some View {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    Icon(icon, size: 14, strokeWidth: 2.4, color: accent)
                        .frame(width: 26, height: 26)
                        .background(background)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    Text(label.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(accent)
                    Spacer(minLength: Spacing.s0)
                    if draft.valid {
                        Text("Draft ready")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.Color.success)
                    }
                }
                Text(draft.title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                if let summary = draft.summary, summary != draft.title {
                    Text(summary)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(3)
                }
                if let price = draft.priceLabel {
                    Text(price)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(accent)
                }
                if draft.type != "mail_summary" {
                    Button { onUse(draft) } label: {
                        HStack(spacing: 5) {
                            Text(actionTitle)
                            Icon(.arrowRight, size: 11, strokeWidth: 2.5, color: accent)
                        }
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(accent)
                        .frame(minHeight: 34)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("chatAIDraftUse_\(draft.type)")
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(accent.opacity(0.22), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("chatAIDraft_\(draft.type)")
        }

        private var label: String {
            switch draft.type {
            case "gig": "Task Draft"
            case "listing": "Listing Draft"
            case "post": "Post Draft"
            case "mail_summary": "Mail Summary"
            default: "Draft"
            }
        }

        private var actionTitle: String {
            switch draft.type {
            case "gig": "Use in task composer"
            case "listing": "Use in listing composer"
            case "post": "Use in Pulse composer"
            default: "Use draft"
            }
        }

        private var icon: PantopusIcon {
            switch draft.type {
            case "gig": .hammer
            case "listing": .tag
            case "post": .pencil
            case "mail_summary": .mailbox
            default: .sparkles
            }
        }

        private var accent: Color {
            switch draft.type {
            case "listing": Theme.Color.success
            case "mail_summary": Theme.Color.warning
            default: Theme.Color.magic
            }
        }

        private var background: Color {
            switch draft.type {
            case "listing": Theme.Color.successBg
            case "mail_summary": Theme.Color.warningBg
            default: Theme.Color.magicBg
            }
        }
    }

    private var aiBubbleShape: some Shape {
        UnevenRoundedRectangle(
            topLeadingRadius: content.isContinuation ? 6 : 18,
            bottomLeadingRadius: content.hasTail ? 6 : 18,
            bottomTrailingRadius: 18,
            topTrailingRadius: 18
        )
    }

    private func stampView(_ raw: String) -> some View {
        HStack(spacing: Spacing.s1) {
            if content.side == .outgoing, content.deliveryState == .read {
                ChatReadReceipt(timestamp: raw)
            } else {
                Text(stampString(raw))
                    .font(.system(size: 10, weight: .regular))
                    .foregroundStyle(Theme.Color.appTextMuted)
                if content.side == .outgoing {
                    switch content.deliveryState {
                    case .read:
                        EmptyView()
                    case .delivered:
                        Icon(.check, size: 10, strokeWidth: 2.0, color: Theme.Color.appTextMuted)
                    case .sending:
                        ProgressView().scaleEffect(0.6).tint(Theme.Color.appTextMuted)
                    case .failed:
                        Button(action: onRetry) {
                            HStack(spacing: 3) {
                                Icon(.alertCircle, size: 11, color: Theme.Color.error)
                                Text("Retry")
                                    .font(.system(size: 10, weight: .semibold))
                                    .underline()
                                    .foregroundStyle(Theme.Color.error)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("chatRetry_\(content.id)")
                    case .none:
                        EmptyView()
                    }
                }
            }
        }
        .padding(.top, 2)
        .padding(.bottom, Spacing.s3)
    }

    private func stampString(_ raw: String) -> String {
        switch content.deliveryState {
        case .read: "Read \(raw)"
        // Delivered is conveyed by the small check icon, not a loud word (RN).
        case .delivered: raw
        case .sending: "Sending..."
        case .failed: "Failed to send"
        case .none: raw
        }
    }

    private var alignment: HorizontalAlignment {
        content.side == .outgoing ? .trailing : .leading
    }

    private var alignmentToFrameAlignment: Alignment {
        content.side == .outgoing ? .trailing : .leading
    }

    private var bubbleShape: some Shape {
        // A15 `.bubble` — radius 18 with a 6pt tail on the sender's
        // bottom corner of the last message in a run, plus a 6pt top
        // corner on the sender's side for continuation bubbles
        // (`.bubble.in.cont` / `.bubble.out.cont`).
        UnevenRoundedRectangle(
            topLeadingRadius: content.side == .incoming && content.isContinuation ? 6 : 18,
            bottomLeadingRadius: content.side == .incoming && content.hasTail ? 6 : 18,
            bottomTrailingRadius: content.side == .outgoing && content.hasTail ? 6 : 18,
            topTrailingRadius: content.side == .outgoing && content.isContinuation ? 6 : 18
        )
    }

    private var showsIncomingAvatarSlot: Bool {
        guard content.side == .incoming else { return false }
        switch content.body {
        case .systemLink, .locationCard, .gigOfferCard, .listingOfferCard:
            return false
        default:
            return true
        }
    }

    private func accentForeground(_ accent: ChatBubbleContent.SystemLinkAccent) -> Color {
        switch accent {
        case .primary: Theme.Color.primary600
        case .success: Theme.Color.success
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        }
    }

    private func accentBackground(_ accent: ChatBubbleContent.SystemLinkAccent) -> Color {
        switch accent {
        case .primary: Theme.Color.primary50
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        case .error: Theme.Color.errorBg
        }
    }
}

private struct ChatMiniAvatar: View {
    let initials: String
    var hidden = false

    var body: some View {
        // A15 `.mini-av` — 22pt circle, 9pt/700 initials. `hidden`
        // keeps the layout slot for continuation bubbles.
        ZStack {
            Circle().fill(Theme.Color.primary500)
            Text(initials)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .frame(width: 22, height: 22)
        .opacity(hidden ? 0 : 1)
        .accessibilityHidden(true)
    }
}

private struct PhotoBubblePlaceholder: View {
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Theme.Color.appSurfaceSunken
            HStack(spacing: 10) {
                ForEach(0..<6, id: \.self) { index in
                    RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                        .fill(Theme.Color.appSurface.opacity(index.isMultiple(of: 2) ? 0.38 : 0.22))
                        .frame(width: 18)
                        .rotationEffect(.degrees(24))
                        .offset(y: CGFloat(index % 3) * 7)
                }
            }
            .padding(.leading, Spacing.s2)
            .accessibilityHidden(true)
            Text("Photo")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(Theme.Color.appSurface.opacity(0.72), in: Capsule())
                .padding(.leading, 10)
                .padding(.bottom, Spacing.s2)
        }
    }
}

private struct ChatReadReceipt: View {
    let timestamp: String

    var body: some View {
        // A15 `.ts.out` — "Read <time>" with a 12pt primary500
        // check-check (two overlapped checks emulate Lucide's glyph).
        HStack(spacing: Spacing.s1) {
            Text("Read \(timestamp)")
                .font(.system(size: 10, weight: .regular))
                .foregroundStyle(Theme.Color.appTextMuted)
            HStack(spacing: -7) {
                Icon(.check, size: 12, strokeWidth: 2.5, color: Theme.Color.primary500)
                Icon(.check, size: 12, strokeWidth: 2.5, color: Theme.Color.primary500)
            }
            .accessibilityHidden(true)
        }
        .accessibilityLabel("Read \(timestamp)")
        .accessibilityIdentifier("chatReadReceipt")
    }
}

/// A15.3 "Thinking" state — shown inside the AI reply bubble while the
/// stream is in flight and no text has arrived yet. A pulsing sparkles
/// glyph plus muted copy (the design's shimmer gradient, simplified).
private struct ChatAIThinkingRow: View {
    @State private var pulsing = false

    var body: some View {
        HStack(spacing: 6) {
            Icon(.sparkles, size: 14, color: Theme.Color.primary600)
                .opacity(pulsing ? 1 : 0.55)
                .scaleEffect(pulsing ? 1.12 : 1)
                .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: pulsing)
            Text("Thinking…")
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .onAppear { pulsing = true }
        .accessibilityLabel("Pantopus AI is thinking")
        .accessibilityIdentifier("chatAIThinking")
    }
}

// MARK: - Typing indicator

private struct ChatTypingIndicator: View {
    let initials: String
    @State private var isAnimating = false

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            ChatMiniAvatar(initials: initials)
            HStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Theme.Color.appTextSecondary)
                        .opacity(isAnimating ? 1.0 : 0.3)
                        .frame(width: 6, height: 6)
                        .animation(
                            .easeInOut(duration: 0.6)
                                .repeatForever(autoreverses: true)
                                .delay(Double(i) * 0.18),
                            value: isAnimating
                        )
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(
                UnevenRoundedRectangle(
                    topLeadingRadius: Radii.xl,
                    bottomLeadingRadius: Radii.xs,
                    bottomTrailingRadius: Radii.xl,
                    topTrailingRadius: Radii.xl
                )
                .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(
                UnevenRoundedRectangle(
                    topLeadingRadius: Radii.xl,
                    bottomLeadingRadius: Radii.xs,
                    bottomTrailingRadius: Radii.xl,
                    topTrailingRadius: Radii.xl
                )
            )
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.top, Spacing.s2)
        .padding(.bottom, 6)
        .onAppear {
            isAnimating = true
        }
        .accessibilityLabel("Typing")
        .accessibilityIdentifier("chatTypingIndicator")
    }
}

// MARK: - Attachment strip

private struct AttachmentStripView: View {
    let attachments: [ChatQueuedAttachment]
    let onRemove: @MainActor (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(attachments) { attachment in
                    AttachmentTile(attachment: attachment, onRemove: onRemove)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, 10)
            .padding(.bottom, 6)
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("chatAttachmentStrip")
    }
}

private struct AttachmentTile: View {
    let attachment: ChatQueuedAttachment
    let onRemove: @MainActor (String) -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            tileBody
                .frame(width: 64, height: 64)
                .background(Theme.Color.appSurfaceSunken)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            Button { onRemove(attachment.id) } label: {
                ZStack {
                    Circle()
                        .fill(Theme.Color.appText.opacity(0.78))
                        .frame(width: 18, height: 18)
                    Icon(.x, size: 11, strokeWidth: 3, color: Theme.Color.appTextInverse)
                }
                .frame(width: 44, height: 44, alignment: .topTrailing)
                .padding(.top, 3)
                .padding(.trailing, 3)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(attachment.filename)")
            .accessibilityIdentifier("chatAttachmentRemove_\(attachment.id)")
        }
        .frame(width: 64, height: 64)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var tileBody: some View {
        switch attachment.kind {
        case .image:
            PhotoBubblePlaceholder()
                .accessibilityLabel("Queued image \(attachment.filename)")
        case .document:
            VStack(spacing: 3) {
                Icon(.fileText, size: 22, color: Theme.Color.primary600)
                Text(attachment.filename)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                    .padding(.horizontal, Spacing.s1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appSurface)
            .accessibilityLabel("Queued document \(attachment.filename)")
        }
    }
}

// MARK: - Composer

private struct ChatComposer: View {
    @Binding var text: String
    let placeholder: String
    let canSend: Bool
    let showsSendCost: Bool
    let isLockedAction: Bool
    /// A15.3 — while the AI reply stream is in flight the send disc
    /// becomes a stop button wired to `onStop`.
    var isStreaming = false
    let onAttach: @MainActor () -> Void
    let onEmoji: @MainActor () -> Void
    let onSend: @MainActor () -> Void
    var onStop: @MainActor () -> Void = {}

    var body: some View {
        // A15 `.composer` — [+ disc] → [input pill with trailing smile]
        // → [send/stop disc].
        HStack(alignment: .bottom, spacing: Spacing.s2) {
            Button(action: onAttach) {
                Icon(.plus, size: 19, strokeWidth: 2, color: Theme.Color.appTextStrong)
                    .frame(width: 36, height: 36)
                    .background(Theme.Color.appSurfaceSunken, in: Circle())
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Attach")
            .accessibilityIdentifier("chatComposerAttach")

            // Input pill — smile lives INSIDE the pill on the right.
            HStack(alignment: .bottom, spacing: Spacing.s2) {
                TextField(placeholder, text: $text, axis: .vertical)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1...4)
                    .submitLabel(.send)
                    .onSubmit { if canSend { onSend() } }
                Button(action: onEmoji) {
                    Icon(.smile, size: 17, color: Theme.Color.appTextMuted)
                        .frame(width: 24, height: 20)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Emoji")
                .accessibilityIdentifier("chatComposerEmoji")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(minHeight: 36)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            if isStreaming {
                stopButton
            } else {
                sendButton
            }
        }
        .padding(.horizontal, 10)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private var sendButton: some View {
        Button(action: onSend) {
            ZStack(alignment: .topTrailing) {
                Icon(
                    isLockedAction ? .lock : .arrowUp,
                    size: 18,
                    strokeWidth: 2.5,
                    color: canSend ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
                )
                .frame(width: 36, height: 36)
                .background(sendBackground, in: Circle())
                // A15 `--shadow-primary` on the active send disc.
                .shadow(
                    color: canSend && !isLockedAction ? Theme.Color.primary600.opacity(0.18) : .clear,
                    radius: 8,
                    y: 3
                )
                .frame(width: 44, height: 44)
                if showsSendCost && canSend {
                    Text("-1")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Theme.Color.primary700)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(Theme.Color.appSurface)
                        .overlay(Capsule().stroke(Theme.Color.primary600, lineWidth: 1))
                        .clipShape(Capsule())
                        .offset(x: 7, y: -6)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(!canSend)
        .accessibilityLabel("Send")
        .accessibilityIdentifier("chatComposerSend")
    }

    /// A15.3 `.composer .stop` — white disc, 1.5px error ring, filled
    /// error square. Cancels the in-flight AI stream.
    private var stopButton: some View {
        Button(action: onStop) {
            ZStack {
                Circle()
                    .fill(Theme.Color.appSurface)
                    .frame(width: 36, height: 36)
                Circle()
                    .stroke(Theme.Color.error, lineWidth: 1.5)
                    .frame(width: 36, height: 36)
                RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                    .fill(Theme.Color.error)
                    .frame(width: 11, height: 11)
            }
            .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Stop generating")
        .accessibilityIdentifier("chatComposerStop")
    }

    private var sendBackground: Color {
        guard canSend else { return Theme.Color.appSurfaceSunken }
        return isLockedAction ? Theme.Color.warning : Theme.Color.primary600
    }
}

private struct ChatComposerContextBanner: View {
    enum Style {
        case reply, edit
    }

    let title: String
    let subtitle: String
    let style: Style
    let onCancel: @MainActor () -> Void

    private var accent: Color {
        style == .reply ? Theme.Color.primary600 : Theme.Color.success
    }

    private var barBackground: Color {
        style == .reply ? Theme.Color.primary50 : Theme.Color.successBg
    }

    var body: some View {
        HStack(spacing: Spacing.s2) {
            // RN reply/edit bars: tinted bar with a 3pt accent stripe.
            RoundedRectangle(cornerRadius: 2)
                .fill(accent)
                .frame(width: 3, height: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(accent)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
            Button(action: onCancel) {
                Icon(.x, size: 14, strokeWidth: 2.5, color: Theme.Color.appTextSecondary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel message action")
        }
        .padding(.leading, Spacing.s3)
        .padding(.trailing, Spacing.s1)
        .frame(height: 50)
        .background(barBackground)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("chatComposerContext")
    }
}

private struct ChatTopicStrip: View {
    let topics: [ChatConversationTopic]
    let selectedTopicId: String?
    let onSelect: @MainActor (String?) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                topicButton(id: nil, title: "All", icon: .messageCircle)
                ForEach(topics) { topic in
                    topicButton(id: topic.id, title: topic.title, icon: icon(for: topic.topicType))
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("chatTopicStrip")
    }

    private func topicButton(id: String?, title: String, icon: PantopusIcon) -> some View {
        let selected = selectedTopicId == id || (id == nil && selectedTopicId == nil)
        return Button { onSelect(id) } label: {
            HStack(spacing: 4) {
                Icon(icon, size: 12, strokeWidth: 2.4, color: selected ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                Text(title)
                    .font(.system(size: 12, weight: selected ? .semibold : .regular))
                    .foregroundStyle(selected ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .frame(height: 30)
            .background(selected ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
            // RN: only the active chip carries a border (primary200).
            .overlay {
                if selected {
                    Capsule().stroke(Theme.Color.primary200, lineWidth: 1)
                }
            }
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func icon(for type: String) -> PantopusIcon {
        switch type {
        case "task": .briefcase
        case "listing": .tag
        case "home": .home
        case "business": .building2
        default: .messageCircle
        }
    }
}
