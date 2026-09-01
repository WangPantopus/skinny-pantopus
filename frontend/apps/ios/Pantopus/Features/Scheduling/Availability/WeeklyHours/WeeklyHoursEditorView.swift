//
//  WeeklyHoursEditorView.swift
//  Pantopus
//
//  Stream I3 — B5 Weekly Hours Editor (full screen). The source-of-truth
//  editor for personal availability. Uses FormShell with a sticky save bar,
//  the per-weekday on/off + time-range grid, a timezone control, and link-out
//  rows to date overrides (local sheet), booking limits (services), and
//  block-off time (local sheet).
//

import SwiftUI

struct WeeklyHoursEditorView: View {
    @State private var viewModel: WeeklyHoursEditorViewModel
    @State private var editingRange: TimeRangeEdit?
    @Environment(\.dismiss) private var dismiss

    init(viewModel: WeeklyHoursEditorViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    /// View-local target for the time-range picker sheet (which day + range).
    private struct TimeRangeEdit: Identifiable {
        let weekday: Int
        let range: TimeRange
        var id: UUID {
            range.id
        }
    }

    private var isReady: Bool {
        if case .ready = viewModel.phase { return true }
        return false
    }

    /// "Set hours" on the unset hero frame, "Edit schedule" everywhere else.
    private var formTitle: String {
        isReady && viewModel.isUnset ? "Set hours" : "Edit schedule"
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle(formTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(isReady ? .hidden : .visible, for: .navigationBar)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.weeklyHours")
            .sheet(isPresented: $viewModel.showTimezoneSheet) {
                TimezoneSelectorSheet(
                    selectedIdentifier: viewModel.timezoneId,
                    accent: Theme.Color.primary600,
                    onSelect: { viewModel.changeTimezone($0) },
                    onDone: { viewModel.showTimezoneSheet = false }
                )
            }
            .sheet(item: $editingRange) { target in
                TimeRangePickerSheet(range: target.range) { start, end in
                    viewModel.updateStart(target.weekday, target.range.id, start)
                    viewModel.updateEnd(target.weekday, target.range.id, end)
                }
            }
            .sheet(item: $viewModel.activeSheet) { sheet in
                sheetContent(sheet)
                    .presentationDragIndicator(.visible)
            }
            .alert("Couldn't save", isPresented: saveErrorPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.saveError ?? "")
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(headline: "Couldn't load this schedule", message: message) {
                await viewModel.reload()
            }
        case .ready:
            editor
        }
    }

    private var editor: some View {
        FormShell(
            title: formTitle,
            leading: .back,
            // Design `TopBar` carries a trailing Save / Saving text action on
            // every editor frame, above the full-width save bar — the label
            // greys to fg4 while the commit is in flight.
            rightActionLabel: viewModel.isSaving ? "Saving…" : "Save",
            bottomActionLabel: "Save schedule",
            showsTopActionWithBottom: true,
            isValid: viewModel.formValid && viewModel.isDirty,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: { Task { await viewModel.save() } },
            content: {
                // Design `Body` stacks its cards 12px apart — the shared shell's
                // default 20pt rhythm is looser than the availability frames.
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    AvailabilityHeaderPill()
                    if viewModel.isUnset {
                        CompositionGapCard()
                        WeeklyHoursEmptyHero { viewModel.applyNineToFiveDefault() }
                        linkGroup
                    } else {
                        if viewModel.allOff {
                            NoHoursWarningCard { viewModel.applyNineToFiveDefault() }
                        }
                        nameGroup
                        timezoneGroup
                        weeklyHoursGroup
                        linkGroup
                    }
                }
            }
        )
    }

    // MARK: Groups

    private var nameGroup: some View {
        AvailabilityCard(overline: "Schedule") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                AvailabilityFieldLabel(text: "Name")
                TextField("Working hours", text: $viewModel.scheduleName)
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appText)
                    .textInputAutocapitalization(.words)
                    .disabled(viewModel.isSaving)
                    .accessibilityIdentifier("scheduling.weeklyHours.nameField")
            }
        }
    }

    private var timezoneGroup: some View {
        AvailabilityCard(overline: "Timezone") {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                AvailabilityFieldLabel(text: "Time zone")
                timezoneFieldButton
            }
            Divider().background(Theme.Color.appBorderSubtle)
            // Design `TimezoneCard` closes on a `ToggleRow icon="lock"` — a
            // 30pt leading tile, not a bare labelled switch.
            IconToggleRow(
                icon: .lock,
                title: "Lock to my timezone",
                subtitle: "Keep these hours even when you travel",
                isOn: Binding(get: { viewModel.lockTimezone }, set: viewModel.setLockTimezone)
            )
            .disabled(viewModel.isSaving)
        }
    }

    /// Bordered field button (1.5px border, globe + value + chevron-down) with a
    /// muted "· auto" suffix when the timezone is auto-detected.
    private var timezoneFieldButton: some View {
        Button { viewModel.showTimezoneSheet = true } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.globe, size: 15, color: Theme.Color.appTextSecondary)
                timezoneLabel
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronDown, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isSaving)
        .accessibilityIdentifier("scheduling.weeklyHours.timezoneRow")
    }

    private var timezoneLabel: some View {
        // Bold the city; render the " · auto" suffix in muted fg4.

        Text(viewModel.timezoneCityDisplay)
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(Theme.Color.appText)
            + Text(viewModel.lockTimezone ? " · auto" : "")
            .font(.system(size: 13))
            .foregroundColor(Theme.Color.appTextMuted)
    }

    private var weeklyHoursGroup: some View {
        AvailabilityCard(overline: "Weekly hours") {
            ForEach(Array(viewModel.days.enumerated()), id: \.element.id) { index, day in
                WeekdayHoursRow(
                    day: day,
                    disabled: viewModel.isSaving,
                    onToggle: { viewModel.setEnabled(day.weekday, $0) },
                    onAddRange: { viewModel.addRange(day.weekday) },
                    onCopy: { viewModel.copyHours(from: day.weekday, to: $0) },
                    onEditRange: { editingRange = TimeRangeEdit(weekday: day.weekday, range: $0) },
                    onRemoveRange: { viewModel.removeRange(day.weekday, $0) }
                )
                if index < viewModel.days.count - 1 {
                    Divider().background(Theme.Color.appBorderSubtle)
                }
            }
        }
    }

    /// No overline in the design's links card (`<Card pillar="personal">` only).
    private var linkGroup: some View {
        AvailabilityCard {
            SchedulingLinkRow(
                icon: .calendarX,
                title: "Date overrides & holidays",
                subtitle: "None set"
            ) { viewModel.activeSheet = .dateOverrides }
            Divider().background(Theme.Color.appBorderSubtle)
            SchedulingLinkRow(
                icon: .slidersHorizontal,
                title: "Booking limits & notice rules",
                subtitle: "Defaults"
            ) { Task { await viewModel.openBookingLimits() } }
        }
    }

    // MARK: Sheets

    @ViewBuilder
    private func sheetContent(_ sheet: WeeklyHoursSheet) -> some View {
        switch sheet {
        case .dateOverrides:
            DateOverridesView(viewModel: viewModel.makeDateOverridesViewModel())
        case .blockOff:
            BlockOffTimeView(viewModel: viewModel.makeBlockOffViewModel())
        }
    }

    // MARK: Loading

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s5) {
                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Shimmer(width: 120, height: 12, cornerRadius: Radii.xs)
                        VStack(spacing: Spacing.s3) {
                            ForEach(0..<3, id: \.self) { _ in
                                Shimmer(height: 20, cornerRadius: Radii.sm)
                            }
                        }
                        .padding(Spacing.s4)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    }
                    .padding(.horizontal, Spacing.s3)
                }
            }
            .padding(.vertical, Spacing.s4)
        }
    }

    private var saveErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.saveError != nil }, set: { if !$0 { viewModel.saveError = nil } })
    }
}
