//
//  CardTableMediaLayer.swift
//  Pantopus
//
//  The card's own photo on the table (memories plan step 4, `holiday_card_memories`; wave 4 drawings 3, 4 and 5), as
//  web's #3883 and #3890 lay it: once the card is turned over it lies on the table, not on the card, so it stays put
//  while the card moves. Beside the card where the table has room on each side, under it (a little over its foot) on
//  a phone, where the layout keeps it room above the buttons. A photo from someone who isn't the reader's connection
//  is covered ("Photo from {name}. Tap to show.") and nothing is fetched until the tap. It's a layer of its own, so
//  screen readers reach the print's description and the cover's button.
//

import SwiftUI

struct CardTableMediaLayer: View {
    let model: CardTableModel
    let layout: CardTableLayout
    @State private var uncovered = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// How much room the layout keeps under the card for the print: none without one, on a letter, beside a wide
    /// card, or on the open Duo's pages.
    static func room(for content: CardTableContent, screen: CGSize, strip: CGFloat, fold: CardTableFold) -> CGFloat {
        guard content.photo != nil, !content.isLetter, !fold.isSpread else { return 0 }
        let width = screen.width - strip
        guard !isWide(width: width) else { return 0 }
        return min(160, max(110, (screen.height * 0.16).rounded()))
    }

    /// At least 176 pt of table at each side of the card: the print lies beside it.
    private static func isWide(width: CGFloat) -> Bool {
        (width - CardTableLayout.cardCap(width: width)) / 2 >= 176
    }

    var body: some View {
        // Off the table entirely while hidden, so a screen reader never reaches a print that isn't there.
        ZStack(alignment: .topLeading) {
            if shown, let photo = model.content.photo, let from = model.content.mediaFrom {
                let frame = printFrame(photo)
                CardPrintView(
                    source: from.source(photo.fileId),
                    aspect: photo.aspect,
                    alt: photo.alt,
                    datedOn: CardTableMood(number: model.content.number) == .nostalgia ? mailedDay : nil,
                    covered: photo.covered && !uncovered,
                    fromName: model.content.fromName,
                    onUncover: { uncovered = true },
                    tilt: -3
                )
                .frame(width: frame.width)
                .position(x: frame.midX, y: frame.minY + frame.width * printK(photo) / 2)
                .transition(reduceMotion ? .identity : .opacity.combined(with: .offset(y: frame.width * 0.05)))
                .accessibilityIdentifier("cardTablePrint")
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.45), value: shown)
    }

    /// Once the card is out and turned over, not while it's enlarged or being sealed.
    private var shown: Bool {
        model.step == .out && model.sending == nil && !model.isZoomed && !model.content.sealed
            && (model.fold.isSpread ? model.springs.spread.x > 0.9 : model.cardBackIsUp)
    }

    /// The print's height for its width, border included.
    private func printK(_ photo: CardPhoto) -> CGFloat {
        0.88 / max(photo.aspect, 0.2) + 0.2
    }

    /// Where the print lies (its top edge and width).
    private func printFrame(_ photo: CardPhoto) -> CGRect {
        let k = printK(photo)
        if model.fold.isSpread, let pages = model.fold.pages(
            screen: layout.screen,
            bottomRoom: model.pagesBottomRoom(layout)
        ) {
            // The open Duo: over the note page's lower right corner, clear of FROM and the caption, hanging a little
            // below the page.
            let page = pages.noteFrame
            let width = min(page.width * 0.42, page.height * 0.46 / k)
            let top = page.maxY - width * k * 0.88
            return CGRect(x: page.maxX - width - page.width * 0.05, y: top, width: width, height: width * k)
        }
        let cardBottom = layout.cardTop + layout.cardHeight
        if Self.isWide(width: layout.width) {
            let width = min(240, layout.cardX - 24)
            let top = layout.cardTop + layout.cardHeight * 0.5
            return CGRect(x: layout.cardX + 20 - width, y: top, width: width, height: width * k)
        }
        let room = Self.room(for: model.content, screen: layout.screen, strip: layout.screen.width - layout.width, fold: model.fold)
        let width = min(layout.cardWidth * 0.47, room * 1.1 / k)
        return CGRect(x: layout.cardX + layout.cardWidth * 0.02, y: cardBottom - room * 0.16, width: width, height: width * k)
    }

    /// The day it was mailed ("NOV 10" on the postmark), as a date for the print's orange numbers.
    private var mailedDay: String? {
        guard let postmark = model.content.mailedOn else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d yyyy"
        guard let day = formatter.date(from: "\(postmark.capitalized) \(model.content.year)") else { return nil }
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: day)
    }
}
