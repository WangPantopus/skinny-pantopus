//
//  CardMediaBeside.swift
//  Pantopus
//
//  The card's own photo beside the card, a little over its foot, where the sender looks at their own card: Look it
//  over and Sent's detail (memories plan step 4, `holiday_card_memories`; wave 4 drawing 2). Never covered there: it's
//  their own photo. A nostalgia card's print carries the orange date (the card's own day); other moods have none.
//

import SwiftUI

struct CardMediaBeside: View {
    let photo: CardPhoto
    /// Where its bytes come from: the uploader's own route (Look it over) or Sent's.
    let source: CardMediaSource
    /// The card's picture number, for its mood.
    let number: Int?
    /// The card's own day (its postmark, or when it was sent), printed in orange on a nostalgia card.
    var day: String?
    var fromName = ""

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            CardPrintView(
                source: source,
                aspect: photo.aspect,
                alt: photo.alt,
                datedOn: CardTableMood(number: number) == .nostalgia ? day : nil,
                fromName: fromName
            )
            .frame(maxWidth: 190)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s3)
    }
}
