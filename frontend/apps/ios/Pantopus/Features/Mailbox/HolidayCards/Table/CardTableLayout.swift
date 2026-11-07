//
//  CardTableLayout.swift
//  Pantopus
//
//  Fitting the card to the screen (launch key `card_table`): the card nearly as
//  wide as the phone, room below it for the buttons, and above it the open flap
//  peeking out by between 13% and 47% of the card's width. If the screen is too
//  short for 13% the card shrinks. Open on the iPhone Duo, the two pages of the
//  folded card meet at the hinge.
//

import CoreGraphics

/// Where the mail lies, for the room it has.
struct CardTableLayout: Equatable {
    /// The whole screen.
    let screen: CGSize
    /// The room left of any side strip (the closed Duo's); it runs from the screen's left edge.
    let width: CGFloat
    let height: CGFloat
    let safeTop: CGFloat
    /// The card.
    let cardWidth: CGFloat
    let cardHeight: CGFloat
    let cardX: CGFloat
    let cardTop: CGFloat
    /// The card just out of the envelope, before it's laid down.
    let cardTopOut: CGFloat
    /// The envelope.
    let envelopeWidth: CGFloat
    let envelopeHeight: CGFloat
    let flapDepth: CGFloat
    let envelopeX: CGFloat
    /// Shut, a little above the middle of the free space.
    let envelopeTop: CGFloat
    /// With the flap open, low enough that the tip stays on a short screen.
    let envelopeTopOpen: CGFloat
    /// Sunk as the card rises out.
    let envelopeTopOut: CGFloat
    /// Laid down behind the card.
    let envelopeTopFinal: CGFloat

    /// - Parameters:
    ///   - screen: the whole screen.
    ///   - trailingStrip: the system strip down one side (the closed Duo's), to keep clear of.
    ///   - safeTop: the top of the safe area.
    ///   - bottomControls: how much the buttons take at the bottom, with the safe area.
    ///   - wordsBottom: how far down the words at the top reach, from the screen's top.
    init(screen: CGSize, trailingStrip: CGFloat, safeTop: CGFloat, bottomControls: CGFloat, wordsBottom: CGFloat) {
        self.screen = screen
        self.safeTop = safeTop
        let width = screen.width - trailingStrip
        let height = screen.height
        self.width = width
        self.height = height
        let bottom = bottomControls + 8
        let topGap = safeTop + 6
        let room = height - topGap - bottom
        let side: CGFloat = width < 560 ? 9 : 14
        var cardWidth = min(width - side * 2, width < 560 ? 470 : 560)
        var peek = room - cardWidth * 1.2
        let minPeek = cardWidth * 0.13
        let maxPeek = cardWidth * 0.47
        if peek < minPeek {
            cardWidth = min(cardWidth, room / (1.2 + 0.13))
            peek = cardWidth * 0.13
        }
        peek = min(peek, maxPeek)
        let spare = max(0, room - cardWidth * 1.2 - peek)
        let cardTop = topGap + spare * 0.46 + peek
        let envelopeWidth = cardWidth * 1.012
        let envelopeHeight = envelopeWidth * 1392 / 1200
        let flapDepth = envelopeWidth * 512 / 1200
        let free = height - safeTop - bottom
        let envelopeTop = safeTop + max(88, max((free - envelopeHeight) * 0.56, wordsBottom - safeTop + 8))
        let envelopeTopOut = min(height - envelopeHeight * 0.5, cardWidth * 1.2 * 0.8 + 8)
        self.cardWidth = cardWidth
        cardHeight = cardWidth * 1.2
        cardX = (width - cardWidth) / 2
        self.cardTop = cardTop
        cardTopOut = envelopeTopOut - cardWidth * 1.2 * 1.02 - 8
        self.envelopeWidth = envelopeWidth
        self.envelopeHeight = envelopeHeight
        self.flapDepth = flapDepth
        envelopeX = (width - envelopeWidth) / 2
        self.envelopeTop = envelopeTop
        envelopeTopOpen = max(envelopeTop, safeTop + flapDepth * 0.9 + 4)
        self.envelopeTopOut = envelopeTopOut
        envelopeTopFinal = cardTop - peek + flapDepth
    }
}

/// How the iPhone Duo is holding the folded card.
enum CardTableFold: Equatable {
    /// One page at a time, as on any phone.
    case single
    /// Open sideways: the hinge runs down the screen, at this x. Half closed is `halfClosed`.
    case sideways(hingeX: CGFloat, halfClosed: Bool)
    /// Upright: the hinge runs across the screen, at this y.
    case upright(hingeY: CGFloat, halfClosed: Bool)

    var isSpread: Bool {
        self != .single
    }

    var isHalfClosed: Bool {
        switch self {
        case .single: false
        case let .sideways(_, halfClosed), let .upright(_, halfClosed): halfClosed
        }
    }

    /// The two pages and the flap above them, for this fold on a screen this wide.
    func pages(screen: CGSize) -> CardTablePages? {
        switch self {
        case .single:
            return nil
        case let .sideways(hingeX, _):
            // Each page is as big as the whole card on an iPhone, from just under the top.
            let width: CGFloat = 391
            let height = width * 1.2
            let top = min(100, max(0, screen.height - height - 100))
            return CardTablePages(
                pictureFrame: CGRect(x: hingeX - width, y: top, width: width, height: height),
                noteFrame: CGRect(x: hingeX, y: top, width: width, height: height),
                spine: hingeX,
                isSideways: true,
                flapWidth: 430,
                flapTop: 9
            )
        case let .upright(hingeY, _):
            // Each page near the hinge, about 366 wide, in the middle of the screen.
            let width: CGFloat = 366
            let height = width * 1.2
            let gap: CGFloat = 8.5
            let x = (screen.width - width) / 2
            return CardTablePages(
                pictureFrame: CGRect(x: x, y: hingeY - gap - height, width: width, height: height),
                noteFrame: CGRect(x: x, y: hingeY + gap, width: width, height: height),
                spine: hingeY,
                isSideways: false,
                flapWidth: nil,
                flapTop: 0
            )
        }
    }
}

/// The folded card's two pages on the open Duo.
struct CardTablePages: Equatable {
    let pictureFrame: CGRect
    let noteFrame: CGRect
    /// The hinge: x sideways, y upright.
    let spine: CGFloat
    let isSideways: Bool
    /// The flap's width above the pages (sideways only).
    let flapWidth: CGFloat?
    let flapTop: CGFloat
}
