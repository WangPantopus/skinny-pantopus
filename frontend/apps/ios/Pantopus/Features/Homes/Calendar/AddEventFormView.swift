//
//  AddEventFormView.swift
//  Pantopus
//
//  F3 — Home Add / Edit Event sheet. Renders the bespoke sections from
//  `add-event-frames.jsx`: a green-overline `EventSection` per group, a
//  wrapping `CatPick` category pill row, sunken date value pills, a
//  segmented Repeats control, an "Assign to" list with a green
//  selected-count + round green `Check`, gradient member avatars, the
//  amber offline banner, and the dimmed "Saving event" overlay. Identity
//  chrome uses the Home pillar accent (green); functional controls stay
//  product sky only where the design draws them so.
//

// swiftlint:disable file_length

import SwiftUI

@MainActor
struct AddEventFormView: View {
    @State private var viewModel: AddEventFormViewModel
    private let onClose: @MainActor () -> Void
    private let onCommitted: @MainActor (AddEventFormEvent) -> Void

    init(
        homeId: String,
        editingEvent: CalendarEventDTO? = nil,
        prefilledCategory: CalendarEventCategory? = nil,
        prefilledStart: Date? = nil,
        api: APIClient = .shared,
        onClose: @escaping @MainActor () -> Void,
        onCommitted: @escaping @MainActor (AddEventFormEvent) -> Void
    ) {
        _viewModel = State(initialValue: AddEventFormViewModel(
            homeId: homeId,
            editingEvent: editingEvent,
            prefilledCategory: prefilledCategory,
            prefilledStart: prefilledStart,
            api: api
        ))
        self.onClose = onClose
        self.onCommitted = onCommitted
    }

    var body: some View {
        FormShell(
            title: viewModel.screenTitle,
            rightActionLabel: viewModel.commitLabel,
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: onClose,
            onCommit: { Task { await viewModel.submit() } },
            content: {
                if !NetworkMonitor.shared.isOnline {
                    AddEventOfflineBanner()
                }
                TitleGroup(viewModel: viewModel)
                CategoryGroup(viewModel: viewModel)
                ScheduleGroup(viewModel: viewModel)
                RecurrenceGroup(viewModel: viewModel)
                AttendeesGroup(viewModel: viewModel)
                ReminderGroup(viewModel: viewModel)
                RequestRsvpGroup(viewModel: viewModel)
                NotesGroup(viewModel: viewModel)
                Color.clear.frame(height: Spacing.s5)
            }
        )
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .accessibilityIdentifier("addEventForm")
        .overlay { savingOverlay }
        .overlay(alignment: .bottom) { toastOverlay }
        .task { await viewModel.load() }
        .onChange(of: viewModel.pendingEvent) { _, pending in
            guard let pending else { return }
            viewModel.acknowledgePendingEvent()
            onCommitted(pending)
        }
    }

    @ViewBuilder private var savingOverlay: some View {
        if viewModel.isSaving {
            SavingOverlay()
        }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
        }
    }
}

// MARK: - Section (green-overline card)

/// Bespoke section card matching the design's `Section` — a white card with
/// a Home-green (`H.accent700`) uppercase overline. The shared
/// `FormFieldGroup` hardcodes a neutral overline, so the F3 sheet renders its
/// own to carry the Home pillar accent on the section labels.
private struct EventSection<Content: View>: View {
    private let overline: String?
    private let content: Content

    init(_ overline: String? = nil, @ViewBuilder content: () -> Content) {
        self.overline = overline
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if let overline {
                Text(overline)
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.homeDark)
                    .accessibilityAddTraits(.isHeader)
            }
            VStack(alignment: .leading, spacing: Spacing.s3) {
                content
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s4)
    }
}

// MARK: - Offline banner

/// Amber `wifi-off` banner the design pins to the top of the offline sheet
/// ("This event saves when you reconnect."). Named distinctly from the shared
/// `Core/Design/Components/OfflineBanner` strip — this is the in-sheet inline
/// `Banner` the F3 design draws, not the screen-level offline strip.
private struct AddEventOfflineBanner: View {
    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.wifiOff, size: 15, strokeWidth: 2.2, color: Theme.Color.warning)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("You're offline")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                Text("This event saves when you reconnect.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("addEvent_offlineBanner")
    }
}

// MARK: - Saving overlay

/// Dims the sheet behind a centered "Saving event" spinner card, matching the
/// design's `FrameSaving` overlay.
private struct SavingOverlay: View {
    var body: some View {
        ZStack {
            Theme.Color.appText.opacity(0.18).ignoresSafeArea()
            VStack(spacing: Spacing.s3) {
                ProgressView()
                    .controlSize(.large)
                    .tint(Theme.Color.home)
                Text("Saving event")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s6)
            .padding(.vertical, Spacing.s5)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .shadow(color: .black.opacity(0.10), radius: 12, x: 0, y: 8)
        }
        .allowsHitTesting(true)
        .accessibilityIdentifier("addEvent_savingOverlay")
        .accessibilityLabel("Saving event")
    }
}

// MARK: - Title

private struct TitleGroup: View {
    @Bindable var viewModel: AddEventFormViewModel

    var body: some View {
        EventSection {
            PantopusTextField(
                "Title",
                text: Binding(
                    get: { viewModel.fields[.title]?.value ?? "" },
                    set: { viewModel.updateField(.title, to: $0) }
                ),
                placeholder: "Add a title",
                state: state(for: .title),
                identifier: "addEvent_titleField"
            )
        }
    }

    private func state(for field: AddEventField) -> PantopusFieldState {
        guard let snapshot = viewModel.fields[field], snapshot.touched else { return .default }
        if let error = snapshot.error { return .error(error) }
        return snapshot.value.trimmingCharacters(in: .whitespaces).isEmpty ? .default : .valid
    }
}

// MARK: - Category

private struct CategoryGroup: View {
    @Bindable var viewModel: AddEventFormViewModel

    /// The design's five-category vocabulary (`CATS` in
    /// `add-event-frames.jsx:8`): health · chore · meal · family · school.
    private static let categories: [CalendarEventCategory] = [
        .medical, .chore, .meal, .family, .school
    ]

    var body: some View {
        EventSection("Category") {
            ChipFlow(spacing: Spacing.s2) {
                ForEach(Self.categories, id: \.self) { category in
                    CategoryPill(
                        category: category,
                        isSelected: viewModel.category == category
                    ) {
                        viewModel.category = category
                    }
                }
            }
        }
    }
}

/// Rounded-pill category chip: colour dot + label. Selected = Home-green
/// background (`H.bg100`/homeBg) + Home-dark-green text, matching `CatPick`.
private struct CategoryPill: View {
    let category: CalendarEventCategory
    let isSelected: Bool
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                Circle()
                    .fill(category.dotColor)
                    .frame(width: 8, height: 8)
                Text(category.pickerLabel)
                    .font(.system(size: 12, weight: isSelected ? .bold : .semibold))
                    .foregroundStyle(isSelected ? Theme.Color.homeDark : Theme.Color.appTextStrong)
                    .lineLimit(1)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 7)
            .background(isSelected ? Theme.Color.homeBg : Theme.Color.appSurface)
            .overlay(
                Capsule().stroke(isSelected ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("addEvent_category_\(category.rawValue)")
        .accessibilityLabel(category.pickerLabel)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Schedule

private struct ScheduleGroup: View {
    @Bindable var viewModel: AddEventFormViewModel

    var body: some View {
        EventSection("When") {
            VStack(spacing: Spacing.s0) {
                // All-day
                ValueRow(label: "All-day") {
                    Toggle("", isOn: $viewModel.allDay)
                        .labelsHidden()
                        .toggleStyle(SwitchToggleStyle(tint: Theme.Color.home))
                        .accessibilityIdentifier("addEvent_allDayToggle")
                }
                Divider().overlay(Theme.Color.appBorder)

                // Starts
                ValueRow(label: "Starts") {
                    DateValuePill(
                        date: $viewModel.startDate,
                        showsTime: !viewModel.allDay,
                        isError: false,
                        identifier: "addEvent_startDate"
                    )
                }

                // Ends
                if !viewModel.allDay {
                    Divider().overlay(Theme.Color.appBorder)
                    ValueRow(label: "Ends", isError: viewModel.endError != nil) {
                        DateValuePill(
                            date: Binding(
                                get: { viewModel.endDate ?? viewModel.startDate.addingTimeInterval(60 * 60) },
                                set: { viewModel.endDate = $0 }
                            ),
                            showsTime: true,
                            isError: viewModel.endError != nil,
                            identifier: "addEvent_endDate"
                        )
                    }
                    if let error = viewModel.endError {
                        HStack(spacing: Spacing.s1) {
                            Icon(.circleAlert, size: 11, color: Theme.Color.error)
                            Text(error)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.error)
                            Spacer(minLength: Spacing.s0)
                        }
                        .padding(.top, Spacing.s1)
                        .accessibilityIdentifier("addEvent_endError")
                    }
                }
            }
        }
    }
}

/// Inline "label left · control right" row matching the design's `ValueRow`.
private struct ValueRow<Trailing: View>: View {
    let label: String
    var isError: Bool = false
    @ViewBuilder let trailing: Trailing

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isError ? Theme.Color.error : Theme.Color.appTextStrong)
            Spacer(minLength: Spacing.s2)
            trailing
        }
        .frame(minHeight: 44)
    }
}

/// Compact sunken date pill — looks like the design's value pill but stays a
/// real picker so the date is editable.
private struct DateValuePill: View {
    @Binding var date: Date
    let showsTime: Bool
    let isError: Bool
    let identifier: String

    var body: some View {
        DatePicker(
            "",
            selection: $date,
            displayedComponents: showsTime ? [.date, .hourAndMinute] : [.date]
        )
        .labelsHidden()
        .datePickerStyle(.compact)
        .font(.system(size: 12, weight: .semibold))
        .tint(isError ? Theme.Color.error : Theme.Color.home)
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Recurrence (segmented)

private struct RecurrenceGroup: View {
    @Bindable var viewModel: AddEventFormViewModel

    var body: some View {
        EventSection("Repeats") {
            HStack(spacing: Spacing.s1) {
                ForEach(AddEventRecurrence.pickerOptions, id: \.self) { option in
                    SegmentButton(
                        label: option.segmentedLabel,
                        isSelected: viewModel.recurrence == option
                    ) {
                        viewModel.recurrence = option
                    }
                    .accessibilityIdentifier("addEvent_recurrence_\(option.rawValue)")
                }
            }
            .padding(Spacing.s1)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
    }
}

/// One segment of the design's `Segmented` control — Home-green fill + white
/// label when selected.
private struct SegmentButton: View {
    let label: String
    let isSelected: Bool
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(label)
                .font(.system(size: 12, weight: isSelected ? .bold : .semibold))
                .foregroundStyle(isSelected ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 30)
                .background(isSelected ? Theme.Color.home : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Attendees ("Assign to")

private struct AttendeesGroup: View {
    @Bindable var viewModel: AddEventFormViewModel

    var body: some View {
        EventSection("Assign to") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack {
                    Text("Assign to")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer()
                    Text("\(viewModel.selectedAttendeeIds.count) selected")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.homeDark)
                        .accessibilityIdentifier("addEvent_assignedCount")
                }

                if viewModel.attendees.isEmpty {
                    EmptyAttendeesRow()
                } else {
                    VStack(spacing: Spacing.s0) {
                        ForEach(viewModel.attendees) { attendee in
                            AttendeeRow(
                                attendee: attendee,
                                isSelected: viewModel.selectedAttendeeIds.contains(attendee.id)
                            ) {
                                viewModel.toggleAttendee(attendee.id)
                            }
                            if attendee.id != viewModel.attendees.last?.id {
                                Divider().overlay(Theme.Color.appBorder)
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct AttendeeRow: View {
    let attendee: AddEventAttendee
    let isSelected: Bool
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                MemberGradientAvatar(seed: attendee.id, initials: attendee.initials)
                Text(attendee.displayName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                RoundCheck(isSelected: isSelected)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("addEvent_attendee_\(attendee.id)")
        .accessibilityLabel(attendee.displayName)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

private struct EmptyAttendeesRow: View {
    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.usersRound, size: 18, color: Theme.Color.appTextSecondary)
            Text("No household members loaded yet.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
        }
        .padding(.vertical, Spacing.s2)
        .frame(minHeight: 44)
    }
}

/// 32pt circular gradient avatar with a 2pt white ring, matching the design's
/// `Avatar` primitive. Keyed on the member id via the shared
/// `HomeMemberPalette` so a member reads the same colour across screens.
private struct MemberGradientAvatar: View {
    let seed: String
    let initials: String

    var body: some View {
        let pair = HomeMemberPalette.gradient(for: seed)
        Text(initials.isEmpty ? "·" : initials)
            .font(.system(size: 32 * 0.38, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: 32, height: 32)
            .background(
                LinearGradient(
                    colors: [pair.start, pair.end],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(Circle())
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
            .accessibilityHidden(true)
    }
}

/// Round Home-green check matching the design's `Check` (round, green fill +
/// white tick when on; grey ring when off).
private struct RoundCheck: View {
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(isSelected ? Theme.Color.home : Color.clear)
                .overlay(
                    Circle().stroke(
                        isSelected ? Theme.Color.home : Theme.Color.appBorderStrong,
                        lineWidth: 1.5
                    )
                )
                .frame(width: 20, height: 20)
            if isSelected {
                Icon(.check, size: 12, strokeWidth: 3, color: Theme.Color.appTextInverse)
            }
        }
    }
}

// MARK: - Reminder

private struct ReminderGroup: View {
    @Bindable var viewModel: AddEventFormViewModel

    var body: some View {
        EventSection("Reminder") {
            ChipFlow(spacing: Spacing.s2) {
                ForEach(AddEventReminderOffset.allCases, id: \.self) { offset in
                    ReminderChip(
                        label: offset.label,
                        isOn: viewModel.reminderOffsets.contains(offset)
                    ) {
                        viewModel.toggleReminder(offset)
                    }
                }
            }
        }
    }
}

private struct ReminderChip: View {
    let label: String
    let isOn: Bool
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s1) {
                if isOn {
                    Icon(.check, size: 12, strokeWidth: 3, color: Theme.Color.homeDark)
                }
                Text(label)
                    .font(.system(size: 12, weight: isOn ? .bold : .semibold))
                    .foregroundStyle(isOn ? Theme.Color.homeDark : Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 7)
            .background(isOn ? Theme.Color.homeBg : Theme.Color.appSurface)
            .overlay(
                Capsule().stroke(isOn ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("addEvent_reminder_\(label)")
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Request RSVP

private struct RequestRsvpGroup: View {
    @Bindable var viewModel: AddEventFormViewModel

    var body: some View {
        EventSection {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                ValueRow(label: "Request RSVP from attendees") {
                    Toggle("", isOn: Binding(
                        get: { viewModel.requestRsvp },
                        set: { viewModel.setRequestRsvp($0) }
                    ))
                    .labelsHidden()
                    .toggleStyle(SwitchToggleStyle(tint: Theme.Color.home))
                    .accessibilityIdentifier("addEvent_requestRsvpToggle")
                }
                Text("Members get a Going / Maybe / Can't prompt")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }
}

// MARK: - Notes

private struct NotesGroup: View {
    @Bindable var viewModel: AddEventFormViewModel

    var body: some View {
        EventSection("Notes") {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                TextField(
                    "Add a note (optional)",
                    text: Binding(
                        get: { viewModel.fields[.notes]?.value ?? "" },
                        set: { viewModel.updateField(.notes, to: $0) }
                    ),
                    axis: .vertical
                )
                .lineLimit(3...8)
                .font(Theme.Font.body)
                .padding(Spacing.s3)
                .frame(minHeight: 88, alignment: .topLeading)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(
                            (viewModel.fields[.notes]?.error == nil)
                                ? Theme.Color.appBorder
                                : Theme.Color.error,
                            lineWidth: 1
                        )
                )
                .accessibilityIdentifier("addEvent_notesField")
                if let error = viewModel.fields[.notes]?.error {
                    Text(error)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                }
            }
        }
    }
}

// MARK: - Chip flow layout

/// Wrapping chip row matching the design's `ChipWrap`
/// (`display:flex; flex-wrap:wrap; gap:7`).
private struct ChipFlow: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout Void) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rows = layoutRows(maxWidth: maxWidth, subviews: subviews)
        let height = rows.isEmpty ? 0 : rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(rows.count - 1)
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: min(maxWidth, max(width, 0)), height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout Void) {
        let rows = layoutRows(maxWidth: bounds.width, subviews: subviews)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX
            for item in row.items {
                let size = subviews[item].sizeThatFits(.unspecified)
                subviews[item].place(
                    at: CGPoint(x: x, y: y),
                    anchor: .topLeading,
                    proposal: ProposedViewSize(size)
                )
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row { var items: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func layoutRows(maxWidth: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        var x: CGFloat = 0
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            if x + size.width > maxWidth, !current.items.isEmpty {
                rows.append(current)
                current = Row()
                x = 0
            }
            current.items.append(index)
            x += size.width + spacing
            current.width = max(current.width, x - spacing)
            current.height = max(current.height, size.height)
        }
        if !current.items.isEmpty { rows.append(current) }
        return rows
    }
}

#Preview {
    AddEventFormView(
        homeId: "preview",
        onClose: {},
        onCommitted: { _ in }
    )
}

// swiftlint:enable file_length
