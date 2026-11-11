//
//  CardTableContent.swift
//  Pantopus
//
//  What lies on the card table (launch key `card_table`): the card's picture, note and names, its seal, and its own
//  photo (memories plan step 4).
//

import Foundation

/// What's on the table.
struct CardTableContent: Equatable {
    let design: String
    let number: Int?
    let caption: String
    let paper: String?
    /// The cloth's colour (hex).
    let table: String?
    let slug: String?
    let year: Int
    /// The day it was mailed ("OCT 30") for the postmarks.
    let mailedOn: String?
    let note: String
    let fromName: String
    let toName: String
    var sealed: Bool
    /// When the seal lifts: an instant, or a day (`YYYY-MM-DD`).
    let sealedUntil: String?
    /// "in 56 days", "tomorrow" or "today".
    var sealedInDays: String
    /// How many days until it opens, for "Not yet."
    var sealedDayCount: Int
    /// A Christmas with Jesus Christ card's whole verse, for "Read the verse" (plan 6.2); nil for the rest, while
    /// it's sealed, and in Sent (the server doesn't send it there).
    var verse: String?
    /// The sender's signature beside FROM (plan 8.2), drawn in place of the typed first name; nil while sealed and when
    /// unsigned.
    var signature: CardSignature?
    /// A letter, not a card (plan Part 10, the welcome letter): the cream envelope with the red seal on slate, the same
    /// moves, and a folded sheet inside that opens the letter page.
    var isLetter = false
    /// The card's own photo (memories plan step 4, `holiday_card_memories`), lying on the table beside the card once
    /// it's turned over; nil while sealed, on a letter and without one. `covered` until the reader taps it.
    var photo: CardPhoto?
    /// Whose route its bytes come from: the reader's piece, the sender's Sent, or the uploader's own (Look it over).
    var mediaFrom: CardMediaFrom?

    var firstName: String {
        HolidayCardWords.firstName(fromName)
    }
}

/// Whose route a card's own photo and voice come through on the table.
enum CardMediaFrom: Equatable {
    /// The recipient's delivered piece (`GET /api/mailbox/:id/card-media/:fileId`).
    case piece(mailId: String)
    /// The sender's Sent (`GET /api/mailbox/sent/:id/card-media/:fileId`).
    case sent(cardId: String)
    /// The uploader's own files, before the card is sent (Look it over).
    case own

    func source(_ fileId: String) -> CardMediaSource {
        switch self {
        case let .piece(mailId): .piece(mailId: mailId, fileId: fileId)
        case let .sent(cardId): .sent(cardId: cardId, fileId: fileId)
        case .own: .own(fileId: fileId)
        }
    }
}
