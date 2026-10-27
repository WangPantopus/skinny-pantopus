//
//  MailPieceParts.swift
//  Pantopus
//
//  The parts every drawn piece shares (Mail tab drawings, board "Parts"): the
//  sender block, how the sender was checked, the stamp or printed postage,
//  the postmark, the sheet peeking out of an opened envelope, the special
//  delivery stripes, a parcel's bar code, and the paper with its torn top.
//

import SwiftUI

/// The sender's name, return address and how they were checked, printed on
/// a bill, notice or special delivery.
struct MailSenderBlock: View {
    let model: MailPieceModel

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Text(String(model.from.prefix(1)).uppercased())
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(MailPaper.envelope)
                .frame(width: 24, height: 24)
                .background(MailPaper.postalInk, in: RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(model.from)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(MailPaper.handInk)
                    .lineLimit(2)
                if let line = model.fromLine {
                    Text(line)
                        .font(.system(size: 11))
                        .foregroundStyle(MailPaper.printSoft)
                        .lineLimit(1)
                }
                MailTrustLine(trust: model.trust)
                    .padding(.top, 2)
            }
        }
    }
}

/// "Verified utility" with its check, or "Unverified sender" in red.
struct MailTrustLine: View {
    let trust: MailPieceTrust

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(trust == .unknown ? .alertTriangle : .badgeCheck, size: 12, strokeWidth: 2.25, color: color)
            Text(trust.label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(color)
                .lineLimit(1)
        }
    }

    private var color: Color {
        switch trust {
        case .business, .government, .utility: MailPaper.verifiedInk
        case .pantopus: MailPaper.pantopusInk
        case .neighbor: MailPaper.printSoft
        case .unknown: MailPaper.warningInk
        }
    }
}

/// A stamp for people's mail, printed postage for verified senders, the
/// Pantopus mark for Pantopus, nothing for an unknown sender's bill. The
/// postmark cancels the stamp.
struct MailPostage: View {
    let model: MailPieceModel

    var body: some View {
        if model.trust.usesStamp {
            ZStack(alignment: .topTrailing) {
                MailStamp(art: model.stamp)
                MailPostmarkView(town: model.postmarkTown, date: model.postmarkDate, year: model.postmarkYear, waves: true)
                    .frame(width: 92, height: 46)
                    .opacity(0.62)
                    .offset(x: 6, y: 4)
            }
            .frame(width: 92, height: 58, alignment: .topTrailing)
        } else if let indicia = model.trust.indicia {
            printedPostage(indicia)
        } else if model.trust == .pantopus {
            pantopusPostage
        }
    }

    /// Verified senders' postage, with the day's postmark beside it.
    private func printedPostage(_ indicia: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            if model.kind == .letter || model.kind == .bundle {
                MailPostmarkView(town: model.postmarkTown, date: model.postmarkDate, year: model.postmarkYear, waves: false)
                    .frame(width: 40, height: 40)
                    .opacity(0.6)
            }
            VStack(spacing: Spacing.s0) {
                Text("PANTOPUS POST").fontWeight(.bold)
                Text("VERIFIED")
                Text(indicia)
            }
            .font(.system(size: 6.5, design: .monospaced))
            .tracking(0.3)
            .foregroundStyle(MailPaper.postalInk)
            .frame(width: 66, height: 44)
            .overlay(RoundedRectangle(cornerRadius: 2).strokeBorder(MailPaper.postalInk, lineWidth: 1.5))
        }
    }

    /// Pantopus's own mark, with the day's postmark on its letters.
    private var pantopusPostage: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            if model.kind == .letter {
                MailPostmarkView(town: model.postmarkTown, date: model.postmarkDate, year: model.postmarkYear, waves: false)
                    .frame(width: 40, height: 40)
                    .opacity(0.6)
            }
            HStack(spacing: Spacing.s1) {
                PantopusMark(size: 18)
                Text("PANTOPUS")
                    .font(.system(size: 7, weight: .bold, design: .monospaced))
            }
            .foregroundStyle(MailPaper.pantopusInk)
            .frame(width: 66, height: 44)
            .overlay(RoundedRectangle(cornerRadius: 2).strokeBorder(MailPaper.pantopusInk, lineWidth: 1.5))
        }
    }
}

/// A 42 × 54 stamp with its perforated edge and one of the three designs.
struct MailStamp: View {
    let art: MailStampArt

    var body: some View {
        ZStack {
            MailPaper.envelope
                .mask {
                    PerforatedStampShape(toothRadius: 1.8, toothGap: 6)
                        .fill(Color.black, style: FillStyle(eoFill: true, antialiased: true))
                }
            artwork
                .frame(width: 36, height: 48)
        }
        .frame(width: 42, height: 54)
        .shadow(color: .black.opacity(0.12), radius: 1, x: 0, y: 1)
    }

    private var artwork: some View {
        Canvas { context, size in
            let sx = size.width / 36
            let sy = size.height / 48
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * sx, y: y * sy)
            }
            func poly(_ points: [CGPoint]) -> Path {
                var path = Path()
                path.addLines(points)
                path.closeSubpath()
                return path
            }
            let all = Path(CGRect(origin: .zero, size: size))
            switch art {
            case .fir:
                context.fill(all, with: .color(MailPaper.firSky))
                context.fill(Path(ellipseIn: CGRect(x: 23 * sx, y: 7 * sy, width: 8 * sx, height: 8 * sy)), with: .color(MailPaper.sun))
                let tree = poly([p(18, 10), p(27, 25), p(22, 25), p(29, 37), p(7, 37), p(14, 25), p(9, 25)])
                context.fill(tree, with: .color(MailPaper.firTree))
                context.fill(Path(CGRect(x: 16.5 * sx, y: 37 * sy, width: 3 * sx, height: 6 * sy)), with: .color(MailPaper.firTree))
            case .peak:
                context.fill(all, with: .color(MailPaper.peakSky))
                context.fill(poly([p(2, 40), p(15, 18), p(21, 27), p(25, 21), p(34, 40)]), with: .color(MailPaper.peakRock))
                context.fill(poly([p(15, 18), p(19, 24.5), p(16.5, 23), p(13.5, 25)]), with: .color(.white))
                context.fill(Path(ellipseIn: CGRect(x: 5.5 * sx, y: 7.5 * sy, width: 7 * sx, height: 7 * sy)), with: .color(MailPaper.sun))
            case .river:
                context.fill(all, with: .color(MailPaper.riverLand))
                context.fill(poly([p(11, 22), p(18, 9), p(25, 22)]), with: .color(MailPaper.riverPeak))
                var water = Path()
                water.move(to: p(0, 30))
                water.addQuadCurve(to: p(12, 30), control: p(6, 26))
                water.addQuadCurve(to: p(24, 30), control: p(18, 34))
                water.addQuadCurve(to: p(36, 30), control: p(30, 26))
                water.addLine(to: p(36, 48))
                water.addLine(to: p(0, 48))
                water.closeSubpath()
                context.fill(water, with: .color(MailPaper.riverWater))
            }
        }
    }
}

/// The round postmark with town, date and year; letters add the wavy
/// cancellation lines. Without a town it shows the date only.
struct MailPostmarkView: View {
    let town: String?
    let date: String
    let year: String
    let waves: Bool

    var body: some View {
        Canvas { context, size in
            let diameter = min(size.height, waves ? size.width * 0.45 : size.width) - 4
            let rect = CGRect(x: 2, y: (size.height - diameter) / 2, width: diameter, height: diameter)
            context.stroke(Path(ellipseIn: rect), with: .color(MailPaper.postalInk), lineWidth: 1.3)
            let center = CGPoint(x: rect.midX, y: rect.midY)
            let small = diameter * 0.12
            if let town {
                context.draw(
                    Text(town).font(.system(size: small, design: .monospaced)).foregroundColor(MailPaper.postalInk),
                    at: CGPoint(x: center.x, y: center.y - diameter * 0.2)
                )
            }
            context.draw(
                Text(date).font(.system(size: diameter * 0.16, weight: .bold, design: .monospaced)).foregroundColor(MailPaper.postalInk),
                at: CGPoint(x: center.x, y: center.y + (town == nil ? 0 : diameter * 0.04))
            )
            if town != nil {
                context.draw(
                    Text(year).font(.system(size: small, design: .monospaced)).foregroundColor(MailPaper.postalInk),
                    at: CGPoint(x: center.x, y: center.y + diameter * 0.24)
                )
            }
            guard waves else { return }
            for row in 0..<3 {
                let y = rect.minY + diameter * (0.3 + 0.2 * CGFloat(row))
                var wave = Path()
                var x = rect.maxX + 4
                wave.move(to: CGPoint(x: x, y: y))
                var up = true
                while x < size.width - 2 {
                    wave.addQuadCurve(to: CGPoint(x: x + 12, y: y), control: CGPoint(x: x + 6, y: y + (up ? -4 : 4)))
                    x += 12
                    up.toggle()
                }
                context.stroke(wave, with: .color(MailPaper.postalInk), lineWidth: 1.2)
            }
        }
        .accessibilityHidden(true)
    }
}

/// The sheet of an opened envelope, peeking out over its torn top.
struct MailPeekSheet: View {
    let line: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            if let line {
                Text(line)
                    .font(.system(size: 10, design: .serif))
                    .foregroundStyle(MailPaper.handInkSoft)
                    .lineLimit(1)
            } else {
                Capsule().fill(MailPaper.sheetLine).frame(height: 2).frame(maxWidth: .infinity, alignment: .leading).padding(.trailing, 120)
            }
            Capsule().fill(MailPaper.sheetLineSoft).frame(height: 2).padding(.trailing, 160)
        }
        .padding(.horizontal, 14)
        .padding(.top, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(MailPaper.envelope)
                .overlay(RoundedRectangle(cornerRadius: 2, style: .continuous).strokeBorder(MailPaper.envelopeEdge, lineWidth: 1))
        )
        .shadow(color: .black.opacity(0.06), radius: 1, x: 0, y: 1)
    }
}

/// The red, white and blue chevrons around a special delivery.
struct SpecialDeliveryStripes: View {
    var body: some View {
        Canvas { context, size in
            let colors = [MailPaper.stripeRed, MailPaper.stripeWhite, MailPaper.stripeBlue, MailPaper.stripeWhite]
            let widths: [CGFloat] = [9, 5, 9, 5]
            var x: CGFloat = -size.height
            var index = 0
            while x < size.width + size.height {
                let width = widths[index % 4]
                var band = Path()
                band.move(to: CGPoint(x: x, y: size.height))
                band.addLine(to: CGPoint(x: x + size.height, y: 0))
                band.addLine(to: CGPoint(x: x + size.height + width, y: 0))
                band.addLine(to: CGPoint(x: x + width, y: size.height))
                band.closeSubpath()
                context.fill(band, with: .color(colors[index % 4]))
                x += width
                index += 1
            }
        }
        .accessibilityHidden(true)
    }
}

/// A bar code line on a parcel's label.
struct MailBarcode: View {
    var body: some View {
        Canvas { context, size in
            let pattern: [CGFloat] = [1, 2, 2, 1, 1, 2, 1, 2, 3, 1, 1, 2, 2, 1, 1, 3]
            var x: CGFloat = 0
            var index = 0
            var ink = true
            while x < size.width {
                let width = pattern[index % pattern.count]
                if ink {
                    context.fill(Path(CGRect(x: x, y: 0, width: width, height: size.height)), with: .color(MailPaper.postalInk))
                }
                x += width
                ink.toggle()
                index += 1
            }
        }
        .accessibilityHidden(true)
    }
}

/// An envelope's outline, with a torn top once it's opened.
struct TornTopEdge: Shape {
    let torn: Bool
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        guard torn else {
            return RoundedRectangle(cornerRadius: radius, style: .continuous).path(in: rect)
        }
        var path = Path()
        let teeth = max(8, Int(rect.width / 11))
        let step = rect.width / CGFloat(teeth)
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + 7))
        for index in 0..<teeth {
            let x = rect.minX + step * CGFloat(index)
            path.addLine(to: CGPoint(x: x + step / 2, y: rect.minY + (index.isMultiple(of: 2) ? 2 : 4)))
            path.addLine(to: CGPoint(x: x + step, y: rect.minY + (index.isMultiple(of: 3) ? 8 : 6)))
        }
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - radius))
        path.addQuadCurve(to: CGPoint(x: rect.maxX - radius, y: rect.maxY), control: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + radius, y: rect.maxY))
        path.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - radius), control: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

extension View {
    /// The piece's paper: fill, edge, shadow, and the torn top once opened.
    func mailPaper(_ paper: Color, edge: Color, radius: CGFloat, torn: Bool) -> some View {
        background(paper)
            .overlay(TornTopEdge(torn: torn, radius: radius).stroke(edge, lineWidth: 1))
            .clipShape(TornTopEdge(torn: torn, radius: radius))
            .shadow(color: .black.opacity(0.08), radius: 9, x: 0, y: 6)
            .shadow(color: .black.opacity(0.06), radius: 1, x: 0, y: 1)
    }
}
