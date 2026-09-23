//
//  HubViewModel+Formatting.swift
//  Pantopus
//
//  Small formatting helpers the hub projections use: pillar icons,
//  avatar initials, setup-step titles, the greeting and relative times.
//  Split out of `HubViewModel.swift` to keep that file inside the
//  500-line lint budget.
//

import Foundation

extension HubViewModel {
    static func icon(from raw: String) -> PantopusIcon {
        PantopusIcon.allCases.first { $0.rawValue == raw } ?? .arrowLeft
    }

    static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }

    static func setupTitle(_ key: String) -> String {
        key.replacingOccurrences(of: "_", with: " ").capitalized
    }

    static func greeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default: return "Hello"
        }
    }

    static func relative(timestamp: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: timestamp) else { return timestamp }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
