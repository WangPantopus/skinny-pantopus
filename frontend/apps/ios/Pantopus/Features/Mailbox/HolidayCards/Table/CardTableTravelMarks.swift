//
//  CardTableTravelMarks.swift
//  Pantopus
//
//  A travelling card's postmarks on the address side of its envelope (server switch `card_travel`, travelling card
//  plan Part 3): one for every town on the way to this person, oldest first. Each is two inked rings with the town and
//  state round the top, PANTOPUS POST round the bottom and the day and year in the middle; the first keeps today's
//  five wavy lines over the stamp. Measures from the plan's sample (`SLOTS` and `postmark()`), in shares of the
//  envelope's width. A card that doesn't travel never comes here.
//

import SwiftUI
import UIKit

/// One town's postmark: the town it left and that day's date where its sender lives.
struct CardTravelMark: Equatable {
    /// "Boise", or "Abroad" for someone outside the United States.
    let town: String
    /// "ID"; nil abroad.
    let state: String?
    /// "NOV 23".
    let day: String
    let year: Int
}

/// Where a travelling card has been on its way to this person, as its envelope and the words above it show it.
struct CardTravelEnvelope: Equatable {
    /// Oldest first.
    let marks: [CardTravelMark]
    /// Straight-line miles from town to town to reach this person.
    let miles: Int
    /// The journey page's id, for Copy link (travelling card plan Part 7).
    var journey: String?

    /// The share picture's slip: "5 TOWNS · 2,692 MILES", counting the town it reached, this person's.
    var slipLine: String {
        "\(CardTravelWords.towns(marks.count + 1)) · \(CardTravelWords.miles(miles))".uppercased()
    }

    /// "It came 2,692 miles through 4 towns to reach you."; nil on its first stop, which says nothing more than today.
    var cameLine: String? {
        guard marks.count > 1 else { return nil }
        return "It came \(CardTravelWords.miles(miles)) through \(CardTravelWords.towns(marks.count)) to reach you."
    }
}

extension CardTravelEnvelope {
    /// The reader's envelope from the server's travel; nil for a card that doesn't travel or has no postmark yet.
    init?(_ travel: CardTravel?, year: Int) {
        guard let travel, !travel.postmarks.isEmpty else { return nil }
        marks = travel.postmarks.map { stop in
            let day = CardTravelWords.postmarkDay(stop.on)
            return CardTravelMark(town: stop.town, state: stop.state, day: day?.day ?? "", year: day?.year ?? year)
        }
        miles = travel.miles
        journey = travel.journey
    }
}

/// The numbers in the travelling card's words.
enum CardTravelWords {
    /// "2,692 miles", "1 mile".
    static func miles(_ count: Int) -> String {
        "\(grouped(count)) \(count == 1 ? "mile" : "miles")"
    }

    /// "4 towns", "1 town".
    static func towns(_ count: Int) -> String {
        "\(grouped(count)) \(count == 1 ? "town" : "towns")"
    }

    /// `2026-11-23` → ("NOV 23", 2026), as the day reads on a postmark; nil for anything else.
    static func postmarkDay(_ value: String?) -> (day: String, year: Int)? {
        let parts = (value ?? "").prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, (1...12).contains(parts[1]), (1...31).contains(parts[2]) else { return nil }
        let months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        return ("\(months[parts[1] - 1]) \(parts[2])", parts[0])
    }

    static func grouped(_ count: Int) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: count)) ?? String(count)
    }
}

enum CardTableTravelMarks {
    /// Where a ring lies: its centre in % of the envelope (across, down) and its turn in degrees.
    struct Slot {
        let x: CGFloat
        let y: CGFloat
        let turn: Double

        init(_ x: CGFloat, _ y: CGFloat, _ turn: Double) {
            self.x = x
            self.y = y
            self.turn = turn
        }
    }

    /// One ring as it's drawn: where, how large, which ink, and whether it keeps the wavy lines.
    private struct Ring {
        let center: CGPoint
        /// The sample's unit: the outer ring is 120 of them across.
        let unit: CGFloat
        let turn: Double
        let waves: Bool
        let ink: Color
        let seed: Int
    }

    /// A line of capitals round a ring.
    private struct ArcLine {
        let radius: CGFloat
        let size: CGFloat
        let tracking: CGFloat
        /// Round the top, reading outward; else round the bottom, reading inward.
        let over: Bool
    }

    /// The rings' places, oldest first.
    static let slots: [Slot] = [
        Slot(66, 15, -8), Slot(23, 30, 11), Slot(80, 37, -14), Slot(27, 70, 6), Slot(79, 69, -5),
        Slot(61, 88, 13), Slot(13, 52, -18), Slot(89, 58, 9), Slot(46, 28, -3)
    ]

    /// The postmarks shown on the envelope: the newest nine.
    static func shown(_ marks: [CardTravelMark]) -> ArraySlice<CardTravelMark> {
        marks.suffix(slots.count)
    }

    /// "+ 4 more towns" for the towns that don't fit; nil when they all do.
    static func moreLine(_ marks: [CardTravelMark]) -> String? {
        let more = marks.count - slots.count
        guard more > 0 else { return nil }
        return "+ \(more) more \(more == 1 ? "town" : "towns")"
    }

    /// Draws the postmarks on an envelope `size` big. `strike`, 0 to 1, is the newest one being struck as the envelope
    /// arrives (1 shows it struck).
    static func draw(_ marks: [CardTravelMark], in context: GraphicsContext, size: CGSize, strike: Double = 1) {
        let shown = Array(shown(marks))
        for (index, mark) in shown.enumerated() {
            let slot = slots[index]
            let newest = index == shown.count - 1
            let landing = newest ? min(1, max(0, strike)) : 1
            guard landing > 0 else { continue }
            var layer = context
            layer.opacity = landing
            let grow = newest ? 1 + 0.9 * (1 - overshoot(landing)) : 1
            let ring = Ring(
                center: CGPoint(x: size.width * slot.x / 100, y: size.height * slot.y / 100),
                unit: size.width * 0.27 / 120 * grow,
                turn: slot.turn,
                waves: index == 0,
                ink: index % 3 == 1 ? MailPaper.tablePostmarkBlue : MailPaper.tablePostmarkInk,
                seed: index
            )
            drawRing(mark, ring, in: layer)
        }
        if let more = moreLine(marks) {
            drawMore(more, in: context, size: size)
        }
    }

    /// The sample's landing curve (cubic-bezier .2, .9, .3, 1.25): quick, a little past, then home.
    private static func overshoot(_ t: Double) -> Double {
        let s = 1.0 - t
        return 1 - s * s * (1 - 2.6 * t)
    }

    /// One postmark, 27% of the envelope's width across its outer ring. Drawn in the sample's 120-unit box.
    private static func drawRing(_ mark: CardTravelMark, _ ring: Ring, in context: GraphicsContext) {
        let unit = ring.unit
        let ink = ring.ink
        context.drawLayer { layer in
            layer.translateBy(x: ring.center.x, y: ring.center.y)
            layer.rotate(by: .degrees(ring.turn))
            let shading = GraphicsContext.Shading.color(ink)
            func circle(_ radius: CGFloat) -> Path {
                Path(ellipseIn: CGRect(x: -radius * unit, y: -radius * unit, width: 2 * radius * unit, height: 2 * radius * unit))
            }
            layer.stroke(circle(55.5), with: shading, lineWidth: 3.2 * unit)
            layer.stroke(circle(34), with: shading, lineWidth: 1.9 * unit)
            if ring.waves {
                var lines = Path()
                for row in [36.0, 48, 60, 72, 84] {
                    let y = (row - 60) * unit
                    lines.move(to: CGPoint(x: 64 * unit, y: y))
                    for hump in 0..<4 {
                        let x0 = 64 + 26 * Double(hump)
                        lines.addQuadCurve(
                            to: CGPoint(x: (x0 + 26) * unit, y: y),
                            control: CGPoint(x: (x0 + 13) * unit, y: y + (hump.isMultiple(of: 2) ? -9 : 9) * unit)
                        )
                    }
                }
                layer.stroke(lines, with: shading, style: StrokeStyle(lineWidth: 3.4 * unit, lineCap: .round))
            }
            let top = topLine(mark)
            let townLine = ArcLine(radius: 41.5 * unit, size: top.size * unit, tracking: 1.3 * unit, over: true)
            arcText(top.text, townLine, ink: ink, in: layer)
            let postLine = ArcLine(radius: 50 * unit, size: 8.2 * unit, tracking: 1.6 * unit, over: false)
            arcText("PANTOPUS POST", postLine, ink: ink, in: layer)
            func middle(_ text: String, size: CGFloat, baseline: CGFloat) {
                layer.drawText(
                    Text(text).font(.custom("Georgia-Bold", fixedSize: size * unit)).foregroundColor(ink),
                    centeredOn: 0,
                    baseline: (baseline - 60) * unit
                )
            }
            middle(mark.day.uppercased(), size: 15.5, baseline: 59)
            middle(String(mark.year), size: 11.5, baseline: 74)
            let townSeed = mark.town.unicodeScalars.reduce(0) { $0 &* 31 &+ Int($1.value) }
            wear(layer, unit: unit, waves: ring.waves, seed: ring.seed &+ townSeed)
        }
    }

    /// The town round the top: "BOISE · ID". A long one is set smaller to fit, down to two thirds of its size; if it
    /// still doesn't fit, the state is left off.
    static func topLine(_ mark: CardTravelMark) -> (text: String, size: CGFloat) {
        let town = mark.town.uppercased()
        let base: CGFloat = mark.town.count > 8 ? 10.4 : 11.6
        let room = CGFloat.pi * 41.5
        func fitted(_ text: String, floor: CGFloat) -> CGFloat? {
            let length = arcLength(text, size: base, tracking: 1.3)
            let size = length <= room ? base : base * room / length
            return size >= floor ? size : nil
        }
        if let state = mark.state, !state.isEmpty {
            let full = "\(town) · \(state.uppercased())"
            if let size = fitted(full, floor: base * 2 / 3) { return (full, size) }
        }
        return (town, fitted(town, floor: 0) ?? base)
    }

    /// How long a line of capitals runs round its ring, in the sample's units (letter spacing scales with the font).
    private static func arcLength(_ text: String, size: CGFloat, tracking: CGFloat) -> CGFloat {
        let font = UIFont(name: "Georgia-Bold", size: size) ?? .boldSystemFont(ofSize: size)
        let advances = text.map { (String($0) as NSString).size(withAttributes: [.font: font]).width }
        return advances.reduce(0, +) + tracking * CGFloat(max(0, advances.count - 1))
    }

    /// Capitals set round a circle about the origin, centred at its top (`over`, reading outward) or its bottom
    /// (reading inward, left to right along the bottom).
    private static func arcText(_ text: String, _ line: ArcLine, ink: Color, in context: GraphicsContext) {
        let (radius, size, tracking, over) = (line.radius, line.size, line.tracking, line.over)
        let font = UIFont(name: "Georgia-Bold", size: size) ?? .boldSystemFont(ofSize: size)
        let letters = text.map { String($0) }
        let advances = letters.map { ($0 as NSString).size(withAttributes: [.font: font]).width }
        let length = advances.reduce(0, +) + tracking * CGFloat(max(0, letters.count - 1))
        var along = -length / 2
        for (letter, advance) in zip(letters, advances) {
            let middle = along + advance / 2
            along += advance + tracking
            guard letter != " " else { continue }
            let angle = over ? -Double.pi / 2 + Double(middle / radius) : Double.pi / 2 - Double(middle / radius)
            var glyph = context
            glyph.translateBy(x: radius * CGFloat(cos(angle)), y: radius * CGFloat(sin(angle)))
            glyph.rotate(by: .radians(over ? angle + Double.pi / 2 : angle - Double.pi / 2))
            glyph.drawText(Text(letter).font(Font(font)).foregroundColor(ink), centeredOn: 0, baseline: 0)
        }
    }

    /// The stamp's worn ink: specks and a few soft patches where it didn't take, the same for a town every time.
    private static func wear(_ context: GraphicsContext, unit: CGFloat, waves: Bool, seed: Int) {
        var random = CardTravelRandom(seed: UInt64(bitPattern: Int64(seed)))
        var worn = context
        worn.blendMode = .destinationOut
        let reach: ClosedRange<Double> = waves ? -60...172 : -60...60
        for _ in 0..<(waves ? 9 : 6) {
            let x = random.next(in: reach)
            let y = random.next(in: -60...60)
            let radius = random.next(in: 7...16)
            worn.opacity = random.next(in: 0.25...0.55)
            worn.fill(Path(ellipseIn: rect(x, y, radius, unit)), with: .color(.black))
        }
        for _ in 0..<(waves ? 150 : 90) {
            let x = random.next(in: reach)
            let y = random.next(in: -60...60)
            let radius = random.next(in: 0.5...1.9)
            worn.opacity = random.next(in: 0.6...1)
            worn.fill(Path(ellipseIn: rect(x, y, radius, unit)), with: .color(.black))
        }
    }

    private static func rect(_ x: Double, _ y: Double, _ radius: Double, _ unit: CGFloat) -> CGRect {
        let side = CGFloat(2 * radius) * unit
        return CGRect(x: CGFloat(x - radius) * unit, y: CGFloat(y - radius) * unit, width: side, height: side)
    }

    /// "+ 4 more towns" bottom right, in the gold and type of "CHRISTMAS CARD".
    private static func drawMore(_ line: String, in context: GraphicsContext, size: CGSize) {
        let fontSize = size.width * 0.0235
        let font = CardTableSerif.font(size: fontSize, weight: .semibold)
        let top = size.height - size.height * 0.054 - fontSize
        let resolved = context.resolve(
            Text(line.uppercased()).font(Font(font)).tracking(fontSize * 0.2).foregroundColor(MailPaper.tableGold)
        )
        let room = CGSize(width: 100_000, height: 100_000)
        let baseline = top + CardTableType.baseline(font, lineHeight: fontSize)
        context.draw(
            resolved,
            at: CGPoint(x: size.width * 0.932, y: baseline - resolved.firstBaseline(in: room)),
            anchor: .topTrailing
        )
    }
}

/// A small seeded random source (SplitMix64), so a postmark wears the same way each time it's drawn.
struct CardTravelRandom {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed &+ 0x9E37_79B9_7F4A_7C15
    }

    mutating func next(in range: ClosedRange<Double>) -> Double {
        state = state &+ 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        z ^= z >> 31
        return range.lowerBound + Double(z >> 11) / Double(1 << 53) * (range.upperBound - range.lowerBound)
    }
}
