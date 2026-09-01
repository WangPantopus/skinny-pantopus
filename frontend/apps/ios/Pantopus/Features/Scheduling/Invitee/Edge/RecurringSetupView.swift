//
//  RecurringSetupView.swift
//  Pantopus
//
//  D12 Recurring / Multi-Session Setup (Stream I7). The owner lays out a weekly
//  series — weekday, time, and how many sessions — sees a live preview of the
//  occurrences, and books them in one go. A 409 surfaces the nearest open times
//  via the Foundation SlotTakenSheet. Loading / configuring / confirming / booked
//  / error states. Tokens only.
//

import SwiftUI

// swiftlint:disable file_length

// swiftlint:disable:next type_body_length
struct RecurringSetupView: View {
    @State private var viewModel: RecurringSetupViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: RecurringSetupViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    private let weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"]

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
            .navigationTitle("Set up your series")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .slotTakenSheet(
                item: Binding(get: { viewModel.slotConflict }, set: { viewModel.slotConflict = $0 }),
                tz: TimeZone.current.identifier,
                onSelect: { _ in viewModel.dismissConflict() },
                onPickAnother: { viewModel.dismissConflict() }
            )
            .accessibilityIdentifier("scheduling.recurringSetup")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loading
        case .configuring:
            configuring
        case .reviewing, .confirming:
            recap
        case let .booked(count):
            booked(count: count)
        case let .error(message):
            EmptyState(
                icon: .arrowsRepeat,
                headline: "We couldn't set up your series",
                subcopy: message,
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
        }
    }

    private var loading: some View {
        VStack(spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .frame(height: 180)
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .frame(height: 120)
        }
        .padding(Spacing.s4)
        .frame(maxHeight: .infinity, alignment: .top)
        .accessibilityLabel("Loading")
    }

    // MARK: - Configuring

    private var configuring: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Book the whole series in one go. We'll find the same time each week and flag any that's taken.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                if viewModel.conflictHint {
                    conflictBanner
                }
                controlsCard
                seriesStrip
                EdgeOverline(text: viewModel.occurrenceOverline)
                ForEach(viewModel.occurrences, id: \.index) { occurrence in
                    occurrenceRow(occurrence)
                }
                summaryChip
            }
            .padding(Spacing.s4)
        }
        .safeAreaInset(edge: .bottom) {
            EdgeDock {
                PrimaryButton(title: "Review \(viewModel.count) bookings") {
                    viewModel.review()
                }
            }
        }
    }

    // MARK: - Recap / summary (design Frame 4)

    private var recap: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                recapHeader
                recapCard
                recapTotalRow
            }
            .padding(Spacing.s4)
        }
        .safeAreaInset(edge: .bottom) {
            EdgeDock {
                PrimaryButton(
                    title: "Confirm \(viewModel.bookableCount) bookings",
                    isLoading: viewModel.state == .confirming
                ) { await viewModel.confirm() }
                GhostButton(title: "Adjust the series") { viewModel.backToConfigure() }
            }
        }
    }

    private var recapHeader: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.arrowsRepeat, size: 17, color: viewModel.accent)
                .frame(width: 34, height: 34)
                .background(viewModel.accentBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text("\(viewModel.bookableCount)-session series")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(viewModel.recapEventName)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
    }

    private var recapCard: some View {
        VStack(spacing: 0) {
            let rows = viewModel.bookableOccurrences
            ForEach(Array(rows.enumerated()), id: \.element.index) { offset, occurrence in
                recapRow(occurrence, isLast: offset == rows.count - 1)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    private func recapRow(_ occurrence: RecurringSetupViewModel.Occurrence, isLast: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: Spacing.s3) {
                Icon(.calendarCheck, size: 15, color: Theme.Color.success)
                VStack(alignment: .leading, spacing: 1) {
                    Text(weekdayDateLabel(occurrence.date))
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(recapRowSubtitle)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .monospacedDigit()
                }
                Spacer(minLength: Spacing.s2)
                Button { viewModel.toggleRemoved(index: occurrence.index) } label: {
                    Icon(.x, size: 13, color: Theme.Color.appTextSecondary)
                        .frame(width: 26, height: 26)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(Circle())
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove \(weekdayDateLabel(occurrence.date))")
            }
            .padding(.vertical, Spacing.s2 + 1)
            if !isLast {
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            }
        }
    }

    /// `2:00 – 2:30 PM · $40` — the recap row's time + per-session price line.
    private var recapRowSubtitle: String {
        if let each = viewModel.perSessionPriceLabel {
            return "\(viewModel.timeLabel) · \(each)"
        }
        return viewModel.timeLabel
    }

    private var recapTotalRow: some View {
        HStack {
            Text(recapTotalLeft)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            if let total = viewModel.totalPriceLabel {
                Text(total)
                    .font(.system(size: 18, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(viewModel.accent)
            }
        }
        .padding(.horizontal, Spacing.s1)
    }

    private var recapTotalLeft: String {
        let sessions = "\(viewModel.bookableCount) sessions"
        if let each = viewModel.perSessionEachLabel {
            return "\(sessions) · \(each)"
        }
        return sessions
    }

    private var conflictBanner: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertCircle, size: 16, strokeWidth: 2.2, color: Theme.Color.warning)
            Text("Some of those times are taken. Adjust the day, time, or count and try again.")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.warning)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var controlsCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            field(label: "Repeats") {
                HStack(spacing: Spacing.s2) {
                    Icon(.arrowsRepeat, size: 15, color: viewModel.accent)
                    Text("Weekly")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer()
                    Icon(.chevronDown, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, Spacing.s3)
                .frame(height: 42)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            }
            field(label: "On") { weekdayChips }
            field(label: "Time") { timeRow }
            field(label: "How many") { countStepper }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    private func field(label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            content()
        }
    }

    private var weekdayChips: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(0..<7, id: \.self) { index in
                let isSelected = viewModel.weekdayIndex == index
                Button { viewModel.setWeekday(index) } label: {
                    Text(weekdayLabels[index])
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(isSelected ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 32)
                        .background(isSelected ? viewModel.accent : Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .stroke(isSelected ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Calendar(identifier: .gregorian).weekdaySymbols[index])
                .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
            }
        }
    }

    private var timeRow: some View {
        HStack(spacing: 0) {
            // The design's sky time pill (clock + time + chevron). A hidden
            // system DatePicker is overlaid so the chip stays an interactive,
            // platform-native time field while matching the pill visual.
            ZStack {
                HStack(spacing: 7) {
                    Icon(.clock, size: 13, color: viewModel.accent)
                    Text(viewModel.timeLabel)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.primary700)
                        .monospacedDigit()
                    Icon(.chevronDown, size: 13, color: viewModel.accent)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(viewModel.accentBg)
                .overlay(Capsule().stroke(Theme.Color.primary100, lineWidth: 1))
                .clipShape(Capsule())

                DatePicker(
                    "",
                    selection: Binding(get: { viewModel.timeOfDay }, set: { viewModel.timeOfDay = $0 }),
                    displayedComponents: .hourAndMinute
                )
                .labelsHidden()
                .blendMode(.destinationOver)
                .opacity(0.02)
            }
            .fixedSize()
            Spacer()
        }
        .accessibilityIdentifier("scheduling.recurringSetup.time")
    }

    private var countStepper: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button { viewModel.toggleCountPicker() } label: {
                    Text("for \(viewModel.count) sessions")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Spacer()
                HStack(spacing: 0) {
                    stepperButton(icon: .minus, enabled: viewModel.count > viewModel.minCount, accented: false) {
                        viewModel.decrementCount()
                    }
                    Text("\(viewModel.count)")
                        .font(.system(size: 13, weight: .bold))
                        .monospacedDigit()
                        .frame(minWidth: 34, minHeight: 34)
                    stepperButton(icon: .plus, enabled: viewModel.count < viewModel.maxCount, accented: true) { viewModel.incrementCount() }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            if viewModel.countPickerExpanded {
                countPickerPanel
                    .padding(.top, Spacing.s3)
            }
        }
    }

    /// The expanded count picker (design Frame 5): an end-condition segmented
    /// toggle, a quick-pick grid, and a helper line.
    private var countPickerPanel: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: 3) {
                ForEach([RecurringSetupViewModel.EndCondition.count, .untilDate], id: \.self) { option in
                    let isActive = viewModel.endCondition == option
                    Button { viewModel.setEndCondition(option) } label: {
                        Text(option == .count ? "Number of sessions" : "Until a date")
                            .font(.system(size: 10.5, weight: .bold))
                            .foregroundStyle(isActive ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                            .frame(maxWidth: .infinity)
                            .frame(height: 30)
                            .background(isActive ? viewModel.accentBg : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))

            if viewModel.endCondition == .count {
                HStack(spacing: Spacing.s2) {
                    ForEach(viewModel.quickPickCounts, id: \.self) { value in
                        let isActive = viewModel.count == value
                        Button { viewModel.setCount(value) } label: {
                            Text("\(value)")
                                .font(.system(size: 13, weight: .bold))
                                .monospacedDigit()
                                .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                                .frame(maxWidth: .infinity)
                                .frame(height: 34)
                                .background(isActive ? viewModel.accent : Theme.Color.appSurface)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                        .stroke(isActive ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Text("We'll find \(viewModel.timeLabel) each week and flag any that's taken.")
                .font(.system(size: 10.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private func stepperButton(icon: PantopusIcon, enabled: Bool, accented: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: 14, color: enabled ? (accented ? viewModel.accent : Theme.Color.appTextStrong) : Theme.Color.appTextMuted)
                .frame(width: 34, height: 34)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    // MARK: - Series strip

    private var seriesStrip: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                Icon(.calendarRange, size: 13, color: Theme.Color.appTextSecondary)
                Text("Your \(viewModel.count) \(viewModel.weekdayName)s")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(viewModel.occurrences, id: \.index) { occurrence in
                        seriesPill(occurrence)
                    }
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func seriesPill(_ occurrence: RecurringSetupViewModel.Occurrence) -> some View {
        let conflict = occurrence.status == .conflict
        return VStack(spacing: Spacing.s1) {
            Text(monthLabel(occurrence.date))
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Theme.Color.appTextMuted)
            Text(dayLabel(occurrence.date))
                .font(.system(size: 12.5, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(conflict ? Theme.Color.warning : Theme.Color.appTextInverse)
                .frame(width: 34, height: 34)
                .background(conflict ? Theme.Color.warningBg : viewModel.accent)
                .overlay(
                    Circle().stroke(conflict ? Theme.Color.warningLight : Color.clear, lineWidth: 1.5)
                )
                .clipShape(Circle())
            if conflict {
                Icon(.alertCircle, size: 11, color: Theme.Color.warning)
            } else {
                Circle().fill(viewModel.accent).frame(width: 5, height: 5)
            }
        }
        .frame(width: 42)
    }

    // MARK: - Occurrence row

    private func occurrenceRow(_ occurrence: RecurringSetupViewModel.Occurrence) -> some View {
        let status = occurrence.status
        let conflict = status == .conflict
        let unavail = status == .unavailable
        return HStack(spacing: Spacing.s3) {
            Icon(occurrenceTileIcon(status), size: 16, strokeWidth: 2, color: occurrenceTileFg(status))
                .frame(width: 30, height: 30)
                .background(occurrenceTileBg(status))
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(weekdayDateLabel(occurrence.date))
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(unavail ? Theme.Color.appTextMuted : Theme.Color.appText)
                    .strikethrough(unavail)
                Text(occurrenceSubtitle(status))
                    .font(.system(size: 10.5))
                    .foregroundStyle(conflict ? Theme.Color.warning : Theme.Color.appTextSecondary)
                    .monospacedDigit()
            }
            Spacer(minLength: Spacing.s2)
            occurrenceTrailing(status)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(conflict ? Theme.Color.warningLight : Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .opacity(unavail ? 0.6 : 1)
    }

    private func occurrenceTileIcon(_ status: RecurringSetupViewModel.OccurrenceStatus) -> PantopusIcon {
        switch status {
        case .open: .calendarCheck
        case .conflict: .alertCircle
        case .unavailable: .calendarX
        }
    }

    private func occurrenceTileFg(_ status: RecurringSetupViewModel.OccurrenceStatus) -> Color {
        switch status {
        case .open: Theme.Color.success
        case .conflict: Theme.Color.warning
        case .unavailable: Theme.Color.appTextMuted
        }
    }

    private func occurrenceTileBg(_ status: RecurringSetupViewModel.OccurrenceStatus) -> Color {
        switch status {
        case .open: Theme.Color.successBg
        case .conflict: Theme.Color.warningBg
        case .unavailable: Theme.Color.appSurfaceSunken
        }
    }

    private func occurrenceSubtitle(_ status: RecurringSetupViewModel.OccurrenceStatus) -> String {
        switch status {
        case .open: viewModel.timeLabel
        case .conflict: "\(viewModel.timeLabel) is taken that week"
        case .unavailable: "Fully booked"
        }
    }

    @ViewBuilder
    private func occurrenceTrailing(_ status: RecurringSetupViewModel.OccurrenceStatus) -> some View {
        switch status {
        case .open:
            HStack(spacing: Spacing.s1) {
                Icon(.check, size: 10, strokeWidth: 3, color: Theme.Color.success)
                Text("Open")
                    .font(.system(size: 10, weight: .bold))
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.success)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 2)
            .background(Theme.Color.successBg)
            .overlay(Capsule().stroke(Theme.Color.successLight, lineWidth: 1))
            .clipShape(Capsule())
        case .conflict:
            HStack(spacing: Spacing.s1) {
                Text("Pick another")
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(viewModel.accent)
                Icon(.chevronRight, size: 13, color: viewModel.accent)
            }
        case .unavailable:
            Text("Full")
                .font(.system(size: 9.5, weight: .bold))
                .textCase(.uppercase)
                .tracking(0.3)
                .foregroundStyle(Theme.Color.appTextMuted)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 2)
                .background(Theme.Color.appSurfaceSunken)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(Capsule())
        }
    }

    // MARK: - Summary

    private var summaryChip: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.arrowsRepeat, size: 15, color: viewModel.accent)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(viewModel.bookableCount) sessions · \(viewModel.weekdayName) \(viewModel.timeLabel)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
                Text(summarySubtitle)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .monospacedDigit()
            }
            Spacer(minLength: 0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(viewModel.accentBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary100, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var summarySubtitle: String {
        var parts: [String] = []
        if let range = viewModel.rangeLabel { parts.append(range) }
        if let total = viewModel.totalPriceLabel { parts.append("\(total) total") }
        return parts.joined(separator: " · ")
    }

    // MARK: - Booked

    private func booked(count: Int) -> some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: 0)
            EdgeIconHalo(icon: .checkCircle, tone: .success, size: 84)
            VStack(spacing: Spacing.s2) {
                Text("Your series is booked")
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("\(count) \(count == 1 ? "session" : "sessions") confirmed. We've sent the details along.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 250)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s5)
        .safeAreaInset(edge: .bottom) {
            EdgeDock { PrimaryButton(title: "Done") { dismiss() } }
        }
    }

    // MARK: - Date labels

    private func monthLabel(_ date: Date) -> String {
        formatted(date, template: "MMM").uppercased()
    }

    private func dayLabel(_ date: Date) -> String {
        formatted(date, template: "d")
    }

    private func weekdayDateLabel(_ date: Date) -> String {
        formatted(date, template: "EEEMMMd")
    }

    private func formatted(_ date: Date, template: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = .current
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter.string(from: date)
    }
}

#if DEBUG
#Preview("Configuring") {
    NavigationStack { RecurringSetupView(viewModel: .previewConfiguring()) }
}

#Preview("Recap") {
    NavigationStack { RecurringSetupView(viewModel: .previewReviewing()) }
}
#endif
