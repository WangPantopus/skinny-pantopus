//
//  HolidayCardBoughtStamp.swift
//  Pantopus
//
//  A card's own photo or voice greeting goes only on a card sent with a bought stamp (founder, 2026-11-11; contract
//  `wave4-contract-notes` "Bought stamp only", server #3919). The server says what to do in `GET /api/mailbox/cards`
//  `media.bought_stamp.state`; with none left, "Add a photo" and "Record a greeting" open the stamp books, and a look
//  or seal the server refuses (402 `CARD_MEDIA_NEEDS_STAMP`) opens them too, keeping the card as it is.
//

import Foundation

extension HolidayCardFlowViewModel {
    /// The stamp books, saying a photo or greeting goes only with a bought stamp.
    func openStampsForMedia() {
        stampsForMedia = true
        showsStampBooks = true
    }

    /// The card carries a photo or greeting, so it spends a bought stamp.
    var carriesMedia: Bool {
        !mediaPick.isEmpty
    }

    /// Bought stamps left, from the stamp books' balance; nil before it's read.
    var boughtStampsLeft: Int? {
        stamps.balance.map { max(0, $0.paidRemaining) }
    }
}
