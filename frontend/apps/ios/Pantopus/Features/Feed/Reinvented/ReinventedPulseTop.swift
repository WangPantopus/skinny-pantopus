//
//  ReinventedPulseTop.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 6 (PHASE-6 §2 A1): the new Pulse's top line, one row 44 pt high (the side menu, the scope
//  pill, Map | Atlas, the search lens, the chat button; pulled down, it drops the Filters sheet), and the pills under it
//  (what is filtered, what the map lit for its question; nothing when neither). Only drawn while `pulse_reinvented` is on.
//

import SwiftUI

struct ReinventedPulseTopLine: View {
    let model: ReinventedPulseModel
    let inAtlas: Bool
    /// Filters and When apply (not in My Atlas or Explore).
    let filtering: Bool
    @Binding var lensOpen: Bool
    @Binding var showsFilters: Bool
    let onMap: () -> Void
    let onAtlas: () -> Void
    @State private var showsDial = false

    var body: some View {
        // The round buttons are 36 drawn in 44 to the finger, so 2 pt between them still leaves 10 between the circles:
        // the room goes to the scope pill (it read "Aroun…" on a 402 pt iPhone).
        HStack(spacing: 2) {
            NavigationMenuButton(accessibilityIdentifier: "reinventedPulse.menu", floating: false)
                .background(Circle().fill(.regularMaterial).frame(width: 36, height: 36))
            scopePill
            viewSwitch
            lensButton
            MessagesButton(accessibilityIdentifier: "reinventedPulse.chat", floating: false)
                .background(Circle().fill(.regularMaterial).frame(width: 36, height: 36))
        }
        .frame(height: 44)
        .padding(.horizontal, Spacing.s3)
        .contentShape(Rectangle())
        .gesture(pullDown)
    }

    /// A pull down from the top line (the map's top) drops the Filters sheet (PHASE-6 A3, the gesture the founder asked for).
    private var pullDown: some Gesture {
        DragGesture(minimumDistance: 12)
            .onEnded { value in
                guard filtering, value.translation.height > 36,
                      value.translation.height > abs(value.translation.width) else { return }
                showsFilters = true
            }
    }

    /// The town's name (or Close circle, or Explore); it opens the reach dial.
    private var scopePill: some View {
        Button { showsDial = true } label: {
            HStack(spacing: 5) {
                Icon(scopeIcon, size: 14, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                Text(scopeTitle)
                    .pulseFont(sized: 13, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 10)
            .frame(height: 36)
            .background(Capsule().fill(.regularMaterial))
            .frame(minHeight: 44)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Showing \(scopeTitle). Change what Pulse shows")
        .accessibilityIdentifier("reinventedPulse.scope")
        .sheet(isPresented: $showsDial) {
            ReinventedReachDial(reach: model.reach, miles: model.miles, circle: model.circle) { reach, miles, circle in
                Task { await model.pick(reach: reach, miles: miles, circle: circle) }
            }
        }
    }

    private var scopeIcon: PantopusIcon {
        switch model.reach {
        case "close": .users
        case "explore": .globe
        default: .mapPin
        }
    }

    private var scopeTitle: String {
        switch model.reach {
        case "close": model.circle?.name ?? "Close circle"
        case "explore": "Explore"
        default: model.placeLabel.map { "\($0) · \(model.miles) mi" } ?? "Around me"
        }
    }

    /// Map | Atlas, small, in the top line (PHASE-6 A1: the List button is gone, the sheet is the list).
    private var viewSwitch: some View {
        HStack(spacing: 2) {
            switchButton("Map", on: !inAtlas, action: onMap)
            switchButton("Atlas", on: inAtlas, action: onAtlas)
        }
        .padding(2)
        .background(Capsule().fill(.regularMaterial))
        .fixedSize()
    }

    private func switchButton(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .pulseFont(sized: 13, weight: .semibold)
                .foregroundStyle(on ? Color.white : Theme.Color.appText)
                .padding(.horizontal, 8)
                .frame(height: 32)
                .background(Capsule().fill(on ? Theme.Color.primarySolid : Color.clear))
                .frame(minHeight: 44)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("reinventedPulse.view.\(title.lowercased())")
    }

    /// The search lens: one field for both jobs (Ask the map, and search).
    private var lensButton: some View {
        Button {
            withAnimation(.snappy(duration: 0.2)) { lensOpen = true }
        } label: {
            Icon(.search, size: 18, strokeWidth: 2.2, color: Theme.Color.appText)
                .frame(width: 36, height: 36)
                .background(Circle().fill(.regularMaterial))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Ask the map or search")
        .accessibilityIdentifier("reinventedPulse.lens")
    }
}

/// Under the top line: what is filtered, and what the map lit for its question.
struct ReinventedPulsePills: View {
    let map: ReinventedMapModel
    let filtering: Bool
    let onFilters: () -> Void
    let onClearFilters: () -> Void
    let onLens: () -> Void
    private let store = ReinventedPulseFilterStore.shared

    var body: some View {
        if filtering, store.count(time: map.time) > 0 {
            ReinventedFilterPill(words: store.words(time: map.time), onOpen: onFilters, onClear: onClearFilters)
        }
        if let asked = Self.askedLine(map: map) {
            ReinventedFilterPill(words: asked, onOpen: onLens) {
                ReinventedMapAsk.shared.clear()
            }
        }
    }

    /// How many pills show (the sheet's full rest stops under them).
    static func count(map: ReinventedMapModel, filtering: Bool) -> Int {
        let filtered = filtering && ReinventedPulseFilterStore.shared.count(time: map.time) > 0
        return (filtered ? 1 : 0) + (askedLine(map: map) == nil ? 0 : 1)
    }

    /// "3 lit for "cafe"", that nothing here matched, or why it couldn't ask.
    static func askedLine(map: ReinventedMapModel) -> String? {
        let ask = ReinventedMapAsk.shared
        if let error = ask.error { return error }
        guard let lit = ask.lit else { return nil }
        let shown = map.items.filter { lit.pins[$0.id] != nil }.count
        guard shown > 0 else { return "Nothing here for \u{201C}\(lit.q)\u{201D}" }
        return "\(shown) lit for \u{201C}\(lit.q)\u{201D}" + (lit.more ? ", and more" : "")
    }
}
