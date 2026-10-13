//
//  PlanComposerOptions.swift
//  Pantopus
//
//  The choices the host composer offers (boards H2 to H5) and their words:
//  sports, levels, walk kinds, paces, kids' age bands, and what "extra gear"
//  is called for each sport. The values sent are recorded in the Plans
//  coordination folder (QUESTIONS.md) for the backend to match.
//

import Foundation

enum PlanComposerOptions {
    /// H4 "Sport".
    static let sports: [(value: String, label: String)] = [
        ("pickleball", "Pickleball"),
        ("basketball", "Basketball"),
        ("soccer", "Soccer"),
        ("tennis", "Tennis"),
        ("volleyball", "Volleyball"),
        ("running", "Running"),
        ("other", "Other")
    ]

    /// H4 "Level".
    static let levels: [(value: String, label: String)] = [
        ("any", "Any level"),
        ("casual", "Casual"),
        ("competitive", "Competitive")
    ]

    /// H5 "Kind".
    static let walkKinds: [(value: String, label: String)] = [
        ("walk", "Walk"),
        ("dog_walk", "Dog walk"),
        ("stroller_walk", "Stroller walk"),
        ("coffee", "Coffee")
    ]

    /// H5 "Pace".
    static let paces: [(value: String, label: String)] = [
        ("easy", "Easy"),
        ("brisk", "Brisk")
    ]

    static func sportLabel(_ value: String?) -> String {
        sports.first { $0.value == value }?.label ?? "Pickup game"
    }

    static func levelLabel(_ value: String) -> String {
        value == "any" ? "Any level" : levels.first { $0.value == value }?.label ?? value.capitalized
    }

    /// "paddles", "balls", "rackets": what the host has extra of.
    static func gearNoun(_ sport: String?) -> String {
        switch sport {
        case "pickleball": "paddles"
        case "tennis": "rackets"
        case "basketball", "soccer", "volleyball": "balls"
        default: "gear"
        }
    }

    static func ageLabel(_ band: PlanKidsAgeBand) -> String {
        switch band {
        case .under2: "Under 2"
        case .age2to3: "2–3"
        case .age4to5: "4–5"
        case .age6to8: "6–8"
        case .age9to12: "9–12"
        }
    }

    /// "Sam R." from a full display name, as other people will see it.
    static func publicName(_ displayName: String?) -> String {
        let words = (displayName ?? "").split(separator: " ")
        guard let first = words.first else { return "You" }
        guard words.count > 1, let last = words.last?.first else { return String(first) }
        return "\(first) \(last)."
    }
}
