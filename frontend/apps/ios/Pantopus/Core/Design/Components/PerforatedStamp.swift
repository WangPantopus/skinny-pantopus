//
//  PerforatedStamp.swift
//  Pantopus
//
//  Postage-stamp primitives for A17.11 Stamps (book hero, sheet grid,
//  wallet rail, usage chits). Ports the `.pp-stamp` CSS mask from
//  docs/designs/A17/stamps.jsx to native SwiftUI:
//
//  - `PerforatedStamp` — an `ink`-filled rectangle with a perforated
//    (toothed) edge, an engraved hairline double-frame, and an artwork
//    slot. `used: true` overlays a `Postmark` cancellation.
//  - `Postmark` — the circular cancellation ("PANTOPUS / USED") with a
//    concentric date-ring + four wavy cancellation lines.
//  - `ForeverArt` — the default Forever-series emblem (concentric rings +
//    serif "P" + "PANTOPUS POST" / "FOREVER" / "LOCAL · 1 SEND").
//
//  PERF: the perforated edge is a vector even-odd mask (rect XOR a row of
//  edge circles), so it stays crisp at 1x/2x/3x with no banding and no
//  per-pixel shader. It renders statically — there is no animation, so
//  nothing to gate behind reduce-motion. The masked draw is a single
//  composited layer; well within the per-frame budget for stamp-sized
//  tiles in `docs/ios/perf_budgets.md`.
//

import SwiftUI

// MARK: - PerforatedStamp

/// A postage rectangle with a perforated edge. `ink` fills the paper; the
/// `content` slot renders the engraved artwork (defaults to `ForeverArt`).
///
/// - Parameters:
///   - ink: Paper ink. Pass a token (e.g. `Theme.Color.categoryStamps`);
///     the philatelic series palette lands with the A17.11 screen (B2.1).
///   - width / height: Paper size in points.
///   - toothRadius: Perforation bite radius. Design default `4.5`.
///   - toothGap: Target spacing between bite centres. Design default `12`.
///   - used: Overlays a `Postmark` cancellation when `true`.
///   - content: Artwork drawn over the ink (inside the perforations).
public struct PerforatedStamp<Content: View>: View {
    private let ink: Color
    private let width: CGFloat
    private let height: CGFloat
    private let toothRadius: CGFloat
    private let toothGap: CGFloat
    private let used: Bool
    private let content: Content

    /// Engraved inner-frame inset — fixed at 7pt per the design's
    /// `inset: 7` regardless of stamp size. Computed (not a stored `static
    /// let`) because this is a generic type.
    private static var frameInset: CGFloat {
        7
    }

    public init(
        ink: Color,
        width: CGFloat,
        height: CGFloat,
        toothRadius: CGFloat = 4.5,
        toothGap: CGFloat = 12,
        used: Bool = false,
        @ViewBuilder content: () -> Content
    ) {
        self.ink = ink
        self.width = width
        self.height = height
        self.toothRadius = toothRadius
        self.toothGap = toothGap
        self.used = used
        self.content = content()
    }

    public var body: some View {
        ZStack {
            inkLayer
            engravedFrame
            content
                .foregroundStyle(Color.white.opacity(0.95))
            if used {
                Postmark()
                    .frame(width: width * 0.78, height: height * 0.60)
            }
        }
        .frame(width: width, height: height)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(used ? "Postage stamp, used" : "Postage stamp")
        .accessibilityIdentifier("perforatedStamp")
    }

    /// `ink` masked by the perforated outline. Even-odd fill removes the
    /// half-circle bites where edge circles overlap the paper; the outer
    /// halves fall outside the `width × height` ink and are inert.
    private var inkLayer: some View {
        ink.mask {
            PerforatedStampShape(toothRadius: toothRadius, toothGap: toothGap)
                .fill(Color.black, style: FillStyle(eoFill: true, antialiased: true))
        }
    }

    /// Engraved hairline double-frame — a barely-rounded white 30% stroke
    /// inset 7pt from the paper edge.
    private var engravedFrame: some View {
        RoundedRectangle(cornerRadius: 2, style: .continuous)
            .strokeBorder(Color.white.opacity(0.30), lineWidth: 1)
            .padding(Self.frameInset)
    }
}

public extension PerforatedStamp where Content == ForeverArt {
    /// Convenience init using the default Forever-series artwork. Picks the
    /// compact emblem for narrow stamps (sheet cells, rail tiles).
    init(
        ink: Color,
        width: CGFloat,
        height: CGFloat,
        toothRadius: CGFloat = 4.5,
        toothGap: CGFloat = 12,
        used: Bool = false
    ) {
        self.init(
            ink: ink,
            width: width,
            height: height,
            toothRadius: toothRadius,
            toothGap: toothGap,
            used: used
        ) {
            ForeverArt(small: width < 80)
        }
    }
}

// MARK: - Perforated outline

/// Rect ∪ a row of edge-centred circles. Filled even-odd, the inside half
/// of each circle cancels against the paper (a concave bite); the outside
/// half is inert. Crisp/vector at every scale.
struct PerforatedStampShape: Shape {
    var toothRadius: CGFloat = 4.5
    var toothGap: CGFloat = 12

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addRect(rect)
        for centre in Self.perforationCentres(in: rect, toothGap: toothGap) {
            path.addEllipse(
                in: CGRect(
                    x: centre.x - toothRadius,
                    y: centre.y - toothRadius,
                    width: toothRadius * 2,
                    height: toothRadius * 2
                )
            )
        }
        return path
    }

    /// Evenly-distributed bite centres along all four edges. Each edge gets
    /// `round(edge / gap)` teeth on a half-step margin, so corners never
    /// land a half-cut bite and the two opposite edges stay symmetric.
    static func perforationCentres(in rect: CGRect, toothGap: CGFloat) -> [CGPoint] {
        var centres: [CGPoint] = []
        let columns = max(1, Int((rect.width / toothGap).rounded()))
        let rows = max(1, Int((rect.height / toothGap).rounded()))
        let stepX = rect.width / CGFloat(columns)
        let stepY = rect.height / CGFloat(rows)

        for index in 0..<columns {
            let x = rect.minX + stepX * (CGFloat(index) + 0.5)
            centres.append(CGPoint(x: x, y: rect.minY))
            centres.append(CGPoint(x: x, y: rect.maxY))
        }
        for index in 0..<rows {
            let y = rect.minY + stepY * (CGFloat(index) + 0.5)
            centres.append(CGPoint(x: rect.minX, y: y))
            centres.append(CGPoint(x: rect.maxX, y: y))
        }
        return centres
    }
}

// MARK: - ForeverArt

/// Default stamp artwork — the Local · Forever-series emblem. White ink on
/// the stamp's colour; `small` scales it for sheet cells / rail tiles.
public struct ForeverArt: View {
    private let small: Bool

    public init(small: Bool = false) {
        self.small = small
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            Text("PANTOPUS POST")
                .font(.system(size: small ? 6 : 7.5, weight: .heavy))
                .tracking(small ? 0.8 : 1)
                .opacity(0.92)
            Spacer(minLength: 2)
            emblem
            Spacer(minLength: 2)
            VStack(spacing: small ? 1 : 2) {
                Text("FOREVER")
                    .font(.system(size: small ? 9 : 12.5, weight: .heavy))
                    .tracking(small ? 0.9 : 1.2)
                Text("LOCAL · 1 SEND")
                    .font(.system(size: small ? 5.5 : 7, weight: .bold))
                    .tracking(small ? 1 : 1.3)
                    .opacity(0.8)
            }
        }
        .foregroundStyle(Color.white.opacity(0.95))
        .padding(.horizontal, small ? 6 : 10)
        .padding(.vertical, small ? 9 : 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Three concentric rings + a centred serif "P".
    private var emblem: some View {
        let outer: CGFloat = small ? 30 : 42
        let mid: CGFloat = small ? 21 : 30
        let inner: CGFloat = small ? 12 : 17
        return ZStack {
            ring(outer)
            ring(mid)
            ring(inner)
            Text("P")
                .font(.system(size: small ? 9 : 13, weight: .bold, design: .serif))
        }
        .frame(width: outer, height: outer)
    }

    private func ring(_ diameter: CGFloat) -> some View {
        Circle()
            .strokeBorder(Color.white.opacity(0.45), lineWidth: 1)
            .frame(width: diameter, height: diameter)
    }
}

// MARK: - Postmark

/// Circular cancellation drawn over a `used` stamp — concentric date-ring +
/// four wavy cancellation lines + "PANTOPUS / USED". Self-contained: bakes
/// the design's 0.55 opacity and −14° tilt.
public struct Postmark: View {
    public init() {}

    public var body: some View {
        Canvas { context, size in
            // Uniform-fit the 90×70 design viewbox, centred.
            let scale = min(size.width / 90, size.height / 70)
            let originX = (size.width - 90 * scale) / 2
            let originY = (size.height - 70 * scale) / 2
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: originX + x * scale, y: originY + y * scale)
            }
            let ink = Color.white

            // Concentric date-ring (r 22 + r 16, centred at 45,35).
            for radius in [CGFloat(22), CGFloat(16)] {
                let circle = Path(ellipseIn: CGRect(
                    x: originX + (45 - radius) * scale,
                    y: originY + (35 - radius) * scale,
                    width: radius * 2 * scale,
                    height: radius * 2 * scale
                ))
                context.stroke(circle, with: .color(ink), lineWidth: max(1, 2 * scale))
            }

            // Four wavy cancellation lines.
            for waveY in [CGFloat(20), 26, 32, 38] {
                var wave = Path()
                wave.move(to: point(2, waveY))
                var x: CGFloat = 2
                var dipUp = true
                while x < 90 {
                    let controlY = waveY + (dipUp ? -5 : 5)
                    wave.addQuadCurve(
                        to: point(x + 22, waveY),
                        control: point(x + 11, controlY)
                    )
                    x += 22
                    dipUp.toggle()
                }
                context.stroke(wave, with: .color(ink.opacity(0.9)), lineWidth: max(0.75, 1.6 * scale))
            }

            // Cancellation text.
            context.draw(
                Text("PANTOPUS").font(.system(size: 6.5 * scale, weight: .bold)).foregroundColor(ink),
                at: point(45, 31),
                anchor: .center
            )
            context.draw(
                Text("USED").font(.system(size: 5.5 * scale, weight: .regular)).foregroundColor(ink),
                at: point(45, 41),
                anchor: .center
            )
        }
        .opacity(0.55)
        .rotationEffect(.degrees(-14))
        .accessibilityHidden(true)
    }
}

// MARK: - Preview

#Preview("Ink variants") {
    // Preview inks demonstrate the primitive across hues; the philatelic
    // series palette (Local/Express/Civic/Spring/Business) lands with the
    // A17.11 Stamps screen (B2.1).
    HStack(spacing: Spacing.s3) {
        PerforatedStamp(ink: Theme.Color.categoryStamps, width: 64, height: 84)
        PerforatedStamp(ink: Theme.Color.rose, width: 64, height: 84)
        PerforatedStamp(ink: Theme.Color.magic, width: 64, height: 84)
        PerforatedStamp(ink: Theme.Color.home, width: 64, height: 84)
        PerforatedStamp(ink: Theme.Color.warmAmber, width: 64, height: 84)
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appSurface)
}

#Preview("Used / unused + featured") {
    HStack(spacing: Spacing.s4) {
        PerforatedStamp(ink: Theme.Color.categoryStamps, width: 104, height: 132)
        PerforatedStamp(ink: Theme.Color.categoryStamps, width: 104, height: 132, used: true)
        VStack(spacing: Spacing.s2) {
            PerforatedStamp(ink: Theme.Color.categoryStamps, width: 68, height: 84)
            PerforatedStamp(ink: Theme.Color.rose, width: 68, height: 84, used: true)
        }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appSurfaceSunken)
}
