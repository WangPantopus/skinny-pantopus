//
//  AvailabilityScheduleListView.swift
//  Pantopus
//
//  Stream I3 — B4 Availability Schedule List (full screen). Renders the
//  personal availability schedules as standalone white cards (16pt radius,
//  36pt icon tile, vertical-ellipsis kebab) with a 10pt gap, mirroring the
//  design's `ScheduleRow` rather than the shared ListOfRowsView `.card`
//  shell (which merges rows into one grouped card with hairline dividers).
//  Carries the overflow menu (set default / rename / duplicate / delete), a
//  helper line framing personal availability as the source the other pillars
//  compose from, a boxed info note in the single-schedule frame, and a
//  two-row matching skeleton.
//

import SwiftUI

struct AvailabilityScheduleListView: View {
    @State private var viewModel: AvailabilityScheduleListViewModel

    init(viewModel: AvailabilityScheduleListViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Availability")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await viewModel.createSchedule() }
                    } label: {
                        Icon(.plus, size: 21, strokeWidth: 2.2, color: Theme.Color.primary600)
                    }
                    .accessibilityLabel("New schedule")
                    .accessibilityIdentifier("listOfRowsTopBarAction")
                }
            }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.availability.scheduleList")
            .confirmationDialog(
                viewModel.menuTarget?.name ?? "Schedule",
                isPresented: menuPresented,
                titleVisibility: .visible,
                presenting: viewModel.menuTarget
            ) { schedule in
                menuButtons(for: schedule)
            }
            .alert("Rename schedule", isPresented: renamePresented) {
                TextField("Schedule name", text: $viewModel.renameText)
                Button("Save") { Task { await viewModel.commitRename() } }
                Button("Cancel", role: .cancel) { viewModel.renameTarget = nil }
            }
            .alert(
                "Delete schedule?",
                isPresented: deletePresented,
                presenting: viewModel.deleteTarget
            ) { _ in
                Button("Delete", role: .destructive) { Task { await viewModel.confirmDelete() } }
                Button("Cancel", role: .cancel) { viewModel.deleteTarget = nil }
            } message: { schedule in
                Text("\u{201C}\(schedule.name ?? "This schedule")\u{201D} and its hours will be removed. This can't be undone.")
            }
            .alert("Heads up", isPresented: actionErrorPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.actionError ?? "")
            }
    }

    // MARK: Body by phase

    @ViewBuilder
    private var content: some View {
        switch viewModel.displayPhase {
        case .loading:
            VStack(spacing: Spacing.s0) {
                AvailabilityHeaderPill()
                helperHeader
                loadingList
            }
        case let .loaded(rows):
            VStack(spacing: Spacing.s0) {
                AvailabilityHeaderPill()
                helperHeader
                loadedList(rows)
            }
        case .empty:
            // Design omits the helper line on the empty frame but keeps the HeaderPill.
            VStack(spacing: Spacing.s0) {
                AvailabilityHeaderPill()
                EmptyState(
                    icon: .calendarClock,
                    headline: "You don't have a schedule yet",
                    subcopy: "Set the hours you're open to bookings. Your home and business pages build from this.",
                    cta: EmptyState.CTA(title: "Add working hours") {
                        await viewModel.createDefaultSchedule()
                    },
                    tint: Theme.Color.personalBg,
                    accent: Theme.Color.primary600
                )
            }
        case let .error(message):
            // Error is a non-happy state not present in design frames; no HeaderPill.
            ErrorState(headline: "Couldn't load your availability", message: message) {
                await viewModel.load()
            }
        }
    }

    // MARK: Helper header

    private var helperHeader: some View {
        Text("Times here are the source your home and business pages build from.")
            .font(.system(size: 11.5))
            .lineSpacing(2)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s1)
            .accessibilityIdentifier("scheduling.availability.helper")
    }

    // MARK: Loaded list

    private func loadedList(_ rows: [AvailabilityScheduleListViewModel.ScheduleRowDisplay]) -> some View {
        ScrollView {
            VStack(spacing: 10) {
                ForEach(rows) { row in
                    ScheduleCard(
                        row: row,
                        onOpen: { viewModel.openEditor(id: row.id) },
                        onMenu: { viewModel.openMenu(id: row.id) }
                    )
                }
                if rows.count == 1 {
                    scheduleNote(
                        "With one schedule, this list is skipped — opening Availability drops you straight into the editor."
                    )
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, Spacing.s1)
            .padding(.bottom, Spacing.s6)
        }
        .refreshable { await viewModel.refresh() }
    }

    /// Raised bordered card with a leading 14pt info icon (single-schedule note).
    private func scheduleNote(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 7) {
            Icon(.info, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
                .padding(.top, 1)
            Text(text)
                .font(.system(size: 11))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("scheduling.availability.singleScheduleNote")
    }

    // MARK: Loading

    /// Two skeleton rows matching the loaded card geometry (36pt md-radius tile).
    private var loadingList: some View {
        VStack(spacing: 10) {
            ForEach(0..<2, id: \.self) { _ in
                HStack(alignment: .center, spacing: 11) {
                    Shimmer(width: 36, height: 36, cornerRadius: Radii.md)
                    VStack(alignment: .leading, spacing: 7) {
                        Shimmer(width: 130, height: 12, cornerRadius: Radii.sm)
                        Shimmer(width: 180, height: 10, cornerRadius: Radii.sm)
                    }
                    Spacer()
                    Shimmer(width: 4, height: 18, cornerRadius: Radii.xs)
                }
                .padding(Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            }
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.top, Spacing.s1)
    }

    // MARK: Overflow menu

    @ViewBuilder
    private func menuButtons(for schedule: AvailabilityScheduleDTO) -> some View {
        if schedule.isDefault != true {
            Button("Set as default") { Task { await viewModel.setDefault(schedule) } }
        }
        Button("Rename") { viewModel.beginRename(schedule) }
        Button("Duplicate") { Task { await viewModel.duplicate(schedule) } }
        Button("Delete", role: .destructive) { viewModel.deleteTarget = schedule }
        Button("Cancel", role: .cancel) {}
    }

    // MARK: Optional → Bool bindings

    private var menuPresented: Binding<Bool> {
        Binding(get: { viewModel.menuTarget != nil }, set: { if !$0 { viewModel.menuTarget = nil } })
    }

    private var renamePresented: Binding<Bool> {
        Binding(get: { viewModel.renameTarget != nil }, set: { if !$0 { viewModel.renameTarget = nil } })
    }

    private var deletePresented: Binding<Bool> {
        Binding(get: { viewModel.deleteTarget != nil }, set: { if !$0 { viewModel.deleteTarget = nil } })
    }

    private var actionErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.actionError != nil }, set: { if !$0 { viewModel.actionError = nil } })
    }
}

// MARK: - Schedule card

/// One schedule rendered as a standalone white card: 36pt sky icon tile, name
/// + optional Default pill, summary · timezone subline, and a top-right
/// vertical-ellipsis kebab. Mirrors the design's `ScheduleRow`.
private struct ScheduleCard: View {
    let row: AvailabilityScheduleListViewModel.ScheduleRowDisplay
    let onOpen: () -> Void
    let onMenu: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(alignment: .top, spacing: 11) {
                Icon(.calendarClock, size: 18, color: Theme.Color.primary600)
                    .frame(width: 36, height: 36)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 7) {
                        Text(row.name)
                            .font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        if row.isDefault {
                            DefaultPill()
                        }
                    }
                    subline
                }
                .padding(.trailing, 28)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(alignment: .topTrailing) {
            Button(action: onMenu) {
                Icon(.ellipsisVertical, size: 18, color: Theme.Color.appTextMuted)
                    .frame(width: 30, height: 30)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("More actions for \(row.name)")
            .padding(.top, 9)
            .padding(.trailing, 7)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier("scheduling.availability.scheduleCard")
    }

    /// Summary in fg3, then an fg4 separator, then a bold fg2 timezone segment.
    private var subline: some View {
        (
            Text(row.summary)
                .foregroundColor(Theme.Color.appTextSecondary)
                + Text(row.timezone.isEmpty ? "" : "  ·  ")
                .foregroundColor(Theme.Color.appTextMuted)
                + Text(row.timezone)
                .fontWeight(.semibold)
                .foregroundColor(Theme.Color.appTextStrong)
        )
        .font(.system(size: 11.5))
    }

    private var accessibilityLabel: String {
        var parts = [row.name]
        if row.isDefault { parts.append("Default") }
        parts.append(row.summary)
        if !row.timezone.isEmpty { parts.append(row.timezone) }
        return parts.joined(separator: ", ")
    }
}

/// Filled sky "DEFAULT" pill.
private struct DefaultPill: View {
    var body: some View {
        Text("DEFAULT")
            .font(.system(size: 9, weight: .bold))
            .tracking(0.4)
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 2)
            .background(Theme.Color.primary600)
            .clipShape(Capsule())
    }
}
