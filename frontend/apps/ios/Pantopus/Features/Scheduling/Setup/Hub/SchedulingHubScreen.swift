//
//  SchedulingHubScreen.swift
//  Pantopus
//
//  A1 Scheduling Hub — the owner-polymorphic front door. Renders the top bar +
//  identity pill switcher and the per-phase content: loading skeleton, empty /
//  first-run, the loaded stack (composed note · booking-link card · pause row ·
//  agenda · Manage rows · pinned footer), and the error retry. Copy →
//  pasteboard + transient toast; Share → activity sheet. Matches
//  `scheduling-hub-frames.jsx`.
//

import SwiftUI
import UIKit

struct SchedulingHubScreen: View {
    @State private var model: SchedulingHubModel
    @State private var didLoad = false
    @State private var showCopyToast = false
    @State private var shareURL: ShareURLItem?

    init(owner: SchedulingOwner, push: @escaping @MainActor (SchedulingRoute) -> Void) {
        _model = State(wrappedValue: SchedulingHubModel(owner: owner, push: push))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            SetupTopBar(
                title: "Scheduling",
                leading: .none,
                // Owners get the `.moreHorizontal` settings affordance; a non-editor
                // sees the design's `.info` glyph (scheduling-hub-frames FramePermission
                // right={info}, mirrored on Android) as a view-only indicator — inert,
                // since the body already carries the view-only explainer banner.
                trailingIcon: model.canEdit ? .moreHorizontal : .info,
                trailingLabel: model.canEdit ? "Scheduling settings" : "View-only access",
                onTrailing: model.canEdit ? { model.openSettings() } : nil
            )
            SetupIdentityPills(active: model.owner) { choice in
                Task { await model.selectPillar(choice) }
            }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .overlay(alignment: .top) { copyToast }
        .sheet(item: $shareURL) { item in
            HubShareSheet(items: [item.url])
        }
        .onAppear {
            if didLoad {
                Task { await model.refresh() }
            } else {
                didLoad = true
                Task { await model.load() }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            SchedulingHubSkeleton(owner: model.owner)
        case .empty:
            ScrollView {
                HubEmptyState(owner: model.owner) { model.startSetup() }
            }
            .background(Theme.Color.appBg)
        case .loaded:
            loadedBody
        case let .error(message):
            errorBody(message)
        }
    }

    // MARK: Loaded

    private var loadedBody: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(spacing: Spacing.s0) {
                    if !model.canEdit {
                        viewOnlyBanner
                    }
                    summaryCard
                    if !model.owner.isPersonal {
                        HubComposedNote(owner: model.owner, members: composedMembers)
                            .padding(.top, 14)
                    }
                    HubLinkCard(
                        owner: model.owner,
                        handle: model.bookingHandle,
                        name: model.displayName,
                        role: model.displayRole,
                        paused: model.isPaused,
                        readOnly: !model.canEdit,
                        onCopy: copyLink,
                        onShare: shareLink
                    )
                    statusRow
                    agenda
                    manageSection
                    Color.clear.frame(height: model.canEdit ? 96 : Spacing.s6)
                }
            }
            .background(Theme.Color.appBg)
            if model.canEdit {
                HubFooterCTA(owner: model.owner, isPaused: model.isPaused, action: footerAction)
            }
        }
    }

    /// A5 summary card — embedded at the top of the loaded hub, above the
    /// booking-link card (`summary-card-frames.jsx`). Data / empty (share CTA) /
    /// error (retry) come from the already-fetched summary; the hub skeleton
    /// covers the initial loading frame, and the card's own shimmer covers a
    /// summary-only retry.
    private var summaryCard: some View {
        HubSummaryCard(
            content: summaryContent,
            owner: model.owner,
            nameFor: { model.eventTypeName(for: $0) },
            onShare: shareLink,
            onRetry: { Task { await model.retrySummary() } },
            onInsights: { model.openInsights() }
        )
    }

    private var summaryContent: HubSummaryCard.Content {
        if model.summaryRetrying { return .loading }
        if let summary = model.summary { return .data(summary) }
        return .error
    }

    @ViewBuilder
    private var statusRow: some View {
        if !model.canEdit {
            HubReadOnlyStatus(owner: model.owner)
        } else if model.isPaused {
            HubPausedBanner { Task { await model.setPaused(false) } }
        } else {
            HubPauseRow(owner: model.owner, isOn: !model.isPaused) { newOn in
                Task { await model.setPaused(!newOn) }
            }
        }
    }

    /// Permission-gated (member) read-only context banner — matches the design's
    /// info-tinted "view-only" strip at the top of the gated frame.
    private var viewOnlyBanner: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.eye, size: 16, color: Theme.Color.info)
            Text("You have view-only access. Ask an owner to make changes.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextStrong)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .background(Theme.Color.infoBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
    }

    private var pausedInfoLine: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.info, size: 14, color: Theme.Color.appTextMuted)
            Text("Existing bookings stay on your calendar while paused.")
                .pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .setupCard(radius: Radii.lg)
        .padding(.horizontal, Spacing.s4)
    }

    @ViewBuilder
    private var agenda: some View {
        let sections = model.agendaSections
        if !sections.isEmpty {
            SetupSectionHeader(
                title: "Today & upcoming",
                actionTitle: model.canEdit ? "See all bookings" : nil,
                action: model.canEdit ? { model.openBookings() } : nil
            )
            // FramePaused puts the "existing bookings stay" explainer inside the
            // agenda section, directly under its header (design info strip at
            // `4px 16px 0`; mirrors Android SchedulingHubScreen.kt).
            if model.isPaused {
                pausedInfoLine
            }
            ForEach(sections) { section in
                HubAgendaDateHeader(label: section.header, sub: section.sub)
                VStack(spacing: Spacing.s2) {
                    ForEach(section.rows) { row in
                        HubBookingRowCard(row: row)
                    }
                }
            }
        }
    }

    private var manageSection: some View {
        VStack(spacing: Spacing.s0) {
            SetupSectionHeader(title: "Manage")
            HubManageRows(items: manageItems, readOnly: !model.canEdit)
        }
    }

    private var manageItems: [HubManageItem] {
        var items: [HubManageItem] = [
            HubManageItem(
                id: "eventTypes",
                icon: .layoutGrid,
                label: "Event types",
                value: model.eventTypesValue
            ) { model.openEventTypes() }
        ]
        if model.owner.isPersonal {
            items.append(HubManageItem(
                id: "availability",
                icon: .clock,
                label: "Availability",
                value: model.availabilityValue ?? "Set hours"
            ) { model.openAvailability() })
        } else {
            items.append(HubManageItem(
                id: "memberAvailability",
                icon: .users,
                label: "Member availability"
            ) { model.openAvailability() })
        }
        items.append(HubManageItem(
            id: "calendars",
            icon: .calendarSync,
            label: "Connected calendars",
            value: model.connectedCalendarsValue
        ) { model.openConnectedCalendars() })
        if let pending = model.pendingValue {
            items.append(HubManageItem(
                id: "bookings",
                icon: .inbox,
                label: "Bookings",
                value: pending,
                alert: true
            ) { model.openBookings() })
        }
        if model.canEdit {
            items.append(HubManageItem(id: "settings", icon: .settings, label: "Settings") { model.openSettings() })
        }
        return items
    }

    private var composedMembers: [String] {
        // Avatar-stack initials are decorative; full household listing is another
        // stream's domain, so seed from the owner display name.
        let base = setupInitials(model.displayName)
        return [base, "JD", "AV"]
    }

    // MARK: Error

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 64, height: 64)
                Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text("Couldn't load scheduling").font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button { Task { await model.load() } } label: {
                HStack(spacing: 6) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            .accessibilityIdentifier("schedulingHubRetry")
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
        .background(Theme.Color.appBg)
    }

    // MARK: Copy / share

    private var copyToast: some View {
        Group {
            if showCopyToast {
                HStack(spacing: Spacing.s2) {
                    Icon(.check, size: 15, strokeWidth: 3, color: Theme.Color.success)
                    Text("Link copied").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .background(Theme.Color.appText)
                .clipShape(Capsule())
                .pantopusShadow(.lg)
                .padding(.top, Spacing.s3)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showCopyToast)
    }

    private func copyLink() {
        let value = model.bookingShareURL.isEmpty ? model.bookingHandle : model.bookingShareURL
        UIPasteboard.general.string = value
        showCopyToast = true
        Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            showCopyToast = false
        }
    }

    private func shareLink() {
        guard let url = URL(string: model.bookingShareURL.isEmpty ? "https://\(model.bookingHandle)" : model.bookingShareURL)
        else { return }
        shareURL = ShareURLItem(url: url)
    }

    private func footerAction() {
        if model.isPaused {
            Task { await model.setPaused(false) }
        } else {
            shareLink()
        }
    }
}

// MARK: - Loading skeleton

private struct SchedulingHubSkeleton: View {
    let owner: SchedulingOwner

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Shimmer(height: 252, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s4).padding(.top, 14)
                Shimmer(height: 60, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s4).padding(.top, Spacing.s3)
                Shimmer(width: 130, height: 11, cornerRadius: Radii.xs).padding(.horizontal, Spacing.s4).padding(.top, Spacing.s5).padding(
                    .bottom,
                    Spacing.s2
                )
                VStack(spacing: Spacing.s2) {
                    ForEach(0..<2, id: \.self) { _ in skeletonBookingRow }
                }
                .padding(.horizontal, Spacing.s4)
                Shimmer(width: 80, height: 11, cornerRadius: Radii.xs).padding(.horizontal, Spacing.s4).padding(.top, Spacing.s5).padding(
                    .bottom,
                    Spacing.s2
                )
                skeletonManage.padding(.horizontal, Spacing.s4)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("schedulingHubSkeleton")
    }

    private var skeletonBookingRow: some View {
        HStack(spacing: Spacing.s3) {
            Shimmer(width: 40, height: 40, cornerRadius: Radii.md)
            VStack(alignment: .leading, spacing: 6) {
                Shimmer(width: 180, height: 11, cornerRadius: Radii.xs)
                Shimmer(width: 110, height: 9, cornerRadius: Radii.xs)
                Shimmer(width: 140, height: 9, cornerRadius: Radii.xs)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .setupCard(radius: Radii.lg)
    }

    private var skeletonManage: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(0..<4, id: \.self) { idx in
                HStack(spacing: Spacing.s3) {
                    Shimmer(width: 18, height: 18, cornerRadius: Radii.xs)
                    Shimmer(width: 120, height: 11, cornerRadius: Radii.xs)
                    Spacer(minLength: Spacing.s0)
                    Shimmer(width: 48, height: 10, cornerRadius: Radii.xs)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                if idx < 3 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 14)
                }
            }
        }
        .setupCard(radius: Radii.lg)
    }
}

// MARK: - Share sheet

private struct ShareURLItem: Identifiable {
    let url: URL
    var id: String {
        url.absoluteString
    }
}

private struct HubShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context _: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_: UIActivityViewController, context _: Context) {}
}
