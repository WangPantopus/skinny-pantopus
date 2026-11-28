//
//  ReinventedPulseRail.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 6 (PHASE-6 §2 A1, A2): what sits on the map besides the sheet. The top line, one row 44 pt
//  high: the side menu, the scope pill, Map | Atlas, the search lens and the chat button; the lens is one field for
//  both jobs, its first suggestion "Ask the map: …". A rail of small round buttons down the right edge: Filters (a dot
//  with the count when any is on), When (the choice in a letter or two), Listen and My place; a tap opens that control
//  as a small card beside the button. The rail fades while the map moves. One small pill under the top line says what
//  is filtered, with ✕; nothing shows when nothing is. These replace the chips row, the time row, the Ask bar and the
//  Listen button at the top. Only drawn while `pulse_reinvented` is on.
//

import MapKit
import SwiftUI

/// The rail down the right edge.
struct ReinventedPulseRail: View {
    enum Card {
        case when, listen
    }

    let map: ReinventedMapModel
    /// Filters and When: not in My Atlas or Explore.
    let filtering: Bool
    let onFilters: () -> Void
    @State private var card: Card?
    private let store = ReinventedPulseFilterStore.shared
    private let town = ReinventedTownSound.shared

    static var button: CGFloat {
        36
    }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            if let card {
                cardView(card)
                    .padding(.top, top(of: card))
                    .transition(.opacity.combined(with: .move(edge: .trailing)))
            }
            VStack(spacing: Spacing.s2) {
                if filtering {
                    railButton(.slidersHorizontal, label: filtersLabel, id: "filters", lit: !isClear) {
                        card = nil
                        onFilters()
                    }
                    .overlay(alignment: .topTrailing) { if !isClear { countDot } }
                    railButton(nil, label: "When: \(whenTitle)", id: "when", lit: card == .when, letters: whenLetters) {
                        withAnimation(.snappy(duration: 0.2)) { card = card == .when ? nil : .when }
                    }
                }
                railButton(
                    .volume2,
                    label: town.listening ? "Stop listening to the town" : "Listen to the town",
                    id: "listen",
                    lit: town.listening
                ) {
                    town.toggle()
                    withAnimation(.snappy(duration: 0.2)) { card = town.listening ? .listen : nil }
                }
                railButton(.locateFixed, label: "Back to where I am", id: "myPlace", lit: false) {
                    card = nil
                    withAnimation(.easeInOut(duration: 0.5)) { map.position = .userLocation(fallback: .automatic) }
                }
            }
        }
        .opacity(map.moving ? 0.4 : 1)
        .animation(.easeOut(duration: 0.2), value: map.moving)
        .onChange(of: town.listening) { _, listening in if !listening, card == .listen { card = nil } }
        .onDisappear { town.stop() }
        .accessibilityIdentifier("reinventedPulse.rail")
    }

    private var count: Int {
        store.count(time: map.time)
    }

    private var isClear: Bool {
        store.count(time: map.time) == 0
    }

    private var filtersLabel: String {
        isClear ? "Filters" : "Filters, \(count) on"
    }

    private var whenTitle: String {
        ReinventedMapModel.times.first { $0.key == map.time }?.title ?? "Live"
    }

    /// The When in a letter or two: "Now", "Td", "Wk", "All", "Tn", "We".
    private var whenLetters: String {
        switch map.time {
        case "today": "Td"
        case "week": "Wk"
        case "all": "All"
        case "tonight": "Tn"
        case "weekend": "We"
        default: "Now"
        }
    }

    /// The card opens beside its own button.
    private func top(of card: Card) -> CGFloat {
        let index = switch card {
        case .when: 1
        case .listen: filtering ? 2 : 0
        }
        return CGFloat(index) * (Self.button + Spacing.s2)
    }

    private var countDot: some View {
        Text("\(count)")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .frame(minWidth: 16, minHeight: 16)
            .background(Circle().fill(Theme.Color.primarySolid))
            .offset(x: 4, y: -4)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    private func railButton(
        _ icon: PantopusIcon?,
        label: String,
        id: String,
        lit: Bool,
        letters: String? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Group {
                if let icon {
                    Icon(icon, size: 18, strokeWidth: 2.2, color: lit ? .white : Theme.Color.appText)
                } else {
                    Text(letters ?? "")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(lit ? Color.white : Theme.Color.appText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            .frame(width: Self.button, height: Self.button)
            .background(Circle().fill(lit ? AnyShapeStyle(Theme.Color.primarySolid) : AnyShapeStyle(.regularMaterial)))
            .overlay(Circle().stroke(Theme.Color.appBorder.opacity(lit ? 0 : 0.6), lineWidth: 0.5))
            .shadow(color: .black.opacity(0.12), radius: 3, y: 1)
            // 44 pt to the finger, 36 drawn.
            .frame(width: 44, height: 44)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .frame(height: Self.button)
        .accessibilityLabel(label)
        .accessibilityAddTraits(lit ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("reinventedPulse.rail.\(id)")
    }

    @ViewBuilder
    private func cardView(_ card: Card) -> some View {
        switch card {
        case .when:
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(ReinventedMapModel.times, id: \.key) { time in
                        let on = map.time == time.key
                        Button {
                            map.pick(time: time.key)
                            withAnimation(.snappy(duration: 0.2)) { self.card = nil }
                        } label: {
                            Text(time.title)
                                .pulseFont(sized: 13, weight: .semibold)
                                .foregroundStyle(on ? Color.white : Theme.Color.appText)
                                .padding(.horizontal, 10)
                                .frame(height: 28)
                                .background(Capsule().fill(on ? Theme.Color.primarySolid : Theme.Color.appSurface))
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                        .accessibilityIdentifier("reinventedPulse.time.\(time.key)")
                    }
                }
                .padding(.horizontal, Spacing.s2)
            }
            .frame(maxWidth: 260, maxHeight: 44)
            .background(Capsule().fill(.regularMaterial))
            .accessibilityIdentifier("reinventedPulse.rail.whenCard")
        case .listen:
            Text(ReinventedListenButton.said ?? "Listening to the town.")
                .pulseFont(sized: 12, weight: .semibold)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(2)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .frame(maxWidth: 220, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(.regularMaterial))
                .accessibilityIdentifier("reinventedPulse.rail.listenCard")
        }
    }
}

/// The one small glass pill under the top line while anything is filtered (or the map lit what it was asked), with ✕.
struct ReinventedFilterPill: View {
    let words: String
    let onOpen: () -> Void
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Button(action: onOpen) {
                Text(words)
                    .pulseFont(sized: 12, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .padding(.leading, Spacing.s3)
                    .frame(minHeight: 32)
                    // 32 drawn, 44 to the finger.
                    .contentShape(Rectangle().inset(by: -6))
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens what is filtered")
            .accessibilityIdentifier("reinventedPulse.filterPill")
            Button(action: onClear) {
                Icon(.x, size: 13, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                    .frame(width: 32, height: 32)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .frame(width: 32, height: 32)
            .accessibilityLabel("Clear")
            .accessibilityIdentifier("reinventedPulse.filterPill.clear")
        }
        .background(Capsule().fill(.regularMaterial))
        .shadow(color: .black.opacity(0.1), radius: 3, y: 1)
    }
}

/// The search lens opened: one field for both jobs. Its first suggestion asks the map; the next searches the Atlas.
struct ReinventedLensField: View {
    let map: ReinventedMapModel
    let onClose: () -> Void
    let onSearchAtlas: (String) -> Void
    @State private var text = ""
    @FocusState private var typing: Bool
    private let ask = ReinventedMapAsk.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: Spacing.s2) {
                Icon(.search, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                TextField("Ask the map or search", text: $text)
                    .pulseFont(sized: 14)
                    .foregroundStyle(Theme.Color.appText)
                    .submitLabel(.search)
                    .focused($typing)
                    .onSubmit(askMap)
                    .accessibilityIdentifier("reinventedPulse.lens.field")
                if ask.asking { ProgressView().controlSize(.small) }
                Button("Cancel") {
                    text = ""
                    onClose()
                }
                .pulseFont(sized: 14, weight: .semibold)
                .frame(minHeight: 44)
                .accessibilityIdentifier("reinventedPulse.lens.cancel")
            }
            .padding(.leading, Spacing.s3)
            .padding(.trailing, Spacing.s2)
            .frame(height: 40)
            .background(Capsule().fill(.regularMaterial))
            let words = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !words.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    suggestion(icon: .sparkles, "Ask the map: \u{201C}\(words)\u{201D}", id: "ask", action: askMap)
                    Divider()
                    suggestion(icon: .bookmark, "Search your Atlas for \u{201C}\(words)\u{201D}", id: "atlas") {
                        onSearchAtlas(words)
                    }
                }
                .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(.regularMaterial))
            }
        }
        .onAppear { typing = true }
    }

    private func askMap() {
        let words = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !words.isEmpty else { return }
        ask.ask(words, items: map.items)
        onClose()
    }

    private func suggestion(icon: PantopusIcon, _ title: String, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 16, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                Text(title)
                    .pulseFont(sized: 14)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("reinventedPulse.lens.\(id)")
    }
}
