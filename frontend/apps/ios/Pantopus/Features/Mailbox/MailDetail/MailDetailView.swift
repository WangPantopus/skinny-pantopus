//
//  MailDetailView.swift
//  Pantopus
//
//  Mail item detail screen — dispatches to the bespoke ceremonial layout
//  for each category (A17.1–A17.8). Every variant composes the shared
//  `MailItemDetailShell` (P19) and lives under `Variants/`.
//

import QuickLook
import SwiftUI

// swiftlint:disable file_length trailing_closure type_body_length

public struct MailDetailView: View {
    @State private var viewModel: MailDetailViewModel
    private let mailId: String
    private let onBack: () -> Void
    private let onOpenSenderProfile: (@MainActor (String) -> Void)?
    /// Opens a business's page from the sender card of a letter sent as that
    /// business. Nil leaves such a card without a tap.
    private let onOpenSenderBusiness: (@MainActor (String) -> Void)?
    /// Opens the A17.13 Translation screen for this mail. When set, the
    /// generic detail variant surfaces a "Translate" overflow action.
    private let onTranslate: (@MainActor @Sendable () -> Void)?
    /// A17.12 — opens the Elf-extracted task detail for this mail. When
    /// non-nil the certified variant surfaces a "view task" card. The
    /// closure receives the mail id so the host can resolve the task.
    private let onOpenExtractedTask: (@MainActor (String) -> Void)?
    /// Mail that carries a stationery theme belongs in the ceremonial
    /// open experience, not here. When set, the host *replaces* this
    /// screen with `CeremonialMailOpenView` — mirroring RN's
    /// `router.replace` in `src/app/mailbox/detail.tsx:43-49`.
    private let onOpenCeremonialMail: (@MainActor (String) -> Void)?
    /// A17.12 — opens the Mail-tasks screen in its create frame for this
    /// mail (`POST /api/mailbox/v2/p3/tasks/from-mail`). Mirrors RN's
    /// "Create Task" affordance in `src/app/mailbox/detail.tsx:221-227`.
    private let onCreateTask: (@MainActor @Sendable () -> Void)?
    /// A17.14 — opens the Unboxing flow for this package. Mirrors RN's
    /// "Virtual Unboxing" CTA in `src/app/mailbox/package.tsx:183`.
    private let onOpenUnboxing: (@MainActor @Sendable () -> Void)?
    /// A17.8 → "Ask a Neighbor". Opens the package-gig form for this
    /// package; the flag mirrors RN's `?mode=pre|post`
    /// (`src/app/mailbox/package.tsx:196-204`).
    private let onAskNeighbor: (@MainActor @Sendable (_ isPreDelivery: Bool) -> Void)?
    /// Pay on a bill: opens the invoice (`invoice.id`).
    private let onPay: (@MainActor (String) -> Void)?
    /// A bundle's piece: opens its own letter page.
    private let onOpenMail: (@MainActor (String) -> Void)?
    /// "Verify your home" on a Home letter that waits for proof of address.
    private let onVerifyHome: (@MainActor (String) -> Void)?

    public init(
        mailId: String,
        onBack: @escaping () -> Void,
        onOpenSenderProfile: (@MainActor (String) -> Void)? = nil,
        onOpenSenderBusiness: (@MainActor (String) -> Void)? = nil,
        onTranslate: (@MainActor @Sendable () -> Void)? = nil,
        onOpenExtractedTask: (@MainActor (String) -> Void)? = nil,
        onOpenCeremonialMail: (@MainActor (String) -> Void)? = nil,
        onCreateTask: (@MainActor @Sendable () -> Void)? = nil,
        onOpenUnboxing: (@MainActor @Sendable () -> Void)? = nil,
        onAskNeighbor: (@MainActor @Sendable (_ isPreDelivery: Bool) -> Void)? = nil,
        onPay: (@MainActor (String) -> Void)? = nil,
        onOpenMail: (@MainActor (String) -> Void)? = nil,
        onVerifyHome: (@MainActor (String) -> Void)? = nil
    ) {
        self.mailId = mailId
        _viewModel = State(initialValue: MailDetailViewModel(mailId: mailId))
        self.onBack = onBack
        self.onOpenSenderProfile = onOpenSenderProfile
        self.onOpenSenderBusiness = onOpenSenderBusiness
        self.onTranslate = onTranslate
        self.onOpenExtractedTask = onOpenExtractedTask
        self.onOpenCeremonialMail = onOpenCeremonialMail
        self.onCreateTask = onCreateTask
        self.onOpenUnboxing = onOpenUnboxing
        self.onAskNeighbor = onAskNeighbor
        self.onPay = onPay
        self.onOpenMail = onOpenMail
        self.onVerifyHome = onVerifyHome
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingLayout(onBack: onBack)
            case let .loaded(content):
                loaded(content)
            case let .error(message):
                errorLayout(message)
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        // A deleted or household-dismissed letter opens from its notice with Restore.
        .safeAreaInset(edge: .top, spacing: Spacing.s0) {
            // The letter page offers Bring it back where its actions are.
            if let removed = viewModel.removed, !showsLetterPage {
                removedBanner(removed)
            }
        }
        // A container, so the page's buttons keep their own identifiers.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailDetail")
        // Opens out of its piece in the mailbox; drag it down to put it back.
        .itemZoomDestination(.mailPiece, id: mailId)
        .task { await viewModel.load() }
        // A dismissed or archived letter has left the mailbox; the list has dropped it.
        .onChange(of: viewModel.didLeaveMailbox) { _, left in
            if left { onBack() }
        }
        .onChange(of: viewModel.ceremonialRedirectMailId) { _, redirect in
            guard let redirect, let onOpenCeremonialMail else { return }
            viewModel.acknowledgeCeremonialRedirect()
            onOpenCeremonialMail(redirect)
        }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastBanner(message: toast)
                    .padding(.bottom, 110)
                    .task {
                        try? await Task.sleep(nanoseconds: 1_800_000_000)
                        viewModel.toast = nil
                    }
                    .transition(.opacity)
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .sheet(isPresented: Binding(
            get: { viewModel.showsSenderSheet },
            set: { viewModel.showsSenderSheet = $0 }
        )) {
            if case let .loaded(content) = viewModel.state, let letter = content.letter {
                MailSenderSheet(letter: letter, senderLink: senderLink(content))
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
        .confirmationDialog(
            "File in the Vault",
            isPresented: Binding(get: { viewModel.showsFilePicker }, set: { viewModel.showsFilePicker = $0 }),
            titleVisibility: .visible
        ) {
            ForEach(viewModel.fileFolders) { folder in
                Button(folder.label) { Task { await viewModel.act(.file, folderId: folder.id) } }
                    .accessibilityIdentifier("mailLetterFolder.\(folder.id)")
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Choose a folder for it.")
        }
        .confirmationDialog(
            "Done with it?",
            isPresented: Binding(get: { viewModel.confirmsDone }, set: { viewModel.confirmsDone = $0 }),
            titleVisibility: .visible
        ) {
            Button("Done") { Task { await viewModel.act(.done) } }
                .accessibilityIdentifier("mailLetterDoneConfirm")
            Button("Keep it on the counter", role: .cancel) {}
        } message: {
            Text("It comes off the counter and goes into the Vault.")
        }
        .confirmationDialog(
            "Shred this?",
            isPresented: Binding(get: { viewModel.confirmsShred }, set: { viewModel.confirmsShred = $0 }),
            titleVisibility: .visible
        ) {
            Button("Shred", role: .destructive) { Task { await viewModel.act(.shred) } }
                .accessibilityIdentifier("mailLetterShredConfirm")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(shredMessage)
        }
        .quickLookPreview(Binding(get: { viewModel.quickLookURL }, set: { viewModel.quickLookURL = $0 }))
        .confirmationDialog(
            "Save to vault",
            isPresented: Binding(
                get: { viewModel.showsSaveToVaultPicker },
                set: { viewModel.showsSaveToVaultPicker = $0 }
            ),
            titleVisibility: .visible
        ) {
            ForEach(viewModel.saveToVaultFolders) { folder in
                Button(folder.label) {
                    Task { await viewModel.saveToVault(folderId: folder.id) }
                }
                .accessibilityIdentifier("mailDetail_saveToVault_\(folder.id)")
            }
            Button("Cancel", role: .cancel) {
                viewModel.showsSaveToVaultPicker = false
            }
        } message: {
            Text("Pick a folder to keep this mail in.")
        }
        .confirmationDialog(
            destructiveActionTitle,
            isPresented: Binding(
                get: { viewModel.pendingDestructiveAction != nil },
                set: { if !$0 { viewModel.pendingDestructiveAction = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let pending = viewModel.pendingDestructiveAction {
                Button(pending.label, role: .destructive) {
                    Task { await viewModel.performCategoryAction(pending) }
                }
                .accessibilityIdentifier("mailDetail_categoryActionConfirm")
            }
            Button("Cancel", role: .cancel) {
                viewModel.pendingDestructiveAction = nil
            }
        } message: {
            Text("It moves out of your mailbox and stops showing up in this drawer.")
        }
    }

    private func removedBanner(_ removed: MailRemovedDTO) -> some View {
        let text = MailDetailViewModel.removedBannerText(removed)
        return PauseBanner(
            icon: .trash,
            title: text.title,
            subtitle: text.subtitle,
            actionLabel: viewModel.restoreInFlight ? "Restoring…" : "Restore",
            onAction: { Task { await viewModel.restore() } }
        )
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("mailDetail_removedBanner")
    }

    /// Confirm-sheet title for the destructive category action (today only
    /// `Dismiss`, which shreds the item server-side).
    private var destructiveActionTitle: String {
        guard case let .loaded(content) = viewModel.state else { return "Dismiss this mail?" }
        return "Dismiss \"\(content.title)\"?"
    }

    /// The sender card's tap: the business's page for a letter sent as a
    /// business, the person's profile otherwise.
    private func openSender(_ content: MailDetailContent) -> (@MainActor (String) -> Void)? {
        content.senderIsBusiness ? onOpenSenderBusiness : onOpenSenderProfile
    }

    @ViewBuilder
    private func loaded(_ content: MailDetailContent) -> some View {
        switch content.category {
        // Launch cut #8 (Mail extras): certified mail (e-signing), community
        // mail, ceremonial keepsakes and party invitations read as plain
        // mail. Launch cut #4 (Open gigs): a bid by mail has no Accept.
        // Launch cut #7 (Household extras): package tracking (timeline, Share
        // ETA, Report issue, virtual unboxing) reads as plain mail, as on web.
        case .certified where !LaunchFeatures.mailExtras, .community where !LaunchFeatures.mailExtras,
             .memory where !LaunchFeatures.mailExtras, .party where !LaunchFeatures.mailExtras,
             .gig where !LaunchFeatures.openGigs, .package where !LaunchFeatures.householdExtras:
            generic(content)
        case .booklet:
            booklet(content)
        case .certified:
            certified(content)
        case .community:
            community(content)
        case .coupon:
            coupon(content)
        case .gig:
            gig(content)
        case .memory:
            memory(content)
        case .package:
            package(content)
        case .party:
            party(content)
        case .records:
            records(content)
        default:
            generic(content)
        }
    }

    @ViewBuilder
    private func booklet(_ content: MailDetailContent) -> some View {
        // The Mail tab's letter page holds the pager with the new actions.
        if content.letter == nil, let booklet = content.bookletDetail {
            BookletDetailLayout(
                content: content,
                booklet: booklet,
                ackInFlight: viewModel.ackInFlight,
                onBack: { onBack() },
                onAcknowledge: { Task { await viewModel.acknowledge() } },
                onOpenSenderProfile: openSender(content),
                onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } },
                onArchive: { Task { await viewModel.archive() } },
                onDownloadPDF: { Task { await viewModel.downloadBookletPDF() } },
                downloadInFlight: viewModel.bookletDownloadInFlight
            )
        } else {
            generic(content)
        }
    }

    @ViewBuilder
    private func certified(_ content: MailDetailContent) -> some View {
        if let certified = content.certifiedDetail {
            CertifiedDetailLayout(
                content: content,
                certified: certified,
                ackInFlight: viewModel.ackInFlight,
                onBack: { onBack() },
                onAcknowledge: { Task { await viewModel.acknowledge() } },
                onOpenSenderProfile: openSender(content),
                onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } },
                onArchive: { Task { await viewModel.archive() } },
                onOpenExtractedTask: onOpenExtractedTask.map { open in
                    { @MainActor in open(mailId) }
                },
                onDownloadProof: { Task { await viewModel.downloadCertifiedProof() } },
                proofSaved: viewModel.certifiedProofSaved,
                proofInFlight: viewModel.certifiedProofInFlight
            )
        } else {
            generic(content)
        }
    }

    @ViewBuilder
    private func community(_ content: MailDetailContent) -> some View {
        if let community = content.communityDetail {
            CommunityDetailLayout(
                content: content,
                community: community,
                rsvpInFlight: viewModel.rsvpInFlight,
                onBack: { onBack() },
                onRsvp: { status in Task { await viewModel.setRsvp(status) } },
                onOpenSenderProfile: openSender(content),
                onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } }
            )
        } else {
            generic(content)
        }
    }

    @ViewBuilder
    private func coupon(_ content: MailDetailContent) -> some View {
        if let coupon = content.couponDetail {
            CouponDetailLayout(
                content: content,
                coupon: coupon,
                redeemInFlight: viewModel.couponRedeemInFlight,
                onBack: { onBack() },
                onRedeem: { Task { await viewModel.redeemCoupon() } },
                onOpenSenderProfile: openSender(content),
                onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } },
                onArchive: { Task { await viewModel.archive() } }
            )
        } else {
            generic(content)
        }
    }

    @ViewBuilder
    private func gig(_ content: MailDetailContent) -> some View {
        if let gig = content.gigDetail {
            GigMailDetailLayout(
                content: content,
                gig: gig,
                bidInFlight: viewModel.gigBidInFlight,
                onBack: { onBack() },
                onAccept: { Task { await viewModel.acceptGigBid() } },
                onOpenSenderProfile: openSender(content),
                onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } },
                onArchive: { Task { await viewModel.archive() } },
                paymentPending: viewModel.gigPaymentPending,
                onCancelPayment: { Task { await viewModel.cancelGigPayment() } }
            )
        } else {
            generic(content)
        }
    }

    @ViewBuilder
    private func memory(_ content: MailDetailContent) -> some View {
        if let memory = content.memoryDetail {
            MemoryDetailLayout(
                content: content,
                memory: memory,
                saveInFlight: viewModel.saveToVaultInFlight,
                onBack: { onBack() },
                onSaveMemory: { Task { await viewModel.saveMemoryToVault() } },
                onOpenSenderProfile: openSender(content),
                onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } },
                onArchive: { Task { await viewModel.archive() } }
            )
        } else {
            generic(content)
        }
    }

    @ViewBuilder
    private func package(_ content: MailDetailContent) -> some View {
        if let package = content.packageDetail {
            PackageDetailLayout(
                content: content,
                package: package,
                ackInFlight: viewModel.ackInFlight,
                onBack: { onBack() },
                onAcknowledgeDelivery: { Task { await viewModel.acknowledge() } },
                onOpenSenderProfile: openSender(content),
                onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } },
                onArchive: { Task { await viewModel.archive() } },
                onOpenUnboxing: onOpenUnboxing,
                // Offered only while posting a package task is available.
                onAskNeighbor: PackageGigAvailability.isAvailable ? onAskNeighbor : nil,
                onShareEta: { Task { @MainActor in await viewModel.sharePackageEta() } },
                onReportIssue: { Task { @MainActor in await viewModel.reportPackageIssue() } }
            )
        } else {
            generic(content)
        }
    }

    @ViewBuilder
    private func party(_ content: MailDetailContent) -> some View {
        if let party = content.partyDetail {
            PartyDetailLayout(
                content: content,
                party: party,
                rsvpInFlight: viewModel.partyRsvpInFlight,
                onBack: { onBack() },
                onSetRsvp: { status in Task { await viewModel.setPartyRsvp(status) } },
                onAdjustPlusOne: { count in Task { await viewModel.setPartyPlusOneCount(count) } },
                onClaimBring: { index in Task { await viewModel.togglePartyBringClaim(at: index, byName: "You") } },
                onReleaseBring: { index in Task { await viewModel.togglePartyBringClaim(at: index, byName: nil) } },
                onOpenSenderProfile: openSender(content),
                onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } }
            )
        } else {
            generic(content)
        }
    }

    @ViewBuilder
    private func records(_ content: MailDetailContent) -> some View {
        if let records = content.recordsDetail {
            RecordsDetailLayout(
                content: content,
                records: records,
                fileInFlight: viewModel.recordsFileInFlight,
                onBack: { onBack() },
                onFileInVault: { Task { await viewModel.fileRecordToVault() } },
                onOpenSenderProfile: openSender(content),
                onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } },
                onArchive: { Task { await viewModel.archive() } }
            )
        } else {
            generic(content)
        }
    }

    private var showsLetterPage: Bool {
        if case let .loaded(content) = viewModel.state { return content.letter != nil }
        return false
    }

    /// Shredding Home mail takes it from everyone who gets it.
    private var shredMessage: String {
        guard case let .loaded(content) = viewModel.state, content.letter?.homeId != nil else {
            return "It's gone from your mailbox. You can bring it back for 30 days."
        }
        return "It's gone for everyone who gets your home's mail. You can bring it back for 30 days."
    }

    /// "See their business page" or "See their profile", when there's one.
    private func senderLink(_ content: MailDetailContent) -> (title: String, open: () -> Void)? {
        guard let id = content.senderUserId else { return nil }
        if content.senderIsBusiness, let onOpenSenderBusiness {
            return ("See their business page", { onOpenSenderBusiness(id) })
        }
        if !content.senderIsBusiness, let onOpenSenderProfile {
            return ("See their profile", { onOpenSenderProfile(id) })
        }
        return nil
    }

    /// The letter page's state, and where its taps go.
    private func letterHooks(_ content: MailDetailContent) -> MailLetterPageHooks {
        MailLetterPageHooks(
            inFlight: viewModel.letterActionInFlight,
            openingEnclosure: viewModel.openingEnclosure,
            bundlePieces: viewModel.bundlePieces,
            bundleLoading: viewModel.bundleLoading,
            bundleFailure: viewModel.bundleFailure,
            removed: viewModel.removed,
            restoreInFlight: viewModel.restoreInFlight,
            onEnvelope: { viewModel.showsSenderSheet = true },
            onAction: { action in
                if action == .pay {
                    if let invoice = content.letter?.payable { onPay?(invoice.id) }
                    return
                }
                Task { await viewModel.tapLetterAction(action) }
            },
            onOpenEnclosure: { enclosure in Task { await viewModel.openEnclosure(enclosure) } },
            onOpenPiece: { id in onOpenMail?(id) },
            onRetryBundle: { Task { await viewModel.loadBundle() } },
            onRestore: { Task { await viewModel.restore() } }
        )
    }

    /// Why it couldn't open, and what to do: verify the home for Home mail
    /// waiting for proof, otherwise try again.
    private func errorLayout(_ message: String) -> some View {
        let proofHome = viewModel.proofHomeId
        if viewModel.needsProof {
            return ErrorLayout(
                headline: "This is your home's mail",
                message: message,
                ctaTitle: proofHome == nil || onVerifyHome == nil ? "Try again" : "Verify your home",
                onBack: onBack
            ) {
                if let proofHome, let onVerifyHome {
                    onVerifyHome(proofHome)
                } else {
                    Task { await viewModel.refresh() }
                }
            }
        }
        if viewModel.isNotFound {
            return ErrorLayout(headline: "Couldn't open this mail", message: message, ctaTitle: "Back to Mail", onBack: onBack) {
                onBack()
            }
        }
        return ErrorLayout(headline: "Couldn't open this mail", message: message, ctaTitle: "Try again", onBack: onBack) {
            Task { await viewModel.refresh() }
        }
    }

    private func generic(_ content: MailDetailContent) -> some View {
        GenericMailDetailLayout(
            content: content,
            ackInFlight: viewModel.ackInFlight,
            onBack: { onBack() },
            onAcknowledge: { Task { await viewModel.acknowledge() } },
            onOpenSenderProfile: openSender(content),
            onSaveToVault: { Task { await viewModel.openSaveToVaultPicker() } },
            onArchive: { Task { await viewModel.archive() } },
            onTranslate: onTranslate,
            onCreateTask: onCreateTask,
            categoryActions: viewModel.categoryActions.filter { $0 != .createTask || onCreateTask != nil },
            categoryActionInFlight: viewModel.categoryActionInFlight,
            onCategoryAction: { action in
                // Create Task runs the real create-task flow; the rest post the item action.
                if action == .createTask {
                    onCreateTask?()
                } else {
                    Task { await viewModel.tapCategoryAction(action) }
                }
            },
            letterHooks: letterHooks(content)
        )
    }
}

// MARK: - Loading / Error / Toast

private struct LoadingLayout: View {
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            MailItemDetailTopBar(
                config: MailTopBarConfig(
                    eyebrow: nil,
                    trust: .neutral,
                    onBack: { @Sendable in Task { @MainActor in onBack() } }
                )
            )
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 100, cornerRadius: Radii.lg)
                Shimmer(height: 80, cornerRadius: Radii.lg)
                Shimmer(height: 160, cornerRadius: Radii.lg)
            }
            .padding(Spacing.s4)
            Spacer()
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("mailDetail_loading")
    }
}

private struct ErrorLayout: View {
    let headline: String
    let message: String
    let ctaTitle: String
    let onBack: () -> Void
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            MailItemDetailTopBar(
                config: MailTopBarConfig(
                    eyebrow: nil,
                    trust: .warning,
                    onBack: { @Sendable in Task { @MainActor in onBack() } }
                )
            )
            EmptyState(
                icon: .alertCircle,
                headline: headline,
                subcopy: message,
                cta: EmptyState.CTA(title: ctaTitle) { await MainActor.run { onRetry() } }
            )
            .frame(maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("mailDetail_error")
    }
}

private struct ToastBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appText.opacity(0.9))
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            .accessibilityLabel(message)
    }
}

#Preview {
    NavigationStack {
        MailDetailView(mailId: "preview", onBack: {})
    }
}
