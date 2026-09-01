//
//  CeremonialMailContent.swift
//  Pantopus
//
//  Render-only models + enums for the T3.7 Ceremonial Mail Compose
//  wizard. The four-moment flow:
//  1. Decide who and why (recipient + intent)
//  2. Verify the address
//  3. Compose the letter (stationery + ink + body + voice + seal)
//  4. Commit and send (send timing)
//

import Foundation

/// The four ordered steps in the wizard. Numbered so the chrome
/// readout reads "1 of 4 / 2 of 4 / 3 of 4 / 4 of 4".
public enum CeremonialMailStep: Int, CaseIterable, Sendable {
    case decide = 0
    case verify
    case compose
    case commit
    case success

    public var stepNumber: Int? {
        switch self {
        case .decide: 1
        case .verify: 2
        case .compose: 3
        case .commit: 4
        case .success: nil
        }
    }

    public static let progressTotal: Int = 4
}

/// Why the letter is being sent. Drives copy + recommended
/// stationery on the compose step.
public enum CeremonialMailIntent: String, CaseIterable, Sendable, Identifiable {
    case sayHello = "say_hello"
    case congratulations
    case condolences
    case businessNote = "business_note"
    case justBecause = "just_because"

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .sayHello: "Say hello"
        case .congratulations: "Congratulations"
        case .condolences: "Condolences"
        case .businessNote: "Business note"
        case .justBecause: "Just because"
        }
    }

    public var subtitle: String {
        switch self {
        case .sayHello: "A quick warm check-in."
        case .congratulations: "Celebrate something good."
        case .condolences: "Steady through a hard moment."
        case .businessNote: "Keep it professional."
        case .justBecause: "Send a thought, no occasion needed."
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .sayHello: .send
        case .congratulations: .star
        case .condolences: .heart
        case .businessNote: .briefcase
        case .justBecause: .pencil
        }
    }
}

public enum CeremonialMailStationery: String, CaseIterable, Sendable, Identifiable {
    case classicCream = "classic_cream"
    case midnightBlue = "midnight_blue"
    case linen
    case botanical

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .classicCream: "Classic cream"
        case .midnightBlue: "Midnight blue"
        case .linen: "Linen white"
        case .botanical: "Botanical"
        }
    }
}

public enum CeremonialMailInk: String, CaseIterable, Sendable, Identifiable {
    case walnut
    case navy
    case sepia
    case forest

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .walnut: "Walnut"
        case .navy: "Navy"
        case .sepia: "Sepia"
        case .forest: "Forest"
        }
    }
}

public enum CeremonialMailSeal: String, CaseIterable, Sendable, Identifiable {
    case waxRed = "wax_red"
    case waxBlue = "wax_blue"
    case waxBlack = "wax_black"
    case none

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .waxRed: "Red wax"
        case .waxBlue: "Blue wax"
        case .waxBlack: "Black wax"
        case .none: "No seal"
        }
    }
}

public enum CeremonialMailSendTiming: String, CaseIterable, Sendable, Identifiable {
    case now
    case morning
    case tomorrow

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .now: "Send now"
        case .morning: "Tomorrow morning"
        case .tomorrow: "Tomorrow evening"
        }
    }

    public var subtitle: String {
        switch self {
        case .now: "Deliver as soon as the recipient opens Pantopus."
        case .morning: "Land in their inbox at 8 a.m. local time."
        case .tomorrow: "Land in their inbox at 6 p.m. local time."
        }
    }
}

/// Voice-postscript recording state. Recording lives in the view
/// layer; the VM only owns the resolved URL.
public enum VoicePostscriptStatus: Sendable, Hashable {
    case empty
    case recording
    case captured(localUri: String)
    case uploading
    case uploaded(remoteUrl: String)
    case error(message: String)
}

/// Outbound nav event the host should react to.
public enum CeremonialMailEvent: Sendable, Equatable {
    case dismiss
    case openMail(mailId: String)
}
