//
//  BallotTimelineView.swift
//  Pantopus
//
//  Deadline timeline (Chart catalog: "Deadlines for the home address";
//  Board: Place: Your ballot card). Real calendar spacing from today to
//  Election Day at the canvas's geometry: a 3pt track at y = 38 from
//  x = 8 to width − 8, r5 markers, the Election Day marker r6 with a
//  2pt ring, 11pt labels alternating above (baselines 14/26) and below
//  (60/72), and the one deadline that needs action in the warning ink.
//  Where two labels on a row would overprint, or one would leave the card
//  (Oregon's registration and mailing dates a day apart, a 24-character
//  label near an edge), a repair pass moves just those labels.
//

import SwiftUI

/// Pure layout, shared with the web's `timelineLayout` so all three
/// clients place markers identically.
struct BallotTimelineLayout: Equatable {
    enum Side: Equatable { case above, below }
    enum Anchor: Equatable { case start, middle, end }
    enum Kind: Equatable { case today, deadline, final }

    struct Marker: Equatable {
        let key: String
        let x: CGFloat
        var side: Side
        let kind: Kind
        let firstLine: String
        let secondLine: String
        let needsAction: Bool
        var anchor: Anchor
        /// How far the repair pass slid the label along its row; 0 unless it
        /// could not clear its neighbours any other way.
        var dx: CGFloat = 0

        /// Where the label's text is drawn: the marker's x, nudged 4 for a
        /// start or end anchor, then slid by `dx`.
        var textX: CGFloat {
            switch anchor {
            case .start: x - 4 + dx
            case .end: x + 4 + dx
            case .middle: x + dx
            }
        }
    }

    let markers: [Marker]
    /// End of the darker "waiting for ballots" segment, when ahead.
    let waitUntilX: CGFloat?
    let x0: CGFloat
    let x1: CGFloat

    static let height: CGFloat = 74
    static let trackY: CGFloat = 38
    /// How far a label may stick out past the chart on either side (the card
    /// pads 17). The view draws this much wider than the chart, because a
    /// Canvas clips to its frame.
    static let bleed: CGFloat = 12

    /// `fontScale` multiplies the estimated label widths of the repair pass
    /// (Android scales its labels with the user's font size). iOS draws
    /// fixed-size labels, so the view leaves it at 1.
    static func make(
        deadlines: [BallotDeadline],
        today: String,
        width: CGFloat,
        fontScale: CGFloat = 1
    ) -> BallotTimelineLayout? {
        let ahead = deadlines
            .filter { $0.timeline && $0.daysUntil >= 0 }
            .sorted { $0.daysUntil < $1.daysUntil }
        guard let last = ahead.last, last.daysUntil > 0 else { return nil }
        let span = CGFloat(last.daysUntil)
        let x0: CGFloat = 8
        let x1 = width - 8
        func xFor(_ days: Int) -> CGFloat {
            x0 + (x1 - x0) * CGFloat(days) / span
        }

        var markers = [
            Marker(
                key: "today",
                x: x0,
                side: .below,
                kind: .today,
                firstLine: "Today",
                secondLine: monthDay(today),
                needsAction: false,
                anchor: .start
            )
        ]
        for (i, d) in ahead.enumerated() {
            let final = i == ahead.count - 1
            markers.append(Marker(
                key: d.key,
                x: xFor(d.daysUntil),
                side: final || i % 2 == 0 ? .above : .below,
                kind: final ? .final : .deadline,
                firstLine: d.monthDay,
                secondLine: d.label,
                needsAction: d.needsAction && !final,
                anchor: final ? .end : .middle
            ))
        }
        // A label within 70pt of a same-side neighbour moves to the other
        // side (today and the final marker never move).
        if markers.count > 2 {
            for i in 1..<markers.count - 1 {
                let m = markers[i]
                let clash = markers.enumerated().contains { j, o in
                    j != i && o.side == m.side && abs(o.x - m.x) < 70
                }
                if clash { markers[i].side = m.side == .above ? .below : .above }
                if m.x < 40 { markers[i].anchor = .start } else if m.x > width - 40 { markers[i].anchor = .end }
            }
        }
        // Then move only the labels that still overprint a neighbour on their
        // row or leave the card; a layout with none comes out as it is above.
        var repair = LabelRepair(markers: markers, width: width, fontScale: fontScale)
        repair.run()
        markers = repair.markers
        let mailed = ahead.first { $0.key == "ballots_mailed" }
        return BallotTimelineLayout(markers: markers, waitUntilX: mailed.map { xFor($0.daysUntil) }, x0: x0, x1: x1)
    }

    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    /// "2026-09-24" → "Sep 24" (calendar date; no timezone shift).
    static func monthDay(_ iso: String) -> String {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, (1...12).contains(parts[1]) else { return iso }
        return "\(months[parts[1] - 1]) \(parts[2])"
    }

    /// The chart's text alternative, as the web reads it: "Timeline: today,
    /// Sep 24; ballots mailed Oct 16; return by 8 p.m. Nov 3".
    static func accessibilityDescription(deadlines: [BallotDeadline], today: String) -> String {
        let ahead = deadlines.filter { $0.timeline && $0.daysUntil >= 0 }.sorted { $0.daysUntil < $1.daysUntil }
        let parts = ["today, \(monthDay(today))"] + ahead.map { "\(spoken($0)) \($0.monthDay)" }
        return "Timeline: " + parts.joined(separator: "; ")
    }

    /// The deadline's label read aloud: first letter lower-cased, and the
    /// return deadline ("By 8 p.m.") given its noun.
    private static func spoken(_ deadline: BallotDeadline) -> String {
        let label = deadline.label.prefix(1).lowercased() + deadline.label.dropFirst()
        return deadline.key == "return_by" ? "return \(label)" : label
    }
}

private extension BallotTimelineLayout {
    /// Label placement after the legacy pass. A deadline label that still
    /// overprints another on its row, or leaves the card, moves to the
    /// placement (row, anchor, slide) with the least trouble. Today and
    /// Election Day never move; the deadline someone must act on moves after
    /// the others. Estimated widths, not measured ones, so it stays pure.
    struct LabelRepair {
        /// One character at 11pt, estimated (measured 4.9 to 6.2).
        static let charWidth: CGFloat = 5.5
        /// Clear space kept between two labels on a row.
        static let gap: CGFloat = 4
        /// A label that slides along its row keeps more room from the one it
        /// moved past, so two short lines side by side never read as one phrase.
        static let slideGap: CGFloat = 12
        /// The furthest a label may slide along its row.
        static let maxPush: CGFloat = 48
        /// Each pass moves one label; a few settle any real layout.
        static let passes = 6

        typealias Span = (left: CGFloat, right: CGFloat)

        var markers: [Marker]
        let width: CGFloat
        let fontScale: CGFloat

        mutating func run() {
            for _ in 0..<Self.passes {
                guard let index = mostTroubled() else { return }
                let best = bestPlacement(for: index)
                if best == markers[index] { return }
                markers[index] = best
            }
        }

        /// Today and Election Day (3) never move; a deadline that needs action
        /// (2) moves after the others (1).
        private func priority(_ marker: Marker) -> Int {
            switch marker.kind {
            case .today, .final: 3
            case .deadline: marker.needsAction ? 2 : 1
            }
        }

        /// The movable label in trouble that moves first: lowest priority,
        /// then the right-hand one, then the earlier one.
        private func mostTroubled() -> Int? {
            markers.indices
                .filter { priority(markers[$0]) < 3 && trouble(markers[$0], at: $0) > 0 }
                .min { a, b in
                    let (pa, pb) = (priority(markers[a]), priority(markers[b]))
                    if pa != pb { return pa < pb }
                    if markers[a].x != markers[b].x { return markers[a].x > markers[b].x }
                    return a < b
                }
        }

        /// `marker` moved to `side` and `anchor`, slid by `dx`.
        private func placed(_ marker: Marker, _ side: Side, _ anchor: Anchor, dx: CGFloat = 0) -> Marker {
            var copy = marker
            copy.side = side
            copy.anchor = anchor
            copy.dx = dx
            return copy
        }

        /// The candidate with the least trouble; an earlier one wins a tie.
        /// Candidates: each anchor on the current row, then the other row;
        /// then, as a last resort, a start or end label slid along its row
        /// until it clears the labels it overprints.
        private func bestPlacement(for index: Int) -> Marker {
            let marker = markers[index]
            let sides: [Side] = [marker.side, marker.side == .above ? .below : .above]
            var candidates = sides.flatMap { side in
                [Anchor.middle, .start, .end].map { placed(marker, side, $0) }
            }
            for side in sides {
                for anchor in [Anchor.start, .end] {
                    let push = clearance(of: placed(marker, side, anchor), at: index)
                    if push != 0, abs(push) <= Self.maxPush { candidates.append(placed(marker, side, anchor, dx: push)) }
                }
            }
            let scored = candidates.map { (candidate: $0, trouble: trouble($0, at: index)) }
            return scored.min { $0.trouble < $1.trouble }?.candidate ?? marker
        }

        /// How far `marker` (a start or end label, not yet slid) must move to
        /// clear every label it overprints on its row: right for a start
        /// label, left for an end label; 0 when none.
        private func clearance(of marker: Marker, at index: Int) -> CGFloat {
            let mine = span(of: marker)
            var need: CGFloat = 0
            for (j, other) in markers.enumerated() where j != index && other.side == marker.side {
                let theirs = span(of: other)
                guard overlap(mine, theirs) > 0 else { continue }
                need = marker.anchor == .start
                    ? max(need, theirs.right + Self.slideGap - mine.left)
                    : min(need, theirs.left - Self.slideGap - mine.right)
            }
            return need
        }

        /// How badly `marker`, standing in place of `markers[index]`, collides:
        /// how far it sticks out of the chart (and one more when it does) plus
        /// how far it overprints each label on its row. 0 is fine.
        private func trouble(_ marker: Marker, at index: Int) -> CGFloat {
            let mine = span(of: marker)
            let bleed = BallotTimelineLayout.bleed
            var total: CGFloat = 0
            if mine.left < -bleed || mine.right > width + bleed {
                total += max(-bleed - mine.left, mine.right - width - bleed, 0) + 1
            }
            for (j, other) in markers.enumerated() where j != index && other.side == marker.side {
                let clash = overlap(mine, span(of: other))
                if clash > 0 { total += clash }
            }
            return total
        }

        /// How far two labels overprint, with `gap` kept clear: positive is too close.
        private func overlap(_ a: Span, _ b: Span) -> CGFloat {
            min(a.right, b.right) - max(a.left, b.left) + Self.gap
        }

        /// The horizontal extent of the label, from its longer line.
        private func span(of marker: Marker) -> Span {
            let labelWidth = CGFloat(max(marker.firstLine.count, marker.secondLine.count)) * Self.charWidth * fontScale
            return switch marker.anchor {
            case .start: (marker.textX, marker.textX + labelWidth)
            case .end: (marker.textX - labelWidth, marker.textX)
            case .middle: (marker.textX - labelWidth / 2, marker.textX + labelWidth / 2)
            }
        }
    }
}

struct BallotTimelineView: View {
    let deadlines: [BallotDeadline]
    let today: String

    var body: some View {
        Canvas { context, size in
            let width = size.width - 2 * BallotTimelineLayout.bleed
            guard let layout = BallotTimelineLayout.make(deadlines: deadlines, today: today, width: width) else { return }
            context.translateBy(x: BallotTimelineLayout.bleed, y: 0)
            draw(layout, in: &context)
        }
        .frame(height: BallotTimelineLayout.height)
        .padding(.horizontal, -BallotTimelineLayout.bleed)
        .accessibilityElement()
        .accessibilityLabel(accessibilityText)
    }

    private var accessibilityText: String {
        BallotTimelineLayout.accessibilityDescription(deadlines: deadlines, today: today)
    }

    private func draw(_ layout: BallotTimelineLayout, in context: inout GraphicsContext) {
        let y = BallotTimelineLayout.trackY
        var track = Path()
        track.move(to: CGPoint(x: layout.x0, y: y))
        track.addLine(to: CGPoint(x: layout.x1, y: y))
        context.stroke(track, with: .color(Theme.Color.appBorder), style: StrokeStyle(lineWidth: 3, lineCap: .round))
        if let wait = layout.waitUntilX {
            var segment = Path()
            segment.move(to: CGPoint(x: layout.x0, y: y))
            segment.addLine(to: CGPoint(x: wait, y: y))
            context.stroke(segment, with: .color(Theme.Color.ballotWait), style: StrokeStyle(lineWidth: 3, lineCap: .round))
        }
        for m in layout.markers {
            drawDot(m, y: y, in: &context)
            let (base1, base2): (CGFloat, CGFloat) = m.side == .above ? (14, 26) : (60, 72)
            let tx = m.textX
            let firstColor: Color = m.kind == .today
                ? Theme.Color.home
                : m.needsAction ? Theme.Color.warning : Theme.Color.appText
            let first = Text(m.firstLine)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(firstColor)
            let second = Text(m.secondLine)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
            drawText(first, x: tx, baseline: base1, anchor: m.anchor, in: &context)
            drawText(second, x: tx, baseline: base2, anchor: m.anchor, in: &context)
        }
    }

    private func drawDot(_ m: BallotTimelineLayout.Marker, y: CGFloat, in context: inout GraphicsContext) {
        switch m.kind {
        case .final:
            let dot = Path(ellipseIn: CGRect(x: m.x - 6, y: y - 6, width: 12, height: 12))
            context.fill(dot, with: .color(Theme.Color.appText))
            context.stroke(dot, with: .color(Theme.Color.appSurface), lineWidth: 2)
        case .today:
            context.fill(Path(ellipseIn: CGRect(x: m.x - 5, y: y - 5, width: 10, height: 10)), with: .color(Theme.Color.home))
        case .deadline:
            let ink = m.needsAction ? Theme.Color.warning : Theme.Color.appTextStrong
            context.fill(Path(ellipseIn: CGRect(x: m.x - 5, y: y - 5, width: 10, height: 10)), with: .color(ink))
        }
    }

    /// Draws `text` with its first baseline at `baseline`, like SVG `<text y>`.
    private func drawText(
        _ text: Text,
        x: CGFloat,
        baseline: CGFloat,
        anchor: BallotTimelineLayout.Anchor,
        in context: inout GraphicsContext
    ) {
        let resolved = context.resolve(text)
        let size = resolved.measure(in: CGSize(width: 240, height: 40))
        let ascent = resolved.firstBaseline(in: size)
        let originX: CGFloat = switch anchor {
        case .start: x
        case .middle: x - size.width / 2
        case .end: x - size.width
        }
        context.draw(resolved, in: CGRect(x: originX, y: baseline - ascent, width: size.width, height: size.height))
    }
}
