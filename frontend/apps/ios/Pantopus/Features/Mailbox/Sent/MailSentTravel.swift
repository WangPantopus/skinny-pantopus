//
//  MailSentTravel.swift
//  Pantopus
//
//  A card in Sent that travels (server switch `card_travel`, travelling card plan Part 6): "5 towns · 2,692 miles. Now
//  in Tampa, FL." once it has reached someone, and "See its journey", which opens the journey's web page inside the
//  app (D6). The notice "Your card reached Tampa, FL" opens this page. A card that doesn't travel shows none of it.
//

import SwiftUI

/// "5 towns · 2,692 miles. Now in Tampa, FL." under the heading, once it has reached someone.
struct MailSentTravelLine: View {
    let travel: SentCardTravel

    var body: some View {
        if let line = CardTravelWords.sentLine(travel) {
            Text(verbatim: line)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("mailSentTravelLine")
        }
    }
}

/// "See its journey", with the card's other buttons: the journey's web page inside the app.
struct MailSentJourneyButton: View {
    let travel: SentCardTravel

    var body: some View {
        if let page = CardJourneyPage(journey: travel.journey) {
            HolidayCardPaperButton(title: "See its journey", fullWidth: true) { page.open() }
                .accessibilityIdentifier("mailSentJourney")
        }
    }
}

extension CardTravelWords {
    /// "5 towns · 2,692 miles. Now in Tampa, FL."; nil until it has reached someone.
    static func sentLine(_ travel: SentCardTravel) -> String? {
        guard let now = travel.nowIn, !now.isEmpty else { return nil }
        return "\(towns(travel.towns)) · \(miles(travel.miles)). Now in \(now)."
    }
}
