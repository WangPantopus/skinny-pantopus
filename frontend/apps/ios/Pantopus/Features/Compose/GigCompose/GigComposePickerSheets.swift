//
//  GigComposePickerSheets.swift
//  Pantopus
//
//  E.1 — Post-a-Task composer picker sheets. The bottom-sheet sub-modals
//  the gig composer fields open, mirroring the RN `gig/_components/*`
//  modals (design: docs/design/new/Gig Picker Sheets.html). Each is a
//  rounded-top docked sheet (--radius-2xl) with a grab handle, title,
//  options, and an optional confirm affordance, presented from
//  `GigComposeWizardView` via `.sheet(item:)`.
//
//  Five sheets: Category · Deadline · Cancellation policy · Urgency ·
//  Tags. Results bind straight back into `GigComposeViewModel` /
//  `GigComposeFormState`. (The former attachment-source sheet was
//  retired in P15.5 — the Basics step now opens the system PhotosPicker
//  directly and uploads for real via `POST /api/files/upload`.)
//

import SwiftUI

// swiftlint:disable file_length

// MARK: - Sheet identifier

/// The composer picker sheets, presented one-at-a-time over the wizard.
public enum GigPickerSheet: String, Identifiable, CaseIterable, Sendable {
    case category
    case deadline
    case policy
    case urgency
    case tags
    // A12.8 — step-1 module-prompt quick editors (When / Where / Effort).
    case when
    case location
    case effort

    public var id: String {
        rawValue
    }

    /// Detents tuned to each sheet's natural content height.
    var detents: Set<PresentationDetent> {
        switch self {
        case .deadline: [.large]
        case .urgency, .effort: [.medium]
        case .category, .policy, .tags, .when, .location: [.medium, .large]
        }
    }
}

// MARK: - Host (switchboard)

/// Resolves the active `GigPickerSheet` to its concrete view and applies
/// the shared bottom-sheet presentation chrome.
struct GigPickerSheetHost: View {
    let sheet: GigPickerSheet
    let viewModel: GigComposeViewModel

    var body: some View {
        Group {
            switch sheet {
            case .category: GigCategorySheet(viewModel: viewModel)
            case .deadline: GigDeadlineSheet(viewModel: viewModel)
            case .policy: GigPolicySheet(viewModel: viewModel)
            case .urgency: GigUrgencySheet(viewModel: viewModel)
            case .tags: GigTagsSheet(viewModel: viewModel)
            case .when: GigWhenSheet(viewModel: viewModel)
            case .location: GigWhereSheet(viewModel: viewModel)
            case .effort: GigEffortSheet(viewModel: viewModel)
            }
        }
        .presentationDetents(sheet.detents)
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(Radii.xl2)
        .presentationBackground(Theme.Color.appSurface)
    }
}

// MARK: - Shared scaffold

/// Grab handle · title/subtitle · close · scrollable body · optional
/// full-width confirm button. Mirrors the design's `Sheet` component.
private struct PickerSheetScaffold<Content: View>: View {
    let testID: String
    let title: String
    var subtitle: String?
    var applyLabel: String?
    var applyIdentifier: String?
    var applyEnabled: Bool
    var onApply: (() -> Void)?
    let onClose: () -> Void
    let content: Content

    init(
        testID: String,
        title: String,
        subtitle: String? = nil,
        applyLabel: String? = nil,
        applyIdentifier: String? = nil,
        applyEnabled: Bool = true,
        onApply: (() -> Void)? = nil,
        onClose: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.testID = testID
        self.title = title
        self.subtitle = subtitle
        self.applyLabel = applyLabel
        self.applyIdentifier = applyIdentifier
        self.applyEnabled = applyEnabled
        self.onApply = onApply
        self.onClose = onClose
        self.content = content()
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            SheetGrabHandle()
            header
            ScrollView {
                content
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.top, Spacing.s4)
                    .padding(.bottom, Spacing.s4)
            }
            if let applyLabel, let onApply {
                applyButton(label: applyLabel, action: onApply)
            }
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier(testID)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s0)
            SheetCloseButton(action: onClose)
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s2)
    }

    private func applyButton(label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .shadow(color: Theme.Color.primary600.opacity(0.3), radius: 9, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .disabled(!applyEnabled)
        .opacity(applyEnabled ? 1 : 0.5)
        .accessibilityIdentifier(applyIdentifier ?? "")
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s5)
    }
}

private struct SheetGrabHandle: View {
    var body: some View {
        Capsule()
            .fill(Theme.Color.appBorderStrong)
            .frame(width: 38, height: 5)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s1)
            .accessibilityHidden(true)
    }
}

private struct SheetCloseButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Icon(.x, size: 17, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                .frame(width: 30, height: 30)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Close")
    }
}

// MARK: - Sheet 1: Deadline

private struct GigDeadlineSheet: View {
    let viewModel: GigComposeViewModel

    @State private var selectedDay: Date?
    @State private var specificTime: Bool = false

    private let calendar = Calendar.current

    var body: some View {
        PickerSheetScaffold(
            testID: "gigPicker.deadlineSheet",
            title: "Deadline",
            subtitle: "When do you need this done?",
            applyLabel: applyLabel,
            applyIdentifier: "gigPicker.deadlineApply",
            onApply: apply,
            onClose: viewModel.dismissPicker
        ) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                quickChips
                    .padding(.bottom, Spacing.s5)
                DeadlineCalendar(selectedDay: $selectedDay, calendar: calendar)
                specificTimeRow
                    .padding(.top, Spacing.s4)
            }
        }
        .onAppear(perform: restore)
    }

    private var quickChips: some View {
        FilterSheetFlowLayout(spacing: Spacing.s2) {
            PickerChip(label: "Today", isActive: isSameDay(offset: 0)) { pick(offset: 0) }
            PickerChip(label: "Tomorrow", isActive: isSameDay(offset: 1)) { pick(offset: 1) }
            PickerChip(label: "This weekend", isActive: isWeekendSelected) { pickWeekend() }
            PickerChip(label: "Flexible", isActive: selectedDay == nil) { selectedDay = nil }
                .accessibilityIdentifier("gigPicker.deadline.flexible")
        }
    }

    private var specificTimeRow: some View {
        Button {
            specificTime.toggle()
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.clock, size: 17, color: Theme.Color.appTextSecondary)
                Text("By a specific time")
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s0)
                Text(specificTime ? "6:00 PM" : "Any time")
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(specificTime ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurfaceMuted)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigPicker.deadline.specific")
        .accessibilityLabel("By a specific time, \(specificTime ? "6:00 PM" : "off")")
        .accessibilityAddTraits(specificTime ? [.isButton, .isSelected] : .isButton)
    }

    private var applyLabel: String {
        guard let day = selectedDay else { return "Set as flexible" }
        return "Set deadline · \(Self.shortFormatter.string(from: day))"
    }

    // MARK: helpers

    private func restore() {
        if let iso = viewModel.form.deadlineISO,
           let date = ISO8601DateFormatter().date(from: iso) {
            selectedDay = calendar.startOfDay(for: date)
            specificTime = calendar.component(.hour, from: date) < 23
        }
    }

    private func apply() {
        guard let day = selectedDay else {
            viewModel.setDeadline(nil)
            viewModel.dismissPicker()
            return
        }
        var comps = calendar.dateComponents([.year, .month, .day], from: day)
        comps.hour = specificTime ? 18 : 23
        comps.minute = specificTime ? 0 : 59
        let resolved = calendar.date(from: comps) ?? day
        viewModel.setDeadline(ISO8601DateFormatter().string(from: resolved))
        viewModel.dismissPicker()
    }

    private func pick(offset: Int) {
        let base = calendar.startOfDay(for: Date())
        selectedDay = calendar.date(byAdding: .day, value: offset, to: base)
    }

    private func pickWeekend() {
        selectedDay = Self.upcomingSaturday(from: Date(), calendar: calendar)
    }

    private func isSameDay(offset: Int) -> Bool {
        guard let day = selectedDay else { return false }
        let base = calendar.startOfDay(for: Date())
        guard let target = calendar.date(byAdding: .day, value: offset, to: base) else { return false }
        return calendar.isDate(day, inSameDayAs: target)
    }

    private var isWeekendSelected: Bool {
        guard let day = selectedDay else { return false }
        return calendar.isDate(day, inSameDayAs: Self.upcomingSaturday(from: Date(), calendar: calendar))
    }

    private static func upcomingSaturday(from date: Date, calendar: Calendar) -> Date {
        let start = calendar.startOfDay(for: date)
        let weekday = calendar.component(.weekday, from: start) // 1 = Sun … 7 = Sat
        let delta = (7 - weekday) % 7 // 0 when today is Saturday
        return calendar.date(byAdding: .day, value: delta, to: start) ?? start
    }

    private static let shortFormatter: DateFormatter = {
        let fmt = DateFormatter()
        fmt.dateFormat = "EEE, MMM d"
        return fmt
    }()
}

/// Month grid with prev/next navigation, today ringed and the chosen day
/// in primary. Past days are non-selectable.
private struct DeadlineCalendar: View {
    @Binding var selectedDay: Date?
    let calendar: Calendar

    @State private var monthAnchor: Date = Calendar.current.startOfDay(for: Date())

    private let weekdaySymbols = ["S", "M", "T", "W", "T", "F", "S"]
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(Array(weekdaySymbols.enumerated()), id: \.offset) { _, symbol in
                    Text(symbol)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.s1)
                }
            }
            LazyVGrid(columns: columns, spacing: Spacing.s1) {
                ForEach(Array(cells.enumerated()), id: \.offset) { _, day in
                    dayCell(day)
                }
            }
        }
        .onAppear {
            if let selected = selectedDay { monthAnchor = startOfMonth(selected) }
        }
        .onChange(of: selectedDay) { _, newValue in
            if let newValue { monthAnchor = startOfMonth(newValue) }
        }
    }

    private var header: some View {
        HStack {
            Text(Self.monthFormatter.string(from: monthAnchor))
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            HStack(spacing: Spacing.s1 + 2) {
                navButton(.chevronLeft, label: "Previous month") { shiftMonth(-1) }
                navButton(.chevronRight, label: "Next month") { shiftMonth(1) }
            }
        }
    }

    private func navButton(_ icon: PantopusIcon, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: 17, color: Theme.Color.appTextSecondary)
                .frame(width: 30, height: 30)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    @ViewBuilder
    private func dayCell(_ day: Date?) -> some View {
        if let day {
            let isSelected = selectedDay.map { calendar.isDate($0, inSameDayAs: day) } ?? false
            let isToday = calendar.isDateInToday(day)
            let isPast = day < calendar.startOfDay(for: Date())
            Button {
                selectedDay = day
            } label: {
                Text("\(calendar.component(.day, from: day))")
                    .font(.system(size: 13.5, weight: isSelected ? .bold : .medium))
                    .foregroundStyle(dayColor(isSelected: isSelected, isToday: isToday, isPast: isPast))
                    .frame(width: 36, height: 36)
                    .background(
                        Circle().fill(isSelected ? Theme.Color.primary600 : Color.clear)
                    )
                    .overlay(
                        Circle().stroke(
                            isToday && !isSelected ? Theme.Color.primary300 : Color.clear,
                            lineWidth: 1.5
                        )
                    )
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .disabled(isPast)
            .accessibilityLabel(Self.a11yFormatter.string(from: day))
            .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        } else {
            Color.clear.frame(width: 36, height: 36).frame(maxWidth: .infinity)
        }
    }

    private func dayColor(isSelected: Bool, isToday: Bool, isPast: Bool) -> Color {
        if isSelected { return Theme.Color.appTextInverse }
        if isPast { return Theme.Color.appTextMuted }
        if isToday { return Theme.Color.primary600 }
        return Theme.Color.appText
    }

    private var cells: [Date?] {
        let first = startOfMonth(monthAnchor)
        let leading = calendar.component(.weekday, from: first) - 1 // Sunday = 0 blanks
        let count = calendar.range(of: .day, in: .month, for: first)?.count ?? 30
        var result: [Date?] = Array(repeating: nil, count: max(0, leading))
        for dayOffset in 0..<count {
            result.append(calendar.date(byAdding: .day, value: dayOffset, to: first))
        }
        return result
    }

    private func startOfMonth(_ date: Date) -> Date {
        let comps = calendar.dateComponents([.year, .month], from: date)
        return calendar.date(from: comps) ?? date
    }

    private func shiftMonth(_ delta: Int) {
        if let next = calendar.date(byAdding: .month, value: delta, to: monthAnchor) {
            monthAnchor = startOfMonth(next)
        }
    }

    private static let monthFormatter: DateFormatter = {
        let fmt = DateFormatter()
        fmt.dateFormat = "MMMM yyyy"
        return fmt
    }()

    private static let a11yFormatter: DateFormatter = {
        let fmt = DateFormatter()
        fmt.dateStyle = .full
        return fmt
    }()
}

// MARK: - Sheet 2: Cancellation policy

private struct GigPolicySheet: View {
    let viewModel: GigComposeViewModel

    @State private var selection: GigCancellationPolicy = .moderate

    var body: some View {
        PickerSheetScaffold(
            testID: "gigPicker.policySheet",
            title: "Cancellation policy",
            subtitle: "What happens if the booking is called off.",
            applyLabel: "Save policy",
            applyIdentifier: "gigPicker.policySave",
            onApply: save,
            onClose: viewModel.dismissPicker
        ) {
            VStack(spacing: Spacing.s0) {
                ForEach(GigCancellationPolicy.allCases, id: \.self) { policy in
                    PolicyOptionCard(
                        policy: policy,
                        isSelected: selection == policy
                    ) { selection = policy }
                }
                SheetInfoNote(
                    icon: .info,
                    text: "Most neighbors pick Moderate — it protects you without scaring off bidders.",
                    tint: Theme.Color.primary700,
                    background: Theme.Color.primary50
                )
                .padding(.top, Spacing.s1)
            }
        }
        .onAppear {
            selection = viewModel.form.cancellationPolicy ?? .moderate
        }
    }

    private func save() {
        viewModel.setCancellationPolicy(selection)
        viewModel.dismissPicker()
    }
}

private struct PolicyOptionCard: View {
    let policy: GigCancellationPolicy
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(policy.label)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(policy.detail)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                RadioGlyph(isOn: isSelected)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(isSelected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .padding(.bottom, Spacing.s2 + 2)
        .accessibilityIdentifier("gigPicker.policy.\(policy.rawValue)")
        .accessibilityLabel("\(policy.label). \(policy.detail)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Sheet 3: Urgency

private struct GigUrgencySheet: View {
    let viewModel: GigComposeViewModel

    @State private var isUrgent: Bool = false
    @State private var window: UrgencyWindow = .withinHours

    private enum UrgencyWindow: String, CaseIterable {
        case withinHours, today, thisWeek
        var label: String {
            switch self {
            case .withinHours: "Within hours"
            case .today: "Today"
            case .thisWeek: "This week"
            }
        }
    }

    var body: some View {
        PickerSheetScaffold(
            testID: "gigPicker.urgencySheet",
            title: "Urgency",
            subtitle: "Boost a time-sensitive gig to the top.",
            applyLabel: "Apply",
            applyIdentifier: "gigPicker.urgencyApply",
            onApply: applyUrgency,
            onClose: viewModel.dismissPicker
        ) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                urgentToggleCard
                if isUrgent {
                    Text("HOW SOON")
                        .font(.system(size: 11.5, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.top, Spacing.s3)
                        .padding(.bottom, Spacing.s2)
                    windowChips
                    SheetInfoNote(
                        icon: .megaphone,
                        text: "Urgent gigs get a visibility boost · +$2 promotion fee.",
                        tint: Theme.Color.warning,
                        background: Theme.Color.warningBg
                    )
                    .padding(.top, Spacing.s4)
                }
            }
        }
        .onAppear { isUrgent = viewModel.form.isUrgent }
    }

    private func applyUrgency() {
        viewModel.setUrgent(isUrgent)
        viewModel.dismissPicker()
    }

    private var urgentToggleCard: some View {
        HStack(spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: Spacing.s1 + 3) {
                    Icon(.zap, size: 17, strokeWidth: 2.4, color: Theme.Color.warning)
                    Text("Mark as urgent")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                }
                Text("Pinned higher in the feed and flagged with an urgent badge.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
            Toggle("", isOn: $isUrgent)
                .labelsHidden()
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier("gigPicker.urgencyToggle")
                .accessibilityLabel("Mark as urgent")
        }
        .padding(Spacing.s4)
        .background(isUrgent ? Theme.Color.primary50 : Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(isUrgent ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: 1.5)
        )
    }

    private var windowChips: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(UrgencyWindow.allCases, id: \.self) { option in
                PickerChip(label: option.label, isActive: window == option) { window = option }
            }
        }
    }
}

// MARK: - Sheet 4: Tags

private struct GigTagsSheet: View {
    let viewModel: GigComposeViewModel

    @State private var draft: String = ""

    private let suggestions = [
        "#heavy-lifting", "#truck-needed", "#furniture",
        "#1-hour", "#stairs", "#tip-included"
    ]

    var body: some View {
        PickerSheetScaffold(
            testID: "gigPicker.tagsSheet",
            title: "Tags",
            subtitle: "Help the right neighbors find this gig.",
            applyLabel: applyLabel,
            applyIdentifier: "gigPicker.tagsApply",
            onApply: viewModel.dismissPicker,
            onClose: viewModel.dismissPicker
        ) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                inputField
                Text("SUGGESTED")
                    .font(.system(size: 11.5, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.top, Spacing.s5)
                    .padding(.bottom, Spacing.s3)
                suggestionCloud
                Text(remainingLabel)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.top, Spacing.s4)
            }
        }
    }

    private var inputField: some View {
        FilterSheetFlowLayout(spacing: Spacing.s1 + 3) {
            ForEach(viewModel.form.tags, id: \.self) { tag in
                TagChip(label: "#\(tag)", removable: true) { viewModel.removeTag(tag) }
            }
            TextField("Add a tag…", text: $draft)
                .font(.system(size: 13.5))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .frame(minWidth: 90)
                .onSubmit(commitDraft)
                .accessibilityIdentifier("gigPicker.tagInput")
        }
        .padding(Spacing.s3 - 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.primary600, lineWidth: 1.5)
        )
    }

    private var suggestionCloud: some View {
        FilterSheetFlowLayout(spacing: Spacing.s2) {
            ForEach(suggestions, id: \.self) { suggestion in
                SuggestionChip(
                    label: suggestion,
                    isChosen: isChosen(suggestion)
                ) { viewModel.toggleTag(suggestion) }
            }
        }
    }

    private var applyLabel: String {
        let count = viewModel.form.tags.count
        if count == 0 { return "Done" }
        return count == 1 ? "Add 1 tag" : "Add \(count) tags"
    }

    private var remainingLabel: String {
        let remaining = max(0, GigComposeLimits.maxTags - viewModel.form.tags.count)
        return "Up to \(GigComposeLimits.maxTags) tags · \(remaining) remaining"
    }

    private func isChosen(_ suggestion: String) -> Bool {
        guard let normalized = GigComposeViewModel.normalizeTag(suggestion) else { return false }
        return viewModel.form.tags.contains(normalized)
    }

    private func commitDraft() {
        viewModel.addTag(draft)
        draft = ""
    }
}

private struct TagChip: View {
    let label: String
    let removable: Bool
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s1 + 1) {
            Text(label)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
            if removable {
                Button(action: onRemove) {
                    Icon(.x, size: 13, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove \(label)")
            }
        }
        .padding(.leading, Spacing.s3 - 1)
        .padding(.trailing, removable ? Spacing.s2 : Spacing.s3 - 1)
        .padding(.vertical, Spacing.s1 + 2)
        .background(Theme.Color.primary600)
        .clipShape(Capsule())
        .accessibilityIdentifier("gigPicker.tagChip")
    }
}

private struct SuggestionChip: View {
    let label: String
    let isChosen: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s1 + 1) {
                Icon(.plus, size: 13, strokeWidth: 2.6, color: isChosen ? Theme.Color.appTextInverse : Theme.Color.appTextMuted)
                Text(label)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(isChosen ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s1 + 3)
            .background(isChosen ? Theme.Color.primary600 : Theme.Color.appSurface)
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(isChosen ? Color.clear : Theme.Color.appBorderStrong, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigPicker.tagChip")
        .accessibilityLabel("\(label)\(isChosen ? ", added" : "")")
        .accessibilityAddTraits(isChosen ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Sheet 5: Category

private struct GigCategorySheet: View {
    let viewModel: GigComposeViewModel

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.s2),
        GridItem(.flexible(), spacing: Spacing.s2)
    ]

    var body: some View {
        PickerSheetScaffold(
            testID: "gigPicker.categorySheet",
            title: "Category",
            subtitle: "Pick the archetype that fits this gig.",
            onClose: viewModel.dismissPicker
        ) {
            LazyVGrid(columns: columns, spacing: Spacing.s2) {
                ForEach(GigComposeCategory.manualPickerCases, id: \.self) { category in
                    CategorySheetTile(
                        category: category,
                        isSelected: viewModel.form.category == category
                    ) {
                        viewModel.selectCategory(category)
                        viewModel.dismissPicker()
                    }
                }
            }
        }
    }
}

private struct CategorySheetTile: View {
    let category: GigComposeCategory
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Icon(category.tileIcon, size: 17, strokeWidth: 2.2, color: category.accent)
                    .frame(width: 34, height: 34)
                    .background(category.accent.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(category.label)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(category.examples)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(isSelected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigPicker.category.\(category.rawValue)")
        .accessibilityLabel("\(category.label)\(isSelected ? ", selected" : "")")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Shared bits

private struct PickerChip: View {
    let label: String
    let isActive: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(label)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s3 + 1)
                .padding(.vertical, Spacing.s1 + 3)
                .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(isActive ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label)\(isActive ? ", selected" : "")")
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }
}

private struct RadioGlyph: View {
    let isOn: Bool

    var body: some View {
        ZStack {
            Circle()
                .stroke(isOn ? Theme.Color.primary600 : Theme.Color.appBorderStrong, lineWidth: 2)
                .frame(width: 22, height: 22)
            if isOn {
                Circle().fill(Theme.Color.primary600).frame(width: 22, height: 22)
                Icon(.check, size: 13, strokeWidth: 3, color: Theme.Color.appTextInverse)
            }
        }
        .accessibilityHidden(true)
    }
}

private struct SheetInfoNote: View {
    let icon: PantopusIcon
    let text: String
    let tint: Color
    let background: Color

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2 + 1) {
            Icon(icon, size: 15, strokeWidth: 2.2, color: tint)
                .padding(.top, 1)
            Text(text)
                .font(.system(size: 11.5))
                .foregroundStyle(tint)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3 + 1)
        .padding(.vertical, Spacing.s3 - 1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous))
    }
}

// MARK: - Sheet 6: When (A12.8 step-1 module prompt)

/// Quick When editor — schedule-type cards + a date picker for one-time.
/// Mirrors the Fill-gaps step's schedule fields.
private struct GigWhenSheet: View {
    let viewModel: GigComposeViewModel

    var body: some View {
        PickerSheetScaffold(
            testID: "gigPicker.whenSheet",
            title: "When",
            subtitle: "When does the task need to happen?",
            applyLabel: "Done",
            applyIdentifier: "gigPicker.whenApply",
            onApply: viewModel.dismissPicker,
            onClose: viewModel.dismissPicker
        ) {
            VStack(spacing: Spacing.s2) {
                ForEach(GigComposeScheduleType.allCases, id: \.self) { type in
                    Button {
                        viewModel.selectScheduleType(type)
                    } label: {
                        HStack(spacing: Spacing.s3) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(type.label)
                                    .font(.system(size: 14.5, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appText)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            RadioGlyph(isOn: viewModel.form.scheduleType == type)
                        }
                        .padding(Spacing.s3)
                        .frame(maxWidth: .infinity)
                        .background(
                            viewModel.form.scheduleType == type ? Theme.Color.primary50 : Theme.Color.appSurface
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(
                                    viewModel.form.scheduleType == type
                                        ? Theme.Color.primary600
                                        : Theme.Color.appBorder,
                                    lineWidth: 1.5
                                )
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gigPicker.when.\(type.rawValue)")
                    .accessibilityAddTraits(
                        viewModel.form.scheduleType == type ? [.isButton, .isSelected] : .isButton
                    )
                }
                if viewModel.form.scheduleType == .oneTime {
                    DatePicker(
                        "Date & time",
                        selection: scheduledStartBinding,
                        in: Date().addingTimeInterval(60)...,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .datePickerStyle(.compact)
                    .tint(Theme.Color.primary600)
                    .padding(.top, Spacing.s2)
                    .accessibilityIdentifier("gigPicker.when.date")
                }
            }
        }
    }

    private var scheduledStartBinding: Binding<Date> {
        Binding(
            get: {
                if let iso = viewModel.form.scheduledStartISO,
                   let date = ISO8601DateFormatter().date(from: iso) {
                    return date
                }
                return Date().addingTimeInterval(3600)
            },
            set: { viewModel.setScheduledStart($0) }
        )
    }
}

// MARK: - Sheet 7: Where (A12.8 step-1 module prompt)

/// Quick Where editor — location-mode cards + the address fields for
/// "a place". Mirrors the Fill-gaps step's location fields.
private struct GigWhereSheet: View {
    let viewModel: GigComposeViewModel

    var body: some View {
        PickerSheetScaffold(
            testID: "gigPicker.whereSheet",
            title: "Where",
            subtitle: "Your exact address is shared only after a helper is selected.",
            applyLabel: "Done",
            applyIdentifier: "gigPicker.whereApply",
            onApply: viewModel.dismissPicker,
            onClose: viewModel.dismissPicker
        ) {
            VStack(spacing: Spacing.s2) {
                ForEach(GigComposeLocationMode.allCases, id: \.self) { mode in
                    Button {
                        viewModel.selectLocationMode(mode)
                    } label: {
                        HStack(spacing: Spacing.s3) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(mode.label)
                                    .font(.system(size: 14.5, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appText)
                                Text(mode.subcopy)
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            RadioGlyph(isOn: viewModel.form.locationMode == mode)
                        }
                        .padding(Spacing.s3)
                        .frame(maxWidth: .infinity)
                        .background(
                            viewModel.form.locationMode == mode ? Theme.Color.primary50 : Theme.Color.appSurface
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(
                                    viewModel.form.locationMode == mode
                                        ? Theme.Color.primary600
                                        : Theme.Color.appBorder,
                                    lineWidth: 1.5
                                )
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gigPicker.where.\(mode.rawValue)")
                    .accessibilityAddTraits(
                        viewModel.form.locationMode == mode ? [.isButton, .isSelected] : .isButton
                    )
                }
                if viewModel.form.locationMode == .aPlace {
                    VStack(spacing: Spacing.s2) {
                        PantopusTextField(
                            "Street",
                            text: addressBinding(\.line1) { viewModel.updatePlaceAddress(line1: $0) },
                            placeholder: "123 Main St",
                            identifier: "gigPicker.where.line1"
                        )
                        PantopusTextField(
                            "City",
                            text: addressBinding(\.city) { viewModel.updatePlaceAddress(city: $0) },
                            identifier: "gigPicker.where.city"
                        )
                        HStack(alignment: .top, spacing: Spacing.s2) {
                            PantopusTextField(
                                "State",
                                text: addressBinding(\.state) { viewModel.updatePlaceAddress(state: $0) },
                                identifier: "gigPicker.where.state"
                            )
                            PantopusTextField(
                                "ZIP",
                                text: addressBinding(\.zip) { viewModel.updatePlaceAddress(zip: $0) },
                                identifier: "gigPicker.where.zip"
                            )
                        }
                    }
                    .padding(.top, Spacing.s2)
                }
            }
        }
    }

    private func addressBinding(
        _ keyPath: KeyPath<GigComposePlaceAddress, String>,
        set: @escaping (String) -> Void
    ) -> Binding<String> {
        Binding(
            get: { viewModel.form.placeAddress[keyPath: keyPath] },
            set: set
        )
    }
}

// MARK: - Sheet 8: Effort (A12.8 step-1 module prompt)

/// Small stepper sheet for the optional effort estimate ("~2 hours").
private struct GigEffortSheet: View {
    let viewModel: GigComposeViewModel

    @State private var hours: Double = 2

    var body: some View {
        PickerSheetScaffold(
            testID: "gigPicker.effortSheet",
            title: "Effort",
            subtitle: "Roughly how long should this take?",
            applyLabel: "Set estimate",
            applyIdentifier: "gigPicker.effortApply",
            onApply: apply,
            onClose: viewModel.dismissPicker
        ) {
            HStack(spacing: Spacing.s3) {
                Icon(.timer, size: 18, strokeWidth: 2.2, color: Theme.Color.primary600)
                    .frame(width: 36, height: 36)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                Text(hoursLabel)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s0)
                Stepper("", value: $hours, in: 0.5...24, step: 0.5)
                    .labelsHidden()
                    .accessibilityIdentifier("gigPicker.effortStepper")
                    .accessibilityLabel("Estimated hours: \(hoursLabel)")
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .onAppear {
            if let existing = Double(viewModel.form.estimatedHours), existing > 0 {
                hours = existing
            }
        }
    }

    private var hoursLabel: String {
        let rendered = hours.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(hours))
            : String(format: "%.1f", hours)
        return "~\(rendered) hour\(hours == 1 ? "" : "s")"
    }

    private func apply() {
        let rendered = hours.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(hours))
            : String(format: "%.1f", hours)
        viewModel.setEstimatedHours(rendered)
        viewModel.dismissPicker()
    }
}

// swiftlint:enable file_length
