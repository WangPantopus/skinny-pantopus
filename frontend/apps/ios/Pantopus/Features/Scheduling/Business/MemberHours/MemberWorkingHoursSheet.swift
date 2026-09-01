//
//  MemberWorkingHoursSheet.swift
//  Pantopus
//
//  G4 Member Working-Hours Editor (Stream I13) — self-service "My booking hours"
//  bottom sheet on the Business violet pillar. Editable for yourself; read-only
//  for teammates (their hours are private). Matches `memberhours-frames.jsx`.
//  Tokens only; functional CTA stays product sky.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct MemberWorkingHoursSheet: View {
    @State private var model: MemberWorkingHoursViewModel
    var accent: Color = Theme.Color.business
    /// Forwards date-override / block-off navigation to the parent stack.
    var onNavigate: ((SchedulingRoute) -> Void)?
    let onClose: () -> Void

    init(
        mode: MemberWorkingHoursViewModel.Mode,
        accent: Color = Theme.Color.business,
        client: SchedulingClient = .shared,
        onNavigate: ((SchedulingRoute) -> Void)? = nil,
        onClose: @escaping () -> Void
    ) {
        _model = State(wrappedValue: MemberWorkingHoursViewModel(mode: mode, client: client))
        self.accent = accent
        self.onNavigate = onNavigate
        self.onClose = onClose
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            BizSheetHeader(title: model.title, onClose: onClose)
            content
            if !model.isReadOnly, case .ready = model.phase {
                BizSheetFooter {
                    VStack(spacing: Spacing.s2) {
                        if let saveError = model.saveError {
                            BizNote(tone: .error, icon: .alertTriangle, text: saveError)
                                .accessibilityIdentifier("memberHoursSaveError")
                        }
                        BizPrimaryButton(
                            title: model.isSaving ? "Saving" : "Save hours",
                            isSaving: model.isSaving,
                            isDisabled: !model.formValid
                        ) { Task { if await model.save() { onClose() } } }
                    }
                }
            }
        }
        .background(Theme.Color.appBg)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .task { await model.load() }
        .sheet(isPresented: $model.showTimezoneSheet) {
            TimezoneSelectorSheet(
                selectedIdentifier: model.timezoneId,
                accent: accent,
                onSelect: { model.changeTimezone($0) },
                onDone: { model.showTimezoneSheet = false }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
    }

    @ViewBuilder
    private var content: some View {
        if model.isReadOnly {
            readOnlyBody
        } else {
            switch model.phase {
            case .loading: loadingBody
            case .ready: editingBody
            case let .error(message): errorBody(message)
            }
        }
    }

    // MARK: Editing

    private var editingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                tzChip
                if let exception = model.upcomingException {
                    datedCard(
                        icon: exception.isBlocked ? .ban : .calendarClock,
                        title: exception.title,
                        sub: exception.sub,
                        isError: exception.isBlocked
                    )
                }
                weekCard(readonly: false)
                copyLink
                BizOverline(text: "Date overrides")
                overrideRows
                Color.clear.frame(height: Spacing.s4)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
        }
    }

    private var tzChip: some View {
        Button { model.showTimezoneSheet = true } label: {
            HStack(spacing: 6) {
                Icon(.globe, size: 13, color: accent)
                Text(model.timezoneId).font(.system(size: 11.5, weight: .bold)).foregroundStyle(accent)
                Icon(.chevronDown, size: 13, color: accent)
            }
            .padding(.horizontal, 11)
            .frame(height: 30)
            .background(Theme.Color.businessBg)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Time zone, \(model.timezoneId)")
    }

    private func weekCard(readonly: Bool) -> some View {
        BizCard {
            VStack(spacing: Spacing.s0) {
                ForEach(Array(model.days.enumerated()), id: \.element.id) { idx, day in
                    dayRow(day, readonly: readonly)
                    if idx < model.days.count - 1 { BizRowDivider() }
                }
            }
        }
    }

    private func dayRow(_ day: MemberWorkingHoursViewModel.DayHours, readonly: Bool) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Text(Weekday.shortName(day.weekday))
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(day.ranges.isEmpty ? Theme.Color.appTextMuted : Theme.Color.appTextStrong)
                .frame(width: 32, alignment: .leading)
                .padding(.top, 6)
            if day.ranges.isEmpty {
                Text("Unavailable")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.top, 6)
                Spacer(minLength: Spacing.s0)
            } else {
                FlowRanges(ranges: day.ranges) { range in
                    if readonly {
                        readonlyRangePill(range: range)
                    } else {
                        rangePill(weekday: day.weekday, range: range)
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            if !readonly {
                Button { model.addRange(weekday: day.weekday) } label: {
                    ZStack {
                        Circle().stroke(Theme.Color.appBorder, lineWidth: 1)
                        Icon(.plus, size: 13, color: accent)
                    }
                    .frame(width: 26, height: 26)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add a range to \(Weekday.longName(day.weekday))")
            }
        }
        .padding(.vertical, 11)
    }

    /// Static range chip for the read-only inherits grid: sunken fill, secondary
    /// text, no remove `x` and no editing menu. Mirrors `RangeChip readonly`.
    private func readonlyRangePill(range: TimeRange) -> some View {
        Text(range.display)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
    }

    private func rangePill(weekday: Int, range: TimeRange) -> some View {
        HStack(spacing: 5) {
            Menu {
                Menu("Start: \(range.start.display)") {
                    ForEach(Self.timeOptions, id: \.self) { t in
                        Button(t.display) { model.setStart(weekday: weekday, id: range.id, t) }
                    }
                }
                Menu("End: \(range.end.display)") {
                    ForEach(Self.timeOptions, id: \.self) { t in
                        Button(t.display) { model.setEnd(weekday: weekday, id: range.id, t) }
                    }
                }
            } label: {
                Text(range.display)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(range.isValid ? accent : Theme.Color.error)
            }
            Button { model.removeRange(weekday: weekday, id: range.id) } label: {
                Icon(.x, size: 11, strokeWidth: 2.6, color: accent)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(range.display)")
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(Theme.Color.businessBg)
        .clipShape(Capsule())
    }

    private var copyLink: some View {
        Button { model.copyMondayToWeekdays() } label: {
            HStack(spacing: 6) {
                Icon(.copy, size: 13, color: Theme.Color.primary600)
                Text("Copy Monday to weekdays")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.Color.primary600)
            }
        }
        .buttonStyle(.plain)
    }

    private var overrideRows: some View {
        BizCard {
            VStack(spacing: Spacing.s0) {
                overrideRow(icon: .calendarPlus, label: "Add a date override") {
                    if let id = model.scheduleId { onNavigate?(.dateOverrides(scheduleId: id)) }
                }
                BizRowDivider()
                overrideRow(icon: .ban, label: "Block out time") {
                    onNavigate?(.blockOffTime)
                }
            }
        }
    }

    private func overrideRow(icon: PantopusIcon, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Theme.Color.appSurfaceSunken)
                    Icon(icon, size: 16, color: Theme.Color.appTextSecondary)
                }
                .frame(width: 32, height: 32)
                Text(label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.vertical, Spacing.s3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Dated-exception card. Biz tone (`.biz`) → custom-hours override
    /// (`calendar-clock`, violet disc on `businessBg`, neutral text, `appBorder`).
    /// Error tone (`.error`) → blocked-out / time-off (`ban`, error icon on a
    /// white disc, `errorBg` card with an `errorLight` border, error-colored
    /// title + sub). Mirrors `memberhours` `DatedCard`.
    private func datedCard(icon: PantopusIcon, title: String, sub: String, isError: Bool) -> some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(isError ? Theme.Color.appSurface : Theme.Color.businessBg)
                Icon(icon, size: 16, color: isError ? Theme.Color.error : accent)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(isError ? Theme.Color.error : Theme.Color.appText)
                Text(sub)
                    .font(.system(size: 11))
                    .foregroundStyle(isError ? Theme.Color.error : Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, Spacing.s3)
        .background(isError ? Theme.Color.errorBg : Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(isError ? Theme.Color.errorLight : Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.sm)
    }

    // MARK: Read-only (teammate)

    private var readOnlyBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                // The design's `Header` carries the timezone chip on EVERY
                // frame, `FrameInherits` included — inert here, since a
                // teammate's hours are read-only.
                tzChip
                    .disabled(true)
                inheritsLinkRow
                weekCard(readonly: true)
                    .opacity(0.6)
                    .allowsHitTesting(false)
                Color.clear.frame(height: Spacing.s4)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
        }
    }

    /// Biz-tinted "inherits personal availability" row with a sky "View personal"
    /// link. Mirrors `memberhours` frame 4 (`FrameInherits`).
    private var inheritsLinkRow: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.link, size: 16, color: accent)
            Text("These hours come from \(model.readOnlyMemberName ?? "this member")'s personal availability.")
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s2)
            Button { onNavigate?(.availabilityScheduleList) } label: {
                Text("View personal")
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
                    .lineLimit(1)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.businessBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    // MARK: Loading / error

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(width: 150, height: 30, cornerRadius: Radii.pill)
                BizCard {
                    VStack(spacing: Spacing.s0) {
                        ForEach(0..<7, id: \.self) { idx in
                            HStack(spacing: Spacing.s2) {
                                Shimmer(width: 30, height: 11, cornerRadius: Radii.sm)
                                Shimmer(height: 22, cornerRadius: Radii.pill)
                                Shimmer(width: 26, height: 26, cornerRadius: Radii.pill)
                            }
                            .padding(.vertical, Spacing.s3)
                            if idx < 6 { BizRowDivider() }
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
        }
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 240)
            Button { Task { await model.load() } } label: {
                Text("Try again")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s2)
                    .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
    }

    // MARK: Time options (30-min grid, 5:00–23:00)

    private static let timeOptions: [TimeOfDay] = {
        var result: [TimeOfDay] = []
        for hour in 5...23 {
            result.append(TimeOfDay(hour: hour, minute: 0))
            if hour < 23 { result.append(TimeOfDay(hour: hour, minute: 30)) }
        }
        return result
    }()
}

// MARK: - Flow layout for range pills

/// Wrapping chip row for a day's ranges. The design `DayRow` lays the chips out
/// with `flexWrap:'wrap'` and a 6px gap — they run horizontally and only wrap
/// when the row is full, rather than stacking one per line.
private struct FlowRanges<Content: View>: View {
    let ranges: [TimeRange]
    @ViewBuilder let content: (TimeRange) -> Content

    var body: some View {
        ExtrasFlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
            ForEach(ranges) { range in
                content(range)
            }
        }
    }
}
