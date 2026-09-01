//
//  ManageTrainView.swift
//  Pantopus
//
//  A13.13 — Manage train. Organizer-only surface for an active support
//  train, reached from the A10.9 detail dock overflow (organizer-only
//  affordance) and from the `pantopus://support-trains/:id/manage`
//  deep link. The chrome is a 52pt top bar (back chevron + centered
//  title, no right-action) over a scroll body with five mid-sections:
//
//    1. `TrainContextStrip` — warm-amber identity strip.
//    2. `StatCellRow` — 4-cell at-a-glance card.
//    3. `SlotPreview` — 21-dot mini fill strip + legend.
//    4. `SendUpdateForm` — message textarea + audience chips + push toggle.
//    5. `OrganizeSection` + `WindDownSection` — control-row stacks.
//
//  A sticky `Send update` primary CTA pins the bottom inset; tapping
//  the destructive `Close train` row presents the `CloseTrainSheet`
//  bottom sheet over a dimmed body.
//

// swiftlint:disable file_length function_body_length type_body_length

import SwiftUI

@MainActor
public struct ManageTrainView: View {
    @State private var viewModel: ManageTrainViewModel
    private let onClose: @MainActor () -> Void
    private let onOpenAnalytics: @MainActor (String) -> Void
    private let onEditDates: @MainActor (String) -> Void
    private let onInviteHelpers: @MainActor (String) -> Void

    public init(
        viewModel: ManageTrainViewModel,
        onClose: @escaping @MainActor () -> Void,
        onOpenAnalytics: @escaping @MainActor (String) -> Void = { _ in },
        onEditDates: @escaping @MainActor (String) -> Void = { _ in },
        onInviteHelpers: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
        self.onOpenAnalytics = onOpenAnalytics
        self.onEditDates = onEditDates
        self.onInviteHelpers = onInviteHelpers
    }

    /// Gift-fund goal input, in whole dollars (the API takes cents).
    @State private var fundGoalDollars: String = ""

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) { closeSheetOverlay }
        .overlay(alignment: .bottom) { toastOverlay }
        .accessibilityIdentifier("manageTrain")
        .sheet(item: $viewModel.slotEditor) { editor in
            SlotEditorSheet(
                editor: editor,
                isSubmitting: viewModel.isSubmitting,
                onSave: { edited in Task { await viewModel.saveSlot(edited) } },
                onCancel: { viewModel.dismissSlotEditor() }
            )
        }
        .alert(
            viewModel.pendingConfirm?.title ?? "",
            isPresented: Binding(
                get: { viewModel.pendingConfirm != nil },
                set: { if !$0 { viewModel.dismissConfirm() } }
            ),
            presenting: viewModel.pendingConfirm
        ) { confirm in
            Button("Cancel", role: .cancel) { viewModel.dismissConfirm() }
            Button(confirm.confirmLabel, role: .destructive) {
                // Capture the kind — SwiftUI clears `pendingConfirm`
                // through the binding before the Task gets to run.
                let kind = confirm.kind
                Task { await viewModel.perform(kind) }
            }
        } message: { confirm in
            Text(confirm.message)
        }
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { viewModel.actionError != nil },
                set: { if !$0 { viewModel.acknowledgeActionError() } }
            )
        ) {
            Button("OK", role: .cancel) { viewModel.acknowledgeActionError() }
        } message: {
            Text(viewModel.actionError ?? "")
        }
        .onChange(of: viewModel.didDeleteTrain) { _, deleted in
            if deleted { onClose() }
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onClose) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("manageTrainBackButton")

            Spacer(minLength: Spacing.s0)

            Text("Manage train")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)

            Spacer(minLength: Spacing.s0)

            // Reserve 44pt so the centered title stays optically centered
            // against the leading chevron.
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, Spacing.s1)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    // MARK: - Content states

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingBody
        case let .loaded(content):
            loadedBody(content)
        case let .error(message):
            errorBody(message: message)
        }
    }

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(height: 60, cornerRadius: Radii.lg)
                Shimmer(height: 84, cornerRadius: Radii.lg)
                Shimmer(height: 96, cornerRadius: Radii.lg)
                Shimmer(height: 140, cornerRadius: Radii.lg)
                Shimmer(height: 180, cornerRadius: Radii.lg)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s4)
        }
        .accessibilityIdentifier("manageTrainLoading")
    }

    private func errorBody(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load train")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s5)
            Button { Task { await viewModel.refresh() } } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("manageTrainRetry")
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("manageTrainError")
    }

    private func loadedBody(_ content: ManageTrainContent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                TrainContextStrip(
                    title: content.title,
                    dateRangeLabel: content.dateRangeLabel,
                    isActive: content.isActive
                )

                StatCellRow(cells: [
                    StatCellContent(id: "slots", value: content.slotFillValue, label: "Slots", tone: .success),
                    StatCellContent(id: "helpers", value: content.helpersValue, label: "Helpers", tone: .neutral),
                    StatCellContent(id: "left", value: content.daysLeftValue, label: "Left", tone: .neutral),
                    StatCellContent(id: "drop", value: content.dropoutValue, label: "Dropout", tone: .warn)
                ])

                SlotPreview(
                    filled: content.slotsFilled,
                    dropout: content.slotsDropout,
                    open: content.slotsOpen,
                    total: content.slotsTotal,
                    caption: content.slotFillCaption
                )

                sectionOverline("Send an update")
                SendUpdateForm(
                    chips: content.audienceChips,
                    message: $viewModel.draftMessage,
                    selectedAudienceId: $viewModel.selectedAudienceId,
                    pushToPhones: $viewModel.pushToPhones,
                    counterLabel: viewModel.characterCounterLabel,
                    isOverLimit: false
                )

                sectionOverline("Organize")
                OrganizeSection(rows: content.organizeRows) { row in
                    switch row.id {
                    case "edit-dates": onEditDates(content.trainId)
                    case "invite": onInviteHelpers(content.trainId)
                    case "analytics": onOpenAnalytics(content.trainId)
                    default: break
                    }
                }

                organizerControls(content)

                sectionOverline("Wind down")
                WindDownSection(row: content.closeRow) {
                    viewModel.showCloseSheet()
                }

                ManageLifecycleSection(
                    status: content.status,
                    viewerRole: content.viewerRole,
                    isBusy: viewModel.isSubmitting,
                    onPause: { Task { await viewModel.pauseTrain() } },
                    onResume: { Task { await viewModel.resumeTrain() } },
                    onUnpublish: {
                        viewModel.requestConfirm(
                            ManageDestructiveConfirm(
                                kind: .unpublishTrain,
                                title: "Unpublish this train?",
                                message: "\(content.title) goes back to draft and neighbors stop seeing it.",
                                confirmLabel: "Unpublish"
                            )
                        )
                    },
                    onArchive: {
                        viewModel.requestConfirm(
                            ManageDestructiveConfirm(
                                kind: .archiveTrain,
                                title: "Archive this train?",
                                message: "\(content.title) moves out of your active list.",
                                confirmLabel: "Archive"
                            )
                        )
                    },
                    onDelete: {
                        viewModel.requestConfirm(
                            ManageDestructiveConfirm(
                                kind: .deleteTrain,
                                title: "Delete \(content.title)?",
                                message: "This permanently deletes the train, its dates, updates and invites.",
                                confirmLabel: "Delete"
                            )
                        )
                    }
                )
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
            .padding(.bottom, Spacing.s4)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom, spacing: Spacing.s0) { stickyCTA(content: content) }
        .accessibilityIdentifier("manageTrainScroll")
    }

    /// S1 — dates / helpers / co-organizers / nudge / gift fund. Every
    /// block is gated on the viewer's organizer tier so no one sees a
    /// control the backend would 403.
    @ViewBuilder
    private func organizerControls(_ content: ManageTrainContent) -> some View {
        ManageDatesSection(
            rows: viewModel.slotRows,
            isBusy: viewModel.isSubmitting,
            onAdd: { viewModel.startAddSlot() },
            onEdit: { viewModel.startEditSlot($0) },
            onRemove: { row in
                viewModel.requestConfirm(
                    ManageDestructiveConfirm(
                        kind: .cancelSlot(slotId: row.id),
                        title: "Remove date",
                        message: "Remove \(row.dateLabel) from this Support Train?",
                        confirmLabel: "Remove"
                    )
                )
            }
        )

        ManageHelpersSection(
            rows: viewModel.helperRows,
            isBusy: viewModel.isSubmitting,
            onShareAddress: { row in
                Task { await viewModel.shareExactAddress(reservationId: row.id) }
            },
            onConfirm: { row in
                Task { await viewModel.confirmDelivery(reservationId: row.id) }
            },
            onRemove: { row in
                viewModel.requestConfirm(
                    ManageDestructiveConfirm(
                        kind: .removeHelper(reservationId: row.id),
                        title: "Remove helper from slot?",
                        message: "Reopen \(row.slotLabel.isEmpty ? "this date" : row.slotLabel) for someone else?",
                        confirmLabel: "Remove"
                    )
                )
            }
        )

        ManageOrganizersSection(
            rows: viewModel.organizerRows,
            canEdit: content.viewerRole == .primaryOrganizer,
            isBusy: viewModel.isSubmitting,
            newOrganizerUserId: $viewModel.newOrganizerUserId,
            onAdd: { Task { await viewModel.addOrganizer() } },
            onRemove: { row in
                guard let userId = row.userId else { return }
                viewModel.requestConfirm(
                    ManageDestructiveConfirm(
                        kind: .removeOrganizer(userId: userId),
                        title: "Remove organizer",
                        message: "Remove \(row.name) as a co-organizer?",
                        confirmLabel: "Remove"
                    )
                )
            }
        )

        ManageNudgeSection(
            openSlotCount: content.slotsOpen,
            draft: viewModel.nudgeDraft,
            isBusy: viewModel.isSubmitting,
            onDraft: { Task { await viewModel.draftNudge() } },
            onEditDraft: { viewModel.nudgeDraft = $0 },
            onSend: { Task { await viewModel.sendNudge() } },
            onDiscard: { viewModel.discardNudge() }
        )

        ManageFundSection(
            fund: viewModel.fund,
            canDisable: content.viewerRole == .primaryOrganizer,
            isBusy: viewModel.isSubmitting,
            goalDollars: $fundGoalDollars,
            onEnable: {
                Task { await viewModel.enableFund(goalDollars: Int(fundGoalDollars)) }
            },
            onDisable: {
                viewModel.requestConfirm(
                    ManageDestructiveConfirm(
                        kind: .disableFund,
                        title: "Disable the gift fund?",
                        message: "Neighbors won't be able to chip in money any more.",
                        confirmLabel: "Disable"
                    )
                )
            }
        )
    }

    private func sectionOverline(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.66)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .accessibilityAddTraits(.isHeader)
            .padding(.top, Spacing.s1)
    }

    // MARK: - Sticky CTA

    private func stickyCTA(content _: ManageTrainContent) -> some View {
        Button {
            Task { await viewModel.sendUpdate() }
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.send, size: 16, color: Theme.Color.appTextInverse)
                Text("Send update")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(viewModel.canSendUpdate ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
            )
        }
        .buttonStyle(.plain)
        .disabled(!viewModel.canSendUpdate)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(
            Theme.Color.appSurface
                .opacity(0.96)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
        )
        .accessibilityIdentifier("manageTrainSendUpdateCTA")
    }

    // MARK: - Overlays

    @ViewBuilder
    private var closeSheetOverlay: some View {
        switch viewModel.sheetMode {
        case .hidden, .closed:
            EmptyView()
        case .closing:
            if case let .loaded(content) = viewModel.state {
                ZStack(alignment: .bottom) {
                    Color.black.opacity(0.45)
                        .ignoresSafeArea()
                        .onTapGesture { viewModel.hideCloseSheet() }
                        .accessibilityIdentifier("manageTrainCloseSheetScrim")
                    CloseTrainSheet(
                        content: content.close,
                        thankYouNote: $viewModel.thankYouNote,
                        onCancel: { viewModel.hideCloseSheet() },
                        onConfirm: { Task { await viewModel.confirmClose() } }
                    )
                    .clipShape(
                        UnevenRoundedRectangle(
                            topLeadingRadius: Radii.xl2,
                            bottomLeadingRadius: 0,
                            bottomTrailingRadius: 0,
                            topTrailingRadius: Radii.xl2
                        )
                    )
                    .shadow(color: .black.opacity(0.18), radius: 16, y: -12)
                    .transition(.move(edge: .bottom))
                }
                .transition(.opacity)
                .accessibilityIdentifier("manageTrainCloseSheetContainer")
            }
        }
    }

    @ViewBuilder
    private var toastOverlay: some View {
        if let toast = viewModel.toast {
            Text(toast)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                .background(Capsule().fill(Theme.Color.appText))
                .padding(.bottom, Spacing.s12)
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.acknowledgeToast()
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))
                .accessibilityIdentifier("manageTrainToast")
        }
    }
}

#Preview("Active") {
    NavigationStack {
        ManageTrainView(
            viewModel: ManageTrainViewModel(
                trainId: ManageTrainSampleData.trainId,
                content: ManageTrainSampleData.active
            )
        ) {}
    }
}

#Preview("Closing sheet") {
    NavigationStack {
        ClosingPreview()
    }
}

@MainActor
private struct ClosingPreview: View {
    @State private var viewModel = ManageTrainViewModel(
        trainId: ManageTrainSampleData.trainId,
        content: ManageTrainSampleData.active
    )

    var body: some View {
        ManageTrainView(viewModel: viewModel) {}
            .task {
                await viewModel.load()
                viewModel.showCloseSheet()
            }
    }
}
