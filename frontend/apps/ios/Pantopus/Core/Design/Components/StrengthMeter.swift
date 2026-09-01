//
//  StrengthMeter.swift
//  Pantopus
//
//  Four-rule password strength indicator used by A13.14 Change Password.
//  Renders a 4-segment progress bar + per-rule pill row. Sets a red "found
//  in breach data" pill when the caller-supplied `breached` flag is true.
//

import SwiftUI

/// Pure value type describing whether a candidate password satisfies the
/// four strength rules + the breach-data flag passed in by the caller.
/// Computed via `PasswordStrength.evaluate(_:breached:)` — no side effects.
public struct PasswordStrength: Sendable, Equatable {
    public let hasMinLength: Bool
    public let hasMixedCase: Bool
    public let hasNumber: Bool
    public let hasSymbol: Bool
    public let breached: Bool

    public init(
        hasMinLength: Bool,
        hasMixedCase: Bool,
        hasNumber: Bool,
        hasSymbol: Bool,
        breached: Bool = false
    ) {
        self.hasMinLength = hasMinLength
        self.hasMixedCase = hasMixedCase
        self.hasNumber = hasNumber
        self.hasSymbol = hasSymbol
        self.breached = breached
    }

    /// Number of rules satisfied (0...4). Breach flag does not change this
    /// count; the visual bar handles breach as a separate "force-red"
    /// overlay so the underlying rule status stays inspectable.
    public var rulesMet: Int {
        [hasMinLength, hasMixedCase, hasNumber, hasSymbol].lazy.filter { $0 }.count
    }

    public var isStrong: Bool {
        rulesMet == 4 && !breached
    }

    public static func evaluate(_ password: String, breached: Bool = false) -> PasswordStrength {
        let hasUpper = password.contains { $0.isUppercase }
        let hasLower = password.contains { $0.isLowercase }
        let hasNum = password.contains { $0.isNumber }
        let hasSym = password.contains { c in
            !c.isLetter && !c.isNumber && !c.isWhitespace
        }
        return PasswordStrength(
            hasMinLength: password.count >= 12,
            hasMixedCase: hasUpper && hasLower,
            hasNumber: hasNum,
            hasSymbol: hasSym,
            breached: breached
        )
    }
}

/// Strength meter for `PasswordField`. Four segments fill as the four rules
/// pass; pill row below shows each rule with check/x icon. When `breached`
/// is set, the bar paints fully red and a "Found in breach data" pill is
/// prepended to the rule row.
@MainActor
public struct StrengthMeter: View {
    private let strength: PasswordStrength

    public init(_ strength: PasswordStrength) {
        self.strength = strength
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            segmentBar
            ruleRow
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var segmentBar: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(0..<4, id: \.self) { index in
                Capsule(style: .continuous)
                    .fill(segmentFill(index: index))
                    .frame(height: 6)
            }
        }
    }

    private var ruleRow: some View {
        HStack(spacing: Spacing.s2) {
            if strength.breached {
                breachPill
            }
            rulePill("12+ characters", met: strength.hasMinLength)
            rulePill("Mixed case", met: strength.hasMixedCase)
            rulePill("Number", met: strength.hasNumber)
            rulePill("Symbol", met: strength.hasSymbol)
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func rulePill(_ label: String, met: Bool) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(
                met ? .check : .x,
                size: 11,
                strokeWidth: met ? 3 : 2,
                color: met ? Theme.Color.success : Theme.Color.appTextSecondary
            )
            Text(label)
                .font(.system(size: 11, weight: met ? .semibold : .medium))
                .foregroundStyle(met ? Theme.Color.success : Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(
            Capsule(style: .continuous)
                .fill(met ? Theme.Color.successBg : Theme.Color.errorLight.opacity(0.4))
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label), \(met ? "met" : "not met")")
    }

    private var breachPill: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldAlert, size: 11, color: Theme.Color.error)
            Text("Found in breach data")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.error)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(
            Capsule(style: .continuous)
                .fill(Theme.Color.errorBg)
        )
        .overlay(
            Capsule(style: .continuous)
                .stroke(Theme.Color.errorLight, lineWidth: 1)
        )
        .accessibilityLabel("Found in breach data")
    }

    private func segmentFill(index: Int) -> Color {
        if strength.breached { return Theme.Color.error }
        guard index < strength.rulesMet else { return Theme.Color.appSurfaceSunken }
        switch strength.rulesMet {
        case 4: return Theme.Color.success
        case 3: return Theme.Color.success.opacity(0.85)
        case 2: return Theme.Color.warning
        case 1: return Theme.Color.error.opacity(0.85)
        default: return Theme.Color.appSurfaceSunken
        }
    }

    private var accessibilityLabel: String {
        if strength.breached {
            return "Password strength: found in breach data, must be changed"
        }
        let labels = ["Add a password", "Weak", "Fair", "Good", "Strong"]
        let label = labels[min(strength.rulesMet, labels.count - 1)]
        return "Password strength: \(label), \(strength.rulesMet) of 4 rules met"
    }
}

#Preview("Strength meter states") {
    VStack(alignment: .leading, spacing: Spacing.s5) {
        ForEach([
            ("Empty", PasswordStrength.evaluate("")),
            ("Short", PasswordStrength.evaluate("abc")),
            ("Letters only", PasswordStrength.evaluate("abcdefghijkl")),
            ("Mixed", PasswordStrength.evaluate("abcDefghijkl")),
            ("With number", PasswordStrength.evaluate("abcDefghij12")),
            ("Strong", PasswordStrength.evaluate("abcDef1234!@")),
            ("Breached", PasswordStrength.evaluate("password12", breached: true))
        ], id: \.0) { entry in
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(entry.0).font(.system(size: 12, weight: .semibold))
                StrengthMeter(entry.1)
            }
        }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
