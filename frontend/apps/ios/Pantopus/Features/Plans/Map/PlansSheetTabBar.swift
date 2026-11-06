//
//  PlansSheetTabBar.swift
//  Pantopus
//
//  Below full, the Plans sheet stops at the top of the tab bar. The sheet
//  is laid out at full and slides down by an offset, so at its lower stops
//  what follows the first lines lay under the floating tab bar: "Or start
//  something else" and the Host chips showed through and around it, and a
//  tap below the bar opened a Host chip hidden there. Android's sheet is
//  clipped to its box the same way (2026-10-23). At full the list still
//  scrolls under the bar.
//

import SwiftUI

extension PlansSheetLayout {
    /// How much of the sheet shows above the tab bar while its top is at `top`.
    func aboveTabBar(top: CGFloat) -> CGFloat {
        max(height - bottomInset - top, 0)
    }
}

extension View {
    /// A part of the sheet that VoiceOver skips while it lies under the tab bar at a lower stop, where the mask hides
    /// it, so a focus ring never lands on something that doesn't show. On a Group, each of its views is judged alone.
    func hiddenUnderPlansTabBar() -> some View {
        modifier(PlansSheetHiddenUnderTabBar())
    }
}

extension EnvironmentValues {
    /// How much of the sheet shows above the tab bar at its resting stop, from the sheet's top; nil at full and
    /// outside the sheet, where all of it shows.
    var plansSheetShownHeight: CGFloat? {
        get { self[PlansSheetShownHeightKey.self] }
        set { self[PlansSheetShownHeightKey.self] = newValue }
    }
}

/// The sheet's own coordinates, from its top; a drag's offset doesn't move them.
enum PlansSheetBody {
    static let space = "plansSheetBody"
}

private struct PlansSheetShownHeightKey: EnvironmentKey {
    static let defaultValue: CGFloat? = nil
}

private struct PlansSheetHiddenUnderTabBar: ViewModifier {
    @Environment(\.plansSheetShownHeight) private var shown
    @State private var top: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGFloat.self) { $0.frame(in: .named(PlansSheetBody.space)).minY } action: { top = $0 }
            .accessibilityHidden(shown.map { top >= $0 } ?? false)
    }
}

/// The mask: the part of the sheet above the tab bar, following a drag; all of it at full. A view of its own, so a
/// drag frame redraws only this beside the sheet's offset.
struct PlansSheetAboveTabBar: View {
    let drag: PlansSheetDrag
    let layout: PlansSheetLayout
    let stop: PlansSheetStop

    var body: some View {
        let shown = layout.aboveTabBar(top: drag.heldTop ?? layout.top(stop))
        Rectangle().frame(height: stop == .full ? layout.sheetHeight : shown)
    }
}

/// Below full, the part of the sheet under the tab bar: a tap beside or below the floating bar lands here, not on what
/// the mask hides. A drag there still moves the sheet.
struct PlansSheetUnderTabBar: View {
    let drag: PlansSheetDrag
    let layout: PlansSheetLayout
    let stop: PlansSheetStop

    var body: some View {
        Color.clear
            .frame(height: layout.bottomInset)
            .contentShape(Rectangle())
            .onTapGesture {}
            .accessibilityHidden(true)
            .offset(y: layout.aboveTabBar(top: drag.heldTop ?? layout.top(stop)))
    }
}
