//
//  SlotPicker.swift
//  Pantopus
//
//  Foundation (I0b) — the tz-aware date + time slot grid. A month calendar
//  strip and the selected day's slots stack in one scroll (not a wizard split),
//  mirroring the Support Train grid + Home calendar month strip. Driven by
//  `[SlotDTO]`; the host pillar accent paints today / selected / slot-select.
//  Loading shimmers, day-full, and no-availability are first-class calm states.
//  Presentational only — the parent loads slots and owns the state.
//

import SwiftUI

// swiftlint:disable file_length

// swiftlint:disable type_body_length
/// The booker's date + time picker. Stateless: the parent supplies the month,
/// selected day, the day's `slots`, the load `state`, and reacts to callbacks.
public struct SlotPicker: View {
    /// What the slot column renders. The calendar stays visible across all.
    public enum LoadState: Equatable, Sendable {
        /// Slots for the selected day are loading — shimmer rows.
        case loading
        /// Collective (team-intersect) availability is being composed — an
        /// avatar-cluster caption + skeleton rows + the "times come from each
        /// member" explainer pill (design Frame 2). For Business / multi-member
        /// pillars only; the plain `.loading` skeleton stays for solo owners.
        case composing
        /// Slots are loaded (use `slots`).
        case loaded
        /// The selected day has no open times.
        case dayFull
        /// Nothing is open in the visible MONTH/range — but later months may
        /// have times (design Frame 3: "No open times in {month}", primary
        /// "See {next month}", secondary "Get notified").
        case noAvailability
        /// Nothing is open ANYWHERE right now (design Frame 4): a distinct
        /// terminal-feeling empty — "Notify me" primary + "Join waitlist"
        /// secondary with a waiting-count chip. Separate from `.noAvailability`.
        case noAvailabilityAnywhere
        /// Collective-intersect produced an empty window for the selected day —
        /// every required member's calendars don't overlap (design Frame 5): a
        /// pillar-soft *framed* card (not dashed) with a member free/busy
        /// cluster, "Try next month" primary + "Notify me" secondary.
        case composedEmpty
    }

    private let state: LoadState
    private let slots: [SlotDTO]
    private let timeZoneIdentifier: String
    private let timeZoneLabel: String
    private let accent: Color
    private let monthAnchor: Date
    private let selectedDate: Date
    private let availableDays: Set<Date>?
    private let selectedSlotStart: String?
    private let dstHint: String?
    private let onSelectDate: (Date) -> Void
    private let onSelectSlot: (SlotDTO) -> Void
    private let onChangeMonth: (Int) -> Void
    private let members: [SchedulingMemberFreeBusy]
    private let waitlistCount: Int?
    private let onTapTimeZone: () -> Void
    private let onJumpNextAvailable: (() -> Void)?
    private let onNotifyMe: (() -> Void)?
    private let onJoinWaitlist: (() -> Void)?

    public init(
        state: LoadState,
        slots: [SlotDTO],
        timeZoneIdentifier: String,
        timeZoneLabel: String,
        accent: Color,
        monthAnchor: Date,
        selectedDate: Date,
        availableDays: Set<Date>? = nil,
        selectedSlotStart: String? = nil,
        dstHint: String? = nil,
        members: [SchedulingMemberFreeBusy] = [],
        waitlistCount: Int? = nil,
        onSelectDate: @escaping (Date) -> Void,
        onSelectSlot: @escaping (SlotDTO) -> Void,
        onChangeMonth: @escaping (Int) -> Void,
        onTapTimeZone: @escaping () -> Void,
        onJumpNextAvailable: (() -> Void)? = nil,
        onNotifyMe: (() -> Void)? = nil,
        onJoinWaitlist: (() -> Void)? = nil
    ) {
        self.state = state
        self.slots = slots
        self.timeZoneIdentifier = timeZoneIdentifier
        self.timeZoneLabel = timeZoneLabel
        self.accent = accent
        self.monthAnchor = monthAnchor
        self.selectedDate = selectedDate
        self.availableDays = availableDays
        self.selectedSlotStart = selectedSlotStart
        self.dstHint = dstHint
        self.members = members
        self.waitlistCount = waitlistCount
        self.onSelectDate = onSelectDate
        self.onSelectSlot = onSelectSlot
        self.onChangeMonth = onChangeMonth
        self.onTapTimeZone = onTapTimeZone
        self.onJumpNextAvailable = onJumpNextAvailable
        self.onNotifyMe = onNotifyMe
        self.onJoinWaitlist = onJoinWaitlist
    }

    private var calendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: timeZoneIdentifier) ?? .current
        return cal
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            timeZoneChip
            if let dstHint {
                infoCaption(dstHint)
            }
            SlotPickerCalendar(
                monthAnchor: monthAnchor,
                selectedDate: selectedDate,
                availableDays: availableDays,
                accent: accent,
                calendar: calendar,
                onSelectDate: onSelectDate,
                onChangeMonth: onChangeMonth,
                onJumpNextAvailable: onJumpNextAvailable
            )
            Divider().background(Theme.Color.appBorderSubtle)
            // Frames 3 & 4 (no-times-in-range / anywhere) drop the day heading —
            // they speak to the whole month/everywhere, not a single day. The
            // composing / composed-empty frames keep it (a day IS selected).
            if state != .noAvailability && state != .noAvailabilityAnywhere {
                Text(dayHeading)
                    .pantopusTextStyle(.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appText)
            }
            slotColumn
        }
    }

    private var dayHeading: String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: selectedDate)
    }

    // MARK: - Timezone chip

    private var timeZoneChip: some View {
        Button(action: onTapTimeZone) {
            HStack(spacing: Spacing.s2) {
                Icon(.globe, size: 13, color: Theme.Color.appTextSecondary)
                Text("Times shown in \(timeZoneLabel)")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
                Icon(.chevronDown, size: 13, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Time zone, \(timeZoneLabel). Tap to change.")
        .accessibilityIdentifier("scheduling.slotPicker.timezone")
    }

    private func infoCaption(_ text: String) -> some View {
        // Spec tz/DST banner: INFO text + body on an INFO_BG fill, with a 1px
        // INFO_BORDER (infoLight) hairline and ~11px (Radii.lg) corners.
        HStack(spacing: Spacing.s2) {
            Icon(.info, size: 14, color: Theme.Color.info)
            Text(text)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.info)
        }
        .padding(Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.infoLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    // MARK: - Slot column

    @ViewBuilder
    private var slotColumn: some View {
        switch state {
        case .loading:
            VStack(spacing: Spacing.s2) {
                ForEach(0..<6, id: \.self) { _ in SchedulingSlotRowSkeleton() }
            }
            .accessibilityLabel("Loading times")
        case .composing:
            composingColumn
        case .loaded:
            loadedSlots
        case .dayFull:
            dayFullCard
        case .noAvailability:
            noAvailabilityCard
        case .noAvailabilityAnywhere:
            noAvailabilityAnywhereCard
        case .composedEmpty:
            composedEmptyCard
        }
    }

    /// Frame 2 — collective-intersect in progress: a member avatar-cluster
    /// caption, four skeleton rows, then the "times come from each member's
    /// availability" explainer pill in the pillar-soft tint.
    private var composingColumn: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2 + 1) {
                SchedulingAvatarCluster(members: members, accent: accent)
                Text("Finding times that work for everyone")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            VStack(spacing: Spacing.s2) {
                ForEach(0..<4, id: \.self) { _ in SchedulingSlotRowSkeleton() }
            }
            composedExplainerPill
        }
        .accessibilityLabel("Finding times that work for everyone")
    }

    /// "Times come from each member's availability." explainer pill — pillar
    /// soft fill, accent ring, calendar-range glyph (design Frame 2).
    private var composedExplainerPill: some View {
        HStack(spacing: Spacing.s2 + 1) {
            Icon(.calendarRange, size: 15, color: accent)
            Text("Times come from each member's availability.")
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 1)
        .background(accent.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(accent.opacity(0.2), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var loadedSlots: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            ForEach(SlotGroup.allCases, id: \.self) { group in
                let groupSlots = slots.filter { slotGroup(for: $0) == group }
                if !groupSlots.isEmpty {
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Text(group.title)
                            .pantopusTextStyle(.overline)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        ForEach(groupSlots, id: \.self) { slot in
                            SchedulingSlotRow(
                                time: timeLabel(for: slot),
                                detail: nil,
                                accent: accent,
                                isSelected: slot.start == selectedSlotStart
                            ) {
                                onSelectSlot(slot)
                            }
                        }
                    }
                }
            }
        }
    }

    /// Day-full: the selected day has no open times but the month still does.
    /// Calm framing — the same dashed card + circle halo as the empty card, with
    /// a 44pt halo and the `See next available` jump link. `calendar-x` stays
    /// reserved for the composed-empty frame; day-full uses the calmer clock glyph.
    private var dayFullCard: some View {
        VStack(spacing: Spacing.s2) {
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 44, height: 44)
                Icon(.calendarClock, size: 20, strokeWidth: 1.85, color: Theme.Color.appTextSecondary)
            }
            Text("No open times this day")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("Try another highlighted day, or jump to the next open time.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let onJumpNextAvailable {
                Button(action: onJumpNextAvailable) {
                    HStack(spacing: Spacing.s1) {
                        Text("See next available")
                            .font(.system(size: 13, weight: .bold))
                        Icon(.arrowRight, size: 13, color: accent)
                    }
                    .foregroundStyle(accent)
                }
                .buttonStyle(.plain)
                .padding(.top, Spacing.s1)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s5)
        .padding(.vertical, Spacing.s5)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    /// Frame 3 — no times in the visible month, but later months may have some.
    private var noAvailabilityCard: some View {
        SlotPickerEmptyCard(
            // Spec frame 3 (no-times-in-range) uses lucide `calendar-search`.
            // NOTE: PantopusIcon.calendarSearch currently maps to a bare
            // `magnifyingglass` SF symbol in Icons.swift (out of this task's
            // file scope); the calendar-glyph intent is recorded as deferred.
            icon: .calendarSearch,
            framed: false,
            title: "No open times in \(monthName)",
            message: "Availability changes often. Try a later month.",
            accent: accent,
            primary: onJumpNextAvailable.map { (label: "See \(nextMonthName)", icon: PantopusIcon.arrowRight, action: $0) },
            secondary: onNotifyMe.map { (label: "Get notified when times open", icon: PantopusIcon.bell, chip: nil, action: $0) }
        )
    }

    /// Frame 4 — nothing is open anywhere right now: "Notify me" is the PRIMARY
    /// action (distinct from Frame 3's "See {next month}"), with "Join waitlist"
    /// and a waiting-count chip as the secondary.
    private var noAvailabilityAnywhereCard: some View {
        SlotPickerEmptyCard(
            icon: .calendarClock,
            framed: false,
            title: "No times are open right now",
            message: "We'll let you know the moment something frees up.",
            accent: accent,
            primary: onNotifyMe.map { (label: "Notify me", icon: PantopusIcon.bell, action: $0) },
            secondary: onJoinWaitlist.map {
                (
                    label: "Join waitlist",
                    icon: PantopusIcon.usersRound,
                    chip: waitlistCount.map { "\($0) waiting" },
                    action: $0
                )
            }
        )
    }

    /// Frame 5 — collective-intersect produced an empty window: a *framed*
    /// (pillar-soft fill, accent ring, NOT dashed) card with a member free/busy
    /// cluster. `calendar-x` is reserved for THIS composed-empty frame only.
    private var composedEmptyCard: some View {
        SlotPickerEmptyCard(
            icon: .calendarX,
            framed: true,
            title: "Everyone's calendars don't overlap in this window",
            message: "These times need every required member free at once. Try widening the range.",
            accent: accent,
            primary: onJumpNextAvailable.map { (label: "Try next month", icon: PantopusIcon.arrowRight, action: $0) },
            secondary: onNotifyMe.map { (label: "Notify me", icon: PantopusIcon.bell, chip: nil, action: $0) },
            members: members
        )
    }

    // MARK: - Formatting

    private var monthName: String {
        let fmt = DateFormatter()
        fmt.calendar = calendar
        fmt.timeZone = calendar.timeZone
        fmt.dateFormat = "LLLL"
        return fmt.string(from: monthAnchor)
    }

    /// Label for the month after `monthAnchor` — the design's "See July" CTA when
    /// the visible month is empty. Falls back to a generic label if math fails.
    private var nextMonthName: String {
        guard let next = calendar.date(byAdding: .month, value: 1, to: monthAnchor) else {
            return "next month"
        }
        let fmt = DateFormatter()
        fmt.calendar = calendar
        fmt.timeZone = calendar.timeZone
        fmt.dateFormat = "LLLL"
        return fmt.string(from: next)
    }

    private func timeLabel(for slot: SlotDTO) -> String {
        SchedulingTime.localString(
            utcISO: slot.start, tz: timeZoneIdentifier, dateStyle: .none, timeStyle: .short
        ) ?? slot.startLocal ?? slot.start
    }

    private func slotGroup(for slot: SlotDTO) -> SlotGroup {
        guard let date = SchedulingTime.parseUTC(slot.start) else { return .afternoon }
        let hour = calendar.component(.hour, from: date)
        switch hour {
        case ..<12: return .morning
        case 12..<17: return .afternoon
        default: return .evening
        }
    }

    private enum SlotGroup: CaseIterable, Hashable {
        case morning, afternoon, evening
        var title: String {
            switch self {
            case .morning: "Morning"
            case .afternoon: "Afternoon"
            case .evening: "Evening"
            }
        }
    }
}

// swiftlint:enable type_body_length

// MARK: - Month calendar strip

private struct SlotPickerCalendar: View {
    let monthAnchor: Date
    let selectedDate: Date
    let availableDays: Set<Date>?
    let accent: Color
    let calendar: Calendar
    let onSelectDate: (Date) -> Void
    let onChangeMonth: (Int) -> Void
    let onJumpNextAvailable: (() -> Void)?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: Spacing.s1), count: 7)

    var body: some View {
        VStack(spacing: Spacing.s3) {
            header
            weekdayHeader
            LazyVGrid(columns: columns, spacing: Spacing.s1) {
                ForEach(Array(monthDays.enumerated()), id: \.offset) { _, day in
                    if let day {
                        dayCell(day)
                    } else {
                        Color.clear.frame(height: 40)
                    }
                }
            }
        }
    }

    private var header: some View {
        HStack {
            Text(monthTitle)
                .pantopusTextStyle(.small)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            if let onJumpNextAvailable {
                Button("Next available", action: onJumpNextAvailable)
                    .font(Theme.Font.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(accent)
            }
            Button { onChangeMonth(-1) } label: {
                Icon(.chevronLeft, size: 18, color: Theme.Color.appTextSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Previous month")
            Button { onChangeMonth(1) } label: {
                Icon(.chevronRight, size: 18, color: Theme.Color.appTextSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Next month")
        }
    }

    private var weekdayHeader: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(weekdaySymbols, id: \.self) { symbol in
                Text(symbol)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder
    private func dayCell(_ day: Date) -> some View {
        let isSelected = calendar.isDate(day, inSameDayAs: selectedDate)
        let isToday = calendar.isDateInToday(day)
        let enabled = isDayEnabled(day)
        let isAvailable = enabled && !isSelected && !isToday
        Button {
            if enabled { onSelectDate(day) }
        } label: {
            Text("\(calendar.component(.day, from: day))")
                .pantopusTextStyle(.small)
                .fontWeight(isSelected || isToday ? .bold : (isAvailable ? .semibold : .regular))
                .monospacedDigit()
                .foregroundStyle(dayForeground(isSelected: isSelected, enabled: enabled))
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(
                    Circle()
                        .fill(isSelected ? accent : Color.clear)
                        .frame(width: 36, height: 36)
                )
                .overlay(
                    Circle()
                        .stroke(isToday && !isSelected ? accent : Color.clear, lineWidth: 1.5)
                        .frame(width: 36, height: 36)
                )
                .overlay(alignment: .bottom) {
                    if isAvailable {
                        Circle()
                            .fill(accent)
                            .frame(width: 4, height: 4)
                            .padding(.bottom, Spacing.s1)
                    }
                }
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(accessibilityLabel(for: day, enabled: enabled, isToday: isToday))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private func dayForeground(isSelected: Bool, enabled: Bool) -> Color {
        if isSelected { return Theme.Color.appTextInverse }
        return enabled ? Theme.Color.appText : Theme.Color.appTextMuted
    }

    private func isDayEnabled(_ day: Date) -> Bool {
        let startOfDay = calendar.startOfDay(for: day)
        let today = calendar.startOfDay(for: Date())
        guard startOfDay >= today else { return false }
        guard let availableDays else { return true }
        return availableDays.contains(startOfDay)
    }

    private var monthTitle: String {
        let fmt = DateFormatter()
        fmt.calendar = calendar
        fmt.timeZone = calendar.timeZone
        fmt.dateFormat = "LLLL yyyy"
        return fmt.string(from: monthAnchor)
    }

    private var weekdaySymbols: [String] {
        let fmt = DateFormatter()
        fmt.calendar = calendar
        let symbols = fmt.veryShortStandaloneWeekdaySymbols ?? ["S", "M", "T", "W", "T", "F", "S"]
        let first = calendar.firstWeekday - 1
        return Array(symbols[first...] + symbols[..<first])
    }

    /// Days of the visible month, padded with `nil` for the leading blanks.
    private var monthDays: [Date?] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: monthAnchor),
              let range = calendar.range(of: .day, in: .month, for: monthAnchor) else { return [] }
        let firstWeekday = calendar.component(.weekday, from: monthInterval.start)
        let leadingBlanks = (firstWeekday - calendar.firstWeekday + 7) % 7
        var cells: [Date?] = Array(repeating: nil, count: leadingBlanks)
        for dayOffset in range {
            if let date = calendar.date(byAdding: .day, value: dayOffset - 1, to: monthInterval.start) {
                cells.append(date)
            }
        }
        return cells
    }

    private func accessibilityLabel(for day: Date, enabled: Bool, isToday: Bool) -> String {
        let fmt = DateFormatter()
        fmt.calendar = calendar
        fmt.timeZone = calendar.timeZone
        fmt.dateFormat = "EEEE, MMMM d"
        var label = fmt.string(from: day)
        if isToday { label += ", today" }
        label += enabled ? ", available" : ", unavailable"
        return label
    }
}

// MARK: - Empty-state card

/// The design's `EmptyCard`: a centered icon-in-circle, title, body, a filled
/// accent primary CTA (icon + label + soft shadow) and an optional outlined
/// secondary CTA (icon + label + optional count chip). One reusable shape for
/// the no-times-in-range, no-times-anywhere, and composed-empty frames.
private struct SlotPickerEmptyCard: View {
    let icon: PantopusIcon
    /// `framed` = the design's Frame-5 "composed-empty" treatment: a pillar-soft
    /// fill + a solid accent-tinted ring (NOT the default dashed neutral border)
    /// and an accent-tinted icon halo. Default cards stay dashed + neutral.
    var framed: Bool = false
    let title: String
    let message: String
    let accent: Color
    // swiftlint:disable:next large_tuple
    let primary: (label: String, icon: PantopusIcon, action: () -> Void)?
    // swiftlint:disable:next large_tuple
    let secondary: (label: String, icon: PantopusIcon, chip: String?, action: () -> Void)?
    /// Required-member free/busy cluster, rendered between the body and the CTAs
    /// for the composed-empty frame. Empty = not shown.
    var members: [SchedulingMemberFreeBusy] = []

    var body: some View {
        VStack(spacing: Spacing.s3) {
            ZStack {
                Circle()
                    .fill(framed ? accent.opacity(0.12) : Theme.Color.appSurfaceSunken)
                    .frame(width: 50, height: 50)
                Icon(
                    icon,
                    size: 23,
                    strokeWidth: 1.85,
                    color: framed ? accent : Theme.Color.appTextSecondary
                )
            }
            Text(title)
                .font(.system(size: 15, weight: .bold))
                // Spec title: 15px/700, 20px line-height — at a 15pt font the
                // default leading is ~18pt, so ~2.5pt extra hits the 20pt line box.
                .lineSpacing(2.5)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 230)
                .fixedSize(horizontal: false, vertical: true)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 225)
                .fixedSize(horizontal: false, vertical: true)
            if !members.isEmpty {
                SchedulingMemberFreeBusyCluster(members: members)
            }
            VStack(spacing: Spacing.s2) {
                if let primary {
                    Button(action: primary.action) {
                        HStack(spacing: Spacing.s2) {
                            Icon(primary.icon, size: 15, color: Theme.Color.appTextInverse)
                            Text(primary.label)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Theme.Color.appTextInverse)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(accent)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .shadow(color: accent.opacity(0.24), radius: 6, y: 4)
                    }
                    .buttonStyle(.plain)
                }
                if let secondary {
                    Button(action: secondary.action) {
                        HStack(spacing: Spacing.s2) {
                            Icon(secondary.icon, size: 14, color: Theme.Color.appText)
                            Text(secondary.label)
                                .font(.system(size: 12.5, weight: .bold))
                                .foregroundStyle(Theme.Color.appText)
                            if let chip = secondary.chip {
                                Text(chip)
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                    .padding(.horizontal, Spacing.s2)
                                    .padding(.vertical, 2)
                                    .background(Theme.Color.appSurfaceSunken)
                                    .clipShape(Capsule())
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, Spacing.s1)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s5)
        .padding(.vertical, Spacing.s6)
        // Frame 5 (framed): pillar-soft fill. Default: plain surface.
        .background(framed ? accent.opacity(0.06) : Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(
                    // Frame 5 draws a SOLID accent-tinted 1px ring; the default
                    // empty cards keep the calm dashed neutral border.
                    framed ? accent.opacity(0.25) : Theme.Color.appBorderStrong,
                    style: framed
                        ? StrokeStyle(lineWidth: 1)
                        : StrokeStyle(lineWidth: 1, dash: [4, 4])
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }
}

// MARK: - Member free/busy primitives (collective intersect)

/// One required member's identity + whether they're free in the proposed window.
/// Caller supplies the initials + free flag from the find-a-time projection —
/// never fabricated. An empty `[SchedulingMemberFreeBusy]` simply hides the
/// cluster (the composing / composed-empty frames still render their copy).
public struct SchedulingMemberFreeBusy: Identifiable, Hashable, Sendable {
    public let id: String
    /// 1–2 letter initials shown in the avatar disc (e.g. "AR").
    public let initials: String
    /// `true` = free in the window (green dot + "Free"); `false` = busy.
    public let isFree: Bool

    public init(id: String, initials: String, isFree: Bool) {
        self.id = id
        self.initials = initials
        self.isFree = isFree
    }
}

/// Overlapping avatar discs for the composing caption (design `AvatarCluster`).
/// Renders up to four initials-discs; falls back to a single accent disc when
/// no members are supplied so the caption never reads as a lone line of text.
private struct SchedulingAvatarCluster: View {
    let members: [SchedulingMemberFreeBusy]
    let accent: Color

    var body: some View {
        HStack(spacing: -8) {
            if members.isEmpty {
                avatar(initials: nil)
                avatar(initials: nil)
                avatar(initials: nil)
            } else {
                ForEach(members.prefix(4)) { member in
                    avatar(initials: member.initials)
                }
            }
        }
    }

    private func avatar(initials: String?) -> some View {
        ZStack {
            Circle().fill(accent.opacity(0.16))
            Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 1.5)
            if let initials {
                Text(initials)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(accent)
            } else {
                Icon(.user, size: 11, color: accent)
            }
        }
        .frame(width: 26, height: 26)
    }
}

/// Required-member free/busy dot cluster for the composed-empty frame — each
/// member shows an initials disc + a green "Free" / grey "Busy" status dot.
private struct SchedulingMemberFreeBusyCluster: View {
    let members: [SchedulingMemberFreeBusy]

    var body: some View {
        HStack(spacing: Spacing.s4) {
            ForEach(members.prefix(4)) { member in
                VStack(spacing: Spacing.s1) {
                    ZStack {
                        Circle().fill(Theme.Color.appSurfaceSunken)
                        Text(member.initials)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                    .frame(width: 30, height: 30)
                    HStack(spacing: 3) {
                        Circle()
                            .fill(member.isFree ? Theme.Color.success : Theme.Color.appTextMuted)
                            .frame(width: 5, height: 5)
                        Text(member.isFree ? "Free" : "Busy")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(member.isFree ? Theme.Color.success : Theme.Color.appTextSecondary)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(member.initials), \(member.isFree ? "free" : "busy")")
            }
        }
        .padding(.vertical, Spacing.s1)
    }
}

#if DEBUG
#Preview("Loaded") {
    ScrollView {
        SlotPicker(
            state: .loaded,
            slots: [
                SlotDTO(start: "2026-07-01T16:00:00Z", end: "2026-07-01T16:30:00Z", startLocal: nil),
                SlotDTO(start: "2026-07-01T20:30:00Z", end: "2026-07-01T21:00:00Z", startLocal: nil)
            ],
            timeZoneIdentifier: "America/Los_Angeles",
            timeZoneLabel: "Pacific Time",
            accent: Theme.Color.primary600,
            monthAnchor: Date(),
            selectedDate: Date(),
            onSelectDate: { _ in },
            onSelectSlot: { _ in },
            onChangeMonth: { _ in },
            onTapTimeZone: {},
            onJumpNextAvailable: {}
        )
        .padding()
    }
    .background(Theme.Color.appBg)
}

#Preview("No availability") {
    ScrollView {
        SlotPicker(
            state: .noAvailability,
            slots: [],
            timeZoneIdentifier: "America/Los_Angeles",
            timeZoneLabel: "Pacific Time",
            accent: Theme.Color.home,
            monthAnchor: Date(),
            selectedDate: Date(),
            onSelectDate: { _ in },
            onSelectSlot: { _ in },
            onChangeMonth: { _ in },
            onTapTimeZone: {},
            onJumpNextAvailable: {},
            onNotifyMe: {}
        )
        .padding()
    }
    .background(Theme.Color.appBg)
}

private let previewMembers: [SchedulingMemberFreeBusy] = [
    SchedulingMemberFreeBusy(id: "1", initials: "AR", isFree: true),
    SchedulingMemberFreeBusy(id: "2", initials: "JL", isFree: false),
    SchedulingMemberFreeBusy(id: "3", initials: "MK", isFree: true)
]

#Preview("Composing (team intersect)") {
    ScrollView {
        SlotPicker(
            state: .composing,
            slots: [],
            timeZoneIdentifier: "America/Los_Angeles",
            timeZoneLabel: "Pacific Time",
            accent: Theme.Color.business,
            monthAnchor: Date(),
            selectedDate: Date(),
            members: previewMembers,
            onSelectDate: { _ in },
            onSelectSlot: { _ in },
            onChangeMonth: { _ in },
            onTapTimeZone: {}
        )
        .padding()
    }
    .background(Theme.Color.appBg)
}

#Preview("No times anywhere") {
    ScrollView {
        SlotPicker(
            state: .noAvailabilityAnywhere,
            slots: [],
            timeZoneIdentifier: "America/Los_Angeles",
            timeZoneLabel: "Pacific Time",
            accent: Theme.Color.primary600,
            monthAnchor: Date(),
            selectedDate: Date(),
            waitlistCount: 3,
            onSelectDate: { _ in },
            onSelectSlot: { _ in },
            onChangeMonth: { _ in },
            onTapTimeZone: {},
            onNotifyMe: {},
            onJoinWaitlist: {}
        )
        .padding()
    }
    .background(Theme.Color.appBg)
}

#Preview("Composed empty (home intersect)") {
    ScrollView {
        SlotPicker(
            state: .composedEmpty,
            slots: [],
            timeZoneIdentifier: "America/Los_Angeles",
            timeZoneLabel: "Pacific Time",
            accent: Theme.Color.home,
            monthAnchor: Date(),
            selectedDate: Date(),
            members: previewMembers,
            onSelectDate: { _ in },
            onSelectSlot: { _ in },
            onChangeMonth: { _ in },
            onTapTimeZone: {},
            onJumpNextAvailable: {},
            onNotifyMe: {}
        )
        .padding()
    }
    .background(Theme.Color.appBg)
}
#endif
