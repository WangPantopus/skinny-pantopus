//
//  BlockOffTimeView.swift
//  Pantopus
//
//  Stream I3 — B9 Block Off Time / Personal busy override (sheet). A short
//  create form: optional private reason, a date, an all-day toggle or a
//  time-range, and a repeat rule. Saving writes a personal busy hold.
//

import SwiftUI

struct BlockOffTimeView: View {
    @State private var viewModel: BlockOffTimeViewModel
    @State private var activePicker: BlockPicker?
    @Environment(\.dismiss) private var dismiss

    init(viewModel: BlockOffTimeViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    /// View-local target for a date / start / end picker sheet.
    private enum BlockPicker: String, Identifiable {
        case date, start, end
        var id: String {
            rawValue
        }
    }

    var body: some View {
        FormShell(
            title: "Block off time",
            leading: .close,
            rightActionLabel: "Save",
            isValid: viewModel.isValid,
            isDirty: true,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: { Task { if await viewModel.save() { dismiss() } } },
            content: {
                // Design `Body` stacks its cards 12px apart — the shared shell's
                // default 20pt rhythm is looser than the availability frames.
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    sheetOverline
                    detailsCard
                    if let conflict = viewModel.conflict {
                        conflictCard(conflict)
                    }
                    repeatsCard
                    if viewModel.isSaving {
                        savingBar
                    } else {
                        AvailabilityLockFootnote(
                            text: "This time won't be offered for booking. It's private to you."
                        )
                        .padding(.horizontal, Spacing.s3)
                    }
                }
            }
        )
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.blockOffTime")
        .sheet(item: $activePicker) { picker in
            pickerSheet(picker)
        }
        .alert("Couldn't save", isPresented: saveErrorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.saveError ?? "")
        }
    }

    /// Left-aligned sky overline beneath the centered top-bar title.
    private var sheetOverline: some View {
        Text("PERSONAL · AVAILABILITY")
            .font(.system(size: 9.5, weight: .bold))
            .tracking(0.8)
            .foregroundStyle(Theme.Color.personal)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s3)
            .accessibilityIdentifier("scheduling.blockOff.overline")
    }

    /// Reason + Date + All-day + time range live together in one borderless
    /// white card (no section overline), per the design's `DetailsCard`.
    private var detailsCard: some View {
        AvailabilityCard {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                AvailabilityFieldLabel(text: "Reason")
                TextField("Dentist", text: $viewModel.reason)
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appText)
                    .disabled(viewModel.isSaving)
                    .accessibilityIdentifier("scheduling.blockOff.reasonField")
                Text("Optional · only you can see this.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            VStack(alignment: .leading, spacing: Spacing.s1) {
                AvailabilityFieldLabel(text: "Date")
                AvailabilityFieldButton(
                    icon: .calendar,
                    value: Self.dateLabel(viewModel.date),
                    accessibilityLabel: "Date, \(Self.dateLabel(viewModel.date))",
                    disabled: viewModel.isSaving
                ) { activePicker = .date }
                    .accessibilityIdentifier("scheduling.blockOff.dateField")
            }
            // Design `DetailsCard` renders this as a `ToggleRow icon="sun"` —
            // a 30pt leading tile, not a bare labelled switch.
            IconToggleRow(
                icon: .sun,
                title: "All day",
                subtitle: "Block the whole day",
                isOn: $viewModel.allDay
            )
            .disabled(viewModel.isSaving)
            if !viewModel.allDay {
                HStack(spacing: Spacing.s2) {
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        AvailabilityFieldLabel(text: "Starts")
                        AvailabilityFieldButton(
                            icon: .clock,
                            value: viewModel.startTime.display,
                            accessibilityLabel: "Starts at \(viewModel.startTime.display)",
                            disabled: viewModel.isSaving
                        ) { activePicker = .start }
                            .accessibilityIdentifier("scheduling.blockOff.startField")
                    }
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        AvailabilityFieldLabel(text: "Ends")
                        AvailabilityFieldButton(
                            icon: .clock,
                            value: viewModel.endTime.display,
                            accessibilityLabel: "Ends at \(viewModel.endTime.display)",
                            disabled: viewModel.isSaving
                        ) { activePicker = .end }
                            .accessibilityIdentifier("scheduling.blockOff.endField")
                    }
                }
                if !viewModel.isValid {
                    Text("End must be after start.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                }
            }
        }
    }

    private var repeatsCard: some View {
        AvailabilityCard {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                AvailabilityFieldLabel(text: "Repeats")
                Menu {
                    ForEach(BlockRepeat.allCases) { option in
                        Button(option.label) { viewModel.repeats = option }
                    }
                } label: {
                    repeatsFieldButtonLabel
                }
                .disabled(viewModel.isSaving)
                .accessibilityIdentifier("scheduling.blockOff.repeatsField")
                if let caption = viewModel.repeatCaption {
                    Text(caption)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }

    /// Mirrors AvailabilityFieldButton's chrome but wraps a Menu label.
    private var repeatsFieldButtonLabel: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.arrowsRepeat, size: 15, color: Theme.Color.primary600)
            Text(viewModel.repeats.label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
            Icon(.chevronDown, size: 15, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(viewModel.isSaving ? Theme.Color.appSurfaceRaised : Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .contentShape(Rectangle())
        .opacity(viewModel.isSaving ? 0.7 : 1)
    }

    /// Saving frame: a shimmer "Saving…" bar replaces the lock footnote.
    private var savingBar: some View {
        ZStack {
            Shimmer(height: 24, cornerRadius: Radii.md)
            Text("Saving…")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s3)
        .accessibilityIdentifier("scheduling.blockOff.savingBar")
    }

    @ViewBuilder
    private func pickerSheet(_ picker: BlockPicker) -> some View {
        switch picker {
        case .date:
            BlockDatePickerSheet(date: $viewModel.date) { activePicker = nil }
        case .start:
            BlockTimePickerSheet(title: "Start time", time: $viewModel.startTime) { activePicker = nil }
        case .end:
            BlockTimePickerSheet(title: "End time", time: $viewModel.endTime) { activePicker = nil }
        }
    }

    private static func dateLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    /// ─── Conflict warning card (chip-led, semantic) ──────────────
    /// Mirrors block-time-frames.jsx · ConflictCard: warningBg surface,
    /// "Booking overlap" warning chip, body copy, and a "View booking" link.
    private func conflictCard(_ conflict: BlockConflictWarning) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                Icon(.triangleAlert, size: 10, strokeWidth: 2.6, color: Theme.Color.appSurface)
                Text("Booking overlap")
                    .font(.system(size: 9, weight: .bold))
                    .textCase(.uppercase)
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.appSurface)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(Theme.Color.warning)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            Text("This overlaps a \(conflict.bookingLabel). Blocking won't cancel it.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                viewModel.viewConflictingBooking()
            } label: {
                HStack(spacing: 5) {
                    Icon(.arrowUpRight, size: 13, strokeWidth: 2, color: Theme.Color.warning)
                    Text("View booking")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.warning)
                }
            }
            .accessibilityIdentifier("scheduling.blockOff.viewBooking")
        }
        .padding(.horizontal, 13)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("scheduling.blockOff.conflictWarning")
    }

    private var saveErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.saveError != nil }, set: { if !$0 { viewModel.saveError = nil } })
    }
}

/// Date picker sheet opened from the block-off "Date" field button.
private struct BlockDatePickerSheet: View {
    @Binding var date: Date
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Text("Date")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.top, Spacing.s4)
            DatePicker("Date", selection: $date, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .tint(Theme.Color.primary600)
                .labelsHidden()
                .padding(.horizontal, Spacing.s4)
            PrimaryButton(title: "Done") { await MainActor.run { onDone() } }
                .padding(.horizontal, Spacing.s4)
            Spacer(minLength: 0)
        }
        .background(Theme.Color.appBg)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

/// Time picker sheet opened from the block-off "Starts" / "Ends" field buttons.
private struct BlockTimePickerSheet: View {
    let title: String
    @Binding var time: TimeOfDay
    let onDone: () -> Void

    private var dateBinding: Binding<Date> {
        Binding(
            get: { time.referenceDate() },
            set: { time = TimeOfDay(from: $0) }
        )
    }

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.top, Spacing.s4)
            DatePicker(title, selection: dateBinding, displayedComponents: .hourAndMinute)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .accessibilityLabel(title)
            PrimaryButton(title: "Done") { await MainActor.run { onDone() } }
                .padding(.horizontal, Spacing.s4)
            Spacer(minLength: 0)
        }
        .background(Theme.Color.appBg)
        .presentationDetents([.height(320)])
        .presentationDragIndicator(.visible)
    }
}
