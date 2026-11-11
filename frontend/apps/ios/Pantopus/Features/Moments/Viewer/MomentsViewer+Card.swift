//
//  MomentsViewer+Card.swift
//  Pantopus
//
//  Watching on the open iPhone Duo held sideways (boards O2, O5, O6, B1):
//  the phone's viewer in a card on the right half, beside the map. The
//  picture takes the card less the bottom 68 pt, with its bottom corners
//  rounded, and the reply box (or "Seen by") sits in that band, as on the
//  phone; the bars start 12 pt from the card's top. Typing a reply, the card
//  ends above the keyboard (the map sizes it). The … menu points at More.
//

import SwiftUI

extension MomentsViewer {
    /// Board O2's card, as tall and wide as the map gives it.
    var cardLayout: some View {
        GeometryReader { geo in
            let media = CGSize(width: geo.size.width, height: max(geo.size.height - 68, 200))
            ZStack(alignment: .top) {
                Color.black
                duoStage(size: media, barsTop: 12, headerButtons: true, captionBottom: 63)
                    .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 18, bottomTrailingRadius: 18, style: .continuous))
                bottomColumn(floating: false, showsReact: true, bottomInset: Spacing.s3)
                    .frame(width: geo.size.width, height: geo.size.height)
                moreAnchor
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
    }

    /// The menu's popover points at the header's More button: a clear stand-in where it is (Close is 44 wide on a
    /// photo, then More; a video's buttons are 40 wide). The header is 24 pt down: the bars at 12, 3 tall, 9 below.
    private var moreAnchor: some View {
        let buttonWidth: CGFloat = model.moment?.kind == .video ? 40 : 44
        return menuDialogs(on: Color.clear.frame(width: buttonWidth, height: 44), active: true)
            .padding(.top, 12 + 3 + 9 + 2)
            .padding(.trailing, Spacing.s1 + buttonWidth)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}
