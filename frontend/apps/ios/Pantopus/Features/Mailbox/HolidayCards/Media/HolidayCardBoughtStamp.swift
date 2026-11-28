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

    /// The card carries a photo or greeting, so it spends a bought stamp (with `improved`, once the free ones are used).
    var carriesMedia: Bool {
        !mediaPick.isEmpty
    }

    /// The card's photo or greeting spends a bought stamp: always with the switch off; with it on (cards-next Wave 2)
    /// only once the server asks for one again (`media.bought_stamp` is left out while free photo cards are left).
    var mediaSpendsBoughtStamp: Bool {
        carriesMedia && (!improved || cards?.media?.boughtStamp != nil)
    }

    /// The card's photo or greeting needs a bought stamp and none is left: Look it over and the seal open the stamp
    /// books instead.
    var mediaNeedsBoughtStamp: Bool {
        mediaSpendsBoughtStamp && boughtStampsLeft == 0
    }

    /// Bought stamps left, from the stamp books' balance; nil before it's read.
    var boughtStampsLeft: Int? {
        stamps.balance.map { max(0, $0.paidRemaining) }
    }

    /// Stamps of any kind left (free and bought), from the stamp books' balance or the cards' read.
    private var stampsLeft: Int {
        stamps.balance?.available ?? cards?.stamps?.available ?? 0
    }

    /// With `improved`, free photo cards left but no stamp of any kind (fix 4): a card can't go without one, so the
    /// row says what it said before the free cards, and its buttons open the stamp books.
    var mediaNeedsAnyStamp: Bool {
        guard improved, cards?.postageEnabled == true, let free = cards?.media?.freeAllowance, free.remaining > 0 else {
            return false
        }
        return stampsLeft == 0
    }

    /// The line under "Add a photo" and "Record a greeting" when they open the stamp books.
    var mediaNeedsStampLine: String {
        if improved, let free = cards?.media?.freeAllowance, free.limit > 0, free.remaining == 0 {
            return "You’ve used your \(free.limit) free photo or voice cards. Adding more uses a bought stamp."
        }
        return HolidayCardMediaRow.needsStampLine
    }

    /// With `improved` (cards-next Wave 2): one quiet line under the buttons while free photo cards are left, the
    /// sender has no bought stamp, and has at least one stamp of any kind (fix 4); nil otherwise.
    var freeMediaHint: String? {
        guard improved, cards?.postageEnabled == true, let free = cards?.media?.freeAllowance, free.limit > 0,
              free.remaining > 0, stampsLeft > 0, (boughtStampsLeft ?? cards?.stamps?.paidRemaining ?? 0) == 0
        else { return nil }
        let count = recipient?.entries?.count ?? 1
        if count > free.remaining {
            let need = count - free.remaining
            let freePart = "You have \(free.remaining) free photo or voice \(free.remaining == 1 ? "card" : "cards") left."
            return "\(freePart) This list of \(count) will need \(need) bought \(need == 1 ? "stamp" : "stamps")."
        }
        if free.remaining == free.limit {
            return "Your first \(free.limit) cards with a photo or voice greeting are free."
        }
        let freeWord = free.remaining == 1 ? "card" : "cards"
        return "\(free.remaining) free photo or voice \(freeWord) left — after that, they use a bought stamp."
    }
}
