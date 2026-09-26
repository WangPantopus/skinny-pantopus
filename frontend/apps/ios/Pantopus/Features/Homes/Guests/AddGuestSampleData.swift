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

    /// Multi-select "What they can see" chips: the guest page sections the
    /// pass includes (`included_sections`), with the web's keys and labels.
    public static let sectionOptions: [ChipPicker.Option] = [
        .init(id: "wifi", label: "WiFi", icon: .wifi),
        .init(id: "entry_instructions", label: "Entry Instructions", icon: .doorOpen),
        .init(id: "house_rules", label: "House Rules", icon: .clipboardList),
        .init(id: "parking", label: "Parking", icon: .car),
        .init(id: "trash_day", label: "Trash Day", icon: .trash),
        .init(id: "local_tips", label: "Local Tips", icon: .mapPin),
        .init(id: "emergency", label: "Emergency Info", icon: .siren)
    ]

    /// Preselected sections, as in the web's Guest Pass template.
    public static let defaultSectionIds: Set<String> = ["wifi", "entry_instructions", "house_rules", "parking"]

    /// Maximum welcome-message length (characters).
    public static let welcomeMaxLength = 280

    /// House-context strip shown above the form ("which home is this pass
    /// for") in previews and snapshots; the form itself loads the real
    /// Home (`AddGuestFormViewModel.loadHomeContext`).
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

    /// FILLED frame — Sasha, Weekend, WiFi + Entry Instructions + Parking, welcome note.
    public enum Filled {
        public static let name = "Sasha Petrov"
        public static let contact = "sasha@petrov.co"
        public static let durationId = "weekend"
        public static let sectionIds: Set<String> = ["wifi", "entry_instructions", "parking"]
        public static let welcome =
            "Hey Sasha — plants twice this weekend, water bowl is in the kitchen. "
                + "Park in the driveway."
    }
}
