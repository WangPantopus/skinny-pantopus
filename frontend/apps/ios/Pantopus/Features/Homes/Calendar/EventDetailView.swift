//
//  EventDetailView.swift
//  Pantopus
//
//  P2.7 — Read-only Home calendar event detail. Header surfaces the
//  event type / title / time range; body lists location / repeat /
//  reminder / attendees / notes. Footer offers Edit + Delete.
//
//  Built on the shared `ContentDetailShell` (T2.6 archetype). The list
//  endpoint is the only way to fetch by id today (`/api/homes/:id/events`
//  has no `GET /:eventId` handler).
//

// swiftlint:disable file_length

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class EventDetailViewModel {
    enum State: Equatable {
        case loading
        case loaded(CalendarEventDTO)
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isDeleting: Bool = false
    private(set) var deleteError: String?
    private(set) var attendeeNames: [String: String] = [:]
    /// Per-attendee RSVP rows from `GET …/events/:eventId` (Stream I10).
    private(set) var attendees: [HomeEventAttendeeDTO] = []
    /// Whether an RSVP write is in flight (dims the control).
    private(set) var rsvpSaving = false
    /// The signed-in member's id — resolved lazily in `load()`.
    private var myUserId: String?

    private let homeId: String
    private let eventId: String
    private let api: APIClient
    private let onDeleted: @MainActor @Sendable () -> Void

    init(
        homeId: String,
        eventId: String,
        api: APIClient = .shared,
        currentUserId: String? = nil,
        onDeleted: @escaping @MainActor @Sendable () -> Void = {}
    ) {
        self.homeId = homeId
        self.eventId = eventId
        self.api = api
        myUserId = currentUserId
        self.onDeleted = onDeleted
    }

    func load() async {
        state = .loading
        if myUserId == nil { myUserId = Self.signedInUserId() }
        do {
            async let detailTask: HomeEventDetailResponse =
                api.request(HomesEndpoints.getHomeEvent(homeId: homeId, eventId: eventId))
            async let membersTask: OccupantsResponse =
                api.request(HomesEndpoints.listOccupants(homeId: homeId))
            let detail = try await detailTask
            let members = await (try? membersTask.occupants) ?? []
            var lookup: [String: String] = [:]
            for member in members {
                let trimmed = member.displayName?.trimmingCharacters(in: .whitespaces) ?? ""
                let name = trimmed.isEmpty
                    ? (member.username ?? "Member")
                    : (member.displayName ?? trimmed)
                lookup[member.userId] = name
            }
            attendeeNames = lookup
            attendees = detail.attendees
            state = .loaded(detail.event)
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this event."
            )
        }
    }

    // MARK: - RSVP (Stream I10)

    /// The signed-in member's user id, for the attendee-list "· you" suffix.
    var currentUserId: String? {
        myUserId
    }

    /// The signed-in member's RSVP, or `nil` when they haven't replied.
    var myRsvp: HomeRsvpChoice? {
        guard let me = myUserId,
              let raw = attendees.first(where: { $0.userId == me })?.rsvpStatus
        else { return nil }
        return HomeRsvpChoice(backend: raw)
    }

    /// RSVP status for any attendee id (defaults to no-reply).
    func rsvp(for userId: String) -> HomeRsvpChoice {
        guard let raw = attendees.first(where: { $0.userId == userId })?.rsvpStatus
        else { return .noReply }
        return HomeRsvpChoice(backend: raw) ?? .noReply
    }

    /// Record the signed-in member's RSVP. Optimistic — the local row flips
    /// immediately and reverts if the write fails.
    func setRsvp(_ choice: HomeRsvpChoice) async {
        guard let me = myUserId, !rsvpSaving else { return }
        let previous = attendees
        upsertRsvp(userId: me, status: choice.backendValue)
        rsvpSaving = true
        defer { rsvpSaving = false }
        do {
            let response: HomeEventRsvpResponse = try await api.request(
                HomesEndpoints.rsvpHomeEvent(
                    homeId: homeId,
                    eventId: eventId,
                    request: HomeEventRsvpRequest(status: choice.backendValue)
                )
            )
            upsertRsvp(userId: me, status: response.attendee.rsvpStatus ?? choice.backendValue)
        } catch {
            attendees = previous
        }
    }

    private func upsertRsvp(userId: String, status: String?) {
        if let index = attendees.firstIndex(where: { $0.userId == userId }) {
            attendees[index] = HomeEventAttendeeDTO(userId: userId, rsvpStatus: status)
        } else {
            attendees.append(HomeEventAttendeeDTO(userId: userId, rsvpStatus: status))
        }
    }

    static func signedInUserId() -> String? {
        if case let .signedIn(user) = AuthManager.shared.state {
            return user.id
        }
        return nil
    }

    /// Replace the loaded snapshot in place. Called by the host after a
    /// successful edit so the detail view doesn't have to re-GET.
    func replaceLoadedEvent(_ event: CalendarEventDTO) {
        state = .loaded(event)
    }

    func delete() async -> Bool {
        guard !isDeleting else { return false }
        isDeleting = true
        deleteError = nil
        defer { isDeleting = false }
        do {
            let _: EmptyResponse = try await api.request(
                HomesEndpoints.deleteHomeEvent(homeId: homeId, eventId: eventId)
            )
            onDeleted()
            return true
        } catch {
            deleteError = (error as? APIError)?.errorDescription
                ?? "Couldn't delete this event."
            return false
        }
    }
}

struct EventDetailView: View {
    @State private var viewModel: EventDetailViewModel
    private let onBack: @MainActor @Sendable () -> Void
    private let onEdit: @MainActor @Sendable (CalendarEventDTO) -> Void

    init(
        homeId: String,
        eventId: String,
        api: APIClient = .shared,
        onBack: @escaping @MainActor @Sendable () -> Void,
        onEdit: @escaping @MainActor @Sendable (CalendarEventDTO) -> Void
    ) {
        _viewModel = State(initialValue: EventDetailViewModel(
            homeId: homeId,
            eventId: eventId,
            api: api
        ) { onBack() })
        self.onBack = onBack
        self.onEdit = onEdit
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingShell(onBack: onBack)
            case let .loaded(event):
                LoadedShell(
                    event: event,
                    attendeeNames: viewModel.attendeeNames,
                    currentUserId: viewModel.currentUserId,
                    requestsRsvp: event.requestRsvp ?? false,
                    rsvpFor: { viewModel.rsvp(for: $0) },
                    myRsvp: viewModel.myRsvp,
                    rsvpSaving: viewModel.rsvpSaving,
                    rsvpEnabled: NetworkMonitor.shared.isOnline,
                    isDeleting: viewModel.isDeleting,
                    deleteError: viewModel.deleteError,
                    onBack: onBack,
                    onEdit: { onEdit(event) },
                    onRsvp: { choice in Task { await viewModel.setRsvp(choice) } },
                    onDelete: { Task { await viewModel.delete() } }
                )
            case let .error(message):
                ErrorShell(message: message, onBack: onBack) {
                    Task { await viewModel.load() }
                }
            }
        }
        .accessibilityIdentifier("eventDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
    }

    /// Lets the host swap the loaded event after an in-stack edit returns.
    func handleEdited(_ event: CalendarEventDTO) {
        viewModel.replaceLoadedEvent(event)
    }
}

// MARK: - Shells

private struct LoadingShell: View {
    let onBack: @MainActor () -> Void

    /// JSX `FrameLoading` (event-detail-frames.jsx:121-131): a title + subtitle
    /// shimmer, then a detail-grid card of icon-tile rows and an attendees card
    /// of avatar rows — mirrors the loaded geometry.
    var body: some View {
        ContentDetailShell(
            title: "Event",
            onBack: onBack,
            header: {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Shimmer(width: 180, height: 22, cornerRadius: Radii.sm)
                    Shimmer(width: 130, height: 12, cornerRadius: Radii.sm)
                }
                .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    skeletonCard(rows: 4) { iconRow }
                    skeletonCard(rows: 3) { avatarRow }
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }

    private func skeletonCard(
        rows: Int,
        @ViewBuilder row: () -> some View
    ) -> some View {
        let row = row()
        return VStack(spacing: Spacing.s3) {
            ForEach(0..<rows, id: \.self) { _ in row }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private var iconRow: some View {
        HStack(spacing: Spacing.s3) {
            Shimmer(width: 30, height: 30, cornerRadius: Radii.md)
            VStack(alignment: .leading, spacing: 6) {
                Shimmer(width: 60, height: 8, cornerRadius: Radii.sm)
                Shimmer(width: 110, height: 11, cornerRadius: Radii.sm)
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private var avatarRow: some View {
        HStack(spacing: 10) {
            Shimmer(width: 30, height: 30, cornerRadius: 15)
            Shimmer(width: 90, height: 11, cornerRadius: Radii.sm)
            Spacer(minLength: Spacing.s0)
            Shimmer(width: 54, height: 18, cornerRadius: Radii.lg)
        }
    }
}

private struct ErrorShell: View {
    let message: String
    let onBack: @MainActor () -> Void
    let onRetry: @MainActor () -> Void
    var body: some View {
        ContentDetailShell(
            title: "Event",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                // JSX `FrameError` (event-detail-frames.jsx:135-147): a 56×56
                // errorBg circle + `cloud-off` (error), "Couldn't load this
                // event", a fixed deleted/connection line, and a "Retry"
                // (rotate-cw) primary button.
                EmptyState(
                    icon: .cloudOff,
                    headline: "Couldn't load this event",
                    subcopy: "It may have been deleted, or your connection dropped.",
                    cta: EmptyState.CTA(title: "Retry") {
                        await MainActor.run { onRetry() }
                    },
                    tint: Theme.Color.errorBg,
                    accent: Theme.Color.error
                )
                .frame(height: 400)
            }
        )
    }
}

private struct LoadedShell: View {
    let event: CalendarEventDTO
    let attendeeNames: [String: String]
    let currentUserId: String?
    let requestsRsvp: Bool
    let rsvpFor: @MainActor (String) -> HomeRsvpChoice
    let myRsvp: HomeRsvpChoice?
    let rsvpSaving: Bool
    let rsvpEnabled: Bool
    let isDeleting: Bool
    let deleteError: String?
    let onBack: @MainActor () -> Void
    let onEdit: @MainActor () -> Void
    let onRsvp: @MainActor (HomeRsvpChoice) -> Void
    let onDelete: @MainActor () -> Void

    @State private var showsDeleteConfirm = false

    /// The "Your RSVP" card enters its highlighted pending state (green border +
    /// glow + hint) when RSVPs are requested but the signed-in member hasn't
    /// replied yet (JSX `FramePending`, event-detail-frames.jsx:190-213).
    private var rsvpPending: Bool {
        requestsRsvp && (myRsvp == nil || myRsvp == .noReply)
    }

    var body: some View {
        let category = CalendarEventCategory.from(eventType: event.eventType)
        return ContentDetailShell(
            title: "Event",
            onBack: onBack,
            topBarAction: ContentDetailTopBarAction(
                icon: .pencil,
                accessibilityLabel: "Edit event"
            ) {
                Task { @MainActor in onEdit() }
            },
            header: {
                EventHeader(event: event, category: category)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    DetailGrid(event: event, category: category)
                    if let assigned = event.assignedTo, !assigned.isEmpty {
                        AttendeesSection(
                            ids: assigned,
                            nameLookup: attendeeNames,
                            currentUserId: currentUserId,
                            rsvpFor: rsvpFor
                        )
                    }
                    if requestsRsvp {
                        YourRsvpCard(
                            selected: myRsvp,
                            saving: rsvpSaving,
                            enabled: rsvpEnabled,
                            pending: rsvpPending,
                            onSelect: onRsvp
                        )
                    }
                    if let description = event.description, !description.isEmpty {
                        NotesSection(text: description)
                    }
                    if let deleteError {
                        Text(deleteError)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                    }
                }
                .padding(.horizontal, Spacing.s4)
            },
            cta: {
                // JSX `StickyFooter` (event-detail-frames.jsx:112-115): a flex-1
                // secondary (outlined) "Edit" + a red text "Delete".
                HStack(spacing: Spacing.s3) {
                    SecondaryEditButton(isEnabled: !isDeleting) {
                        onEdit()
                    }
                    DeleteTextButton(isEnabled: !isDeleting) {
                        showsDeleteConfirm = true
                    }
                }
            }
        )
        .confirmationDialog(
            "Delete this event?",
            isPresented: $showsDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { @MainActor in onDelete() }
            }
            Button("Keep", role: .cancel) {}
        } message: {
            Text("This can't be undone. Attendees won't see it on the calendar anymore.")
        }
    }
}

// MARK: - Footer buttons

/// Outlined "Edit" button with a leading pencil — the design's flex-1
/// `SecondaryBtn` (event-detail-frames.jsx:113).
private struct SecondaryEditButton: View {
    let isEnabled: Bool
    let action: @MainActor () -> Void

    var body: some View {
        Button {
            action()
        } label: {
            // JSX `SecondaryBtn` (home-shell.jsx:198-203): h46, radius 12,
            // surface fill, 1px borderStrong, no shadow, label 14/700 fg2,
            // icon 15.
            HStack(spacing: Spacing.s2) {
                Icon(.pencil, size: 15, color: Theme.Color.appTextStrong)
                Text("Edit")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .opacity(isEnabled ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityIdentifier("eventDetail_edit")
        .accessibilityLabel("Edit")
    }
}

/// Red text "Delete" with a leading trash glyph — the design's destructive
/// `TextBtn` (event-detail-frames.jsx:114).
private struct DeleteTextButton: View {
    let isEnabled: Bool
    let action: @MainActor () -> Void

    var body: some View {
        Button {
            action()
        } label: {
            // JSX `TextBtn` (home-shell.jsx:205-210): transparent, label 13/700
            // in `tone` (here N.error), icon 14, gap 6.
            HStack(spacing: 6) {
                Icon(.trash2, size: 14, color: Theme.Color.error)
                Text("Delete")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.error)
            }
            .padding(.horizontal, Spacing.s2)
            .frame(minHeight: 44)
            .opacity(isEnabled ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityIdentifier("eventDetail_delete")
        .accessibilityLabel("Delete")
    }
}

private struct EventHeader: View {
    let event: CalendarEventDTO
    let category: CalendarEventCategory

    /// JSX `EventHeader` (event-detail-frames.jsx:41-51): no leading icon tile,
    /// not carded. h2 title (21/700, letterSpacing -0.4, lineHeight 26) then a
    /// row of "Mon Jun 16 · 6:30 PM" (13/600, fg2) + the category chip. Location
    /// is NOT in the header — it lives in the detail grid.
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(event.title)
                .font(.system(size: 21, weight: .bold))
                .tracking(-0.4)
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
                .lineLimit(3)
            HStack(spacing: Spacing.s2) {
                Text(formattedTimeRange)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                CategoryPill(category: category)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var formattedTimeRange: String {
        let calendar = Calendar.current
        guard let start = AddEventFormViewModel.parseIsoInstant(event.startAt) else {
            return event.startAt
        }
        let end = event.endAt.flatMap(AddEventFormViewModel.parseIsoInstant)
        if end == nil, isMidnightUTC(start) {
            return "\(longDateLabel(start, calendar: calendar)) · All day"
        }
        let date = longDateLabel(start, calendar: calendar)
        let time = formattedTime(start: start, end: end, calendar: calendar)
        return "\(date) · \(time)"
    }

    /// All-day events are stored at midnight **UTC** + nil end, so the
    /// heuristic is pinned to UTC even though display uses the local zone.
    private func isMidnightUTC(_ date: Date) -> Bool {
        var calendar = Calendar(identifier: .gregorian)
        if let utc = TimeZone(secondsFromGMT: 0) {
            calendar.timeZone = utc
        }
        let parts = calendar.dateComponents([.hour, .minute, .second], from: date)
        return (parts.hour ?? 0) == 0 && (parts.minute ?? 0) == 0 && (parts.second ?? 0) == 0
    }

    private func longDateLabel(_ date: Date, calendar: Calendar) -> String {
        let fmt = DateFormatter()
        // Design `EventHeader` shows "Mon Jun 16 · 6:30 PM" — 3-letter
        // weekday (`event-detail-frames.jsx:46`), rendered in the device's
        // local zone like the rest of the home-calendar surfaces. POSIX
        // locale keeps the stamp byte-identical with Android's Locale.US.
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = calendar.timeZone
        fmt.dateFormat = "EEE MMM d"
        return fmt.string(from: date)
    }

    private func formattedTime(start: Date, end: Date?, calendar: Calendar) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = calendar.timeZone
        fmt.dateFormat = "h:mm a"
        let startLabel = fmt.string(from: start)
        guard let end else { return startLabel }
        return "\(startLabel) – \(fmt.string(from: end))"
    }
}

private struct CategoryPill: View {
    let category: CalendarEventCategory

    /// Design `CatChip` (home-shell.jsx:153-159): a 7×7 colored dot (`c.c`)
    /// + label in N.fg2 on N.sunken background — no icon glyph.
    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(category.dotColor)
                .frame(width: 7, height: 7)
            Text(category.label)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }
}

/// One `DetailRow` — JSX (event-detail-frames.jsx:56-59 via shared `DetailRow`):
/// a 30×30 sunken icon tile + an overline label stacked *above* the value.
private struct DetailRow: View {
    let icon: PantopusIcon
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: 30, height: 30)
                // JSX icon color N.fg2 (home-shell.jsx:414).
                Icon(icon, size: 15, color: Theme.Color.appTextStrong)
            }
            VStack(alignment: .leading, spacing: 2) {
                // JSX label = 9.5/700, letterSpacing 0.06em, color N.fg4.
                Text(label.uppercased())
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.57)
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text(value)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.vertical, Spacing.s2)
    }
}

private struct DetailGrid: View {
    let event: CalendarEventDTO
    let category: CalendarEventCategory

    // JSX `DetailGrid` (event-detail-frames.jsx:53-62): a single card padded
    // 4px/13px, rows in the order Repeats · Reminder · Location · Type.
    // JSX `DetailRow` (home-shell.jsx:411-421) draws
    // `borderBottom: last ? 'none' : '1px solid N.border'` between all rows
    // except the last. Build the visible row list at render time so dividers
    // are inserted only between the rows that are actually shown.
    var body: some View {
        let rows = visibleRows
        VStack(spacing: Spacing.s0) {
            ForEach(rows.indices, id: \.self) { index in
                let row = rows[index]
                DetailRow(icon: row.icon, label: row.label, value: row.value)
                if index < rows.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(height: 1)
                }
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private struct RowSpec {
        let icon: PantopusIcon
        let label: String
        let value: String
    }

    private var visibleRows: [RowSpec] {
        var rows: [RowSpec] = []
        if let recurrence = recurrenceLabel(event.recurrenceRule) {
            rows.append(RowSpec(icon: .arrowsRepeat, label: "Repeats", value: recurrence))
        }
        rows.append(RowSpec(icon: .bell, label: "Reminder", value: reminderLabel))
        if let location = event.locationNotes, !location.isEmpty {
            rows.append(RowSpec(icon: .mapPin, label: "Location", value: location))
        }
        rows.append(RowSpec(icon: .tag, label: "Type", value: category.label))
        return rows
    }

    /// JSX reminder value = the per-offset list joined by " · ", longest lead
    /// first (e.g. "1 hour before · 10 min before"). Built from the event's
    /// `reminders` jsonb (minutes-before integers); falls back to "1 hour
    /// before · 10 min before"'s sibling — a single "10 min before" — only via
    /// `alerts_enabled` for legacy rows, else "Off".
    private var reminderLabel: String {
        let minutes: [Int] = (event.reminders ?? [])
            .compactMap { $0.numberValue.map { Int($0) } }
            .sorted(by: >)
        if !minutes.isEmpty {
            return minutes.map(Self.reminderPhrase).joined(separator: " · ")
        }
        return (event.alertsEnabled ?? false) ? "10 min before" : "Off"
    }

    /// Minutes-before → the design's human phrase ("At time", "10 min before",
    /// "1 hour before", "1 day before"). Mirrors `AddEventReminderOffset`.
    private static func reminderPhrase(_ minutes: Int) -> String {
        switch minutes {
        case 0: "At time"
        case 1440: "1 day before"
        case 60: "1 hour before"
        default:
            minutes % 60 == 0
                ? "\(minutes / 60) hour\(minutes / 60 == 1 ? "" : "s") before"
                : "\(minutes) min before"
        }
    }

    private func recurrenceLabel(_ rrule: String?) -> String? {
        guard let rrule, !rrule.isEmpty else { return nil }
        let upper = rrule.uppercased()
        if upper.contains("FREQ=WEEKLY") {
            if let day = Self.weeklyDay(upper) {
                return "Every \(day)"
            }
            return "Weekly"
        }
        if upper.contains("FREQ=YEARLY") { return "Yearly" }
        if upper.contains("FREQ=MONTHLY") { return "Monthly" }
        if upper.contains("FREQ=DAILY") { return "Daily" }
        return "Yes"
    }

    /// "FREQ=WEEKLY;BYDAY=MO" → "Monday" (the design renders "Every Monday").
    private static func weeklyDay(_ upper: String) -> String? {
        let map: [String: String] = [
            "MO": "Monday", "TU": "Tuesday", "WE": "Wednesday", "TH": "Thursday",
            "FR": "Friday", "SA": "Saturday", "SU": "Sunday"
        ]
        guard let range = upper.range(of: "BYDAY=") else { return nil }
        let code = String(upper[range.upperBound...].prefix(2))
        return map[code]
    }
}

private struct AttendeesSection: View {
    let ids: [String]
    let nameLookup: [String: String]
    var currentUserId: String?
    var rsvpFor: (@MainActor (String) -> HomeRsvpChoice)?

    /// JSX Attendees card (event-detail-frames.jsx:105-108): a single `Card`
    /// whose first child is an `Overline` "Attendees", followed by `AttendeeRow`s
    /// with a per-member RSVP pill always shown and a "· you" suffix on self.
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline(text: "Attendees")
            VStack(spacing: Spacing.s0) {
                ForEach(Array(ids.enumerated()), id: \.element) { index, id in
                    let name = nameLookup[id] ?? "Member"
                    AttendeeRow(
                        memberId: id,
                        name: name,
                        isYou: id == currentUserId,
                        rsvp: rsvpFor?(id) ?? .noReply
                    )
                    if index < ids.count - 1 {
                        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                    }
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }
}

/// JSX `Overline` (home-shell.jsx:129-131): uppercase 9.5/700, letterSpacing
/// 0.08em (≈0.76pt at 9.5), default `fg3`.
private struct SectionOverline: View {
    let text: String
    var color: Color = Theme.Color.appTextSecondary

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 9.5, weight: .bold))
            .tracking(0.76)
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AttendeeRow: View {
    let memberId: String
    let name: String
    var isYou: Bool = false
    var rsvp: HomeRsvpChoice?

    var body: some View {
        HStack(spacing: 10) {
            // Design `AttendeeRow` uses the per-member gradient `Avatar`
            // (home-shell.jsx) — same `HomeMemberAvatar` the F1 agenda rows
            // render, and Android's F2 AttendeeRow.
            HomeMemberAvatar(
                member: HomeMember(id: memberId, name: name),
                size: 30
            )
            // JSX name = 13/600 fg1, with a "· you" suffix in fg4 for self.
            (
                Text(name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Theme.Color.appText)
                    + Text(isYou ? " · you" : "")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Theme.Color.appTextMuted)
            )
            .lineLimit(1)
            Spacer(minLength: Spacing.s2)
            if let rsvp {
                HomeRsvpPill(rsvp)
            }
        }
        .padding(.vertical, 9)
    }
}

/// "Your RSVP" card — an unselected home-green segmented control, or a
/// confirmation row once recorded. When `pending` (RSVPs requested, no reply
/// yet) the card enters the design's emphasised state: green border + green
/// glow + a "Tap to let everyone know" hint (JSX `FramePending`,
/// event-detail-frames.jsx:200-204).
private struct YourRsvpCard: View {
    let selected: HomeRsvpChoice?
    let saving: Bool
    let enabled: Bool
    var pending: Bool = false
    let onSelect: @MainActor (HomeRsvpChoice) -> Void

    /// The design's OFFLINE frame drops the pending emphasis entirely —
    /// plain dimmed card, muted overline, no hint (event-detail-frames.jsx
    /// `FrameOffline`) — so the green border/glow/hint only render online.
    private var emphasized: Bool {
        pending && enabled
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline(
                text: "Your RSVP",
                color: enabled ? Theme.Color.homeDark : Theme.Color.appTextMuted
            )
            if let selected, selected != .noReply {
                recorded(selected)
            } else {
                control
                if emphasized {
                    HStack(spacing: 5) {
                        Icon(.hand, size: 12, color: Theme.Color.homeDark)
                        Text("Tap to let everyone know")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.homeDark)
                    }
                }
                if !enabled {
                    Text("RSVP buttons are disabled until you reconnect.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(
                    emphasized ? Theme.Color.home : Theme.Color.appBorderSubtle,
                    lineWidth: emphasized ? 1.5 : 1
                )
        )
        .background(
            // The design's `0 0 0 4px H.bg50` green glow around the pending card.
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.homeBg, lineWidth: emphasized ? 4 : 0)
                .padding(-2)
        )
        .accessibilityIdentifier("eventDetail_yourRsvp")
    }

    private var control: some View {
        HStack(spacing: 3) {
            ForEach(HomeRsvpChoice.selectable, id: \.self) { choice in
                Button {
                    onSelect(choice)
                } label: {
                    Text(choice.label)
                        .font(.system(size: 12, weight: selected == choice ? .bold : .semibold))
                        .foregroundStyle(selected == choice ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .background(selected == choice ? Theme.Color.home : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("eventDetail_rsvp_\(choice.rawValue)")
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .opacity(enabled && !saving ? 1 : 0.5)
        .disabled(!enabled || saving)
    }

    private func recorded(_ choice: HomeRsvpChoice) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(choice.background)
                Icon(choice.icon, size: 18, color: choice.foreground)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(recordedTitle(choice))
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Everyone can see your reply")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            Button {
                // Clear back to the picker by reselecting "no reply".
                onSelect(.noReply)
            } label: {
                HStack(spacing: 5) {
                    Icon(.pencil, size: 14, color: Theme.Color.homeDark)
                    Text("Change")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.homeDark)
                }
            }
            .buttonStyle(.plain)
            // "Change" is disabled offline (the POST would fail and silently
            // revert) — matches Android's offline-disabled Change affordance.
            .disabled(saving || !enabled)
            .accessibilityIdentifier("eventDetail_rsvpChange")
        }
    }

    private func recordedTitle(_ choice: HomeRsvpChoice) -> String {
        switch choice {
        case .going: "You're going"
        case .maybe: "You might go"
        case .cant: "You can't make it"
        case .noReply: "No reply yet"
        }
    }
}

private struct NotesSection: View {
    let text: String

    /// JSX `NotesCard` (event-detail-frames.jsx:84-91): a single `Card` with an
    /// `Overline` "Notes" (default neutral fg3, no icon) over body text
    /// (12.5/fg2, line-height 18). No leading glyph, no inner card.
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline(text: "Notes")
            Text(text)
                .font(.system(size: 12.5))
                .lineSpacing(4)
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }
}

#Preview {
    EventDetailView(
        homeId: "preview",
        eventId: "event-1",
        onBack: {},
        onEdit: { _ in }
    )
}

// swiftlint:enable file_length
