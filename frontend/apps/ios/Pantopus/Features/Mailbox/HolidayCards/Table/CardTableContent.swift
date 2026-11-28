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
    /// The card's own voice greeting (memories plan step 7), a cassette or gift tag beside the print; nil while sealed.
    var voice: CardVoice?
    /// Whose route its bytes come from: the reader's piece, the sender's Sent, or the uploader's own (Look it over).
    var mediaFrom: CardMediaFrom?
    /// A travelling card (server switch `card_travel`, travelling card plan Part 3): the postmarks of the towns on the
    /// way to its reader and how far it came; nil for every other card.
    var travel: CardTravelEnvelope?
    /// The table it opens on, as the server names it (card shelves A4); nil from older servers (`CardTableMood` goes by
    /// the number then).
    var mood: String?
    /// A photo card (cards-next 4.2): its photo drawn in its frame as the card's front, not lying beside it (`photo` is
    /// nil then). Nil for every other card and while sealed.
    var photoFront: CardPhotoFrontSpec?

    var firstName: String {
        HolidayCardWords.firstName(fromName)
    }

    /// A photo card (cards-next 4.2), sealed or not: never shared as a picture, a video or a public page.
    var isPhotoCard: Bool {
        photoFront != nil || design == CardPhotoFrontSpec.designId
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

extension CardTableContent {
    /// A card in Sent, as the other person gets it.
    init(sent piece: MailSentPiece, from: String, mailedOn: String?) {
        design = piece.card.design
        number = piece.card.number
        caption = piece.card.caption ?? ""
        paper = piece.card.paper
        table = piece.card.table
        slug = piece.card.slug
        year = piece.card.year
        self.mailedOn = mailedOn
        note = MailPieceModel.firstText(piece.note) ?? ""
        fromName = from
        toName = piece.byLink && piece.status != .claimed ? "Their name" : piece.toName
        sealed = false
        sealedUntil = nil
        sealedInDays = ""
        sealedDayCount = 0
        signature = piece.card.signature
        // Your own photo: never covered here.
        photo = piece.card.photo.map {
            CardPhoto(fileId: $0.fileId, width: $0.width, height: $0.height, alt: $0.alt, live: $0.live)
        }
        voice = piece.card.voice
        mediaFrom = .sent(cardId: piece.id)
        // A card that travels: its envelope's postmarks, as they see it (travelling card plan Part 7).
        travel = CardTravelEnvelope(sent: piece.travel, year: piece.card.year)
        mood = piece.card.mood
        // A photo card: your photo is its front.
        let front = CardPhotoFrontSpec(front: piece.card.front, photo: piece.card.photo) { .sent(cardId: piece.id, fileId: $0.fileId) }
        if let front {
            photoFront = front
            photo = nil
        }
    }
}

extension CardTableContent {
    /// A card from the Mailbox.
    @MainActor
    init(letter: MailLetter, card: HolidayCardLetter, now: Date = Date()) {
        design = card.card.design
        number = card.card.number
        caption = card.card.caption ?? ""
        paper = card.card.paper
        table = card.card.table
        slug = card.card.slug
        year = card.card.year
        mailedOn = card.mailedOn
        note = card.note
        fromName = letter.senderName
        toName = card.envelope.to
        sealed = card.card.sealed
        sealedUntil = card.card.sealedUntil
        sealedInDays = card.card.sealedUntil.map { HolidayCardWords.inDays($0, now: now) } ?? "soon"
        sealedDayCount = card.card.sealedUntil
            .flatMap { MailDates.parse($0) }
            .map { MailDates.daysBetween(now, $0, calendar: .current) } ?? 0
        verse = card.card.sealed ? nil : card.card.verse
        signature = card.card.sealed ? nil : card.card.signature
        photo = card.card.sealed ? nil : card.card.photo
        voice = card.card.sealed ? nil : card.card.voice
        mediaFrom = .piece(mailId: letter.piece.id)
        travel = CardTravelEnvelope(card.card.travel, year: card.card.year)
        mood = card.card.mood
        // A photo card (cards-next 4.2): its photo is the front, veiled first when covered; not shown again inside.
        if !card.card.sealed, let front = CardPhotoFrontSpec(
            front: card.card.front,
            photo: card.card.photo,
            covered: card.card.photo?.covered == true,
            source: { .piece(mailId: letter.piece.id, fileId: $0.fileId) }
        ) {
            photoFront = front
            photo = nil
        }
    }
}
