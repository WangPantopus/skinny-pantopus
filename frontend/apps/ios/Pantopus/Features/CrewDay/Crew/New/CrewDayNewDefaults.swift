//
//  CrewDayNewDefaults.swift
//  Pantopus
//
//  What New Crew Day starts with for each service (build kit 01-spec.md
//  screen 14, example data), and its date and time conversions. A day's
//  date and window are local to the Crew Day (Pacific unless the server
//  says otherwise).
//

import Foundation

enum CrewDayNewDefaults {
    /// "Gutter Day", "Leaf Day".
    static func dayName(_ service: CrewDayService) -> String {
        switch service {
        case .gutterCleaning: "Gutter Day"
        case .leafCleanup: "Leaf Day"
        case .roofMoss: "Roof Moss Day"
        case .holidayLights: "Holiday Lights Day"
        case .windowWashing: "Window Day"
        case .pressureWashing: "Pressure Washing Day"
        case .other: "Crew Day"
        }
    }

    /// Up to six lines, prefilled per service.
    static func included(_ service: CrewDayService) -> [String] {
        switch service {
        case .gutterCleaning:
            ["Cleans every gutter by hand", "Flushes each downspout", "Bags the debris and takes it away"]
        case .leafCleanup:
            ["Clears leaves from the lawn and beds", "Blows off the driveway and walks", "Bags the leaves and takes them away"]
        case .roofMoss:
            ["Brushes moss off the roof by hand", "Treats the roof to slow regrowth", "Cleans up what falls"]
        case .holidayLights:
            ["Hangs lights along the roofline", "Tests every strand first", "Takes them down after the holidays"]
        case .windowWashing:
            ["Washes every outside window", "Wipes the frames and sills"]
        case .pressureWashing:
            ["Washes the driveway and front walk", "Rinses the steps and porch"]
        case .other:
            [""]
        }
    }

    static func options(_ service: CrewDayService) -> [CrewDayNewOption] {
        switch service {
        case .gutterCleaning:
            [
                CrewDayNewOption(id: "one_story", label: "One story", price: "140", needsLook: false),
                CrewDayNewOption(id: "two_stories", label: "Two stories", price: "180", needsLook: false),
                CrewDayNewOption(id: "three_plus", label: "Three or more stories", price: "", needsLook: true)
            ]
        default:
            [CrewDayNewOption(id: "standard", label: "Standard home", price: "", needsLook: false)]
        }
    }

    static func addOns(_ service: CrewDayService) -> [CrewDayNewAddOn] {
        service == .gutterCleaning ? [CrewDayNewAddOn(id: "guards", label: "Clean the gutter guards", price: "30")] : []
    }

    /// "Maple Lane" from "123 Maple Lane".
    static func street(from line: String) -> String {
        let words = line.split(separator: " ")
        guard let first = words.first, first.allSatisfy(\.isNumber), words.count > 1 else { return line }
        return words.dropFirst().joined(separator: " ")
    }

    // MARK: - Dates

    /// The Crew Day's zone.
    static let zone = TimeZone(identifier: "America/Los_Angeles") ?? .current

    /// Two weeks out, a whole day.
    static func firstDay() -> Date {
        Calendar.current.startOfDay(for: Date().addingTimeInterval(14 * 24 * 3600))
    }

    /// Today at `hour`:00 on the phone's clock (a picker's time).
    static func time(hour: Int) -> Date {
        Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: Date()) ?? Date()
    }

    /// The picked day and time as one instant in the Crew Day's zone.
    static func combine(_ day: Date, _ time: Date) -> Date {
        let local = Calendar.current
        let dayParts = local.dateComponents([.year, .month, .day], from: day)
        let timeParts = local.dateComponents([.hour, .minute], from: time)
        var zoned = Calendar(identifier: .gregorian)
        zoned.timeZone = zone
        return zoned.date(from: DateComponents(
            year: dayParts.year,
            month: dayParts.month,
            day: dayParts.day,
            hour: timeParts.hour,
            minute: timeParts.minute
        )) ?? day
    }

    /// `YYYY-MM-DD` of the picked day.
    static func dayString(_ day: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: day)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// `HH:MM` of the picked time.
    static func timeString(_ time: Date) -> String {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: time)
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }
}
