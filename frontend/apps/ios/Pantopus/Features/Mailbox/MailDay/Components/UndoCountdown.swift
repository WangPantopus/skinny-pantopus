//
//  UndoCountdown.swift
//  Pantopus
//
//  A13.16 — 5-second undo chip on the latest reviewed row. Renders as a
//  warm-amber pill with a leading rewind glyph and a mono "Undo · Ns"
//  label that ticks down once a second.
//
//  The chip pairs with `MailDayViewModel.tickUndo()` (driven by the
//  view's `TimelineView` loop) so the seconds left stays in sync with
//  the row's `undoCountdown` field.
//

import SwiftUI

struct UndoCountdown: View {
    let seconds: Int
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s1) {
                Icon(.refreshCw, size: 11, strokeWidth: 2.4, color: undoForeground)
                Text("Undo · \(seconds)s")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(undoForeground)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, Spacing.s1)
            .background(Theme.Color.warmAmberBg)
            .overlay(
                Capsule().stroke(Theme.Color.warningLight, lineWidth: 1)
            )
            .clipShape(Capsule())
            .frame(minHeight: 28)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Undo — \(seconds) seconds remaining")
        .accessibilityIdentifier("mailDayUndoCountdown")
    }

    /// `0x92400E` — amber-800. The design uses this dark-amber for the
    /// timer's text + glyph so the warning chip reads as urgent. Not in
    /// the token set — documented as a per-feature exception (matches
    /// the access-codes lockbox tone).
    private var undoForeground: Color {
        Color(red: 0x92 / 255.0, green: 0x40 / 255.0, blue: 0x0E / 255.0)
    }
}
