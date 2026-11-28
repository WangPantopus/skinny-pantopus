//
//  ReinventedPulseSideBySide.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 1 (PHASE-1 §2.2): on an iPad and the open iPhone Duo held sideways, List and Map sit
//  side by side. Pulse opens with the list in a phone-wide column on the left (the top row, the switch and the chips
//  over it) and the map filling the rest, with the rail of round buttons at its right edge. Map fills the window with the map, the top
//  row and the switch at the top left and the deck along the bottom; tapping the lit Map again goes back to both.
//  (The list alone, the full rest, is reached from My Atlas.) The column is the one "Verified homes nearby" puts
//  beside its map (`SideBySideColumnWidth.nearby`), so a screen too narrow for it (a phone, the Duo upright, an iPad
//  window beside another app) keeps the list resting over the map (`ReinventedPulseView`). Only drawn while
//  `pulse_reinvented` is on.
//

import SwiftUI

/// Where the list and the map go side by side, and how wide the list's column is.
enum ReinventedPulseColumns {
    /// The list's column, a phone's width.
    static var column: CGFloat {
        SideBySideColumnWidth.nearby.ideal
    }

    /// Whether the list and the map go side by side in a screen this wide: regular width (an iPad, the Duo open)
    /// holding the column with the narrowest iPhone's width beside it.
    static func fits(width: CGFloat, sizeClass: UserInterfaceSizeClass?) -> Bool {
        sizeClass == .regular && SideBySideColumnWidth.nearby.fitsBeside(in: width)
    }

    /// From what screen width the tab's reading column leaves the new Pulse the whole width.
    static func widensFrom(sizeClass: UserInterfaceSizeClass?) -> CGFloat {
        sizeClass == .regular ? SideBySideColumnWidth.nearby.screenWidthBeside : .infinity
    }

    /// Where the map starts: past the column and its line while both show, at the screen's edge otherwise.
    static func mapInset(_ height: ReinventedPulseView.Height, sideBySide: Bool) -> CGFloat {
        sideBySide && height == .half ? column + 1 : 0
    }
}

struct ReinventedPulseSideBySide<Header: View, Content: View, Add: View, Rail: View>: View {
    let height: ReinventedPulseView.Height
    let map: ReinventedMapModel
    let header: Header
    /// The list, or My Atlas.
    let content: Content
    let add: Add
    /// The rail of round buttons at the map's right edge (PHASE-6 A2).
    let rail: Rail
    let onOpen: (ReinventedMapModel.Item) -> Void

    var body: some View {
        switch height {
        case .half: both
        case .full: listAlone
        case .peek: mapAlone
        }
    }

    /// The list in its column, a line, and the map (drawn behind) with the rail over it.
    private var both: some View {
        HStack(alignment: .top, spacing: Spacing.s0) {
            VStack(spacing: Spacing.s0) {
                header.padding(.bottom, Spacing.s2)
                content
            }
            .frame(width: ReinventedPulseColumns.column)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Theme.Color.appBg.ignoresSafeArea())
            .overlay(alignment: .bottomTrailing) { addButton }
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(width: 1)
                .ignoresSafeArea()
            // Clear but for the rail, so the map behind takes every other touch.
            railOverMap
        }
    }

    /// The list over the whole window, in the reading column.
    private var listAlone: some View {
        VStack(spacing: Spacing.s0) {
            header.padding(.bottom, Spacing.s2)
            content
        }
        .readableColumn()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appBg.ignoresSafeArea())
        .overlay(alignment: .bottomTrailing) { addButton }
    }

    /// The map over the whole window: the header at the top left, the deck along the bottom.
    private var mapAlone: some View {
        ZStack(alignment: .topLeading) {
            railOverMap
            header
                .frame(width: ReinventedPulseColumns.column)
            ReinventedPeekDeck(model: map, onOpen: onOpen)
                .frame(maxWidth: Self.deckWidth)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                .padding(.bottom, 76)
        }
    }

    /// The rail at the map's right edge, under the open Duo's clock corner.
    private var railOverMap: some View {
        rail
            .padding(.top, Spacing.s16)
            .padding(.trailing, Spacing.s3)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
    }

    /// The deck's cards keep a phone card's width on a big screen.
    private static var deckWidth: CGFloat {
        SideBySideColumnWidth.nearby.max + 80
    }

    /// + where the phone has it: the bottom right of the list.
    private var addButton: some View {
        add
            .padding(.trailing, Spacing.s4)
            .padding(.bottom, 92)
    }
}
