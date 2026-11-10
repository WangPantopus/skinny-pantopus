//
//  CardTableSignature.swift
//  Pantopus
//
//  The sender's own signature beside FROM (launch key `card_table`, plan 8.2):
//  a few pen strokes in a 400 × 100 box, kept by the server with the note. It
//  is drawn the same in every app: 48% of the card's width after FROM, its line
//  y = 72 on FROM's baseline, round 4-unit strokes in the pen's ink. Without
//  one, the first name is set in the pen as before. Strokes are the sender's
//  own: never in a share picture's file name, a log or analytics.
//

import SwiftUI

enum CardTableSignature {
    static let boxWidth: CGFloat = 400
    static let boxHeight: CGFloat = 100
    /// Where the strokes' line sits in the box: it goes on FROM's baseline.
    static let line: CGFloat = 72
    /// The box's width on the card, as a share of the card's width.
    static let onCard: CGFloat = 0.48
    static let strokeWidth: CGFloat = 4
    static let maxBytes = 2048
    static let maxStrokes = 40

    /// The signature when it's one this app can draw.
    static func drawable(_ signature: CardSignature?) -> CardSignature? {
        guard let signature, signature.width == Int(boxWidth), signature.height == Int(boxHeight),
              signature.strokes.contains(where: { $0.count >= 2 })
        else { return nil }
        return signature
    }

    /// The strokes as one path in box units: smooth curves through the points; a dot is a tiny round-capped line.
    static func path(_ strokes: [[CGPoint]]) -> Path {
        var path = Path()
        for points in strokes {
            guard let first = points.first else { continue }
            path.move(to: first)
            if points.count == 1 {
                path.addLine(to: CGPoint(x: first.x + 0.01, y: first.y))
                continue
            }
            if points.count > 2 {
                for index in 1..<(points.count - 1) {
                    let next = points[index + 1]
                    let mid = CGPoint(x: (points[index].x + next.x) / 2, y: (points[index].y + next.y) / 2)
                    path.addQuadCurve(to: mid, control: points[index])
                }
            }
            if let last = points.last { path.addLine(to: last) }
        }
        return path
    }

    static func points(_ signature: CardSignature) -> [[CGPoint]] {
        signature.strokes.map { flat in
            stride(from: 0, to: flat.count - 1, by: 2).map { CGPoint(x: flat[$0], y: flat[$0 + 1]) }
        }
    }

    /// Draws the signature in the pen's ink into `box` (the card's coordinates, 4:1).
    static func draw(_ signature: CardSignature, in context: GraphicsContext, box: CGRect) {
        let scale = box.width / boxWidth
        let transform = CGAffineTransform(translationX: box.minX, y: box.minY).scaledBy(x: scale, y: scale)
        var ink = context
        ink.blendMode = .multiply
        ink.stroke(
            path(points(signature)).applying(transform),
            with: .color(MailPaper.tablePenInk),
            style: StrokeStyle(lineWidth: strokeWidth * scale, lineCap: .round, lineJoin: .round)
        )
    }

    /// Where the box goes on a card back `u` points per 1% of its width, after FROM ending at `nameX`, whose
    /// baseline is `baseline`.
    static func box(nameX: CGFloat, baseline: CGFloat, u: CGFloat) -> CGRect {
        let width = onCard * 100 * u
        let height = width * boxHeight / boxWidth
        return CGRect(x: nameX, y: baseline - height * line / boxHeight, width: width, height: height)
    }

    enum Fitted: Equatable {
        case nothing
        case tooLong
        case signed(CardSignature)
    }

    /// Strokes drawn on the pad (box units, any precision) as the server keeps them: simplified, whole numbers,
    /// inside the box, at most 2 KB (the same steps as web).
    static func fit(_ strokes: [[CGPoint]]) -> Fitted {
        let drawn = strokes.filter { !$0.isEmpty }
        guard !drawn.isEmpty else { return .nothing }
        guard drawn.count <= maxStrokes else { return .tooLong }
        for epsilon in [0.6, 0.9, 1.3, 1.9, 2.8, 4] as [CGFloat] {
            let fitted = drawn.map { stroke -> [Int] in
                var flat: [Int] = []
                for point in simplify(stroke, epsilon: epsilon) {
                    let x = Int(min(boxWidth, max(0, point.x.rounded())))
                    let y = Int(min(boxHeight, max(0, point.y.rounded())))
                    if flat.count >= 2, flat[flat.count - 2] == x, flat[flat.count - 1] == y { continue }
                    flat += [x, y]
                }
                return flat
            }
            let signature = CardSignature(width: Int(boxWidth), height: Int(boxHeight), strokes: fitted)
            if let data = try? JSONEncoder().encode(signature), data.count <= maxBytes {
                return .signed(signature)
            }
        }
        return .tooLong
    }

    /// Ramer-Douglas-Peucker: the fewest points that stay within `epsilon` of the line drawn.
    private static func simplify(_ points: [CGPoint], epsilon: CGFloat) -> [CGPoint] {
        guard points.count >= 3, let first = points.first, let last = points.last else { return points }
        let dx = last.x - first.x
        let dy = last.y - first.y
        let length = max(hypot(dx, dy), 0.000_1)
        var far: CGFloat = 0
        var index = 0
        for i in 1..<(points.count - 1) {
            let distance = abs(dy * points[i].x - dx * points[i].y + last.x * first.y - last.y * first.x) / length
            if distance > far {
                far = distance
                index = i
            }
        }
        guard far > epsilon else { return [first, last] }
        let left = simplify(Array(points[...index]), epsilon: epsilon)
        let right = simplify(Array(points[index...]), epsilon: epsilon)
        return left.dropLast() + right
    }
}

/// Sign your name: a strip of the card's paper, four times as wide as it is tall, to sign with a finger. Done keeps
/// it; Use my typed name puts the typed first name back.
struct CardTableSignPad: View {
    let initial: CardSignature?
    let onDone: (CardSignature) -> Void
    let onTyped: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var strokes: [[CGPoint]] = []
    @State private var tooLong = false
    @State private var loaded = false
    @State private var touching = false

    var body: some View {
        let hasInk = strokes.contains { !$0.isEmpty }
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack {
                Text("Sign your name")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Close") { dismiss() }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("cardSignClose")
            }
            Text("Sign with your finger. It goes beside FROM, in the card's ink.")
                .font(.system(size: 14))
                .foregroundStyle(MailPaper.cardTextSoft)
                .fixedSize(horizontal: false, vertical: true)
            pad(hasInk: hasInk)
            if tooLong {
                Text("Sign a little more simply, or leave your name typed.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(MailPaper.wax)
                    .accessibilityIdentifier("cardSignTooLong")
            }
            HStack(spacing: Spacing.s2) {
                Button("Clear") {
                    strokes = []
                    tooLong = false
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(MailPaper.cardText)
                .padding(.horizontal, Spacing.s4)
                .frame(minHeight: 44)
                .background(Capsule().strokeBorder(MailPaper.cardText.opacity(0.22), lineWidth: 1))
                .disabled(!hasInk)
                .opacity(hasInk ? 1 : 0.5)
                .accessibilityIdentifier("cardSignClear")
                if initial != nil {
                    Button("Use my typed name") {
                        onTyped()
                        dismiss()
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .underline()
                    .foregroundStyle(MailPaper.cardText)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("cardSignTyped")
                }
                Spacer(minLength: 0)
                Button {
                    switch CardTableSignature.fit(strokes) {
                    case .nothing: break
                    case .tooLong: tooLong = true
                    case let .signed(signature):
                        onDone(signature)
                        dismiss()
                    }
                } label: {
                    Text("Done")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MailPaper.waxText)
                        .frame(minWidth: 96, minHeight: 44)
                        .padding(.horizontal, Spacing.s3)
                        .background(Capsule().fill(MailPaper.wax))
                }
                .disabled(!hasInk)
                .opacity(hasInk ? 1 : 0.5)
                .accessibilityIdentifier("cardSignDone")
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity)
        .background(MailPaper.cardPaper(nil).ignoresSafeArea())
        .onAppear {
            guard !loaded else { return }
            loaded = true
            if let initial { strokes = CardTableSignature.points(initial) }
        }
    }

    private func pad(hasInk: Bool) -> some View {
        GeometryReader { geo in
            let scale = geo.size.width / CardTableSignature.boxWidth
            Canvas { context, _ in
                var line = Path()
                let y = CardTableSignature.line * scale
                line.move(to: CGPoint(x: 12 * scale, y: y))
                line.addLine(to: CGPoint(x: 388 * scale, y: y))
                context.stroke(line, with: .color(MailPaper.tablePenInk.opacity(0.28)), style: StrokeStyle(lineWidth: 1, dash: [4, 5]))
                context.stroke(
                    CardTableSignature.path(strokes).applying(CGAffineTransform(scaleX: scale, y: scale)),
                    with: .color(MailPaper.tablePenInk),
                    style: StrokeStyle(lineWidth: CardTableSignature.strokeWidth * scale, lineCap: .round, lineJoin: .round)
                )
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { value in
                        let point = CGPoint(
                            x: min(CardTableSignature.boxWidth, max(0, value.location.x / scale)),
                            y: min(CardTableSignature.boxHeight, max(0, value.location.y / scale))
                        )
                        // A new touch starts a new stroke.
                        if !touching || strokes.isEmpty {
                            touching = true
                            strokes.append([point])
                            tooLong = false
                        } else {
                            strokes[strokes.count - 1].append(point)
                        }
                    }
                    .onEnded { _ in touching = false }
            )
        }
        .aspectRatio(4, contentMode: .fit)
        .background(MailPaper.cardPaper(nil).brightness(-0.02))
        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 4, style: .continuous).strokeBorder(MailPaper.cardText.opacity(0.18), lineWidth: 1))
        .accessibilityElement()
        .accessibilityLabel(hasInk ? "Your signature" : "Space to sign your name")
        .accessibilityIdentifier("cardSignArea")
    }
}
