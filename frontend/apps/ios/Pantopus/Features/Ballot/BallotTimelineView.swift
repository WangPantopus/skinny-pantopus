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
    }

    let markers: [Marker]
    /// End of the darker "waiting for ballots" segment, when ahead.
    let waitUntilX: CGFloat?
    let x0: CGFloat
    let x1: CGFloat

    static let height: CGFloat = 74
    static let trackY: CGFloat = 38

    static func make(deadlines: [BallotDeadline], today: String, width: CGFloat) -> BallotTimelineLayout? {
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
}

struct BallotTimelineView: View {
    let deadlines: [BallotDeadline]
    let today: String

    var body: some View {
        Canvas { context, size in
            guard let layout = BallotTimelineLayout.make(deadlines: deadlines, today: today, width: size.width) else { return }
            draw(layout, in: &context)
        }
        .frame(height: BallotTimelineLayout.height)
        .accessibilityElement()
        .accessibilityLabel(accessibilityText)
    }

    private var accessibilityText: String {
        let ahead = deadlines.filter { $0.timeline && $0.daysUntil >= 0 }.sorted { $0.daysUntil < $1.daysUntil }
        let parts = ["today, \(BallotTimelineLayout.monthDay(today))"] + ahead.map { "\($0.label) \($0.monthDay)" }
        return "Timeline: " + parts.joined(separator: "; ")
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
            let tx: CGFloat = m.anchor == .start ? m.x - 4 : m.anchor == .end ? m.x + 4 : m.x
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
