//
//  MessagesGlyph.swift
//  Pantopus
//
//  The Messages button's bubble (founder decision 2026-11-08, option "Sky"): one drawing on iOS, Android and
//  web in place of the three system icons they used. At rest it is a pale-blue bubble outlined in the brand
//  blue with three dots; with unread messages it fills solid with white dots. The unread count stays the red
//  badge `MessagesButton` draws over it.
//

import SwiftUI

/// The Messages bubble, drawn on a 24-unit grid and scaled to `size`.
struct MessagesGlyph: View {
    var unread = false
    var size: CGFloat = 24

    private static let dotXs: [CGFloat] = [8.1, 12, 15.9]

    var body: some View {
        let unit = size / 24
        let line = unread ? Theme.Color.primarySolid : Theme.Color.primaryInk
        ZStack {
            MessagesBubble()
                .fill(unread ? Theme.Color.primarySolid : Theme.Color.primary100)
            MessagesBubble()
                .stroke(line, style: StrokeStyle(lineWidth: 1.75 * unit, lineCap: .round, lineJoin: .round))
            ForEach(Self.dotXs, id: \.self) { dotX in
                Circle()
                    .fill(unread ? Theme.Color.appTextInverse : line)
                    .frame(width: 2.3 * unit, height: 2.3 * unit)
                    .position(x: dotX * unit, y: 11 * unit)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// The bubble outline: a circle of radius 8.8 around (12, 11) with a tail at the lower left.
private struct MessagesBubble: Shape {
    func path(in rect: CGRect) -> Path {
        let unit = rect.width / 24
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * unit, y: rect.minY + y * unit)
        }
        var path = Path()
        path.move(to: point(4.09, 14.86))
        path.addCurve(to: point(8.14, 3.09), control1: point(1.96, 10.49), control2: point(3.77, 5.22))
        path.addCurve(to: point(19.91, 7.14), control1: point(12.51, 0.96), control2: point(17.78, 2.77))
        path.addCurve(to: point(15.86, 18.91), control1: point(22.04, 11.51), control2: point(20.23, 16.78))
        path.addCurve(to: point(9.87, 19.54), control1: point(14, 19.82), control2: point(11.88, 20.04))
        path.addCurve(to: point(3.5, 21.3), control1: point(7.35, 18.91), control2: point(5.8, 20.6))
        path.addCurve(to: point(4.09, 14.86), control1: point(3.9, 19.4), control2: point(4.3, 17.2))
        path.closeSubpath()
        return path
    }
}
