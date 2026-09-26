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

    /// Server timestamps carry fractional seconds ("…55.905022+00:00"),
    /// which a default `ISO8601DateFormatter` rejects; the Recent activity
    /// list's parser accepts both forms.
    static func relative(timestamp: String) -> String {
        RecentActivityViewModel.relative(timestamp: timestamp, now: Date())
    }
}
