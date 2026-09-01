//
//  Theme.swift
//  Pantopus
//
//  Top-level namespace for design tokens. Feature code MUST access colors,
//  fonts, spacing, radii, and shadows through `Theme.*` — never via raw hex,
//  raw point values, or SwiftUI defaults. See Pantopus/README.md.
//

import SwiftUI

/// Top-level namespace for the Pantopus design system.
///
/// Usage: `Theme.Color.primary600`, `Theme.Font.h1`, `Spacing.s4`, `Radii.xl`,
/// `PantopusElevation.md`. This enum has no cases — it only exists to scope
/// the nested token namespaces.
public enum Theme {
    /// Color tokens sourced from the asset catalog under `Colors/`.
    public enum Color {}
    /// Type-ramp tokens. Prefer `Text(...).pantopusTextStyle(.h1)` over raw `.font()` calls.
    public enum Font {}

    /// Bundle that ships the design-system asset catalog.
    ///
    /// Unit tests have `Bundle.main` pointing at the test runner, not the
    /// Pantopus app, so token colors cannot be resolved without this
    /// indirection. `BundleToken` is defined inside the Pantopus target, so
    /// `Bundle(for:)` returns the app bundle at runtime and in tests.
    static let bundle = Bundle(for: BundleToken.self)

    private final class BundleToken {}
}
