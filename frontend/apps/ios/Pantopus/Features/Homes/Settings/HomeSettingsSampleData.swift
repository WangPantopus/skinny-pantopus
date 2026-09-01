//
//  HomeSettingsSampleData.swift
//  Pantopus
//
//  P5.1 / A14.1 — Deterministic seed for the per-home Settings index.
//  Two frames cover the audit's required shapes:
//
//    `.populated`  — 14 Elm Park Lane, owned since last summer.
//                    Address verified, 4 members, codes + trusted
//                    neighbors configured. All rows carry meaningful
//                    subs.
//    `.pending`    — 42 Magnolia Court, newly claimed. Address chip
//                    flips to amber `Verifying`; the unconfigured
//                    rows read `Not set` or `Available after
//                    verification`. The destructive row becomes
//                    `Cancel claim`.
//
//  Backend persistence is out of scope for P5.1; the rows behave like
//  links + a destructive wind-down action and the VM stays purely
//  local. When the persistence API lands the same sample data backs
//  the snapshot baselines.
//

import Foundation

/// Per-frame seed for `HomeSettingsViewModel`. Mirrors the JSX
/// archetype in `docs/designs/A14/home-settings-frames.jsx` with the
/// audit's slot inventory layered on top.
public enum HomeSettingsSampleData {
    /// Which frame the data source should render.
    public enum Frame: Sendable, Hashable {
        /// Established home with verified address and full populated subs.
        case populated
        /// Newly claimed home with verifying chip + "Not set" subs.
        case pending
    }

    /// Static identity strip rendered above the first group.
    public struct Identity: Sendable, Equatable {
        public let homeName: String
        public let addressChipLabel: String
        public let addressChipTone: RowControl.ChipTone
    }

    /// Resolves the deterministic shape for a frame.
    public static func identity(for frame: Frame) -> Identity {
        switch frame {
        case .populated:
            Identity(
                homeName: "14 Elm Park Lane",
                addressChipLabel: "Verified",
                addressChipTone: .success
            )
        case .pending:
            Identity(
                homeName: "42 Magnolia Court",
                addressChipLabel: "Verifying",
                addressChipTone: .warning
            )
        }
    }

    /// Footer caption rendered under the destructive card.
    public static func footer(for frame: Frame) -> String {
        switch frame {
        case .populated: "14 Elm Park Lane · Owner since Jul 2024"
        case .pending: "42 Magnolia Court · Claim ID 8174"
        }
    }

    /// Frame the sample home for an opaque `homeId`. Test ids that
    /// start with `pending-` route to the pending frame; everything
    /// else lands on the populated frame.
    public static func frame(forHomeId homeId: String) -> Frame {
        homeId.hasPrefix("pending-") || homeId.localizedCaseInsensitiveContains("claim")
            ? .pending
            : .populated
    }
}
