//
//  HolidayCardFlowViewModel+Travel.swift
//  Pantopus
//
//  Letting a card travel (server switch `card_travel`, travelling card plan Part 2): "Let it travel" on Seal it for the
//  day, on to begin with; someone with no town yet is asked "Where does it start?" once, when they turn it on or seal
//  with it on (D4). With the switch off on the server nothing here shows and every card goes as before.
//

import Foundation

extension HolidayCardFlowViewModel {
    /// The server lets cards travel: the switch shows.
    var travelOffered: Bool {
        // A photo card never travels (cards-next 4.2).
        cards?.travel?.on == true && !isPhotoCard
    }

    /// This card will travel: the switch is shown and left on.
    var letsTravel: Bool {
        travelOffered && travels
    }

    /// The sender's town for the journey: the one just chosen, else the server's; nil until they have one.
    var startTown: String? {
        travelTown ?? cards?.travel?.town
    }

    /// The switch, as the row binds it: turning it on with no town yet asks for one.
    func setTravels(_ isOn: Bool) {
        travels = isOn
        guard isOn, travelOffered, startTown == nil else { return }
        afterTown = nil
        asksTown = true
    }

    /// Before a card that travels is looked over or sealed: with no town yet, the sheet comes first and `then` runs
    /// once one is chosen. True when it asked.
    func askTownFirst(then next: @escaping @MainActor () -> Void) -> Bool {
        guard letsTravel, startTown == nil else { return false }
        afterTown = next
        asksTown = true
        return true
    }

    /// A town was chosen and kept: what was waiting for it goes on once the sheet is down.
    func townChosen(_ match: CardTownMatch) {
        travelTown = match.label
        asksTown = false
        guard let next = afterTown else { return }
        afterTown = nil
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 450_000_000)
            next()
        }
    }

    /// "Cancel" with no town yet: the card can't travel from nowhere, so the switch goes back off (as on Android); a
    /// seal that was waiting doesn't go, and "Seal and send" then sends an ordinary card.
    func townCancelled() {
        asksTown = false
        afterTown = nil
        if startTown == nil { travels = false }
    }

    /// The server said the sender has no town yet (`CARD_TRAVEL_NEEDS_TOWN`): ask, then try again. True when it was that.
    func needsTown(_ error: any Error, retry: @escaping @MainActor () -> Void) -> Bool {
        guard Self.refusalCode(error) == "CARD_TRAVEL_NEEDS_TOWN" else { return false }
        travelTown = nil
        afterTown = retry
        asksTown = true
        return true
    }
}
