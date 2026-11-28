//
//  MomentPinsOverlay.swift
//  Pantopus
//
//  The pins drawn on a Moment's picture in the viewer (CONTRACT 8b, `MomentPins.swift`), the spot being chosen for a
//  new one, and the card: the five signals for a new pin, or who dropped one with Remove and Report. Drawn only while
//  the switch is on and the Moment's replies are shown.
//

import SwiftUI

struct MomentPinsOverlay: View {
    let moment: MomentDTO
    /// The picture's own size; nil for a text card (the card's whole frame).
    let picture: CGSize?
    private let store = MomentPinsStore.shared
    @State private var reporting: MomentPinDTO?
    /// The open card's height: a drop card with a voice and cutouts is taller, and it keeps clear of its spot.
    @State private var cardHeight: CGFloat = 0

    var body: some View {
        if PulseReinventedFlags.shared.isOn, moment.together.replies?.shown == true {
            GeometryReader { geo in
                let frame = picture.map { MomentMarks.fill($0, in: geo.size) } ?? CGRect(origin: .zero, size: geo.size)
                ZStack {
                    if store.dropping == moment.id, store.spot == nil {
                        catcher(frame)
                    }
                    if !store.hidden {
                        ForEach(store.pins[moment.id] ?? []) { pin in
                            pinButton(pin)
                                .position(x: frame.minX + pin.x * frame.width, y: frame.minY + pin.y * frame.height)
                        }
                    }
                    if store.dropping == moment.id, let spot = store.spot {
                        Icon(.pin, size: 30, strokeWidth: 2.4, color: .white)
                            .shadow(color: .black.opacity(0.5), radius: 3)
                            .position(x: frame.minX + spot.x * frame.width, y: frame.minY + spot.y * frame.height - 14)
                            .accessibilityHidden(true)
                    }
                    if let card = cardKind {
                        // Beside its pin or spot, as a dot's card sits (above it in the lower half, below it in the
                        // upper), so the Moment's own caption at the bottom never covers it; always inside what
                        // shows on the screen.
                        let anchor = anchor(card, in: frame)
                        let shown = Self.shown(in: geo)
                        let width = min(shown.width - 32, 320)
                        let half = width / 2 + 16
                        let gap = max(110, cardHeight / 2 + 24)
                        cardView(card)
                            .frame(width: width)
                            .fixedSize(horizontal: false, vertical: true)
                            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { cardHeight = $0 }
                            .position(
                                x: min(max(anchor.x, shown.minX + half), max(shown.maxX - half, shown.minX + half)),
                                y: anchor.y > shown.minY + shown.height * 0.55 ? anchor.y - gap : anchor.y + gap
                            )
                    }
                }
            }
            .task(id: moment.id) { await store.load(moment) }
            .confirmationDialog(
                "Why are you reporting this pin?",
                isPresented: Binding(get: { reporting != nil }, set: { if !$0 { reporting = nil } }),
                titleVisibility: .visible,
                presenting: reporting
            ) { pin in
                ForEach(MomentsViewer.reportReasons, id: \.token) { reason in
                    Button(reason.label) { Task { await store.report(pin, on: moment.id, reason: reason.token) } }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    /// Takes the tap that chooses where the new pin goes (on the picture only). The tap is read in the picture's own
    /// frame (before it is positioned), so on a picture wider or taller than the screen the pin lands under the finger.
    private func catcher(_ frame: CGRect) -> some View {
        Color.white.opacity(0.001)
            .frame(width: frame.width, height: frame.height)
            .contentShape(Rectangle())
            .onTapGesture(coordinateSpace: .local) { point in
                store.spot = CGPoint(
                    x: min(max(point.x / max(frame.width, 1), 0), 1),
                    y: min(max(point.y / max(frame.height, 1), 0), 1)
                )
            }
            .position(x: frame.midX, y: frame.midY)
            .accessibilityLabel("Choose a spot on the picture for your pin")
            .accessibilityAddTraits(.isButton)
            .accessibilityIdentifier("moments.pins.catch")
    }

    private func pinButton(_ pin: MomentPinDTO) -> some View {
        Button {
            if pin.kind == "voice" { store.hear(pin) }
            store.dropping = nil
            store.note = nil
            store.open = store.open == pin.id ? nil : pin.id
        } label: {
            MomentPinFace(pin: pin)
                .frame(minWidth: 40, minHeight: 40)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(pin.spoken)
        .accessibilityIdentifier("moments.pins.pin")
    }

    private enum Card {
        case drop
        case pin(MomentPinDTO)
    }

    private var cardKind: Card? {
        if store.dropping == moment.id, store.spot != nil { return .drop }
        if let open = store.open, let pin = store.pins[moment.id]?.first(where: { $0.id == open }) { return .pin(pin) }
        return nil
    }

    /// The part of this layer that is on the screen, in its own coordinates. A video or a photo of another shape
    /// than the screen is drawn filling it, so the layer runs past the screen's edges (a 9:16 video by about 45
    /// points on each side of an iPhone); the card stays inside what shows.
    private static func shown(in geo: GeometryProxy) -> CGRect {
        let whole = CGRect(origin: .zero, size: geo.size)
        let global = geo.frame(in: .global)
        let window = UIApplication.shared.connectedScenes.lazy.compactMap { ($0 as? UIWindowScene)?.keyWindow?.bounds }.first
        guard let window else { return whole }
        let visible = global.intersection(window)
        guard !visible.isNull, visible.width > 120, visible.height > 120 else { return whole }
        return visible.offsetBy(dx: -global.minX, dy: -global.minY)
    }

    /// The point on screen the card belongs to: the chosen spot, or the open pin.
    private func anchor(_ card: Card, in frame: CGRect) -> CGPoint {
        switch card {
        case .drop:
            let spot = store.spot ?? CGPoint(x: 0.5, y: 0.5)
            return CGPoint(x: frame.minX + spot.x * frame.width, y: frame.minY + spot.y * frame.height)
        case let .pin(pin):
            return CGPoint(x: frame.minX + pin.x * frame.width, y: frame.minY + pin.y * frame.height)
        }
    }

    private func cardView(_ card: Card) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack {
                Text(cardTitle(card))
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Button { store.closeCard() } label: {
                    Icon(.x, size: 16, strokeWidth: 2.2, color: Theme.Color.appText)
                        .frame(width: 32, height: 32)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
                .accessibilityIdentifier("moments.pins.close")
            }
            switch card {
            case .drop:
                signalsRow
                MomentPinsMoreRow(moment: moment)
            case let .pin(pin): pinActions(pin)
            }
            if let note = store.note {
                Text(note)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("moments.pins.note")
            }
        }
        .padding(Spacing.s4)
        .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Theme.Color.appBg))
        .shadow(color: .black.opacity(0.25), radius: 10, y: 4)
        .environment(\.colorScheme, .light)
    }

    private func cardTitle(_ card: Card) -> String {
        switch card {
        case .drop: "Drop a pin here"
        case let .pin(pin): pin.author.map { $0.name.isEmpty ? "Someone" : $0.name } ?? "Someone"
        }
    }

    private var signalsRow: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(MomentSignal.allCases) { signal in
                Button { Task { await store.drop(signal, on: moment.id) } } label: {
                    VStack(spacing: 4) {
                        Icon(signal.icon, size: 22, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                        Text(signal.title)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(RoundedRectangle(cornerRadius: Radii.md).fill(Theme.Color.appSurface))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(store.busy)
                .accessibilityLabel(signal.title)
                .accessibilityIdentifier("moments.pins.signal.\(signal.rawValue)")
            }
        }
    }

    private func pinActions(_ pin: MomentPinDTO) -> some View {
        HStack(spacing: Spacing.s4) {
            if pin.kind == "voice", pin.audioURL != nil {
                Button("Play again") { store.hear(pin) }
                    .accessibilityIdentifier("moments.pins.play")
            }
            if pin.canRemove {
                Button("Remove") { Task { await store.remove(pin, on: moment.id) } }
                    .accessibilityIdentifier("moments.pins.remove")
            }
            if !pin.mine {
                Button("Report") { reporting = pin }
                    .accessibilityIdentifier("moments.pins.report")
            }
        }
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(Theme.Color.primaryTint)
        .buttonStyle(.plain)
    }
}

/// How a pin looks on the picture: its signal (or emoji), a voice bubble with its length, or the cutout.
struct MomentPinFace: View {
    let pin: MomentPinDTO

    var body: some View {
        switch pin.kind {
        case "cutout":
            if pin.checking || pin.imageURL == nil {
                bubble { Text("Checking…").font(.system(size: 12, weight: .semibold)) }
            } else {
                AsyncImage(url: pin.imageURL.flatMap(URL.init(string:))) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    Color.clear
                }
                .frame(width: 64, height: 64)
                .shadow(color: .black.opacity(0.4), radius: 3)
            }
        case "voice":
            bubble {
                HStack(spacing: 3) {
                    Icon(.mic, size: 14, strokeWidth: 2.2, color: Theme.Color.appText)
                    if let ms = pin.durationMs { Text("\(max(1, Int((ms / 1000).rounded())))s").font(.system(size: 12, weight: .semibold)) }
                }
            }
        default:
            bubble {
                if let signal = pin.signal.flatMap(MomentSignal.init(rawValue:)) {
                    Icon(signal.icon, size: 18, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                } else {
                    Text(pin.emoji ?? "•").font(.system(size: 18))
                }
            }
        }
    }

    private func bubble(@ViewBuilder _ content: () -> some View) -> some View {
        content()
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, 8)
            .frame(minWidth: 34, minHeight: 34)
            .background(Capsule().fill(Color.white.opacity(0.92)))
            .overlay(Capsule().stroke(pin.mine ? Theme.Color.primarySolid : Color.clear, lineWidth: 2))
            .shadow(color: .black.opacity(0.3), radius: 3, y: 1)
            .environment(\.colorScheme, .light)
    }
}
