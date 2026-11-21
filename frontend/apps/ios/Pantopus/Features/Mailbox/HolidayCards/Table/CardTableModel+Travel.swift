//
//  CardTableModel+Travel.swift
//  Pantopus
//
//  A travelling card on the table (server switch `card_travel`, travelling card plan Part 3): the newest postmark is
//  struck last as the envelope arrives, with the thump today's postmark has, and the words above the envelope say how
//  far it came. A card that doesn't travel has no travel and none of this runs.
//

import Foundation

extension CardTableModel {
    /// The postmarks on the envelope, oldest first; empty for a card that doesn't travel.
    var travelMarks: [CardTravelMark] {
        content.travel?.marks ?? []
    }

    /// "It came 2,692 miles through 4 towns to reach you." under the words at the top, on the address side; nil for a
    /// card on its first stop, a card that doesn't travel, and every other moment.
    var wordsSmall: String? {
        guard sending == nil, step == .front, !content.sealed else { return nil }
        return content.travel?.cameLine
    }

    /// The newest postmark waits for the envelope to land, then is struck (0 to 1); it shows at once with Reduce
    /// Motion and when the card is already on the table.
    func resetStrike(animated: Bool) {
        travelStrike = animated && !reduceMotion && !travelMarks.isEmpty ? Self.strikeWait : 1
    }

    /// The strike's clock: a beat after the envelope settles, 0.42 s to land, the thump as it touches the paper.
    func advanceStrike(elapsed: Double) -> Bool {
        guard travelStrike < 1 else { return false }
        guard springs.drop.x < 0.03 else { return true }
        let before = travelStrike
        travelStrike = min(1, travelStrike + elapsed / 0.42)
        if before < Self.strikeTouch, travelStrike >= Self.strikeTouch { haptics.tap(.firm) }
        return true
    }

    /// How far the newest postmark is struck, 0 to 1, for drawing.
    var strikeShown: Double {
        max(0, travelStrike)
    }

    /// Where the strike starts: below 0 is the beat it waits.
    nonisolated static let strikeWait = -0.35
    /// Where its landing curve first touches the paper.
    nonisolated static let strikeTouch = 0.385

    /// What VoiceOver adds about the postmarks, on the envelope.
    var spokenMarks: String {
        let marks = travelMarks
        guard !marks.isEmpty, step != .out else { return "" }
        let towns = marks.map { mark in mark.state.map { "\(mark.town), \($0)" } ?? mark.town }
        return ". Its envelope has \(marks.count == 1 ? "one postmark" : "\(marks.count) postmarks"): "
            + towns.joined(separator: "; ")
    }
}
