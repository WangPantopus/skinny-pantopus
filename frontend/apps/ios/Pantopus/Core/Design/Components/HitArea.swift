//
//  HitArea.swift
//  Pantopus
//
//  Makes a small icon or text button easier to hit without moving anything around it.
//

import SwiftUI

public extension View {
    /// Grows the tappable area by `horizontal` and `vertical` points on each side while the layout stays as it was:
    /// the hit shape is padded out and the layout padding is taken back. Put it on a button's label (inside the
    /// `Button`), so the button's own area includes it. Icon buttons are 28 to 36 pt and bare text buttons only as tall
    /// as their text; Apple's minimum is 44 x 44 pt.
    func hitArea(horizontal: CGFloat = 0, vertical: CGFloat = 0) -> some View {
        padding(.horizontal, horizontal)
            .padding(.vertical, vertical)
            .contentShape(Rectangle())
            .padding(.horizontal, -horizontal)
            .padding(.vertical, -vertical)
    }
}
