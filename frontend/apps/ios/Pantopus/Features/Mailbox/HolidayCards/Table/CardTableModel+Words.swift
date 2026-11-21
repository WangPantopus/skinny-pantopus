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
            // A long note's first leaf: Read on, on the open Duo's note page too (plan Part 9).
            content.isLetter ? "Read the letter" : readsOn ? "Read on"
                : fold.isSpread ? nil : (cardBackIsUp ? "Turn it back" : "Turn it over")
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
            content.isLetter ? "" : hintLink?.title ?? (readsInPrint ? "" : restingHint)
        }
    }

    /// A Christmas with Jesus Christ card out of its envelope with the picture side up (or on the open Duo): "Read the
    /// verse" (plan 6.2).
    var readsVerse: Bool {
        step == .out && sending == nil && !content.sealed && !(content.verse ?? "").isEmpty
            && (!cardBackIsUp || fold.isSpread)
    }

    /// The note side up, out of its envelope, not sealed and not enlarged (on the open Duo the note's page shows): the
    /// note can be read in plain type that follows the phone's text size (plan Part 2).
    var readsInPrint: Bool {
        step == .out && sending == nil && !content.sealed && !content.isLetter && !isZoomed
            && !content.note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (cardBackIsUp || fold.isSpread)
    }

    /// "Read it in print" as a full button beside "Turn it back", in place of the line, when larger text is set.
    var printIsButton: Bool {
        readsInPrint && largerText
    }

    /// The bookmark the hint opens, when the hint is a link: "Read it in print" in place of "double-tap the card to
    /// enlarge it" on the note side, "Read the verse" on the picture side. The open Duo shows both sides; a verse card
    /// keeps its verse link there.
    var hintLink: CardTableBookmark? {
        if readsInPrint, !largerText, !(fold.isSpread && readsVerse) { return .print }
        return readsVerse ? .verse : nil
    }

    /// The quiet buttons that may show under the main one once the card has been turned over (on the open Duo both
    /// sides show, so at once), in the design check's order (Nov 17): "Open the next card (2 more)" when cards wait;
    /// "Write back to {first name}" or "You wrote back"; "Send {first name} a card". Only the first two show, side by
    /// side; all of them are in the ⋯ menu too. "Share this card" (plan 11.1) is a quiet button only on the sender's
    /// own look at their card; on a reader's card it keeps its corner and its ⋯ line. Never on a sealed card.
    var secondaries: [CardTableMenuItem] {
        if let sending { return sending == .gone ? goneButtons : [] }
        guard step == .out, !content.sealed, turnedOnce || fold.isSpread else { return [] }
        var items: [CardTableMenuItem] = []
        if let nextCard { items.append(nextCard) }
        if let writeBack { items.append(writeBack) }
        if let sendBack { items.append(sendBack) }
        if offersShare {
            items.append(CardTableMenuItem(title: "Share this card", identifier: "cardTableShareQuiet", short: "Share") { [weak self] in
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

    /// Where the open Duo's pages must end: above the buttons when one can show under them (plan 1.7), or when the
    /// hint is a link to read ("Read it in print", "Read the verse").
    func pagesBottomRoom(_ layout: CardTableLayout) -> CGFloat? {
        reservesSecondary || reservesNext || hintLink != nil || printIsButton ? layout.bottomControls + 12 : nil
    }

    /// Once the card is on the table.
    private var restingHint: String {
        // Enlarging works with Reduce Motion and on the closed Duo too, so its hint comes first.
        if isZoomed { return "double-tap to bring it back" }
        if fold.isSpread { return "" }
        if !turnedOnce { return reduceMotion ? "" : "or swipe it" }
        if !zoomedOnce { return "double-tap the card to enlarge it" }
        if reduceMotion { return "" }
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

    /// How far a card at this angle is turned over: 0 picture side up, 1 note side up, easing through the turn.
    nonisolated static func turned(_ angle: Double) -> Double {
        (1 - cos(angle * .pi / 180)) / 2
    }

    /// How far the card is turned over right now, as the finger or the spring has it.
    var cardTurned: Double {
        Self.turned(springs.card.x)
    }

    /// "Not yet. 12 days until Christmas morning."
    var notYet: String {
        switch content.sealedDayCount {
        case ...0: "Not yet. Christmas morning is almost here."
        case 1: "Not yet. 1 day until Christmas morning."
        default: "Not yet. \(content.sealedDayCount) days until Christmas morning."
        }
    }

    /// "With it: a photo and a voice greeting, 5 seconds." (memories plan steps 4 and 7).
    static func withIt(_ content: CardTableContent) -> String {
        let voice = content.voice.map { "a voice greeting, \(HolidayCardGreetingWords.spoken($0.durationMs))" }
        let things = [content.photo == nil ? nil : "a photo", voice].compactMap { $0 }
        return things.isEmpty ? "" : " With it: \(things.joined(separator: " and "))."
    }

    /// What VoiceOver reads for what's on the table.
    var spokenLabel: String {
        if let sending { return sendingSpoken(sending) }
        if content.isLetter {
            return step == .out ? "The letter from \(content.firstName). Opening it." : "A letter from \(content.firstName)"
        }
        return switch step {
        case .front, .back, .flap, .pulling:
            "Christmas card from \(content.firstName)\(content.sealed ? ", sealed until Christmas morning" : "")" + spokenMarks
        case .out:
            "Card from \(content.firstName): \(HolidayCardWords.captionSentence(content.caption)) On the back: \(content.note)"
                + Self.withIt(content)
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
