//
//  CardTableTravelReader.swift
//  Pantopus
//
//  A travelling card on its reader's table (server switch `card_travel`, travelling card plan Parts 4 and 5): "Pass it
//  on" filled beside "Turn it back", "Pass it on to one more" quiet after one pass, none after two, when the quiet row
//  says "You passed it on to Ivy and Cass."; "See its journey" in the quiet row opens the journey's web page inside
//  the app (D6). A card that doesn't travel gets none of it.
//

import SwiftUI

struct CardTableTravelReader: ViewModifier {
    let viewModel: MailDetailViewModel
    let model: CardTableModel

    @State private var passingOn = false

    private var travel: CardTravel? {
        if case let .loaded(content) = viewModel.state { return content.letter?.card?.card.travel }
        return nil
    }

    func body(content: Content) -> some View {
        content
            .onChange(of: travel, initial: true) { _, travel in setButtons(travel) }
            .onChange(of: model.content.sealed) { _, _ in setButtons(travel) }
            .fullScreenCover(isPresented: $passingOn) {
                CardTablePassOnPage(cardId: viewModel.mailId, content: model.content, place: travel?.nextPlace ?? 1) { sent in
                    passingOn = false
                    // Its places changed: the card reads them again.
                    if sent { Task { await viewModel.refresh() } }
                }
            }
    }

    private func setButtons(_ travel: CardTravel?) {
        guard let travel, !model.content.sealed else {
            model.travelButtons = CardTableTravelButtons()
            return
        }
        var buttons = CardTableTravelButtons()
        let passed = travel.passed.filter { $0.status != "withdrawn" }
        if travel.canPassOn, travel.nextPlace != nil {
            let more = !passed.isEmpty
            buttons.passOn = CardTableMenuItem(title: more ? "Pass it on to one more" : "Pass it on", identifier: "cardTablePassOn") {
                passingOn = true
            }
            buttons.passOnFilled = !more
        }
        let url = travel.journey.flatMap(CardJourneyPage.init)
        let open: () -> Void = { url?.open() }
        if url != nil {
            buttons.menu = [CardTableMenuItem(title: "See its journey", identifier: "cardTableMenuJourney", action: open)]
        }
        if travel.placesLeft == 0, !passed.isEmpty {
            let line = CardTravelWords.passedOn(passed.map(CardTravelWords.name))
            buttons.quiet.append(CardTableMenuItem(title: line, identifier: "cardTablePassedOn", action: open))
        } else if url != nil {
            buttons.quiet.append(CardTableMenuItem(
                title: "See its journey",
                identifier: "cardTableJourney",
                short: "Its journey",
                action: open
            ))
        }
        model.travelButtons = buttons
        model.reservesSecondary = true
    }
}

/// The journey's public web page (`/cards/journey/<journey>`), opened inside the app (D6).
struct CardJourneyPage: Identifiable {
    let url: URL

    init?(journey: String) {
        let pathCharacters = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-"))
        let id = journey.addingPercentEncoding(withAllowedCharacters: pathCharacters) ?? journey
        guard let url = URL(string: InviteLinks.publicPageURLString(path: "/cards/journey/\(id)")) else { return nil }
        self.url = url
    }

    var id: String {
        url.absoluteString
    }

    /// The app's own browser over whatever shows, as Stripe's pages open (`ConnectWebPresenter`); it holds itself
    /// until the browser is closed.
    @MainActor
    func open() {
        let browser = ConnectWebPresenter()
        Task { @MainActor in await browser.present(url: url) }
    }
}

extension CardTravelWords {
    /// "You passed it on to Ivy and Cass."
    static func passedOn(_ names: [String]) -> String {
        "You passed it on to \(names.joined(separator: " and "))."
    }

    /// Who a pass went to: their first name, else "someone by link", else the address it went to.
    static func name(_ passed: CardTravelPassed) -> String {
        if let first = passed.firstName, !first.isEmpty { return first }
        if passed.byLink { return "someone by link" }
        return passed.toName ?? "someone"
    }
}
