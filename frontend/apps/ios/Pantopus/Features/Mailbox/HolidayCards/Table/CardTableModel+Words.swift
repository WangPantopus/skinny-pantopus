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
        if let sending { return sendingWords(sending) }
        if content.isLetter { return step == .front ? "A letter from \(content.firstName)." : nil }
        return switch step {
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
        if sending != nil { return words != nil && !controlsHidden }
        return words != nil && springs.pull.x <= 0.02 && step != .pulling && !controlsHidden
    }

    /// The button at the bottom; nil when there's none to press.
    var primaryTitle: String? {
        if let sending { return sendingTitle(sending) }
        return switch step {
        case .front:
            "Turn it over"
        case .back:
            content.sealed ? "Try to open it" : "Open it"
        case .flap:
            content.isLetter ? "Take the letter out" : "Take the card out"
        case .pulling:
            nil
        case .out:
            content.isLetter ? "Read the letter" : fold.isSpread ? nil : (cardBackIsUp ? "Turn it back" : "Turn it over")
        }
    }

    var hint: String {
        if let sending { return sendingHint(sending) }
        return switch step {
        case .front:
            envelopeTurnedOnce ? "or swipe it" : "or swipe it, the way you’d turn it in your hand"
        case .back:
            content.sealed ? "or pull the flap up" : "or pull the flap up with your finger"
        case .flap:
            "or pull it out with your finger"
        case .pulling:
            ""
        case .out:
            content.isLetter ? "" : readsVerse ? "Read the verse" : restingHint
        }
    }

    /// A Christmas with Jesus Christ card out of its envelope: the hint is the link "Read the verse" (plan 6.2).
    var readsVerse: Bool {
        step == .out && sending == nil && !content.sealed && !(content.verse ?? "").isEmpty
    }

    /// The quiet buttons under the main one: "Send {first name} a card" and "Share this card" (plan 11.1), once the
    /// reader has turned the card over (on the open Duo both sides show, so at once). Never on a sealed card; the
    /// corner's share stays.
    var secondaries: [CardTableMenuItem] {
        if let sending { return sending == .gone ? goneButtons : [] }
        guard step == .out, !content.sealed, turnedOnce || fold.isSpread else { return [] }
        var items: [CardTableMenuItem] = []
        if let sendBack { items.append(sendBack) }
        if offersShare {
            items.append(CardTableMenuItem(title: "Share this card", identifier: "cardTableShareQuiet") { [weak self] in
                self?.isSharing = true
            })
        }
        return items
    }

    // MARK: Sealing (plan Part 2)

    private func sendingWords(_ sending: CardTableSending) -> String? {
        let first = sendingSetup?.toFirstName ?? ""
        switch sending {
        case .ready: return first.isEmpty ? nil : "For \(first)."
        case .shut: return sealRefusal ?? "Press and hold to seal it."
        case .gone: return goneWords
        case .goingIn, .inside, .closing, .sealing, .addressing: return nil
        }
    }

    private func sendingTitle(_ sending: CardTableSending) -> String? {
        switch sending {
        case .ready: reduceMotion ? "Seal and send" : "Put it in the envelope"
        case .inside: "Close the flap"
        case .shut: "Seal it"
        case .gone: gonePrimary
        case .goingIn, .closing, .sealing, .addressing: nil
        }
    }

    private func sendingHint(_ sending: CardTableSending) -> String {
        guard !reduceMotion else { return "" }
        switch sending {
        case .ready: return "or push the card up into the envelope"
        case .inside: return "or pull the flap down"
        case .shut: return "or press and hold the envelope"
        case .goingIn, .closing, .sealing, .addressing, .gone: return ""
        }
    }

    /// Where the open Duo's pages must end: above the buttons when one can show under them (plan 1.7).
    func pagesBottomRoom(_ layout: CardTableLayout) -> CGFloat? {
        reservesSecondary ? layout.bottomControls + 12 : nil
    }

    /// Once the card is on the table.
    private var restingHint: String {
        if fold.isSpread || reduceMotion { return "" }
        if !turnedOnce { return "or swipe it" }
        return heldOnce ? "" : "press and hold, then move your finger: the light moves"
    }

    /// Share and ⋯: once the card is out, or any time on a sealed card.
    var showsTopRight: Bool {
        if sending != nil { return false }
        return step == .out || (content.sealed && (step == .back || step == .front))
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
        if let sending { return sendingSpoken(sending) }
        if content.isLetter {
            return step == .out ? "The letter from \(content.firstName). Opening it." : "A letter from \(content.firstName)"
        }
        return switch step {
        case .front, .back, .flap, .pulling:
            "Christmas card from \(content.firstName)\(content.sealed ? ", sealed until Christmas morning" : "")"
        case .out:
            "Card from \(content.firstName): \(HolidayCardWords.captionSentence(content.caption)) On the back: \(content.note)"
                + (content.photo == nil ? "" : " With it: a photo.")
        }
    }

    private func sendingSpoken(_ sending: CardTableSending) -> String {
        let first = sendingSetup?.toFirstName ?? ""
        let to = first.isEmpty ? "" : " for \(first)"
        switch sending {
        case .ready, .goingIn:
            return "Your card\(to), note side up, with its open envelope"
        case .inside, .closing:
            return "Your card in its envelope\(to), the flap open"
        case .shut:
            return "The envelope\(to), the flap shut, not sealed yet"
        case .sealing, .addressing:
            return "The envelope\(to), sealed"
        case .gone:
            return goneWords ?? "On its way."
        }
    }
}
