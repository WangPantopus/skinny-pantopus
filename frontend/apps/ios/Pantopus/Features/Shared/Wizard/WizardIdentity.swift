//
//  WizardIdentity.swift
//  Pantopus
//
//  Identity pillar applied to a `WizardShell`. Drives the progress rail
//  fill, the primary CTA background + shadow tint, and the chip colors
//  callers can use for an inline identity chip or a selected-state
//  accent inside a step.
//
//  The default identity is `.personal` (sky / primary600), so adding
//  this enum is fully additive — existing wizard call sites compile
//  unchanged and render identically.
//

import SwiftUI

/// Identity pillar applied to a `WizardShell`.
///
/// - `personal` — sky / `primary600` (default).
/// - `home` — green / `home` (home flows).
/// - `business` — violet / `business` (A12.10 Create Business).
/// - `warm` — porch amber / `warmAmber` (A12.11 Start Support Train).
public enum WizardIdentity: String, Sendable, CaseIterable {
    case personal
    case home
    case business
    case warm
}

public extension WizardIdentity {
    /// Fill color for the progress rail and the primary CTA background.
    var accent: Color {
        switch self {
        case .personal: Theme.Color.primary600
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        case .warm: Theme.Color.warmAmber
        }
    }

    /// Soft background paired with `accent` — the identity chip pill
    /// background and the selected-state row tint inside a step.
    var accentBg: Color {
        switch self {
        case .personal: Theme.Color.personalBg
        case .home: Theme.Color.homeBg
        case .business: Theme.Color.businessBg
        case .warm: Theme.Color.warmAmberBg
        }
    }

    /// Identity-tinted shadow for the primary CTA. Mirrors the existing
    /// `.primary` shadow recipe (`0 6px 16px rgba(accent, 0.18)`) so the
    /// `.personal` variant is visually identical to the legacy primary
    /// shadow callers got before this enum existed.
    var ctaShadow: PantopusShadow {
        PantopusShadow(color: accent, opacity: 0.18, radius: 16, x: 0, y: 6)
    }
}
