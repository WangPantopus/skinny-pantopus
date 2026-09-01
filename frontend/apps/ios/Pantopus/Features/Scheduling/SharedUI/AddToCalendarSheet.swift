//
//  AddToCalendarSheet.swift
//  Pantopus
//
//  Foundation (I0b) — D8 Add to calendar. Slides up over any booking/event
//  detail with a one-line event recap chip, then a vertical list of provider
//  rows (Apple Calendar, Google, Outlook, Download .ics) in the Gig Picker
//  Sheets idiom (56px rows, leading icon disc, label + sub, trailing chevron).
//
//  Two presentations driven by `nativePrimary`:
//    • Web default — every provider is a row (Apple Calendar first).
//    • Native — a filled "Add to iPhone Calendar" primary CTA on top, then a
//      "More options" group (Google / Outlook / .ics).
//  The Apple-Calendar row morphs to a "done" success state once the event is
//  written, and a second-level "Choose a calendar" picker lets the caller pick
//  which on-device calendar to write to. The .ics row fetches the raw file via
//  `APIClient.requestData` and hands the `Data` back for a system share/save.
//  Tokens only.
//

// swiftlint:disable file_length
import SwiftUI

/// Fetches the booking's `.ics` artifact on demand and tracks the view-only
/// morph state for the Apple-Calendar "added" success. Internal because it
/// depends on the internal `APIClient`; consumed within the app module.
@Observable
@MainActor
final class AddToCalendarViewModel {
    enum Phase: Equatable { case idle, generating, ready, failed }

    private(set) var phase: Phase = .idle
    private(set) var icsData: Data?

    /// View-only: set once the host has written the event into the on-device
    /// calendar so the Apple-Calendar row morphs to its success state.
    var appleCalendarAdded: Bool = false

    let manageToken: String
    private let client: APIClient

    init(manageToken: String, client: APIClient) {
        self.manageToken = manageToken
        self.client = client
    }

    /// Downloads the raw `.ics` for the booking. Returns the data so the caller
    /// can present a share sheet; also cached on `icsData`.
    @discardableResult
    func downloadICS() async -> Data? {
        phase = .generating
        do {
            let data = try await client.requestData(SchedulingPublicEndpoints.ics(token: manageToken))
            icsData = data
            phase = .ready
            return data
        } catch {
            phase = .failed
            return nil
        }
    }

    /// Marks the Apple-Calendar row as written so the row morphs to its "added"
    /// success state. Called by the presenting stream after the EventKit write
    /// (or the multi-calendar pick) succeeds.
    func markAppleCalendarAdded() {
        appleCalendarAdded = true
    }
}

/// A selectable on-device calendar surfaced in the second-level picker.
struct OnDeviceCalendar: Identifiable, Hashable {
    let id: String
    /// The pillar-/account-coloured swatch dot. Use a `Theme.Color` pillar token
    /// (`personal` / `business` / `home`) so the dot inherits the design system.
    let dotColor: Color
    let name: String
    let subtitle: String
}

// swiftlint:disable type_body_length
/// The add-to-calendar action sheet. Provider hand-offs (EventKit / Google /
/// Outlook) are wired by the presenting stream via the callbacks.
struct AddToCalendarSheet: View {
    @State private var viewModel: AddToCalendarViewModel
    /// When `true`, render the native presentation: a filled "Add to iPhone
    /// Calendar" primary CTA over a "More options" group. When `false`, render
    /// Apple Calendar as the first provider row (web default).
    @State private var showCalendarPicker = false

    private let eventRecap: String
    private let nativePrimary: Bool
    private let onDeviceCalendars: [OnDeviceCalendar]
    private let onAppleCalendar: () -> Void
    private let onGoogle: () -> Void
    private let onOutlook: () -> Void
    private let onICSReady: (Data) -> Void
    private let onPickCalendar: (OnDeviceCalendar) -> Void
    private let onDone: () -> Void

    init(
        viewModel: AddToCalendarViewModel,
        eventRecap: String,
        nativePrimary: Bool = false,
        onDeviceCalendars: [OnDeviceCalendar] = [],
        onAppleCalendar: @escaping () -> Void,
        onGoogle: @escaping () -> Void,
        onOutlook: @escaping () -> Void,
        onICSReady: @escaping (Data) -> Void,
        onPickCalendar: @escaping (OnDeviceCalendar) -> Void = { _ in },
        onDone: @escaping () -> Void
    ) {
        _viewModel = State(wrappedValue: viewModel)
        self.eventRecap = eventRecap
        self.nativePrimary = nativePrimary
        self.onDeviceCalendars = onDeviceCalendars
        self.onAppleCalendar = onAppleCalendar
        self.onGoogle = onGoogle
        self.onOutlook = onOutlook
        self.onICSReady = onICSReady
        self.onPickCalendar = onPickCalendar
        self.onDone = onDone
    }

    var body: some View {
        Group {
            if showCalendarPicker {
                calendarPickerLevel
            } else {
                providerLevel
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("scheduling.addToCalendarSheet")
    }

    // MARK: - Level 1 · Providers

    private var providerLevel: some View {
        VStack(alignment: .leading, spacing: 0) {
            sheetHeader(title: "Add to your calendar", showBack: false)

            recapChip
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)

            if nativePrimary {
                nativePrimaryCTA
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)

                Text("More options")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s4)

                rowCard {
                    providerRow(icon: .calendarPlus, label: "Google Calendar", sub: "Opens in your browser", action: onGoogle)
                    rowDivider
                    providerRow(icon: .calendarPlus, label: "Outlook", sub: "Opens in your browser", action: onOutlook)
                    rowDivider
                    icsRow
                }
                .padding(.top, Spacing.s3)
            } else {
                rowCard {
                    appleCalendarRow
                    rowDivider
                    providerRow(icon: .calendarPlus, label: "Google Calendar", sub: "Opens in your browser", action: onGoogle)
                    rowDivider
                    providerRow(icon: .calendarPlus, label: "Outlook", sub: "Opens in your browser", action: onOutlook)
                    rowDivider
                    icsRow
                }
                .padding(.top, Spacing.s3)
            }

            if viewModel.appleCalendarAdded {
                addedStatus
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)
            } else {
                caption("We'll add the event with the join link and a reminder.")
                    .padding(.top, Spacing.s3)
            }

            Spacer(minLength: Spacing.s4)

            doneBar
        }
    }

    // MARK: - Level 2 · Choose a calendar

    private var calendarPickerLevel: some View {
        VStack(alignment: .leading, spacing: 0) {
            sheetHeader(title: "Choose a calendar", showBack: true)

            Text("Where should we add it on this iPhone?")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s1)

            rowCard {
                ForEach(Array(onDeviceCalendars.enumerated()), id: \.element.id) { index, calendar in
                    calendarRow(calendar, selected: index == 0)
                    if index != onDeviceCalendars.count - 1 {
                        rowDivider
                    }
                }
            }
            .padding(.top, Spacing.s3)

            caption("We'll add the event with the join link and a reminder.")
                .padding(.top, Spacing.s3)

            Spacer(minLength: Spacing.s4)

            addToPillarBar
        }
    }

    // MARK: - Header

    private func sheetHeader(title: String, showBack: Bool) -> some View {
        HStack(spacing: Spacing.s2) {
            if showBack {
                Button {
                    showCalendarPicker = false
                } label: {
                    Icon(.chevronLeft, size: 18, color: Theme.Color.appTextStrong)
                }
                .buttonStyle(.plain)
            }
            Text(title)
                .font(.system(size: 15, weight: .bold))
                .tracking(-0.2)
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(height: 30, alignment: .leading)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
    }

    // MARK: - Recap chip

    private var recapChip: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.calendar, size: 14, color: Theme.Color.primary700)
            Text(eventRecap)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.primary700)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.primary100, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: - Native primary CTA

    private var nativePrimaryCTA: some View {
        Button {
            if onDeviceCalendars.count > 1 {
                showCalendarPicker = true
            } else {
                onAppleCalendar()
            }
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.calendarPlus, size: 17, strokeWidth: 2.2, color: Theme.Color.appSurface)
                Text("Add to iPhone Calendar")
                    .font(.system(size: 14, weight: .bold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appSurface)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .pantopusShadow(.primaryDeep)
    }

    // MARK: - Card scaffolding

    private func rowCard(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(spacing: 0) { content() }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .pantopusShadow(.sm)
            .padding(.horizontal, Spacing.s4)
    }

    private var rowDivider: some View {
        Rectangle()
            .fill(Theme.Color.appBorder)
            .frame(height: 1)
    }

    // MARK: - Rows

    private var appleCalendarRow: some View {
        let added = viewModel.appleCalendarAdded
        return Button {
            if onDeviceCalendars.count > 1 {
                showCalendarPicker = true
            } else {
                onAppleCalendar()
            }
        } label: {
            rowContent(
                leading: .disc(icon: added ? .check : .calendar, done: added),
                label: added ? "Added to Apple Calendar" : "Apple Calendar",
                sub: added ? "With a reminder 10 minutes before" : "Save to your iPhone",
                labelColor: added ? Theme.Color.success : Theme.Color.appText,
                trailing: added ? .done : .chevron
            )
        }
        .buttonStyle(.plain)
        .disabled(added)
    }

    private func providerRow(icon: PantopusIcon, label: String, sub: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            rowContent(leading: .disc(icon: icon, done: false), label: label, sub: sub, trailing: .chevron)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var icsRow: some View {
        let isGenerating = viewModel.phase == .generating
        let isReady = viewModel.phase == .ready
        Button {
            Task { @MainActor in
                if let data = await viewModel.downloadICS() {
                    onICSReady(data)
                }
            }
        } label: {
            rowContent(
                leading: .disc(icon: .download, done: false),
                label: isReady ? "Saved .ics file" : "Download .ics file",
                sub: isGenerating ? nil : "Works with any calendar app",
                trailing: isGenerating ? .skeleton : (isReady ? .done : .chevron)
            )
        }
        .buttonStyle(.plain)
        .disabled(isGenerating)
    }

    private func calendarRow(_ calendar: OnDeviceCalendar, selected: Bool) -> some View {
        Button {
            onPickCalendar(calendar)
        } label: {
            rowContent(
                leading: .dot(calendar.dotColor),
                label: calendar.name,
                sub: calendar.subtitle,
                trailing: selected ? .selected : .chevron
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Row content

    private enum RowLeading {
        case disc(icon: PantopusIcon, done: Bool)
        case dot(Color)
    }

    private enum RowTrailing { case chevron, skeleton, done, selected }

    private func rowContent(
        leading: RowLeading,
        label: String,
        sub: String?,
        labelColor: Color = Theme.Color.appText,
        trailing: RowTrailing
    ) -> some View {
        HStack(spacing: Spacing.s3) {
            leadingView(leading)

            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.system(size: 13.5, weight: .semibold))
                    .tracking(-0.1)
                    .foregroundStyle(labelColor)

                if trailing == .skeleton {
                    HStack(spacing: 7) {
                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                            .fill(Theme.Color.appSurfaceSunken)
                            .frame(width: 90, height: 8)
                        Text("Preparing your file")
                            .font(.system(size: 10.5, weight: .regular))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .padding(.top, 4)
                } else if let sub {
                    Text(sub)
                        .font(.system(size: 10.5, weight: .regular))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.top, 1)
                }
            }

            Spacer(minLength: Spacing.s2)

            trailingView(trailing)
        }
        .padding(.horizontal, Spacing.s4)
        .frame(minHeight: 56)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private func leadingView(_ leading: RowLeading) -> some View {
        switch leading {
        case let .disc(icon, done):
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(done ? Theme.Color.successBg : Theme.Color.appSurfaceSunken)
                    .frame(width: 36, height: 36)
                Icon(
                    icon,
                    size: 18,
                    strokeWidth: done ? 2.6 : 2,
                    color: done ? Theme.Color.success : Theme.Color.appTextStrong
                )
            }
        case let .dot(color):
            Circle()
                .fill(color)
                .frame(width: 18, height: 18)
                .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
        }
    }

    @ViewBuilder
    private func trailingView(_ trailing: RowTrailing) -> some View {
        switch trailing {
        case .chevron:
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        case .skeleton:
            EmptyView()
        case .done:
            Icon(.checkCircle2, size: 18, color: Theme.Color.success)
        case .selected:
            Icon(.check, size: 18, strokeWidth: 2.6, color: Theme.Color.primary600)
        }
    }

    // MARK: - Caption / status

    private func caption(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 7) {
            Icon(.bell, size: 13, color: Theme.Color.appTextMuted)
            Text(text)
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var addedStatus: some View {
        HStack(spacing: 6) {
            Icon(.checkCircle2, size: 13, color: Theme.Color.success)
            Text("Added — closing in a moment")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    // MARK: - Footers

    private var doneBar: some View {
        VStack(spacing: 0) {
            rowDivider
            GhostButton(title: "Done") { onDone() }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
                .padding(.bottom, 18)
        }
    }

    private var addToPillarBar: some View {
        let target = onDeviceCalendars.first
        return VStack(spacing: 0) {
            rowDivider
            Button {
                if let target { onPickCalendar(target) }
            } label: {
                HStack(spacing: 7) {
                    Icon(.calendarPlus, size: 16, strokeWidth: 2.2, color: Theme.Color.appSurface)
                    Text("Add to \(target?.name ?? "Calendar")")
                        .font(.system(size: 14, weight: .bold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appSurface)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .pantopusShadow(.primaryDeep)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, 18)
        }
    }
}

// swiftlint:enable type_body_length

#if DEBUG
#Preview("Web default") {
    AddToCalendarSheet(
        viewModel: AddToCalendarViewModel(manageToken: "preview", client: .shared),
        eventRecap: "Intro call · Wed, Jun 17 · 9:30 AM PDT",
        onAppleCalendar: {},
        onGoogle: {},
        onOutlook: {},
        onICSReady: { _ in },
        onDone: {}
    )
}

#Preview("Native + picker") {
    AddToCalendarSheet(
        viewModel: AddToCalendarViewModel(manageToken: "preview", client: .shared),
        eventRecap: "Intro call · Wed, Jun 17 · 9:30 AM PDT",
        nativePrimary: true,
        onDeviceCalendars: [
            OnDeviceCalendar(id: "personal", dotColor: Theme.Color.personal, name: "Personal", subtitle: "maya@gmail.com"),
            OnDeviceCalendar(id: "work", dotColor: Theme.Color.business, name: "Work", subtitle: "maya@acme.com"),
            OnDeviceCalendar(id: "family", dotColor: Theme.Color.home, name: "Family", subtitle: "Shared · 3 people")
        ],
        onAppleCalendar: {},
        onGoogle: {},
        onOutlook: {},
        onICSReady: { _ in },
        onPickCalendar: { _ in },
        onDone: {}
    )
}
#endif
