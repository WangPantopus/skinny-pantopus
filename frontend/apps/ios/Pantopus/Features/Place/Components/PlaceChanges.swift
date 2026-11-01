//
//  PlaceChanges.swift
//  Pantopus
//
//  "Changed since your last visit" on Your Place (the November 2026
//  redesign). The phone remembers, per account and Home, the server time of
//  the last visit that showed the dashboard loaded; the next visit asks the
//  server what really changed since then. A first visit, an error or an
//  older server (404) shows nothing. Parity twin of Android `PlaceChanges`.
//

import SwiftUI

/// The last visit's server time, per account and Home, on this device.
@MainActor
enum PlaceLastVisit {
    private static func key(homeId: String) -> String {
        let account: String = if case let .signedIn(user) = AuthManager.shared.state { user.id } else { "guest" }
        return "place.lastVisit.\(account).\(homeId)"
    }

    static func read(homeId: String) -> String? {
        UserDefaults.standard.string(forKey: key(homeId: homeId))
    }

    static func write(_ iso: String, homeId: String) {
        UserDefaults.standard.set(iso, forKey: key(homeId: homeId))
    }
}

extension PlaceChange {
    /// "Nov 1, 1:20 AM · NWS Portland OR", on the home's clock.
    func originLine(calendar: Calendar) -> String? {
        let when = PlacePresentation.parseISO(occurredAt).map { date in
            date.formatted(Date.FormatStyle(timeZone: calendar.timeZone).month(.abbreviated).day().hour().minute())
        }
        let parts = [when, origin].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    var icon: PantopusIcon {
        switch kind {
        case "weather_alert": .triangleAlert
        case "pickup_schedule": .trash
        case "document_added": .fileText
        case "systems_updated": .wrench
        default: .history
        }
    }
}

/// Every change the server sent, newest first, each opening its screen.
struct PlaceChangesSheet: View {
    let changes: [PlaceChange]
    let total: Int
    let calendar: Calendar
    let onOpen: (PlaceChange) -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Changed since your last visit")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Close", action: onClose)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryInk)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("place.changes.close")
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if total > changes.count {
                        Text("The latest \(changes.count) of \(total).")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .padding(.bottom, 8)
                    }
                    PlaceGroupSurface {
                        ForEach(Array(changes.enumerated()), id: \.element.id) { index, change in
                            if index > 0 { PlaceRowDivider() }
                            Button { onOpen(change) } label: {
                                HStack(alignment: .top, spacing: 11) {
                                    Icon(change.icon, size: 17, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                                        .frame(width: 22)
                                        .padding(.top, 2)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(change.title)
                                            .font(.system(size: 15, weight: .semibold))
                                            .foregroundStyle(Theme.Color.appText)
                                        if let detail = change.detail, !detail.isEmpty {
                                            Text(detail)
                                                .font(.system(size: 13))
                                                .foregroundStyle(Theme.Color.appTextSecondary)
                                        }
                                        if let origin = change.originLine(calendar: calendar) {
                                            Text(origin)
                                                .font(Theme.Font.caption)
                                                .foregroundStyle(Theme.Color.appTextMuted)
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    PlaceChevron()
                                }
                                .padding(.vertical, 12)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityElement(children: .combine)
                            .accessibilityAddTraits(.isButton)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("place.changesSheet")
    }
}
