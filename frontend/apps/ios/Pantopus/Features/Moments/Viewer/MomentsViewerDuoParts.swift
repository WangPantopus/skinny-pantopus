//
//  MomentsViewerDuoParts.swift
//  Pantopus
//
//  Pieces of watching that only the iPhone Duo uses: the side strip's round
//  buttons when it's closed (board C3), and the blurred copy of a Moment
//  that fills a wide screen around it (board U2).
//

import SwiftUI

/// Closed (board C3): Close, More and, on a video, Sound in the side strip, 44-pt round buttons on a faint white fill,
/// under the clock and clear of anything else the system keeps there; the reaction button at the strip's bottom.
struct MomentsStripButtons: View {
    struct Item: Identifiable {
        let id: String
        let icon: PantopusIcon
        let label: String
        /// The reaction already chosen, shown in place of the icon.
        var emoji: String?
        /// Dimmed and not tappable (the camera's flash while there's no camera).
        var enabled = true
        let action: () -> Void
    }

    let screen: MomentsDuoScreen
    /// How tall the strip is above the keyboard.
    let height: CGFloat
    let top: [Item]
    let bottom: Item?

    private static let size: CGFloat = 44
    private static let gap: CGFloat = 12

    var body: some View {
        let x = screen.strip.midX
        let tops = Self.tops(count: top.count, screen: screen)
        ZStack(alignment: .topLeading) {
            ForEach(Array(top.enumerated()), id: \.element.id) { index, item in
                button(item).position(x: x, y: tops[index] + Self.size / 2)
            }
            if let bottom, let y = Self.bottomTop(screen: screen, height: height, below: tops.last) {
                button(bottom).position(x: x, y: y + Self.size / 2)
            }
        }
        .frame(width: screen.size.width, height: height, alignment: .topLeading)
    }

    private func button(_ item: Item) -> some View {
        Button(action: item.action) {
            Group {
                if let emoji = item.emoji {
                    Text(emoji).font(.system(size: 24))
                } else {
                    Icon(item.icon, size: item.icon == .smile ? 24 : 22, strokeWidth: item.icon == .smile ? 1.75 : 2.2, color: .white)
                }
            }
            .frame(width: Self.size, height: Self.size)
            .background(Circle().fill(Color.white.opacity(0.14)))
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .opacity(item.enabled ? 1 : 0.4)
        .disabled(!item.enabled)
        .accessibilityLabel(item.label)
        .accessibilityIdentifier(item.id)
    }

    /// The system's regions over the strip (the clock and Wi-Fi block, the camera), top to bottom.
    private static func occlusionsOverStrip(_ screen: MomentsDuoScreen) -> [CGRect] {
        let strip = screen.strip
        return screen.occlusions
            .filter { $0.maxX > strip.minX && $0.minX < strip.maxX }
            .sorted { $0.minY < $1.minY }
    }

    /// The buttons' tops: 16 pt under the clock and Wi-Fi block, 12 pt apart, each moved below any region it would touch.
    static func tops(count: Int, screen: MomentsDuoScreen) -> [CGFloat] {
        let regions = occlusionsOverStrip(screen)
        let clock = regions.first { $0.minY < 1 }?.maxY ?? 0
        var y = max(screen.insets.top, clock) + 16
        var tops: [CGFloat] = []
        for _ in 0..<count {
            while let hit = regions.first(where: { $0.minY < y + size && $0.maxY > y }) {
                y = hit.maxY + gap
            }
            tops.append(y)
            y += size + gap
        }
        return tops
    }

    /// The bottom button's top: 12 pt off the strip's bottom, moved above any region it would touch; nil when there's
    /// no room under the buttons above it.
    private static func bottomTop(screen: MomentsDuoScreen, height: CGFloat, below last: CGFloat?) -> CGFloat? {
        var y = height - gap - size
        while let hit = occlusionsOverStrip(screen).last(where: { $0.minY < y + size && $0.maxY > y }) {
            y = hit.minY - gap - size
        }
        let floor = (last ?? 0) + size + gap
        return y >= floor ? y : nil
    }
}

/// Around a Moment shown whole on a wide screen: a blurred, darker copy of it (board U2). A text card's colors.
struct MomentsBlurredBackdrop: View {
    let model: MomentsViewerModel

    var body: some View {
        Color.black
            .overlay {
                if let moment = model.moment, moment.kind == .text {
                    MomentsTextCard(text: "", background: moment.background)
                } else if let picture = model.image ?? model.poster {
                    Image(uiImage: picture)
                        .resizable()
                        .scaledToFill()
                        .scaleEffect(1.18)
                        .blur(radius: 38)
                }
            }
            .overlay { Color.black.opacity(0.5) }
            .clipped()
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// The dark glass under a reply box floating over the picture (boards C3, U2): a blur of what's behind, darkened.
struct MomentsFloatingGlass<S: Shape>: View {
    let shape: S

    var body: some View {
        shape
            .fill(.ultraThinMaterial)
            .overlay(shape.fill(Color.black.opacity(0.34)))
            .environment(\.colorScheme, .dark)
    }
}

/// Closed (board C5): a sheet that stays in the column beside the side strip, where Close stays in view (a system
/// sheet would run under the strip). It opens 62 % of the column high, as drawn; drag its top up for the whole column
/// or down to close it; a tap above it closes it too. It follows the phone's light or dark, as the phone's sheet does.
struct MomentsColumnSheet<Content: View>: View {
    let systemScheme: ColorScheme
    let onClose: () -> Void
    @ViewBuilder let content: () -> Content
    @State private var expanded = false
    @State private var drag: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let medium = (geo.size.height * 0.62).rounded()
            let large = max(geo.size.height - 44, medium)
            ZStack(alignment: .bottom) {
                Color.black.opacity(0.38)
                    .contentShape(Rectangle())
                    .onTapGesture(perform: onClose)
                    .accessibilityHidden(true)
                content()
                    .frame(width: geo.size.width, height: expanded ? large : medium, alignment: .top)
                    .background(Theme.Color.appSurface)
                    .overlay(alignment: .top) { handle }
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24, style: .continuous))
                    .shadow(color: .black.opacity(0.35), radius: 12, x: 0, y: -6)
                    .offset(y: max(drag, 0))
                    .environment(\.colorScheme, systemScheme)
                    .accessibilityAddTraits(.isModal)
                    .accessibilityAction(.escape, onClose)
            }
        }
        .transition(.move(edge: .bottom))
    }

    /// The grabber, and a strip along the top to drag it by (the list under it scrolls on its own).
    private var handle: some View {
        Capsule()
            .fill(Theme.Color.appBorderStrong)
            .frame(width: 36, height: 5)
            .padding(.top, Spacing.s2)
            .frame(maxWidth: .infinity, minHeight: 24, alignment: .top)
            .contentShape(Rectangle())
            .gesture(
                DragGesture()
                    .onChanged { drag = $0.translation.height }
                    .onEnded { value in
                        let moved = value.predictedEndTranslation.height
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.86)) {
                            drag = 0
                            if moved > 120 {
                                if expanded { expanded = false } else { onClose() }
                            } else if moved < -80 {
                                expanded = true
                            }
                        }
                    }
            )
            .accessibilityHidden(true)
    }
}
