//
//  CardMediaBeside.swift
//  Pantopus
//
//  The card's own photo and voice greeting beside the card, a little over its foot, where the sender looks at their own
//  card: Look it over and Sent's detail (memories plan steps 4 and 7, `holiday_card_memories`; wave 4 drawing 2): the
//  print on the left, the greeting on the right. Never covered there: they're the sender's own. A nostalgia card's print
//  carries the orange date (the card's own day); a Christmas with Jesus Christ card's greeting is a gift tag.
//

import SwiftUI

struct CardMediaBeside: View {
    let photo: CardPhoto?
    let voice: CardVoice?
    /// Whose route their bytes come from: the uploader's own (Look it over) or Sent's.
    let from: CardMediaFrom
    /// The card's picture number, for its mood.
    let number: Int?
    /// The card's own day (its postmark, or when it was sent), printed in orange on a nostalgia card.
    var day: String?
    var fromName = ""
    /// Who the greeting is for ("For Maya").
    var forName = ""

    var body: some View {
        let mood = CardTableMood(number: number)
        HStack(alignment: .top, spacing: Spacing.s3) {
            if let photo {
                CardPrintView(
                    source: from.source(photo.fileId),
                    aspect: photo.aspect,
                    alt: photo.alt,
                    datedOn: mood == .nostalgia ? day : nil,
                    fromName: fromName
                )
                .frame(maxWidth: 190)
            }
            Spacer(minLength: 0)
            if let voice {
                CardGreetingButton(
                    source: from.source(voice.fileId),
                    durationMs: voice.durationMs,
                    forName: forName,
                    fromName: fromName,
                    gift: mood == .reverence
                )
                .frame(maxWidth: 170)
                .padding(.top, Spacing.s5)
            }
        }
        .padding(.horizontal, Spacing.s3)
    }
}
