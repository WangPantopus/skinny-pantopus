//
//  WalletPalette.swift
//  Pantopus
//
//  A10.10 — bespoke Wallet swatches that don't map 1:1 onto the
//  design-system palette. The two callouts are intentional design
//  decisions logged in `docs/token-drift-color.md`:
//    * `amberDeep` (Tailwind amber-800 92400E) sits between
//      `warning` (D97706) and `warmAmber` (B45309) — used for
//      the pending chip text + amber-row amount.
//    * `chaseBlue{Dark,Light}` (Tailwind blue-900 → blue-600) renders
//      the "physical Chase debit card" gradient; the sky-primary
//      scale reads as a brand surface, not a real card.
//
//  Both colors live in a dedicated palette file so the hex-grep guard
//  has a single, documented exemption per the established convention
//  (mirrors `Features/Homes/Bills/UtilityCategoryPalette.swift` &c.).
//

import SwiftUI

enum WalletPalette {
    /// Tailwind amber-800 92400E. Pending-chip foreground and
    /// amber-row amount colour in the wallet design.
    static let amberDeep = Color(red: 0x92 / 255, green: 0x40 / 255, blue: 0x0E / 255)
    /// Chase card gradient dark stop — Tailwind blue-900 1E3A8A.
    static let chaseBlueDark = Color(red: 0x1E / 255, green: 0x3A / 255, blue: 0x8A / 255)
    /// Chase card gradient light stop — Tailwind blue-600 2563EB.
    static let chaseBlueLight = Color(red: 0x25 / 255, green: 0x63 / 255, blue: 0xEB / 255)
}
