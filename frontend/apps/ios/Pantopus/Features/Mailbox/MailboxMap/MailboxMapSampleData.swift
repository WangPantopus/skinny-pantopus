//
//  MailboxMapSampleData.swift
//  Pantopus
//
//  A11.4 Mailbox map — deterministic sample spots. Backend has been
//  removed from the repo, so the view-model projects these into the
//  render states; previews + snapshot baselines stay stable.
//
//  The first four entries mirror the rail cards in
//  `mailbox-map-frames.jsx` exactly (Hayes Valley PO · USPS drop box ·
//  Amazon Hub Locker · FedEx Office).
//

import CoreGraphics
import Foundation

public enum MailboxMapSampleData {
    /// "You are here" anchor as a 0…1 fraction of the map canvas.
    public static let userAnchor = CGPoint(x: 0.46, y: 0.55)

    public static let spots: [MailboxSpot] = [
        MailboxSpot(
            id: "hayes-valley-po",
            kind: .post,
            name: "Hayes Valley Post Office",
            address: "390 Hayes St · USPS",
            isOpen: true,
            hoursLabel: "Until 6 PM",
            statusLabel: "Open · closes 6 PM",
            walkLabel: "3 min · 0.2 mi",
            lastPickupLabel: "Last pickup 5 PM",
            services: [.stamps, .shipping, .poBoxes, .passport],
            weekHours: weekHours(["9–6", "9–6", "9–6", "9–6", "9–6", "10–4", "—"]),
            mapX: 0.19,
            mapY: 0.20
        ),
        MailboxSpot(
            id: "usps-drop-hayes-buchanan",
            kind: .drop,
            name: "USPS Drop Box · Hayes & Buchanan",
            address: "Hayes St & Buchanan St · USPS",
            isOpen: true,
            hoursLabel: "Pickup 5 PM",
            statusLabel: "Open · last pickup 5 PM",
            walkLabel: "4 min · 0.3 mi",
            lastPickupLabel: "Last pickup 5 PM",
            services: [.dropOff],
            weekHours: weekHours(["24h", "24h", "24h", "24h", "24h", "24h", "24h"]),
            mapX: 0.43,
            mapY: 0.13
        ),
        MailboxSpot(
            id: "amazon-hub-whole-foods",
            kind: .locker,
            name: "Amazon Hub Locker · Whole Foods",
            address: "450 Rhode Island St · Amazon",
            isOpen: true,
            hoursLabel: "Until 10 PM",
            statusLabel: "Open · closes 10 PM",
            walkLabel: "6 min · 0.4 mi",
            lastPickupLabel: nil,
            services: [.pickup, .dropOff],
            weekHours: weekHours(["7–10", "7–10", "7–10", "7–10", "7–10", "8–10", "8–9"]),
            mapX: 0.61,
            mapY: 0.24
        ),
        MailboxSpot(
            id: "fedex-office-market",
            kind: .carrier,
            name: "FedEx Office · Market St",
            address: "1800 Market St · FedEx",
            isOpen: true,
            hoursLabel: "Until 8 PM",
            statusLabel: "Open · closes 8 PM",
            walkLabel: "9 min · 0.6 mi",
            lastPickupLabel: "Last pickup 6 PM",
            services: [.shipping, .printing, .pickup],
            weekHours: weekHours(["8–8", "8–8", "8–8", "8–8", "8–8", "9–6", "12–5"]),
            mapX: 0.80,
            mapY: 0.16
        ),
        MailboxSpot(
            id: "usps-drop-octavia",
            kind: .drop,
            name: "USPS Drop Box · Octavia Blvd",
            address: "Octavia Blvd & Fell St · USPS",
            isOpen: true,
            hoursLabel: "Pickup 4 PM",
            statusLabel: "Open · last pickup 4 PM",
            walkLabel: "5 min · 0.3 mi",
            lastPickupLabel: "Last pickup 4 PM",
            services: [.dropOff],
            weekHours: weekHours(["24h", "24h", "24h", "24h", "24h", "24h", "24h"]),
            mapX: 0.33,
            mapY: 0.34
        ),
        MailboxSpot(
            id: "civic-center-station",
            kind: .civic,
            name: "Civic Center Station",
            address: "101 Hyde St · City & County",
            isOpen: true,
            hoursLabel: "Until 5 PM",
            statusLabel: "Open · closes 5 PM",
            walkLabel: "8 min · 0.5 mi",
            lastPickupLabel: nil,
            services: [.poBoxes, .passport, .dropOff],
            weekHours: weekHours(["8–5", "8–5", "8–5", "8–5", "8–5", "—", "—"]),
            mapX: 0.67,
            mapY: 0.37
        ),
        MailboxSpot(
            id: "ups-locker-safeway",
            kind: .locker,
            name: "UPS Access Point · Safeway",
            address: "298 King St · UPS",
            isOpen: true,
            hoursLabel: "Until 9 PM",
            statusLabel: "Open · closes 9 PM",
            walkLabel: "11 min · 0.7 mi",
            lastPickupLabel: nil,
            services: [.pickup, .dropOff],
            weekHours: weekHours(["6–9", "6–9", "6–9", "6–9", "6–9", "7–9", "8–8"]),
            mapX: 0.86,
            mapY: 0.31
        ),
        MailboxSpot(
            id: "usps-drop-duboce",
            kind: .drop,
            name: "USPS Drop Box · Duboce Park",
            address: "Duboce Ave & Noe St · USPS",
            isOpen: false,
            hoursLabel: "Pickup 3 PM",
            statusLabel: "Closed · next pickup 3 PM tomorrow",
            walkLabel: "12 min · 0.8 mi",
            lastPickupLabel: "Last pickup 3 PM",
            services: [.dropOff],
            weekHours: weekHours(["24h", "24h", "24h", "24h", "24h", "24h", "24h"]),
            mapX: 0.15,
            mapY: 0.45
        ),
        MailboxSpot(
            id: "ups-store-divisadero",
            kind: .carrier,
            name: "The UPS Store · Divisadero",
            address: "1750 Divisadero St · UPS",
            isOpen: true,
            hoursLabel: "Until 7 PM",
            statusLabel: "Open · closes 7 PM",
            walkLabel: "14 min · 0.9 mi",
            lastPickupLabel: "Last pickup 5 PM",
            services: [.shipping, .printing, .pickup, .poBoxes],
            weekHours: weekHours(["8–7", "8–7", "8–7", "8–7", "8–7", "9–5", "—"]),
            mapX: 0.54,
            mapY: 0.47
        ),
        MailboxSpot(
            id: "noe-valley-po",
            kind: .post,
            name: "Noe Valley Post Office",
            address: "4083 24th St · USPS",
            isOpen: true,
            hoursLabel: "Until 5 PM",
            statusLabel: "Open · closes 5 PM",
            walkLabel: "16 min · 1.0 mi",
            lastPickupLabel: "Last pickup 4 PM",
            services: [.stamps, .shipping, .poBoxes],
            weekHours: weekHours(["8:30–5", "8:30–5", "8:30–5", "8:30–5", "8:30–5", "9–2", "—"]),
            mapX: 0.30,
            mapY: 0.27
        ),
        MailboxSpot(
            id: "city-hall-mailroom",
            kind: .civic,
            name: "City Hall Mailroom",
            address: "1 Dr Carlton B Goodlett Pl",
            isOpen: false,
            hoursLabel: "Opens 8 AM",
            statusLabel: "Closed · opens 8 AM",
            walkLabel: "10 min · 0.6 mi",
            lastPickupLabel: nil,
            services: [.dropOff, .poBoxes],
            weekHours: weekHours(["8–5", "8–5", "8–5", "8–5", "8–5", "—", "—"]),
            mapX: 0.47,
            mapY: 0.22
        ),
        MailboxSpot(
            id: "amazon-locker-castro",
            kind: .locker,
            name: "Amazon Hub Locker · Castro",
            address: "2280 Market St · Amazon",
            isOpen: true,
            hoursLabel: "Until 11 PM",
            statusLabel: "Open · closes 11 PM",
            walkLabel: "13 min · 0.8 mi",
            lastPickupLabel: nil,
            services: [.pickup, .dropOff],
            weekHours: weekHours(["6–11", "6–11", "6–11", "6–11", "6–11", "7–11", "8–10"]),
            mapX: 0.72,
            mapY: 0.45
        )
    ]

    /// Build a Monday-first week-hour strip. `hours` is seven entries
    /// Mon→Sun; the labels + `Calendar` weekday numbers (1 = Sun … 7 =
    /// Sat) are filled in so the view can highlight the current day.
    private static func weekHours(_ hours: [String]) -> [MailboxDayHours] {
        let labels = ["M", "T", "W", "T", "F", "S", "S"]
        let weekdays = [2, 3, 4, 5, 6, 7, 1]
        return zip(zip(weekdays, labels), hours).map { pair, hour in
            MailboxDayHours(weekday: pair.0, label: pair.1, hours: hour)
        }
    }
}
