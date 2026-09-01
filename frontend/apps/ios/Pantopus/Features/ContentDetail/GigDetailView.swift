//
//  GigDetailView.swift
//  Pantopus
//
//  T2.6 gig detail. Wraps `TransactionalDetailShell`. The primary dock
//  action opens the shared `EditBidSheetView` in place-bid mode (or tips /
//  delivers / instant-accepts depending on the lifecycle); the Phase 5/5b
//  scroll footer carries the owner bids panel, active-task strip (with
//  running-late badge), changes card, payment card, and review CTA, with
//  counter / report / cancel / reschedule / no-show / running-late /
//  change-order sheets attached.
//

// swiftlint:disable file_length type_body_length

import SwiftUI
import UIKit

public struct GigDetailView: View {
    @State private var viewModel: GigDetailViewModel
    @State private var bidSheetTarget: EditBidSheetTarget?
    @State private var deliveryTarget: DeliveryProofTarget?
    @State private var showTipSheet = false
    @State private var tipCustomAmountText = ""
    @State private var toast: ToastMessage?
    // Phase 5 — lifecycle sheets
    @State private var counterTarget: GigCounterSheetTarget?
    @State private var rejectCandidate: GigBidDTO?
    /// Bid whose pending counter-offer the poster is about to withdraw.
    @State private var withdrawCounterCandidate: GigBidDTO?
    /// Poster's "Close Gig" confirm on a still-open task.
    @State private var showCloseTaskConfirm = false
    @State private var showReportSheet = false
    @State private var showCancelSheet = false
    @State private var cancelPreview: GigCancellationPreview?
    @State private var showNoShowSheet = false
    @State private var reviewTarget: LeaveReviewSheetTarget?
    // Phase 5b — lifecycle completers
    @State private var showRunningLateSheet = false
    @State private var showChangeOrderSheet = false
    /// Phase 6b — reschedule (cancel sheet's "Reschedule instead" path)
    @State private var showRescheduleSheet = false
    // Pre-start release confirms — poster "Replace worker"
    // (`/reopen-bidding`) and worker "Can't make it" (`/worker-release`).
    @State private var showReplaceWorkerConfirm = false
    @State private var showCantMakeItConfirm = false
    /// Non-nil while the "Share to feed" composer is presented.
    @State private var shareToFeedTarget: PulseTaskShare?
    private let onBack: @MainActor () -> Void
    private let onOpenChat: (@MainActor (InboxConversationDestination) -> Void)?

    /// Block 3D — preset tip amounts in cents.
    private let tipPresets = [500, 1000, 2000]

    public init(
        viewModel: GigDetailViewModel,
        onBack: @escaping @MainActor () -> Void = {},
        onOpenChat: (@MainActor (InboxConversationDestination) -> Void)? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onOpenChat = onOpenChat
    }

    public var body: some View {
        TransactionalDetailShell(
            state: viewModel.state,
            overflowItems: overflowItems,
            topBarAccessory: topBarAccessories,
            onBack: onBack,
            onPrimaryAction: { presentPrimaryAction() },
            onSecondaryAction: { openChat() },
            onRetry: { Task { await viewModel.load() } },
            onMessageCounterparty: { openChat() },
            scrollFooter: { lifecycleFooter }
        )
        .task {
            await viewModel.load()
            viewModel.startRealtime()
        }
        .onDisappear { viewModel.stopRealtime() }
        .sheet(item: $bidSheetTarget) { target in
            EditBidSheetView(
                target: target,
                onSubmit: { draft in
                    // `target.bidId != nil` ⇒ the viewer already has a bid
                    // here, so this is a PUT update rather than a new POST.
                    let ok = target.isEditing
                        ? await viewModel.updateViewerBid(
                            amount: draft.amount,
                            message: draft.message,
                            proposedTime: draft.proposedTime
                        )
                        : await viewModel.placeBid(
                            amount: draft.amount,
                            message: draft.message,
                            proposedTime: draft.proposedTime
                        )
                    if ok {
                        bidSheetTarget = nil
                        toast = ToastMessage(
                            text: target.isEditing ? "Bid updated." : "Bid submitted.",
                            kind: .success
                        )
                    }
                    return ok
                },
                onCancel: { bidSheetTarget = nil }
            )
            .presentationDetents([.large])
        }
        .sheet(item: $deliveryTarget) { target in
            DeliveryProofSheetView(
                target: target,
                onSubmit: { photos, note in
                    await viewModel.submitDeliveryProof(photos: photos, note: note)
                },
                onDismiss: { deliveryTarget = nil }
            )
        }
        .sheet(isPresented: $showTipSheet) { tipSheet }
        .modifier(GigLifecycleSheets(
            viewModel: viewModel,
            counterTarget: $counterTarget,
            showReportSheet: $showReportSheet,
            showCancelSheet: $showCancelSheet,
            cancelPreview: $cancelPreview,
            showNoShowSheet: $showNoShowSheet,
            reviewTarget: $reviewTarget,
            showRunningLateSheet: $showRunningLateSheet,
            showChangeOrderSheet: $showChangeOrderSheet,
            showRescheduleSheet: $showRescheduleSheet,
            toast: $toast
        ))
        .confirmationDialog(
            "Reject this bid?",
            isPresented: Binding(
                get: { rejectCandidate != nil },
                set: { if !$0 { rejectCandidate = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Reject bid", role: .destructive) { confirmReject() }
            Button("Keep bid", role: .cancel) { rejectCandidate = nil }
        } message: {
            Text("The bidder is notified and can't be selected afterwards.")
        }
        // RN copy verbatim (`OffersPanel.tsx:178`).
        .confirmationDialog(
            "Withdraw counter-offer?",
            isPresented: Binding(
                get: { withdrawCounterCandidate != nil },
                set: { if !$0 { withdrawCounterCandidate = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Withdraw", role: .destructive) { confirmWithdrawCounter() }
            Button("Keep counter", role: .cancel) { withdrawCounterCandidate = nil }
        } message: {
            Text("The bid will revert to its original amount.")
        }
        // RN copy verbatim (`gig/[id].tsx:414`).
        .confirmationDialog(
            "Close Gig",
            isPresented: $showCloseTaskConfirm,
            titleVisibility: .visible
        ) {
            Button("Close Gig", role: .destructive) { confirmCloseTask() }
            Button("Keep Open", role: .cancel) { showCloseTaskConfirm = false }
        } message: {
            Text("Are you sure you want to close this gig? It will be removed and this cannot be undone.")
        }
        .confirmationDialog(
            "Replace Worker",
            isPresented: $showReplaceWorkerConfirm,
            titleVisibility: .visible
        ) {
            Button("Replace Worker", role: .destructive) {
                Task { await runRelease { await viewModel.replaceWorker() } }
            }
            Button("Keep worker", role: .cancel) { showReplaceWorkerConfirm = false }
        } message: {
            Text(
                "This will unassign the current worker, release any payment hold, "
                    + "and reopen the task for bids. Use this only before work starts."
            )
        }
        .confirmationDialog(
            "Can't Make It",
            isPresented: $showCantMakeItConfirm,
            titleVisibility: .visible
        ) {
            Button("I Can't Make It", role: .destructive) {
                Task { await runRelease { await viewModel.releaseAssignment() } }
            }
            Button("Stay on the task", role: .cancel) { showCantMakeItConfirm = false }
        } message: {
            Text(
                "This will unassign you from the task and reopen it for new bids. "
                    + "Any payment hold will be released."
            )
        }
        .overlay(alignment: .bottom) { toastOverlay }
        .overlay(alignment: .top) { tipMarkers }
        .onChange(of: viewModel.tipStatus) { _, status in handleTip(status) }
        // "Share this task to the feed" — RN opens the same
        // PostTargetPicker + composer the Pulse tab uses, prefilled with
        // the task and carrying `refTaskId` (`gig/[id].tsx:1474-1481`).
        .fullScreenCover(item: $shareToFeedTarget) { share in
            PulseComposeFlowView(
                taskShare: share,
                onCancel: { shareToFeedTarget = nil },
                onPosted: { _ in
                    shareToFeedTarget = nil
                    toast = ToastMessage(text: "Shared to the feed.", kind: .success)
                }
            )
        }
    }

    // MARK: - Share live status / share to feed

    /// Mint a 24h public status link and copy it to the pasteboard.
    /// Mirrors RN's `ETATracker` "Share Status" button, which copies and
    /// never opens the system share sheet.
    private func shareLiveStatus() {
        Task {
            switch await viewModel.shareLiveStatus() {
            case let .succeeded(url):
                UIPasteboard.general.string = url
                toast = ToastMessage(
                    text: "Live status link copied — it expires in 24 hours.",
                    kind: .success
                )
            case let .failed(message):
                toast = ToastMessage(text: message, kind: .error)
            }
        }
    }

    /// Open the Pulse composer prefilled with this task.
    private func presentShareToFeed() {
        guard let gig = viewModel.rawGig else { return }
        shareToFeedTarget = PulseTaskShare(
            taskId: gig.id,
            title: gig.title,
            body: PulseTaskShare.composeBody(
                title: gig.title,
                price: gig.price,
                description: gig.description,
                shareURL: viewModel.shareURL.absoluteString
            )
        )
    }

    // MARK: - Lifecycle footer (Phase 5 / 5b)

    /// Owner bids panel → active-task panel → changes card → payment
    /// card → review CTA → Q&A.
    @ViewBuilder private var lifecycleFooter: some View {
        if case .loaded = viewModel.state {
            if viewModel.showOwnerBidsPanel {
                GigOwnerBidsPanel(
                    bids: viewModel.ownerBids,
                    inFlightBidId: viewModel.bidActionInFlight,
                    onAccept: { bid in Task { await acceptBid(bid) } },
                    onCounter: { bid in counterTarget = GigCounterSheetTarget(id: bid.id, bid: bid) },
                    onReject: { bid in rejectCandidate = bid },
                    onWithdrawCounter: { bid in withdrawCounterCandidate = bid },
                    rankings: viewModel.offerRankings
                )
            }
            // Urgent / starts-asap live stepper (RN `ActiveTaskPanel`).
            if viewModel.showFulfillmentPanel {
                GigFulfillmentPanel(
                    status: viewModel.fulfillmentStatus,
                    etaLabel: viewModel.fulfillmentEtaLabel,
                    nextAction: viewModel.nextFulfillmentAction,
                    isBusy: viewModel.fulfillmentActionInFlight
                ) { status in
                    Task {
                        await runToasting(success: "Status updated.") {
                            await viewModel.advanceFulfillment(to: status)
                        }
                    }
                }
            }
            // Bidder side — "Your bid" with Update / Withdraw and, while a
            // counter-offer is live, Accept / Decline.
            if viewModel.showViewerBidPanel {
                GigViewerBidPanel(
                    viewModel: viewModel,
                    onEditBid: { presentUpdateBidSheet() },
                    onToast: { message, isError in
                        toast = ToastMessage(text: message, kind: isError ? .error : .success)
                    }
                )
            }
            if let phase = viewModel.activePhase, viewModel.showActivePanel {
                GigActiveTaskPanel(
                    phase: phase,
                    showWorkerAck: viewModel.showWorkerAck,
                    canStartTask: viewModel.canStartTask,
                    canConfirmCompletion: viewModel.canConfirmCompletion,
                    noShowEligible: viewModel.noShowEligible,
                    runningLateLabel: viewModel.runningLateLabel,
                    canReportRunningLate: viewModel.canReportRunningLate,
                    canReleaseAssignment: viewModel.canReleaseAssignment,
                    canRemindWorker: viewModel.canRemindWorker,
                    reminderCooldownEnds: viewModel.workerReminderCooldownEnds,
                    onWorkerAck: {
                        Task { await runToasting(success: "Told the poster you're on it.") { await viewModel.sendWorkerAck() } }
                    },
                    onStartTask: {
                        Task { await runToasting(success: "Task started.") { await viewModel.startTask() } }
                    },
                    onConfirmCompletion: {
                        Task { await runToasting(success: "Completion confirmed.") { await viewModel.confirmCompletion() } }
                    },
                    onReportNoShow: { showNoShowSheet = true },
                    onRunningLate: { showRunningLateSheet = true },
                    onCantMakeIt: { showCantMakeItConfirm = true },
                    onRemindWorker: { Task { await remindWorker() } }
                )
            }
            if viewModel.showChangesSection {
                GigChangesCard(
                    orders: viewModel.changeOrders,
                    inFlightOrderId: viewModel.changeOrderActionInFlight,
                    isOwnOrder: { viewModel.isOwnChangeOrder($0) },
                    onApprove: { order in
                        Task { await runToasting(success: "Change approved.") { await viewModel.approveChangeOrder(orderId: order.id) } }
                    },
                    onReject: { order in
                        Task { await runToasting(success: "Change rejected.") { await viewModel.rejectChangeOrder(orderId: order.id) } }
                    },
                    onWithdraw: { order in
                        Task { await runToasting(success: "Change withdrawn.") { await viewModel.withdrawChangeOrder(orderId: order.id) } }
                    },
                    onPropose: { showChangeOrderSheet = true }
                )
            }
            if viewModel.showPaymentCard, let payment = viewModel.payment {
                GigPaymentCard(payment: payment, stateInfo: viewModel.paymentStateInfo)
            }
            if viewModel.showReviewSection {
                GigReviewSection(
                    reviewSubmitted: viewModel.reviewSubmitted,
                    revieweeName: viewModel.pendingReview?.revieweeName,
                    onLeaveReview: presentReviewSheet
                )
            }
            GigQuestionsSection(viewModel: viewModel) { message in
                toast = ToastMessage(text: message, kind: .error)
            }
        }
    }

    /// Run a pre-start release action (`/reopen-bidding`,
    /// `/worker-release`), toasting the server's own confirmation copy.
    /// The VM refreshes on success, so the lifecycle footer re-renders in
    /// the reopened state without extra work here.
    private func runRelease(_ action: () async -> GigDetailViewModel.ReleaseOutcome) async {
        switch await action() {
        case let .succeeded(message):
            toast = ToastMessage(text: message, kind: .success)
        case let .failed(message):
            toast = ToastMessage(text: message, kind: .error)
        }
    }

    /// Run a `String?`-error VM action, toasting either way.
    private func runToasting(success: String, _ action: () async -> String?) async {
        if let error = await action() {
            toast = ToastMessage(text: error, kind: .error)
        } else {
            toast = ToastMessage(text: success, kind: .success)
        }
    }

    private func acceptBid(_ bid: GigBidDTO) async {
        switch await viewModel.acceptBid(bidId: bid.id) {
        case .accepted:
            toast = ToastMessage(text: "Bid accepted — task assigned.", kind: .success)
        case .canceled:
            toast = ToastMessage(text: "Payment canceled.", kind: .error)
        case let .failed(message):
            toast = ToastMessage(text: message, kind: .error)
        }
    }

    /// Poster's "Remind worker" nudge. The server owns the cooldown, so
    /// both outcomes are toasted verbatim from the view-model.
    private func remindWorker() async {
        switch await viewModel.remindWorker() {
        case let .success(message):
            toast = ToastMessage(text: message, kind: .success)
        case let .failure(message):
            toast = ToastMessage(text: message, kind: .error)
        }
    }

    private func confirmReject() {
        guard let bid = rejectCandidate else { return }
        rejectCandidate = nil
        Task { await runToasting(success: "Bid rejected.") { await viewModel.rejectBid(bidId: bid.id) } }
    }

    private func confirmWithdrawCounter() {
        guard let bid = withdrawCounterCandidate else { return }
        withdrawCounterCandidate = nil
        Task {
            await runToasting(success: "Counter-offer withdrawn.") {
                await viewModel.withdrawCounter(bidId: bid.id)
            }
        }
    }

    /// RN pops back to the tasks tab once the gig row is gone
    /// (`gig/[id].tsx:430`).
    private func confirmCloseTask() {
        showCloseTaskConfirm = false
        Task {
            if let error = await viewModel.closeGig() {
                toast = ToastMessage(text: error, kind: .error)
            } else {
                onBack()
            }
        }
    }

    private func presentReviewSheet() {
        guard let gig = viewModel.rawGig else { return }
        reviewTarget = LeaveReviewSheetTarget(
            id: "review-\(gig.id)",
            gigId: gig.id,
            revieweeId: viewModel.pendingReview?.revieweeId ?? "",
            gigTitle: gig.title,
            revieweeName: viewModel.pendingReview?.revieweeName
        )
    }

    // MARK: - Top bar (share + bookmark) & overflow

    /// Share (universal link) + bookmark toggle. Hidden until loaded.
    private var topBarAccessories: AnyView? {
        guard case .loaded = viewModel.state else { return nil }
        return AnyView(
            HStack(spacing: Spacing.s1) {
                ShareLink(item: viewModel.shareURL) {
                    Icon(.share, size: 18, strokeWidth: 2, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Share task")
                .accessibilityIdentifier("gigDetail.share")
                Button {
                    Task {
                        let ok = await viewModel.toggleSave()
                        if !ok {
                            toast = ToastMessage(text: "Couldn't update saved tasks.", kind: .error)
                        }
                    }
                } label: {
                    Icon(
                        .bookmark,
                        size: 18,
                        strokeWidth: 2,
                        color: viewModel.isSaved ? Theme.Color.primary600 : Theme.Color.appText
                    )
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(viewModel.isSaved ? "Saved — tap to unsave" : "Save task")
                .accessibilityIdentifier("gigDetail.save")
            }
        )
    }

    /// Report (everyone) + Cancel task (owner of a live gig).
    private var overflowItems: [ContentDetailOverflowItem] {
        guard case .loaded = viewModel.state else { return [] }
        var items = [
            ContentDetailOverflowItem(
                label: "Share to feed",
                icon: .megaphone,
                identifier: "gigDetail.shareToFeed"
            ) {
                presentShareToFeed()
            },
            ContentDetailOverflowItem(label: "Report task", icon: .flag, identifier: "gigDetail.report") {
                showReportSheet = true
            }
        ]
        if viewModel.canShareLiveStatus {
            items.insert(
                ContentDetailOverflowItem(
                    label: "Share live status",
                    icon: .navigation,
                    identifier: "gigDetail.shareLiveStatus"
                ) {
                    shareLiveStatus()
                },
                at: 0
            )
        }
        if viewModel.canReplaceWorker {
            items.append(
                ContentDetailOverflowItem(
                    label: "Replace worker",
                    icon: .refreshCw,
                    identifier: "gigDetail.replaceWorker",
                    role: .destructive
                ) {
                    showReplaceWorkerConfirm = true
                }
            )
        }
        // RN branches on status: an open gig is *closed* (deleted, no
        // fee), anything live is *cancelled* (`gig/[id].tsx:412`).
        if viewModel.canCloseTask {
            items.append(
                ContentDetailOverflowItem(
                    label: "Close task",
                    icon: .trash2,
                    identifier: "gigDetail.close",
                    role: .destructive
                ) {
                    showCloseTaskConfirm = true
                }
            )
        }
        if viewModel.canCancelTask {
            items.append(
                ContentDetailOverflowItem(
                    label: "Cancel task",
                    icon: .ban,
                    identifier: "gigDetail.cancel",
                    role: .destructive
                ) {
                    Task {
                        cancelPreview = await viewModel.loadCancellationPreview()
                        showCancelSheet = true
                    }
                }
            )
        }
        return items
    }

    // MARK: - Tip (Block 3D)

    private var tipSheet: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.handCoins, size: 32, color: Theme.Color.primary600)
            Text("Send a tip")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("100% goes to your helper. Charged to your card via Stripe.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            HStack(spacing: Spacing.s3) {
                ForEach(tipPresets, id: \.self) { cents in
                    Button { selectTip(cents) } label: {
                        Text("$\(cents / 100)")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Theme.Color.primary600)
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(Theme.Color.primary50)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("tip.amount.\(cents)")
                }
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Custom amount")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(spacing: Spacing.s2) {
                    Text("$")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    TextField("0.00", text: $tipCustomAmountText)
                        .keyboardType(.decimalPad)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityIdentifier("tip.amount.customInput")
                }
                .padding(.horizontal, Spacing.s3)
                .frame(height: 48)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            Button {
                if let cents = customTipCents {
                    selectTip(cents)
                }
            } label: {
                Text("Send custom tip")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(customTipCents == nil ? Theme.Color.appTextMuted : Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(customTipCents == nil ? Theme.Color.appSurfaceSunken : Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .disabled(customTipCents == nil)
            .buttonStyle(.plain)
            .accessibilityIdentifier("tip.amount.customSubmit")
            Button("Not now") { showTipSheet = false }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .buttonStyle(.plain)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity)
        .presentationDetents([.height(410)])
        .accessibilityIdentifier("tip.amount")
    }

    private var customTipCents: Int? {
        let cleaned = tipCustomAmountText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
        guard let dollars = Double(cleaned), dollars >= 0.5 else { return nil }
        return max(50, Int((dollars * 100).rounded()))
    }

    /// Zero-size anchors so UI tests can assert each tip stage (+ the
    /// instant-accept affordance, whose button is the shared dock primary).
    @ViewBuilder private var tipMarkers: some View {
        if viewModel.canInstantAccept {
            Color.clear.frame(width: 0, height: 0).accessibilityIdentifier("gigDetail.instantAccept")
        }
        if viewModel.canTip {
            Color.clear.frame(width: 0, height: 0).accessibilityIdentifier("tip.affordance")
        }
        if viewModel.tipStatus == .sending {
            Color.clear.frame(width: 0, height: 0).accessibilityIdentifier("tip.paymentSheet")
        }
        if viewModel.tipStatus == .succeeded {
            Color.clear.frame(width: 0, height: 0).accessibilityIdentifier("tip.success")
        }
    }

    private func selectTip(_ cents: Int) {
        showTipSheet = false
        tipCustomAmountText = ""
        Task { await viewModel.sendTip(amountCents: cents) }
    }

    private func handleTip(_ status: GigDetailViewModel.TipStatus) {
        switch status {
        case .idle, .sending:
            break
        case .succeeded:
            // Keep the .succeeded marker live for tests; the toast fires once.
            toast = ToastMessage(text: "Tip sent — thank you!", kind: .success)
        case .canceled:
            viewModel.clearTipStatus()
        case let .failed(message):
            toast = ToastMessage(text: message, kind: .error)
            viewModel.clearTipStatus()
        }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    self.toast = nil
                }
                .accessibilityIdentifier("gig-detail-toast")
        }
    }

    /// Dock primary routes to: the tip sheet when the poster can tip a
    /// completed gig (Block 3D); the Delivery Proof sheet for the assigned
    /// worker on an in-progress task; instant accept on `instant_accept`
    /// open gigs; the *update*-bid sheet when the viewer already bid;
    /// otherwise the place-bid sheet.
    private func presentPrimaryAction() {
        if viewModel.canTip {
            tipCustomAmountText = ""
            showTipSheet = true
        } else if viewModel.canMarkDelivered {
            presentDeliveryProof()
        } else if viewModel.canInstantAccept {
            Task { await runToasting(success: "You're on the task — it's yours.") { await viewModel.instantAccept() } }
        } else if viewModel.viewerCanEditBid {
            presentUpdateBidSheet()
        } else {
            presentBidSheet()
        }
    }

    private func presentBidSheet() {
        guard let gig = viewModel.rawGig else { return }
        bidSheetTarget = EditBidSheetTarget(
            id: "new-bid-\(gig.id)",
            gigId: gig.id,
            gigTitle: gig.title,
            bidId: nil
        )
    }

    /// The same sheet in edit mode, pre-filled with the viewer's live bid.
    /// `bidId != nil` flips the submit path to `PUT .../bids/:bidId`.
    private func presentUpdateBidSheet() {
        guard let gig = viewModel.rawGig, let bid = viewModel.viewerBid else { return }
        bidSheetTarget = EditBidSheetTarget(
            id: "edit-bid-\(bid.id)",
            gigId: gig.id,
            gigTitle: gig.title,
            bidId: bid.id,
            initialAmount: bid.bidAmount,
            initialMessage: bid.message,
            initialProposedTime: bid.proposedTime
        )
    }

    private func presentDeliveryProof() {
        guard let gig = viewModel.rawGig else { return }
        deliveryTarget = DeliveryProofTarget(
            id: "deliver-\(gig.id)",
            gigId: gig.id,
            gigTitle: gig.title
        )
    }

    private func openChat() {
        Task {
            guard let destination = await viewModel.resolveChatDestination() else { return }
            onOpenChat?(destination)
        }
    }
}

// MARK: - Phase 5 — lifecycle sheets

/// Bundles the counter / report / cancel / no-show / review sheets so
/// `GigDetailView.body` stays readable. All mutations route through the
/// view-model; results surface via the shared toast binding.
private struct GigLifecycleSheets: ViewModifier {
    let viewModel: GigDetailViewModel
    @Binding var counterTarget: GigCounterSheetTarget?
    @Binding var showReportSheet: Bool
    @Binding var showCancelSheet: Bool
    @Binding var cancelPreview: GigCancellationPreview?
    @Binding var showNoShowSheet: Bool
    @Binding var reviewTarget: LeaveReviewSheetTarget?
    @Binding var showRunningLateSheet: Bool
    @Binding var showChangeOrderSheet: Bool
    @Binding var showRescheduleSheet: Bool
    @Binding var toast: ToastMessage?

    func body(content: Content) -> some View {
        phase5bSheets(phase5Sheets(content))
    }

    /// Phase 6b — the cancel sheet's "Reschedule instead" hand-off.
    /// Poster-only by construction (the overflow's "Cancel task" is
    /// owner-gated); the sheet additionally checks the preview's
    /// `can_reschedule` before rendering the button.
    private var rescheduleAction: (@MainActor () -> Void)? {
        guard viewModel.canRescheduleTask else { return nil }
        return {
            showCancelSheet = false
            showRescheduleSheet = true
        }
    }

    /// Phase 5 — counter / report / cancel / no-show / review.
    private func phase5Sheets(_ content: Content) -> some View {
        content
            .sheet(item: $counterTarget) { target in
                GigCounterSheet(
                    target: target,
                    onSubmit: { amount, message in
                        let error = await viewModel.counterBid(
                            bidId: target.bid.id,
                            amount: amount,
                            message: message
                        )
                        if error == nil {
                            toast = ToastMessage(text: "Counter-offer sent.", kind: .success)
                        }
                        return error
                    },
                    onDismiss: { counterTarget = nil }
                )
            }
            .sheet(isPresented: $showReportSheet) {
                GigReportSheet(
                    onSubmit: { reason, details in
                        let result = await viewModel.reportGig(reason: reason, details: details)
                        toast = ToastMessage(text: result.message, kind: result.success ? .success : .error)
                        showReportSheet = false
                    },
                    onDismiss: { showReportSheet = false }
                )
            }
            .sheet(isPresented: $showCancelSheet) {
                GigCancelSheet(
                    preview: cancelPreview,
                    onReschedule: rescheduleAction,
                    onConfirm: { reason in
                        if let error = await viewModel.cancelTask(reason: reason) {
                            toast = ToastMessage(text: error, kind: .error)
                        } else {
                            toast = ToastMessage(text: "Task cancelled.", kind: .success)
                        }
                        showCancelSheet = false
                    },
                    onDismiss: { showCancelSheet = false }
                )
            }
            .sheet(isPresented: $showNoShowSheet) {
                GigNoShowSheet(
                    counterpartyLabel: viewModel.viewerIsWorker ? "poster" : "worker",
                    onConfirm: { description in
                        if let error = await viewModel.reportNoShow(description: description) {
                            toast = ToastMessage(text: error, kind: .error)
                        } else {
                            toast = ToastMessage(text: "No-show reported. The task was cancelled.", kind: .success)
                        }
                        showNoShowSheet = false
                    },
                    onDismiss: { showNoShowSheet = false }
                )
            }
            .sheet(item: $reviewTarget) { target in
                LeaveReviewSheetView(
                    target: target,
                    onSubmit: { draft in
                        if let error = await viewModel.submitReview(rating: draft.rating, comment: draft.comment) {
                            toast = ToastMessage(text: error, kind: .error)
                            return false
                        }
                        toast = ToastMessage(text: "Review submitted. Thanks!", kind: .success)
                        reviewTarget = nil
                        return true
                    },
                    onCancel: { reviewTarget = nil }
                )
                .presentationDetents([.medium, .large])
            }
    }

    /// Phase 5b — running-late + propose-a-change; Phase 6b — reschedule.
    private func phase5bSheets(_ content: some View) -> some View {
        content
            .sheet(isPresented: $showRescheduleSheet) {
                GigRescheduleSheet(
                    onSubmit: { newStart, note in
                        let error = await viewModel.rescheduleTask(scheduledStart: newStart, note: note)
                        if error == nil {
                            toast = ToastMessage(text: "Task rescheduled", kind: .success)
                        }
                        return error
                    },
                    onDismiss: { showRescheduleSheet = false }
                )
            }
            .sheet(isPresented: $showRunningLateSheet) {
                GigRunningLateSheet(
                    onSubmit: { etaMinutes, note in
                        let error = await viewModel.sendRunningLate(etaMinutes: etaMinutes, note: note)
                        if error == nil {
                            toast = ToastMessage(text: "Told the poster you're running late.", kind: .success)
                        }
                        return error
                    },
                    onDismiss: { showRunningLateSheet = false }
                )
            }
            .sheet(isPresented: $showChangeOrderSheet) {
                GigChangeOrderSheet(
                    onSubmit: { type, description, amountChange, timeChangeMinutes in
                        let error = await viewModel.proposeChangeOrder(
                            type: type,
                            description: description,
                            amountChange: amountChange,
                            timeChangeMinutes: timeChangeMinutes
                        )
                        if error == nil {
                            toast = ToastMessage(text: "Change request sent.", kind: .success)
                        }
                        return error
                    },
                    onDismiss: { showChangeOrderSheet = false }
                )
            }
    }
}
