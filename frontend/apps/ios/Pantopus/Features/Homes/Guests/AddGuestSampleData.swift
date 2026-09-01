//
//  AddGuestSampleData.swift
//  Pantopus
//
//  A13.1 — Deterministic seed data for the Add Guest form. The backend
//  has been removed from the repo, so the chip option lists, the
//  home-context strip copy, and the two design frames (FILLED / INITIAL)
//  all live here so previews + snapshot baselines render the same shape
//  every time.
//

import Foundation

/// Static seed data backing `AddGuestFormViewModel`.
public enum AddGuestSampleData {
    /// Stable id for the "Custom…" duration chip — opens the date-range
    /// picker sheet rather than committing a fixed window.
    public static let durationCustomId = "custom"

    /// Single-select duration chips (radio). Ids are stable; labels match
    /// the design.
    public static let durationOptions: [ChipPicker.Option] = [
        .init(id: "2h", label: "2 hours"),
        .init(id: "today", label: "Today"),
        .init(id: "weekend", label: "Weekend"),
        .init(id: durationCustomId, label: "Custom…")
    ]

    /// Multi-select "Allowed areas" chips. Each carries the leading icon
    /// from the design's `data-lucide` reference.
    public static let areaOptions: [ChipPicker.Option] = [
        .init(id: "front_door", label: "Front door", icon: .doorOpen),
        .init(id: "garage", label: "Garage", icon: .car),
        .init(id: "mailroom", label: "Mailroom", icon: .mailbox),
        .init(id: "backyard", label: "Backyard", icon: .trees),
        .init(id: "garden_shed", label: "Garden shed", icon: .warehouse)
    ]

    /// Maximum welcome-message length (characters).
    public static let welcomeMaxLength = 280

    /// House-context strip shown above the form ("which home is this pass
    /// for"). Keyed by home id so previews stay deterministic; a real
    /// build would resolve this from the loaded home.
    public struct HomeContext: Sendable, Equatable {
        public let title: String
        public let subtitle: String

        public init(title: String, subtitle: String) {
            self.title = title
            self.subtitle = subtitle
        }
    }

    public static func homeContext(for _: String) -> HomeContext {
        HomeContext(title: "412 Elm St · Apt 3B", subtitle: "Kovács household")
    }

    // MARK: - Frame seeds

    /// FILLED frame — Sasha, Weekend, Front door + Garage, welcome note.
    public enum Filled {
        public static let name = "Sasha Petrov"
        public static let contact = "sasha@petrov.co"
        public static let durationId = "weekend"
        public static let areaIds: Set<String> = ["front_door", "garage"]
        public static let welcome =
            "Hey Sasha — plants twice this weekend, water bowl is in the kitchen. "
                + "Pass also opens the garage if you park inside."
    }
}
