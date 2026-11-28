//
//  ReinventedPulsePanel.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 6 (PHASE-6 §2 E, the founder's points 8 and 9): on a screen 700 pt wide or more (an iPad
//  either way up, the open iPhone Duo, an iPhone on its side) the map fills the screen and the list is a floating
//  panel at the left, 380 pt wide and 12 pt from the edges, rounded and frosted, under the top line. A tab on its right
//  edge folds it away to a 28 pt peek and back. The rail of round buttons stays at the right; only the part of the map
//  the panel leaves uncovered counts as "on the map". On the open Duo the panel keeps to the left half, so nothing of
//  it lies across the middle. Narrower (a phone upright, an iPad window beside another app under 700 pt) Pulse keeps
//  the phone's sheet (`ReinventedPulseSheet`). Only drawn while `pulse_reinvented` is on.
//

import SwiftUI

/// Where the list floats as a panel, and how wide it is.
enum ReinventedPulseColumns {
    /// From what width the list is a panel over the map.
    static let panelFrom: CGFloat = 700
    static let margin: CGFloat = 12
    static let peek: CGFloat = 28

    static func fits(width: CGFloat) -> Bool {
        width >= panelFrom
    }

    /// 380 pt, kept inside the left half (the open Duo's middle stays clear).
    static func panelWidth(in width: CGFloat) -> CGFloat {
        min(380, width / 2 - 2 * margin)
    }

    /// From what screen width the tab's reading column leaves the new Pulse the whole width.
    static var widensFrom: CGFloat {
        panelFrom
    }

    /// How much of the map's width, from the left, the panel covers (nothing while folded to its peek).
    static func covered(in width: CGFloat, folded: Bool) -> CGFloat {
        folded ? margin + peek : margin + panelWidth(in: width) + margin
    }
}

struct ReinventedPulsePanel<Header: View, Accessory: View, Content: View, Add: View, Rail: View>: View {
    @Binding var folded: Bool
    let width: CGFloat
    /// The top line and its pills, over the panel (they stay when it folds: the side menu is always there).
    let header: Header
    /// "23 here · Live", over the list.
    let line: String
    /// Dimmed while the list's new read is out (PHASE-6 H).
    var lineDimmed = false
    /// "No place", beside the line.
    let accessory: Accessory
    /// The list, or My Atlas.
    let content: Content
    let add: Add
    /// The rail of round buttons at the map's right edge.
    let rail: Rail

    var body: some View {
        let panelWidth = ReinventedPulseColumns.panelWidth(in: width)
        ZStack(alignment: .topLeading) {
            rail
                .padding(.top, Spacing.s16)
                .padding(.trailing, Spacing.s3)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                header
                    .frame(width: panelWidth + 2 * ReinventedPulseColumns.margin, alignment: .leading)
                panel(width: panelWidth)
                    .padding(.leading, ReinventedPulseColumns.margin)
                    .padding(.bottom, ReinventedPulseColumns.margin)
                    .offset(x: folded ? -(panelWidth + ReinventedPulseColumns.margin - ReinventedPulseColumns.peek) : 0)
            }
        }
    }

    private func panel(width panelWidth: CGFloat) -> some View {
        VStack(spacing: Spacing.s0) {
            HStack(spacing: Spacing.s2) {
                Text(line)
                    .pulseFont(sized: 13, weight: .semibold)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .opacity(lineDimmed ? 0.45 : 1)
                    .lineLimit(1)
                Spacer(minLength: 0)
                accessory
            }
            .padding(.leading, Spacing.s4)
            .padding(.trailing, ReinventedPulseColumns.peek + Spacing.s1)
            .frame(minHeight: 44)
            .accessibilityIdentifier("reinventedPulse.panel.line")
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .opacity(folded ? 0 : 1)
                .allowsHitTesting(!folded)
                .accessibilityHidden(folded)
        }
        .frame(width: panelWidth)
        .frame(maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(.regularMaterial))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .shadow(color: .black.opacity(0.14), radius: 10, y: 2)
        .overlay(alignment: .topTrailing) { foldTab }
        .overlay(alignment: .bottomTrailing) {
            if !folded {
                add
                    .padding(.trailing, Spacing.s4)
                    .padding(.bottom, Spacing.s4)
            }
        }
        .accessibilityIdentifier("reinventedPulse.panel")
    }

    /// The tab on the panel's right edge: folds it away to a peek, and back.
    private var foldTab: some View {
        Button {
            withAnimation(.interpolatingSpring(duration: 0.35, bounce: 0.14)) { folded.toggle() }
        } label: {
            Icon(folded ? .chevronRight : .chevronLeft, size: 16, strokeWidth: 2.4, color: Theme.Color.appText)
                .frame(width: ReinventedPulseColumns.peek, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(width: 44, height: 44, alignment: .trailing)
        .accessibilityLabel(folded ? "Show the list" : "Fold the list away")
        .accessibilityIdentifier("reinventedPulse.panel.fold")
    }
}
