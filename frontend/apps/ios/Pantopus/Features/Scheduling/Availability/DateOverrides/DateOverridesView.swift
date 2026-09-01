//
//  DateOverridesView.swift
//  Pantopus
//
//  Stream I3 — B6 Date Overrides & Holidays (sheet). A month calendar +
//  Unavailable/Custom-hours composer (PickerBlock), a "Block a date range"
//  link row, the list of saved overrides, a US-public-holiday set card, and —
//  when the set is on — the imported-holiday list. Presented locally from the
//  weekly-hours editor; also routable.
//
//  Pillar: Personal — accent ONLY on the sheet overline + per-date overline.
//  Every control stays product sky (primary600). White cards, 1px border,
//  16px radius, shadow-sm, no left-border accents.
//

import SwiftUI

// swiftlint:disable file_length
// swiftlint:disable:next type_body_length
struct DateOverridesView: View {
    @State private var viewModel: DateOverridesViewModel
    /// The custom-hours block currently open in the time-range picker.
    @State private var editingBlock: TimeRange?
    @Environment(\.dismiss) private var dismiss

    init(viewModel: DateOverridesViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            grabber
            header
            content
        }
        .background(Theme.Color.appSurface)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .accessibilityIdentifier("scheduling.dateOverrides")
        .sheet(item: $editingBlock) { block in
            TimeRangePickerSheet(range: block) { start, end in
                viewModel.updateCustomBlock(block.id, start: start, end: end)
            }
        }
        .alert("Couldn't save", isPresented: errorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }

    // MARK: Sheet chrome

    private var grabber: some View {
        Capsule()
            .fill(Theme.Color.appBorderStrong)
            .frame(width: 38, height: 5)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s1)
            .accessibilityHidden(true)
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Personal · Working hours")
                    .font(.system(size: 9.5, weight: .bold))
                    .kerning(0.8)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.personal)
                Text("Date overrides")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
            }
            Spacer()
            Button("Done") { dismiss() }
                .font(Theme.Font.body)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.primary600)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(headline: "Couldn't load overrides", message: message) {
                await viewModel.reload()
            }
        case .ready:
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    calendarCard
                    composerCard
                    rangeLinkRow
                    overridesSection
                    holidayCard
                    if viewModel.holidaysEnabled {
                        holidayImportSection
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s1)
                .padding(.bottom, Spacing.s6)
            }
            .background(Theme.Color.appBg)
        }
    }

    // MARK: Calendar (custom month grid — matches design date-overrides-frames.jsx lines 90–133)

    /// Weekday column headers — Sunday-first, single-character.
    private static let weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"]

    private var calendarCard: some View {
        VStack(spacing: Spacing.s0) {
            monthNavHeader
            weekdayHeader
            dayGrid
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s3 + 2)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.sm)
        .accessibilityIdentifier("scheduling.dateOverrides.calendar")
    }

    /// "July 2026" label + chevron-left / chevron-right navigation.
    private var monthNavHeader: some View {
        HStack {
            Text(Self.monthTitle(viewModel.displayedMonth))
                .font(.system(size: 13.5, weight: .bold))
                .kerning(-0.2)
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            HStack(spacing: Spacing.s1) {
                Button {
                    viewModel.stepMonth(-1)
                } label: {
                    Icon(.chevronLeft, size: 17, color: Theme.Color.appTextSecondary)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Previous month")
                Button {
                    viewModel.stepMonth(1)
                } label: {
                    Icon(.chevronRight, size: 17, color: Theme.Color.appTextSecondary)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Next month")
            }
        }
        .padding(.horizontal, 2)
        .padding(.bottom, Spacing.s2 + 2)
    }

    /// Single-character S/M/T/W/T/F/S row.
    private var weekdayHeader: some View {
        HStack(spacing: 1) {
            ForEach(Array(Self.weekdayLabels.enumerated()), id: \.offset) { _, label in
                Text(label)
                    .font(.system(size: 9.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 2)
            }
        }
        .padding(.bottom, Spacing.s1)
    }

    /// 7-column day grid with tap-to-select, selected-day circle, and override dots.
    private var dayGrid: some View {
        let cells = Self.calendarCells(for: viewModel.displayedMonth)
        let overrideDates = Set(viewModel.overrides.map(\.date))
        let todayKey = OverrideFormatting.ymdKey(Date())
        let cal = Calendar.current
        let selectedKey = OverrideFormatting.ymdKey(viewModel.selectedDate)
        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 1), count: 7),
            spacing: 1
        ) {
            ForEach(Array(cells.enumerated()), id: \.offset) { _, cell in
                if let day = cell {
                    let dayKey = Self.ymdKey(day: day, month: viewModel.displayedMonth, calendar: cal)
                    let isSelected = dayKey == selectedKey
                    let hasOverride = overrideDates.contains(dayKey)
                    let isToday = dayKey == todayKey
                    dayCellView(
                        day: day,
                        isSelected: isSelected,
                        hasOverride: hasOverride,
                        isToday: isToday,
                        dayKey: dayKey
                    )
                } else {
                    Color.clear
                        .frame(height: 30)
                }
            }
        }
    }

    /// Individual day cell: 28pt circle background, day number, 4pt override dot.
    private func dayCellView(
        day: Int,
        isSelected: Bool,
        hasOverride: Bool,
        isToday: Bool,
        dayKey _: String
    ) -> some View {
        Button {
            viewModel.selectDay(day)
        } label: {
            ZStack(alignment: .bottom) {
                ZStack {
                    Circle()
                        .fill(isSelected ? Theme.Color.primary600 : Color.clear)
                        .frame(width: 28, height: 28)
                    Text("\(day)")
                        .font(.system(size: 12, weight: isSelected ? .bold : .medium))
                        .foregroundStyle(
                            isSelected
                                ? Theme.Color.appSurface
                                : (isToday ? Theme.Color.primary600 : Theme.Color.appText)
                        )
                        .monospacedDigit()
                }
                if hasOverride && !isSelected {
                    Circle()
                        .fill(Theme.Color.primary600)
                        .frame(width: 4, height: 4)
                        .offset(y: 1)
                }
            }
            .frame(height: 30)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Day \(day)\(hasOverride ? ", has override" : "")")
    }

    // MARK: Calendar helpers

    /// "July 2026" from the first-of-month Date.
    private static func monthTitle(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = .current
        f.dateFormat = "MMMM yyyy"
        return f.string(from: date)
    }

    /// Array of optional Int — nil for leading blank cells, then 1…daysInMonth.
    private static func calendarCells(for month: Date) -> [Int?] {
        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month], from: month)
        guard let firstOfMonth = cal.date(from: comps),
              let range = cal.range(of: .day, in: .month, for: firstOfMonth) else { return [] }
        // firstWeekday: Sunday=1…Saturday=7 — convert to 0-based column offset.
        let startWeekday = (cal.component(.weekday, from: firstOfMonth) - 1 + 7) % 7
        var cells: [Int?] = Array(repeating: nil, count: startWeekday)
        cells.append(contentsOf: range.map { Optional($0) })
        return cells
    }

    /// Builds a YYYY-MM-DD key for a given day number within the displayed month.
    private static func ymdKey(day: Int, month: Date, calendar: Calendar) -> String {
        var comps = calendar.dateComponents([.year, .month], from: month)
        comps.day = day
        guard let date = calendar.date(from: comps) else { return "" }
        return OverrideFormatting.ymdKey(date, calendar: calendar)
    }

    // MARK: Composer (PickerBlock)

    private var composerCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(Self.longDateLabel(viewModel.selectedDate))
                .font(.system(size: 9.5, weight: .bold))
                .kerning(0.8)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.personal)

            // Design `Segmented` (sunken track, white selected card) — the
            // native segmented Picker carried none of that chrome.
            EventTypeSegmented(
                options: OverrideMode.allCases,
                selection: $viewModel.mode,
                label: { $0.label },
                accessibilityID: "scheduling.dateOverrides.mode"
            )

            if viewModel.mode == .customHours {
                Text("Hours for this day")
                    .font(.system(size: 11, weight: .semibold))
                    .kerning(-0.05)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                customHoursBlocks
            } else {
                Text("People can't book you on this date.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }

            primaryCTA
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.sm)
    }

    /// The custom-hours block list: one labelled time-range button per block
    /// (clock · "10:00 AM – 2:00 PM" · chevron), each opening a picker sheet,
    /// under a "+ Add a block" affordance. Design `PickerBlock` (AVAIL-08) —
    /// a day can hold several windows, and each block persists as its own
    /// override row for that date (mirrors the web `DateOverrideEditor`).
    private var customHoursBlocks: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(viewModel.customBlocks) { block in
                AvailabilityTimeRangeButton(
                    label: block.display,
                    isValid: block.isValid,
                    onTap: { editingBlock = block },
                    onRemove: viewModel.customBlocks.count > 1
                        ? { viewModel.removeCustomBlock(block.id) }
                        : nil
                )
                .accessibilityIdentifier("scheduling.dateOverrides.customHoursButton")
            }
            Button {
                viewModel.addCustomBlock()
            } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.plus, size: 13, strokeWidth: 2.4, color: Theme.Color.primary600)
                    Text("Add a block")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add a time block to this day")
            .accessibilityIdentifier("scheduling.dateOverrides.addBlock")
        }
    }

    private var primaryCTA: some View {
        let isCustom = viewModel.mode == .customHours
        return Button {
            Task { await viewModel.addOverride() }
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(isCustom ? .clock : .calendarOff, size: 15, color: Theme.Color.appSurface)
                Text(isCustom ? "Add custom hours for this day" : "Block this date")
                    .font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(Theme.Color.appSurface)
            .frame(maxWidth: .infinity)
            .frame(height: 42)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!viewModel.canAddCustom)
        .opacity(viewModel.canAddCustom ? 1 : 0.5)
        .accessibilityIdentifier("scheduling.dateOverrides.addButton")
    }

    // MARK: Range link

    private var rangeLinkRow: some View {
        Button { viewModel.isRange = true } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                        .frame(width: 30, height: 30)
                    Icon(.calendarRange, size: 15, color: Theme.Color.appTextStrong)
                }
                Text("Block a date range")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s1)
            .padding(.vertical, Spacing.s1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.dateOverrides.rangeLink")
        .sheet(isPresented: $viewModel.isRange) {
            rangeComposer
        }
    }

    /// The range composer lives in a child sheet so the link-row idiom matches
    /// the design (a chevron row that "opens range mode") while keeping the
    /// existing range ViewModel state.
    private var rangeComposer: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Personal · Working hours")
                        .font(.system(size: 9.5, weight: .bold))
                        .kerning(0.8)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.personal)
                    Text("Block a date range")
                        .pantopusTextStyle(.h3)
                        .foregroundStyle(Theme.Color.appText)
                }
                Spacer()
                Button("Cancel") { viewModel.isRange = false }
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            DatePicker(
                "From",
                selection: $viewModel.selectedDate,
                displayedComponents: .date
            )
            .tint(Theme.Color.primary600)
            DatePicker(
                "Until",
                selection: $viewModel.rangeEndDate,
                in: viewModel.selectedDate...viewModel.maxRangeEnd,
                displayedComponents: .date
            )
            .tint(Theme.Color.primary600)
            Button {
                Task {
                    await viewModel.addOverride()
                    viewModel.isRange = false
                }
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.calendarOff, size: 15, color: Theme.Color.appSurface)
                    Text("Block these dates")
                        .font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(Theme.Color.appSurface)
                .frame(maxWidth: .infinity)
                .frame(height: 42)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .padding(Spacing.s4)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: Overrides list

    @ViewBuilder
    private var overridesSection: some View {
        sectionLabel("Overrides")
        if viewModel.overrides.isEmpty {
            emptyOverrides
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                .pantopusShadow(.sm)
        } else {
            VStack(spacing: Spacing.s0) {
                ForEach(Array(viewModel.overrides.enumerated()), id: \.element.id) { index, entry in
                    overrideRow(entry)
                    if index < viewModel.overrides.count - 1 {
                        Divider().background(Theme.Color.appBorder)
                    }
                }
            }
            .padding(.horizontal, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .pantopusShadow(.sm)
        }
    }

    private var emptyOverrides: some View {
        VStack(spacing: Spacing.s2) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: 44, height: 44)
                Icon(.calendarX, size: 21, color: Theme.Color.appTextMuted)
            }
            Text("No date overrides yet. Pick a date to add one.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 210)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s2)
        .padding(.horizontal, Spacing.s3)
    }

    private func overrideRow(_ entry: OverrideEntry) -> some View {
        let isCustom = !entry.isUnavailable
        return HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(isCustom ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                    .frame(width: 34, height: 34)
                Icon(
                    isCustom ? .clock : .calendarOff,
                    size: 16,
                    color: isCustom ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                )
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(OverrideFormatting.displayDate(entry.date))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(Self.summary(entry))
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Button {
                Task { await viewModel.removeOverride(entry.date) }
            } label: {
                Icon(.trash, size: 15, color: Theme.Color.appTextMuted)
                    .frame(width: 30, height: 30)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Delete override for \(OverrideFormatting.displayDate(entry.date))")
        }
        .padding(.vertical, 11)
    }

    private static func summary(_ entry: OverrideEntry) -> String {
        if entry.isUnavailable { return "Unavailable" }
        if let start = entry.start, let end = entry.end {
            return TimeRange(start: start, end: end).display
        }
        return "Custom hours"
    }

    // MARK: Holidays

    private var holidayCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            // Card overline — personal pillar accent (design Card uses `accent`,
            // not the muted SectionLabel color).
            Text("Holiday sets")
                .font(.system(size: 9.5, weight: .bold))
                .kerning(0.8)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.personal)
                .frame(maxWidth: .infinity, alignment: .leading)
            let isOn = viewModel.holidaysEnabled
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(isOn ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                        .frame(width: 30, height: 30)
                    Icon(.flag, size: 15, color: isOn ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("US public holidays")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(viewModel.holidaysEnabled
                        ? "Adds \(viewModel.holidayCount) days off this year"
                        : "Block major US holidays automatically")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                Toggle("", isOn: holidaysBinding)
                    .labelsHidden()
                    .tint(Theme.Color.primary600)
                    .accessibilityLabel("US public holidays")
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.sm)
    }

    /// The imported-holiday list (design Frame 4). Read-only; the names come
    /// from USHolidays. Removing a single one is not offered — the set is
    /// all-or-nothing per the explainer.
    @ViewBuilder
    private var holidayImportSection: some View {
        sectionLabel("From US public holidays")
        VStack(spacing: Spacing.s0) {
            let holidays = viewModel.currentYearHolidayList
            ForEach(Array(holidays.enumerated()), id: \.element.id) { index, holiday in
                holidayRow(holiday)
                if index < holidays.count - 1 {
                    Divider().background(Theme.Color.appBorder)
                }
            }
        }
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.sm)

        Text("Holidays are blocked as a set. Turn the set off to remove them all at once.")
            .font(.system(size: 11))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.horizontal, Spacing.s1)
    }

    private func holidayRow(_ holiday: USHolidays.Holiday) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: 34, height: 34)
                Icon(.calendarOff, size: 16, color: Theme.Color.appTextSecondary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(Self.shortDateLabel(holiday.date))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(holiday.name)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Text("Holiday")
                .font(.system(size: 9, weight: .bold))
                .kerning(0.4)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 3)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Capsule())
        }
        .padding(.vertical, Spacing.s2)
    }

    // MARK: Section labels

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 9.5, weight: .bold))
            .kerning(0.8)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextMuted)
            .padding(.horizontal, Spacing.s1)
            .padding(.top, Spacing.s1)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Loading

    private var loadingSkeleton: some View {
        VStack(spacing: Spacing.s3) {
            Shimmer(height: 280, cornerRadius: Radii.xl)
            Shimmer(height: 150, cornerRadius: Radii.xl)
            ForEach(0..<2, id: \.self) { _ in
                Shimmer(height: 56, cornerRadius: Radii.xl)
            }
            Spacer()
        }
        .padding(Spacing.s4)
    }

    // MARK: Date labels

    /// `Thursday, Jul 4` for the per-date PickerBlock overline.
    private static func longDateLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: date)
    }

    /// `Jan 1` for an imported-holiday row, from a `YYYY-MM-DD` key.
    private static func shortDateLabel(_ ymd: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        parser.timeZone = TimeZone(identifier: "UTC")
        guard let date = parser.date(from: ymd) else { return ymd }
        let display = DateFormatter()
        display.locale = .current
        display.timeZone = TimeZone(identifier: "UTC")
        display.dateFormat = "MMM d"
        return display.string(from: date)
    }

    // MARK: Bindings

    private var holidaysBinding: Binding<Bool> {
        Binding(
            get: { viewModel.holidaysEnabled },
            set: { enable in Task { await viewModel.toggleHolidays(enable) } }
        )
    }

    private var errorPresented: Binding<Bool> {
        Binding(get: { viewModel.errorMessage != nil }, set: { if !$0 { viewModel.errorMessage = nil } })
    }
}
