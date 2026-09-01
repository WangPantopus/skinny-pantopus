//
//  ConnectedCalendarsViewModel.swift
//  Pantopus
//
//  Stream I2 — B8 Connected Calendars. Reads the (v1-empty) connected-calendar
//  list (`GET /connected-calendars`); `POST /connected-calendars/connect`
//  returns 501, so connecting surfaces an honest "coming soon" notice rather
//  than a dead end. If the backend ever returns linked accounts they render as
//  conflict-check / write-target rows. Personal surface.
//

import Observation
import SwiftUI

/// A calendar provider offered on the connect rows.
struct CalendarProvider: Identifiable, Hashable {
    let id: String
    let name: String
    let icon: PantopusIcon
    /// Short name used in the connecting handoff line ("Opening Google…").
    let shortName: String

    init(id: String, name: String, shortName: String, icon: PantopusIcon) {
        self.id = id
        self.name = name
        self.shortName = shortName
        self.icon = icon
    }

    /// Design glyphs (connected-calendars-frames.jsx PROVIDERS): Google
    /// `calendar-days`, Apple `calendar`, Outlook `calendar-range`.
    static let all: [CalendarProvider] = [
        CalendarProvider(id: "google", name: "Google Calendar", shortName: "Google", icon: .calendarDays),
        CalendarProvider(id: "apple", name: "Apple Calendar", shortName: "Apple", icon: .calendar),
        CalendarProvider(id: "outlook", name: "Outlook", shortName: "Outlook", icon: .calendarRange)
    ]

    /// Per-provider brand tint for the glyph (design `ProviderTile` `p.color`:
    /// Google brand blue, Apple near-black, Outlook deep blue). Mapped to the
    /// closest existing semantic tokens so no raw hex reaches a Color and the
    /// tile reads brand-differentiated rather than uniform grey. See sharedTodos
    /// — dedicated `calendarGoogle/Apple/Outlook` tokens give the exact hues.
    var brandColor: Color {
        switch id {
        case "google": Theme.Color.info
        case "apple": Theme.Color.appText
        case "outlook": Theme.Color.primary700
        default: Theme.Color.appTextSecondary
        }
    }
}

@Observable
@MainActor
final class ConnectedCalendarsViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case error(message: String)
    }

    private(set) var phase: Phase = .loading
    private(set) var calendars: [ConnectedCalendarDTO] = []
    /// A connect attempt that returned 501 — surfaced as a "coming soon" alert.
    var notice: String?
    /// Provider id mid-attempt (drives the row's shimmer status).
    var connectingId: String?

    let owner: SchedulingOwner
    private let client: SchedulingClient

    init(owner: SchedulingOwner, client: SchedulingClient = .shared) {
        self.owner = owner
        self.client = client
    }

    /// v1 always returns no linked accounts, so the screen leads with the
    /// calm coming-soon hero.
    var isComingSoon: Bool {
        calendars.isEmpty
    }

    let providers = CalendarProvider.all

    func load() async {
        if case .ready = phase { return }
        await fetch()
    }

    func reload() async {
        await fetch()
    }

    private func fetch() async {
        phase = .loading
        do {
            let response: ConnectedCalendarsResponse = try await client.request(
                SchedulingEndpoints.getConnectedCalendars()
            )
            calendars = response.calendars
            phase = .ready
        } catch let error as SchedulingError {
            phase = .error(message: error.userMessage ?? "Couldn't load your calendars.")
        } catch {
            phase = .error(message: "Couldn't load your calendars.")
        }
    }

    func connect(_ provider: CalendarProvider) async {
        guard connectingId == nil else { return }
        connectingId = provider.id
        defer { connectingId = nil }
        do {
            try await client.send(SchedulingEndpoints.connectCalendar())
            await fetch()
        } catch let error as SchedulingError {
            notice = comingSoonMessage(for: provider, error: error)
        } catch {
            notice = "Couldn't connect right now. Please try again."
        }
    }

    private func comingSoonMessage(for provider: CalendarProvider, error: SchedulingError) -> String {
        if case .notImplemented = error {
            return "Calendar sync is coming soon. We'll let you know when you can connect \(provider.name)."
        }
        return error.userMessage ?? "Couldn't connect \(provider.name) right now."
    }

    /// The provider definition matching a linked-account DTO's `provider`
    /// string, so a connected/re-auth row can render the right tile + glyph.
    func provider(for calendar: ConnectedCalendarDTO) -> CalendarProvider? {
        guard let key = calendar.provider?.lowercased() else { return nil }
        return providers.first { $0.id == key }
    }

    /// Whether a linked account is in the sync-error / re-auth state (design
    /// frame 5). Maps the backend `status` string, tolerant of variants.
    func needsReauth(_ calendar: ConnectedCalendarDTO) -> Bool {
        switch calendar.status?.lowercased() {
        case "needs_reauth", "reauth", "needs_reconnect", "error", "expired": true
        default: false
        }
    }

    /// Whether the OS/provider declined calendar access (design frame 6 —
    /// permission denied). Maps the backend `status` string; only renders the
    /// lock banner + Open Settings row if the backend ever returns it.
    func isDenied(_ calendar: ConnectedCalendarDTO) -> Bool {
        switch calendar.status?.lowercased() {
        case "denied", "permission_denied", "forbidden", "access_denied": true
        default: false
        }
    }

    /// Disconnecting a linked account is not yet wired to a backend route, so
    /// surface the same honest "coming soon" notice rather than a dead button.
    func disconnect(_ calendar: ConnectedCalendarDTO) {
        let name = calendar.externalAccount ?? calendar.provider ?? "this calendar"
        notice = "Disconnecting calendars is coming soon. We'll let you know when you can remove \(name)."
    }
}
