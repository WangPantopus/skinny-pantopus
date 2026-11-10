//
//  CardTableLayout.swift
//  Pantopus
//
//  Fitting the card to the screen (launch key `card_table`): the card nearly as
//  wide as the phone, room below it for the buttons (at least 12 pt clear of
//  any paper), and above it the open flap peeking out by between 13% and 47% of
//  the card's width. If the screen is too short, the card shrinks. Open on the iPhone Duo, the two pages of the
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
    /// What the buttons take at the bottom, with the safe area.
    let bottomControls: CGFloat
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

    /// The widest the card gets in this much width: 470 on a phone, 560 from 560 wide, growing to 640 on tablets and
    /// wide windows (plan 6.3), so the open Duo upright gets one card about 600 wide (plan 6.4). The height can make it
    /// smaller.
    static func cardCap(width: CGFloat) -> CGFloat {
        width < 560 ? 470 : min(640, max(560, (width * 0.9).rounded()))
    }

    /// - Parameters:
    ///   - screen: the whole screen.
    ///   - trailingStrip: the system strip down one side (the closed Duo's), to keep clear of.
    ///   - safeTop: the top of the safe area.
    ///   - bottomControls: how much the buttons take at the bottom, with the safe area.
    ///   - wordsBottom: how far down the words at the top reach, from the screen's top.
    init(screen: CGSize, trailingStrip: CGFloat, safeTop: CGFloat, bottomControls: CGFloat, wordsBottom: CGFloat) {
        self.screen = screen
        self.safeTop = safeTop
        self.bottomControls = bottomControls
        let width = screen.width - trailingStrip
        let height = screen.height
        self.width = width
        self.height = height
        // The buttons start at least 12 pt below the lowest paper edge (plan 1.7), and 4 more for the
        // envelope's and the card's small turns, which lower a corner.
        let bottom = bottomControls + 12 + 4
        let topGap = safeTop + 6
        let room = height - topGap - bottom
        let side: CGFloat = width < 560 ? 9 : 14
        // Laid down, the envelope reaches from the flap's tip (`cardTop − peek`) down 1.606 card widths
        // (flap and body), lower than the card itself while the peek is under 0.406. Shut, it sits at least
        // 88 pt below the safe area. If the screen is too short for either, the card shrinks. (Under the words
        // when there's room; at the largest text sizes the words get their own glass instead.)
        let laidReach: CGFloat = 1.012 * (512 + 1392) / 1200
        let shutRoom = height - safeTop - bottom - 88
        var cardWidth = min(width - side * 2, Self.cardCap(width: width))
        cardWidth = max(0, min(cardWidth, room / laidReach, shutRoom / (1.012 * 1392 / 1200)))
        var peek = room - cardWidth * 1.2
        let minPeek = cardWidth * 0.13
        let maxPeek = cardWidth * 0.47
        peek = min(max(peek, minPeek), maxPeek)
        let spare = max(0, room - cardWidth * 1.2 - peek)
        let cardTop = topGap + spare * 0.46 + peek
        let envelopeWidth = cardWidth * 1.012
        let envelopeHeight = envelopeWidth * 1392 / 1200
        let flapDepth = envelopeWidth * 512 / 1200
        let free = height - safeTop - bottom
        let envelopeTop = safeTop + max(88, min(max((free - envelopeHeight) * 0.56, wordsBottom - safeTop + 8), free - envelopeHeight))
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
    /// Upright: the hinge runs across the screen, at this y. Only half closed (tabletop): flat, the fold reader says
    /// `single` (plan 6.4).
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

    /// The two pages and the flap above them, for this fold on a screen this wide. `bottomRoom`: when a button can
    /// show under the open card, the pages end this far above the bottom (the buttons start 12 pt below the paper).
    func pages(screen: CGSize, bottomRoom: CGFloat? = nil) -> CardTablePages? {
        switch self {
        case .single:
            return nil
        case let .sideways(hingeX, _):
            // Each page is as big as the whole card on an iPhone, from just under the top.
            var width: CGFloat = 391
            let top = min(100, max(0, screen.height - width * 1.2 - 100))
            if let bottomRoom { width = min(width, max(200, (screen.height - top - bottomRoom) / 1.2)) }
            let height = width * 1.2
            return CardTablePages(
                pictureFrame: CGRect(x: hingeX - width, y: top, width: width, height: height),
                noteFrame: CGRect(x: hingeX, y: top, width: width, height: height),
                spine: hingeX,
                isSideways: true,
                flapWidth: 430,
                flapTop: 9
            )
        case let .upright(hingeY, _):
            // Half closed (tabletop; flat it's one card): each page about 366 wide in the middle of the screen, the
            // picture standing on the top half and the note lying on the bottom one, meeting at the hinge with no gap
            // so it reads as one folded card; the crease is shaded (plan 6.5).
            let gap: CGFloat = 0
            var width: CGFloat = 366
            if let bottomRoom { width = min(width, max(200, (screen.height - hingeY - gap - bottomRoom) / 1.2)) }
            let height = width * 1.2
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
