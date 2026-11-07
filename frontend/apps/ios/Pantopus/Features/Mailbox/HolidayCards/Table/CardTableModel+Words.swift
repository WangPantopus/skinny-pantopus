//
//  CardTableModel+Words.swift
//  Pantopus
//
//  The words and buttons that follow what's on the table (launch key
//  `card_table`), as the sample says them.
//

import Foundation

extension CardTableModel {
    /// The words at the top; nil when there are none.
    var words: String? {
        switch step {
        case .front:
            content.sealed ? "\(content.firstName) sealed this card." : "A Christmas card from \(content.firstName)."
        case .back:
            content.sealed ? "It opens Christmas morning, \(content.sealedInDays)." : nil
        case .flap, .pulling, .out:
            nil
        }
    }

    /// The words stay out of the way of what's moving.
    var wordsShow: Bool {
        words != nil && springs.pull.x <= 0.02 && step != .pulling && !controlsHidden
    }

    /// The button at the bottom; nil when there's none to press.
    var primaryTitle: String? {
        switch step {
        case .front:
            "Turn it over"
        case .back:
            content.sealed ? "Try to open it" : "Open it"
        case .flap:
            "Take the card out"
        case .pulling:
            nil
        case .out:
            fold.isSpread ? nil : (cardBackIsUp ? "Turn it back" : "Turn it over")
        }
    }

    var hint: String {
        switch step {
        case .front:
            envelopeTurnedOnce ? "or swipe it" : "or swipe it, the way you’d turn it in your hand"
        case .back:
            content.sealed ? "or pull the flap up" : "or pull the flap up with your finger"
        case .flap:
            "or pull it out with your finger"
        case .pulling:
            ""
        case .out:
            restingHint
        }
    }

    /// Once the card is on the table.
    private var restingHint: String {
        if fold.isSpread || reduceMotion { return "" }
        if !turnedOnce { return "or swipe it" }
        return heldOnce ? "" : "press and hold, then move your finger: the light moves"
    }

    /// Share and ⋯: once the card is out, or any time on a sealed card.
    var showsTopRight: Bool {
        step == .out || (content.sealed && (step == .back || step == .front))
    }

    var cardBackIsUp: Bool {
        cos(springs.card.t * .pi / 180) < 0
    }

    /// "Not yet. 12 days until Christmas morning."
    var notYet: String {
        switch content.sealedDayCount {
        case ...0: "Not yet. Christmas morning is almost here."
        case 1: "Not yet. 1 day until Christmas morning."
        default: "Not yet. \(content.sealedDayCount) days until Christmas morning."
        }
    }

    /// What VoiceOver reads for what's on the table.
    var spokenLabel: String {
        switch step {
        case .front, .back, .flap, .pulling:
            "Christmas card from \(content.firstName)\(content.sealed ? ", sealed until Christmas morning" : "")"
        case .out:
            "Card from \(content.firstName): \(HolidayCardWords.captionSentence(content.caption)) On the back: \(content.note)"
        }
    }
}
