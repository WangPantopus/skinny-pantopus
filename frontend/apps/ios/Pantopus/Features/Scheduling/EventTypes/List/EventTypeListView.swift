//
//  EventTypeListView.swift
//  Pantopus
//
//  Stream I2 — B1 Event Type / Service List (full screen). Bespoke build of the
//  design's List-of-Rows event-type screen (`event-types-frames.jsx`): a
//  centered 15pt-semibold top bar with a product-blue `+`, a pillar identity
//  pill + segmented Active/Hidden filter header, a pillar-accented section
//  overline, and free-standing 14pt row cards each carrying a 6px colour dot,
//  the meta line, an inline product-blue toggle, and an ellipsis-vertical
//  overflow. Loading / empty / all-hidden / error mirror the design frames.
//
//  Rendered bespoke (not via `ListOfRowsView`) because the generic shell can't
//  express the per-row toggle, the colour-dot leading, the segmented filter, or
//  the template-chip empty state. `EventTypeListViewModel` still conforms to
//  `ListOfRowsDataSource` and keeps its `state` projection for loading / empty /
//  error discrimination and for the unit tests.
//

import SwiftUI

// swiftlint:disable file_length

// MARK: - Overflow-button anchor preference key

/// Carries each row's overflow-button frame (in the root coordinate space) so
/// the floating popover card can be positioned next to the tapped button.
private struct OverflowAnchorKey: PreferenceKey {
    typealias Value = [String: Anchor<CGRect>]
    static let defaultValue: Value = [:]
    static func reduce(value: inout Value, nextValue: () -> Value) {
        value.merge(nextValue()) { _, new in new }
    }
}

// swiftlint:disable:next type_body_length
struct EventTypeListView: View {
    @State private var viewModel: EventTypeListViewModel
    /// Resolved CGRect of the tapped overflow button (coordinate space: root VStack).
    @State private var menuAnchorRect: CGRect = .zero

    init(viewModel: EventTypeListViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            if viewModel.isReordering {
                reorderHintBar
            } else {
                filterHeader
            }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.eventTypes.list")
        // Resolve overflow-button anchors whenever the preference changes.
        .overlayPreferenceValue(OverflowAnchorKey.self) { anchors in
            GeometryReader { proxy in
                Color.clear
                    .onChange(of: viewModel.menuTarget) { _, target in
                        guard let target, let anchor = anchors[target.id] else { return }
                        menuAnchorRect = proxy[anchor]
                    }
                // Custom floating popover (design `OverflowMenu`).
                if let target = viewModel.menuTarget {
                    EventTypeOverflowMenu(
                        eventType: target,
                        anchor: menuAnchorRect,
                        containerSize: proxy.size,
                        onCopyLink: { viewModel.copyLink(target) },
                        onDuplicate: { Task { await viewModel.duplicate(target) } },
                        onShare: { viewModel.share(target) },
                        onToggle: { Task { await viewModel.toggleHidden(target) } },
                        onDelete: { viewModel.deleteTarget = target },
                        onDismiss: { viewModel.menuTarget = nil }
                    )
                    .transition(.opacity.combined(with: .scale(scale: 0.95, anchor: .topTrailing)))
                    .animation(.easeOut(duration: 0.15), value: viewModel.menuTarget != nil)
                }
            }
        }
        .alert(
            "Delete event type?",
            isPresented: deletePresented,
            presenting: viewModel.deleteTarget
        ) { _ in
            Button("Delete", role: .destructive) { Task { await viewModel.confirmDelete() } }
            Button("Cancel", role: .cancel) { viewModel.deleteTarget = nil }
        } message: { eventType in
            Text("\u{201C}\(eventType.name)\u{201D} will be removed. This can't be undone.")
        }
        .alert("Heads up", isPresented: actionErrorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.actionError ?? "")
        }
        .sheet(item: $viewModel.shareItem) { item in
            SystemShareSheet(items: [item.link])
        }
        .overlay(alignment: .bottom) { copiedToast }
        .onChange(of: viewModel.showCopiedToast) { _, shown in
            guard shown else { return }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(1.6))
                viewModel.showCopiedToast = false
            }
        }
    }

    // MARK: Top bar — centered 15pt title + product-blue add

    @Environment(\.dismiss) private var dismiss

    private var topBar: some View {
        ZStack {
            // FRAME 6 retitles the bar while reordering.
            Text(viewModel.isReordering ? "Reorder" : viewModel.screenTitle)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            HStack {
                Button { dismiss() } label: {
                    Icon(.chevronLeft, size: 20, color: Theme.Color.appText)
                        .frame(width: 32, height: 32)
                }
                .accessibilityLabel("Back")
                .opacity(viewModel.isReordering ? 0 : 1)
                .disabled(viewModel.isReordering)
                Spacer()
                if viewModel.canReorder, !viewModel.isReordering {
                    Button { viewModel.startReordering() } label: {
                        Icon(.move, size: 19, strokeWidth: 2.2, color: Theme.Color.primary600)
                            .frame(width: 32, height: 32)
                    }
                    .accessibilityLabel("Reorder event types")
                    .accessibilityIdentifier("schedulingEventTypes_reorderEntry")
                }
                Button { viewModel.createNew() } label: {
                    Icon(
                        .plus,
                        size: 21,
                        strokeWidth: 2.4,
                        color: viewModel.canEdit ? Theme.Color.primary600 : Theme.Color.appTextMuted
                    )
                    .frame(width: 32, height: 32)
                }
                .disabled(!viewModel.canEdit || viewModel.isReordering)
                .opacity(viewModel.isReordering ? 0 : 1)
                .accessibilityLabel("New event type")
                .accessibilityIdentifier("scheduling.eventTypes.create")
            }
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 46)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    // MARK: Filter header — pillar pill + segmented Active/Hidden

    private var filterHeader: some View {
        let theme = viewModel.owner.theme
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: 5) {
                Icon(theme.icon, size: 11, strokeWidth: 2.4, color: theme.accent)
                Text(theme.title.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(theme.accent)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(theme.accentBg)
            .clipShape(Capsule())
            .accessibilityIdentifier("scheduling.eventTypes.identityPill")

            EventTypeSegmentedFilter(
                selected: viewModel.currentTab
            ) { viewModel.selectTab($0) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    // MARK: Content — loading / loaded rows / empty / error

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            EventTypeListSkeleton()
        case let .error(message):
            errorState(message)
        case let .empty(empty):
            emptyState(empty)
        case .loaded:
            rowsList
        }
    }

    private var rowsList: some View {
        Group {
            if viewModel.isReordering {
                reorderList
            } else {
                staticRowsList
            }
        }
    }

    /// FRAME 6 — drag-to-order. A plain `List` in permanent edit mode gives the
    /// system drag affordance and reduces this to `onMove`, which the view-model
    /// translates into `sort_order` writes.
    private var reorderList: some View {
        List {
            ForEach(viewModel.visibleTypes) { eventType in
                EventTypeRowCard(
                    eventType: eventType,
                    meta: viewModel.rowMeta(for: eventType),
                    isHidden: viewModel.isHidden(eventType),
                    isSecret: viewModel.isSecret(eventType),
                    canEdit: viewModel.canEdit,
                    hostsBadge: viewModel.hostsBadge(for: eventType),
                    isReordering: true,
                    onTap: {},
                    onToggle: {},
                    onMenu: {}
                )
                .accessibilityIdentifier("schedulingEventTypes_reorderRow_\(eventType.id)")
                .listRowInsets(EdgeInsets(top: 4, leading: Spacing.s3, bottom: 4, trailing: Spacing.s3))
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
            }
            .onMove { source, destination in
                viewModel.moveRows(fromOffsets: source, toOffset: destination)
            }
        }
        .listStyle(.plain)
        .environment(\.editMode, .constant(.active))
        .scrollContentBackground(.hidden)
        .background(Theme.Color.appBg)
    }

    private var staticRowsList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                if !viewModel.canEdit {
                    GatedLockBanner()
                }
                Text(viewModel.sectionOverline.uppercased())
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.7)
                    .foregroundStyle(viewModel.owner.theme.accent)
                    .padding(.leading, Spacing.s1)
                    .padding(.top, 2)
                ForEach(viewModel.visibleTypes) { eventType in
                    EventTypeRowCard(
                        eventType: eventType,
                        meta: viewModel.rowMeta(for: eventType),
                        isHidden: viewModel.isHidden(eventType),
                        isSecret: viewModel.isSecret(eventType),
                        canEdit: viewModel.canEdit,
                        hostsBadge: viewModel.hostsBadge(for: eventType),
                        onTap: { viewModel.openEventType(eventType) },
                        onToggle: { Task { await viewModel.toggleHidden(eventType) } },
                        onMenu: { viewModel.menuTarget = eventType }
                    )
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s6)
        }
        .refreshable { await viewModel.refresh() }
    }

    /// Design FRAME 6 hint bar: sky-tinted strip, move glyph, instruction, Done.
    private var reorderHintBar: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.move, size: 15, color: Theme.Color.primary700)
            Text("Drag to set the order people see")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.primary700)
            Spacer(minLength: Spacing.s2)
            Button {
                Task { await viewModel.doneReordering() }
            } label: {
                Text("Done")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
            }
            .accessibilityIdentifier("schedulingEventTypes_reorderDone")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.primary50)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.primary100).frame(height: 1)
        }
    }

    // MARK: Empty + error

    @ViewBuilder
    private func emptyState(_ empty: ListOfRowsState.EmptyContent) -> some View {
        if empty.icon == .calendarPlus {
            EventTypesEmptyTemplates(
                onCreate: { viewModel.createNew() },
                onTemplate: { mins in viewModel.createFromTemplate(minutes: mins) }
            )
        } else {
            CalmEmptyState(empty: empty)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertCircle, size: 28, color: Theme.Color.appTextSecondary)
            Text("Couldn't load your event types")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button("Retry") { Task { await viewModel.refresh() } }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
                .padding(.top, Spacing.s1)
        }
        .padding(.horizontal, Spacing.s8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Copied toast

    @ViewBuilder
    private var copiedToast: some View {
        if viewModel.showCopiedToast {
            HStack(spacing: Spacing.s2) {
                Icon(.check, size: 16, color: Theme.Color.appTextInverse)
                Text("Link copied")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appText)
            .clipShape(Capsule())
            .padding(.bottom, Spacing.s6)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityIdentifier("scheduling.eventTypes.copiedToast")
        }
    }

    // MARK: Optional → Bool bindings

    private var deletePresented: Binding<Bool> {
        Binding(get: { viewModel.deleteTarget != nil }, set: { if !$0 { viewModel.deleteTarget = nil } })
    }

    private var actionErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.actionError != nil }, set: { if !$0 { viewModel.actionError = nil } })
    }
}

// MARK: - Segmented Active/Hidden filter

/// Sunken-track segmented control (design `FilterHeader`): white selected
/// segment with a soft shadow, blue700 selected label, fg3 idle labels.
private struct EventTypeSegmentedFilter: View {
    let selected: EventTypeTab
    let onSelect: (EventTypeTab) -> Void

    var body: some View {
        HStack(spacing: 3) {
            segment(.active, label: "Active")
            segment(.hidden, label: "Hidden")
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 9))
        .accessibilityIdentifier("scheduling.eventTypes.filter")
    }

    private func segment(_ tab: EventTypeTab, label: String) -> some View {
        let on = tab == selected
        return Button { onSelect(tab) } label: {
            Text(label)
                .font(.system(size: 12, weight: on ? .bold : .semibold))
                .foregroundStyle(on ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 30)
                .background(selectedBackground(on))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.eventTypes.filter.\(tab.rawValue)")
    }

    @ViewBuilder
    private func selectedBackground(_ on: Bool) -> some View {
        if on {
            RoundedRectangle(cornerRadius: 7)
                .fill(Theme.Color.appSurface)
                .pantopusShadow(.sm)
        } else {
            Color.clear
        }
    }
}

// MARK: - Event-type row card

/// Free-standing 14pt-radius white card (design `EventRow`): 6px colour dot ·
/// name (+ optional unlisted badge) over a meta line · inline product-blue
/// toggle · ellipsis-vertical overflow. Hidden rows dim to 0.55.
private struct EventTypeRowCard: View {
    let eventType: EventTypeDTO
    let meta: String
    let isHidden: Bool
    let isSecret: Bool
    var canEdit: Bool = true
    /// "N hosts" pill next to the name (design EventRow `hosts`); nil hides it.
    var hostsBadge: String?
    /// FRAME 6: leading grip, no overflow, inert toggle.
    var isReordering: Bool = false
    let onTap: () -> Void
    let onToggle: () -> Void
    let onMenu: () -> Void

    var body: some View {
        HStack(spacing: 9) {
            if isReordering {
                Icon(.gripVertical, size: 16, color: Theme.Color.appTextMuted)
            }
            Circle()
                .fill(EventTypeSwatch.match(eventType.color).color)
                .frame(width: 6, height: 6)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(eventType.name)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(isHidden ? Theme.Color.appTextSecondary : Theme.Color.appText)
                        .lineLimit(1)
                    if isSecret {
                        Icon(.eyeOff, size: 11, strokeWidth: 2.4, color: Theme.Color.appTextMuted)
                            .accessibilityLabel("Unlisted")
                    }
                    if let hostsBadge {
                        HStack(spacing: 3) {
                            Icon(.users, size: 9, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                            Text(hostsBadge)
                                .font(.system(size: 9.5, weight: .bold))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(Theme.Color.appSurfaceSunken, in: Capsule())
                    }
                }
                if !meta.isEmpty {
                    Text(meta)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            EventTypeToggle(on: !isHidden, action: onToggle)
                .disabled(!canEdit || isReordering)
                .opacity(canEdit ? 1 : 0.5)
                .accessibilityIdentifier("scheduling.eventTypes.toggle.\(eventType.id)")
            if !isReordering {
                Button(action: onMenu) {
                    Icon(.ellipsisVertical, size: 17, color: canEdit ? Theme.Color.appTextSecondary : Theme.Color.appTextMuted)
                        .frame(width: 26, height: 26)
                        // Report this button's frame so the floating popover can
                        // position itself right-anchored below the tapped button.
                        .anchorPreference(key: OverflowAnchorKey.self, value: .bounds) { [eventType.id: $0] }
                }
                .disabled(!canEdit)
                .accessibilityLabel("More")
            }
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 10)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14).stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .pantopusShadow(.sm)
        .opacity(isHidden ? 0.55 : 1)
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .accessibilityIdentifier("scheduling.eventTypes.row.\(eventType.id)")
    }
}

/// Product-blue 36×20 toggle (design `Toggle`) — distinct from a system
/// `Toggle` so it can carry the design geometry / colours exactly.
private struct EventTypeToggle: View {
    let on: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack(alignment: on ? .trailing : .leading) {
                Capsule()
                    .fill(on ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                    .frame(width: 36, height: 20)
                Circle()
                    .fill(Theme.Color.appSurface)
                    .frame(width: 16, height: 16)
                    .padding(.horizontal, 2)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Gated lock banner

/// Read-only lock banner shown above the catalog when the resolved owner lacks
/// edit rights (403 / forbidden — design `event-types-frames.jsx` FrameGated).
/// Pairs with the disabled +, per-row toggles and overflow.
private struct GatedLockBanner: View {
    var body: some View {
        HStack(spacing: 9) {
            Icon(.lock, size: 15, strokeWidth: 2, color: Theme.Color.appTextSecondary)
            Text("Only owners can edit this catalog.")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 10)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityIdentifier("scheduling.eventTypes.lockBanner")
    }
}

// MARK: - Empty states

/// Design `FrameEmpty` — radial-gradient hero disc, primary CTA pill, a
/// "Start from a template" overline, and 15/30/60-min clock chips.
private struct EventTypesEmptyTemplates: View {
    let onCreate: () -> Void
    let onTemplate: (Int) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Theme.Color.primary50, Theme.Color.primary100],
                            center: UnitPoint(x: 0.3, y: 0.3),
                            startRadius: 0,
                            endRadius: 84
                        )
                    )
                    .frame(width: 84, height: 84)
                Icon(.calendarPlus, size: 36, strokeWidth: 1.7, color: Theme.Color.primary600)
            }
            .padding(.bottom, Spacing.s4)
            Text("You don't have any event types yet")
                .font(.system(size: 15.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.s2)
            Text("An event type is something people can book — a call, a meeting, a visit. Start from a template or build your own.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 240)
                .padding(.bottom, Spacing.s5)
            Button(action: onCreate) {
                HStack(spacing: 7) {
                    Icon(.plus, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("Create your first event type")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 11)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                .pantopusShadow(.primary)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.eventTypes.create")
            .padding(.bottom, Spacing.s4)
            Text("START FROM A TEMPLATE")
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextMuted)
                .padding(.bottom, Spacing.s2)
            HStack(spacing: 7) {
                ForEach([15, 30, 60], id: \.self) { mins in
                    Button { onTemplate(mins) } label: {
                        HStack(spacing: 5) {
                            Icon(.clock, size: 12, color: Theme.Color.primary600)
                            Text("\(mins) min")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Theme.Color.appTextStrong)
                        }
                        .padding(.horizontal, 13)
                        .padding(.vertical, 7)
                        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                        .background(Theme.Color.appSurface, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("scheduling.eventTypes.empty")
    }
}

/// Calm empty (design `FrameAllHidden` / nothing-hidden) — 60pt sunken disc,
/// headline + subcopy, optional ghost CTA. Driven by the VM's `EmptyContent`.
private struct CalmEmptyState: View {
    let empty: ListOfRowsState.EmptyContent

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(empty.tint ?? Theme.Color.appSurfaceSunken)
                    .frame(width: 60, height: 60)
                Icon(empty.icon, size: 26, strokeWidth: 1.8, color: empty.accent ?? Theme.Color.appTextMuted)
            }
            .padding(.bottom, Spacing.s4)
            Text(empty.headline)
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.s2)
            Text(empty.subcopy)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 210)
            if let title = empty.ctaTitle, let onCTA = empty.onCTA {
                Button(action: onCTA) {
                    HStack(spacing: 6) {
                        Text(title)
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary700)
                        Icon(.arrowRight, size: 13, color: Theme.Color.primary700)
                    }
                    .padding(.horizontal, 15)
                    .padding(.vertical, 9)
                    .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(Theme.Color.appBorder, lineWidth: 1))
                    .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.md))
                }
                .buttonStyle(.plain)
                .padding(.top, Spacing.s4)
            }
        }
        .padding(.horizontal, Spacing.s8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("scheduling.eventTypes.empty")
    }
}

// MARK: - Custom overflow popover (design `OverflowMenu`)

/// Floating card anchored right-aligned below the tapped overflow button.
/// Matches the design spec: 184pt wide, radius 12, deep shadow, 4pt padding,
/// icon+label rows (9/10pt), first-item blue50/blue700 highlight, danger
/// separator for Delete.
private struct EventTypeOverflowMenu: View {
    let eventType: EventTypeDTO
    /// Frame of the tapped overflow button in the root coordinate space.
    let anchor: CGRect
    let containerSize: CGSize
    let onCopyLink: () -> Void
    let onDuplicate: () -> Void
    let onShare: () -> Void
    let onToggle: () -> Void
    let onDelete: () -> Void
    let onDismiss: () -> Void

    private let menuWidth: CGFloat = 184

    private struct MenuItem {
        let icon: PantopusIcon
        let label: String
        let isDanger: Bool
        let isSeparated: Bool
        let action: () -> Void
    }

    private var items: [MenuItem] {
        let toggleLabel = eventType.isActive == false ? "Make active" : "Hide"
        let toggleIcon: PantopusIcon = eventType.isActive == false ? .eye : .eyeOff
        return [
            MenuItem(icon: .link, label: "Copy booking link", isDanger: false, isSeparated: false, action: onCopyLink),
            MenuItem(icon: .copy, label: "Duplicate", isDanger: false, isSeparated: false, action: onDuplicate),
            MenuItem(icon: .share2, label: "Share", isDanger: false, isSeparated: false, action: onShare),
            MenuItem(icon: toggleIcon, label: toggleLabel, isDanger: false, isSeparated: false, action: onToggle),
            MenuItem(icon: .trash2, label: "Delete", isDanger: true, isSeparated: true, action: onDelete)
        ]
    }

    /// Top-left origin of the card in the container coordinate space.
    private var cardOrigin: CGPoint {
        // Right-align card to the overflow button's trailing edge.
        let x = min(anchor.maxX - menuWidth, containerSize.width - menuWidth - 8)
        // Position below the button; clamp so the card stays on screen.
        let belowButton = anchor.maxY + 6
        let aboveButton = anchor.minY - cardHeight - 6
        let y = belowButton + cardHeight > containerSize.height - 8
            ? aboveButton
            : belowButton
        return CGPoint(x: max(8, x), y: max(8, y))
    }

    /// Estimated card height (4pt padding top+bottom + rows).
    private var cardHeight: CGFloat {
        let rowH: CGFloat = 35 // 9pt + 10pt padding + icon height ~15
        let separatorH: CGFloat = 7 // 1pt border + marginTop 3 + padding 3
        return 4 + CGFloat(items.count) * rowH + separatorH + 4
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Dismiss scrim — transparent, catches taps outside the card.
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture(perform: onDismiss)
                .ignoresSafeArea()

            // Menu card.
            menuCard
                .frame(width: menuWidth)
                .position(
                    x: cardOrigin.x + menuWidth / 2,
                    y: cardOrigin.y + cardHeight / 2
                )
                .accessibilityIdentifier("scheduling.eventTypes.overflowMenu.\(eventType.id)")
        }
    }

    private var menuCard: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                menuRow(item: item, isFirst: index == 0)
            }
        }
        .padding(4)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 12).stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        // Design shadow: 0 16px 40px rgba(17,24,39,0.22) — 111827 = appText token
        .shadow(color: Theme.Color.appText.opacity(0.22), radius: 20, x: 0, y: 8)
    }

    @ViewBuilder
    private func menuRow(item: MenuItem, isFirst: Bool) -> some View {
        if item.isSeparated {
            // Delete row — preceded by a border separator (design: borderTop + marginTop 3).
            Divider()
                .padding(.horizontal, 0)
                .padding(.top, 3)
        }
        Button {
            onDismiss()
            item.action()
        } label: {
            HStack(spacing: 10) {
                Icon(
                    item.icon,
                    size: 15,
                    strokeWidth: 2,
                    color: item.isDanger ? Theme.Color.error : (isFirst ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                )
                Text(item.label)
                    .font(.system(size: 12.5, weight: isFirst ? .bold : .medium))
                    .foregroundStyle(item.isDanger ? Theme.Color.error : (isFirst ? Theme.Color.primary700 : Theme.Color.appText))
                    .tracking(-0.1)
                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .frame(maxWidth: .infinity)
            .background(isFirst ? Theme.Color.primary50 : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Loading skeleton

/// Three shimmer rows mirroring the loaded card geometry (design `FrameLoading`).
private struct EventTypeListSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Shimmer(width: 88, height: 9, cornerRadius: Radii.xs)
                .padding(.leading, Spacing.s1)
            ForEach(0..<3, id: \.self) { _ in
                HStack(spacing: 9) {
                    Shimmer(width: 6, height: 6, cornerRadius: Radii.pill)
                    VStack(alignment: .leading, spacing: 7) {
                        Shimmer(width: 140, height: 11, cornerRadius: Radii.xs)
                        Shimmer(width: 96, height: 9, cornerRadius: Radii.xs)
                    }
                    Spacer()
                    Shimmer(width: 36, height: 20, cornerRadius: Radii.pill)
                }
                .padding(.horizontal, 11)
                .padding(.vertical, 10)
                .background(Theme.Color.appSurface)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s3)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("scheduling.eventTypes.loading")
    }
}
