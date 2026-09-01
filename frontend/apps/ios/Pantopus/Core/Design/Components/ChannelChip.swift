//
//  ChannelChip.swift
//  Pantopus
//
//  22×22 mono-letter chip used by A14.5 Notifications to stamp the
//  Push / Email / SMS toggle matrix on each category row. Three states:
//  on (primary600 fill, white glyph), off (surface fill, muted glyph),
//  locked (sky bg + lock micro-icon overlay — used by the Emergency
//  alerts row, which can't be muted on push). `ChannelTriad` is the
//  row-layout helper that wires the standard P/E/S triplet.
//

import SwiftUI

/// Which channel a `ChannelChip` represents. `letter` is the glyph that
/// renders inside the chip; `fullName` is the spoken accessibility name.
/// Mirrors `ChannelGlyph` on Android.
public enum ChannelGlyph: String, Sendable, CaseIterable {
    case p = "P"
    case e = "E"
    case s = "S"

    public var letter: String {
        rawValue
    }

    public var fullName: String {
        switch self {
        case .p: "Push"
        case .e: "Email"
        case .s: "SMS"
        }
    }
}

/// Three-way state for a `ChannelChip`. `locked` is a "forced on,
/// untoggleable" state used for Emergency alerts (push); it draws a small
/// lock glyph in the corner and ignores tap.
public enum ChannelState: Sendable, Equatable {
    case on
    case off
    case locked
}

/// One channel chip — 22pt square with a single mono letter inside. Tap
/// fires `onTap` for on/off; `locked` swallows taps.
@MainActor
public struct ChannelChip: View {
    private let glyph: ChannelGlyph
    private let state: ChannelState
    private let onTap: (() -> Void)?

    public init(
        glyph: ChannelGlyph,
        state: ChannelState,
        onTap: (() -> Void)? = nil
    ) {
        self.glyph = glyph
        self.state = state
        self.onTap = onTap
    }

    /// Test seam — mirrors the locked-state guard inside `body` so the
    /// "locked chip swallows taps" contract can be unit-tested without
    /// driving a real touch through XCUITest.
    func handleTap() {
        guard state != .locked else { return }
        onTap?()
    }

    public var body: some View {
        Button(action: handleTap) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(fillColor)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .stroke(borderColor, lineWidth: 1)
                    )
                Text(glyph.letter)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(foregroundColor)
                if state == .locked {
                    lockBadge
                }
            }
            .frame(width: 22, height: 22)
        }
        .buttonStyle(.plain)
        .disabled(state == .locked || onTap == nil)
        .accessibilityLabel("\(glyph.fullName) notifications")
        .accessibilityValue(accessibilityValue)
        .accessibilityHint(state == .locked ? "Locked on" : "Toggles \(glyph.fullName)")
    }

    private var lockBadge: some View {
        Circle()
            .fill(Theme.Color.appSurface)
            .frame(width: 11, height: 11)
            .overlay(
                Circle().stroke(Theme.Color.primary300, lineWidth: 0.5)
            )
            .overlay(
                Icon(.lock, size: 7, color: Theme.Color.primary700)
            )
            .offset(x: 8, y: -8)
    }

    private var fillColor: Color {
        switch state {
        case .on: Theme.Color.primary600
        case .off: Theme.Color.appSurface
        case .locked: Theme.Color.primary100
        }
    }

    private var borderColor: Color {
        switch state {
        case .on: Theme.Color.primary600
        case .off: Theme.Color.appBorder
        case .locked: Theme.Color.primary300
        }
    }

    private var foregroundColor: Color {
        switch state {
        case .on: Theme.Color.appTextInverse
        case .off: Theme.Color.appTextMuted
        case .locked: Theme.Color.primary700
        }
    }

    private var accessibilityValue: String {
        switch state {
        case .on: "On"
        case .off: "Off"
        case .locked: "Locked on"
        }
    }
}

/// Three-chip row layout (P / E / S) — the standard A14.5 notifications row
/// trailing slot. The Bool initialiser is the common case (on/off only);
/// the rich initialiser surfaces per-chip locked state for rows like
/// "Emergency alerts" where push can't be muted.
@MainActor
public struct ChannelTriad: View {
    private let p: ChannelState
    private let e: ChannelState
    private let s: ChannelState
    private let onTap: ((ChannelGlyph) -> Void)?

    public init(
        p: Bool,
        e: Bool,
        s: Bool,
        onTap: ((ChannelGlyph) -> Void)? = nil
    ) {
        self.p = p ? .on : .off
        self.e = e ? .on : .off
        self.s = s ? .on : .off
        self.onTap = onTap
    }

    public init(
        p: ChannelState,
        e: ChannelState,
        s: ChannelState,
        onTap: ((ChannelGlyph) -> Void)? = nil
    ) {
        self.p = p
        self.e = e
        self.s = s
        self.onTap = onTap
    }

    public var body: some View {
        HStack(spacing: Spacing.s1) {
            ChannelChip(glyph: .p, state: p, onTap: tapHandler(for: .p))
            ChannelChip(glyph: .e, state: e, onTap: tapHandler(for: .e))
            ChannelChip(glyph: .s, state: s, onTap: tapHandler(for: .s))
        }
    }

    private func tapHandler(for glyph: ChannelGlyph) -> (() -> Void)? {
        guard let onTap else { return nil }
        return { onTap(glyph) }
    }
}

#Preview("Channel chips") {
    VStack(alignment: .leading, spacing: Spacing.s4) {
        Text("Triad — on/off mix").font(.system(size: 12, weight: .semibold))
        ChannelTriad(p: true, e: false, s: false)
        ChannelTriad(p: true, e: true, s: false)
        ChannelTriad(p: true, e: true, s: true)
        Text("Locked push (emergency)").font(.system(size: 12, weight: .semibold))
        ChannelTriad(p: .locked, e: .on, s: .off)
        Text("Individual chips").font(.system(size: 12, weight: .semibold))
        HStack(spacing: Spacing.s3) {
            ChannelChip(glyph: .p, state: .on)
            ChannelChip(glyph: .e, state: .off)
            ChannelChip(glyph: .s, state: .locked)
        }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
