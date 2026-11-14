//
//  WaitingCardLanding.swift
//  Pantopus
//
//  "Joined for a card" (TABCARD section 3, drawing CardArrival): the first
//  time an account's tabs show on this phone, the app asks once whether a
//  Christmas card is waiting for it (`GET /api/mailbox/cards/waiting`: a card
//  sent before they joined, while the account is under 14 days old). A card
//  opens in the Mail tab exactly as a tap on it in the Mailbox does (the
//  card-table reader, or its sealed envelope while sealed), after Mail's
//  "who's holding the phone" check. The account counts as asked once an
//  answer comes, a card or none; a failed read asks again next launch. A
//  link already opening (an invitation, a notification, any deep link) wins,
//  and the account still counts as asked.
//

import SwiftUI

struct WaitingCardLanding: ViewModifier {
    /// The signed-in account.
    let account: String?
    let tabs: RootTabModel
    /// A link is waiting to open (or its invitation is showing).
    let linkWaiting: () -> Bool

    func body(content: Content) -> some View {
        content.task(id: account) { await land() }
    }

    private func land() async {
        guard let account, HolidayCardDoors.keysOn, !Self.asked(account) else { return }
        if linkWon(account) {
            Self.markAsked(account)
            return
        }
        let answer: HolidayCardWaitingResponse
        do {
            answer = try await APIClient.shared.request(HolidayCardEndpoints.waiting())
        } catch {
            // Not an answer: asked again next launch.
            return
        }
        // Signed out or another account meanwhile: not this one's answer.
        guard !Task.isCancelled, Self.signedInAccount == account else { return }
        Self.markAsked(account)
        guard let card = answer.card, !linkWon(account) else { return }
        tabs.pendingMailRequest = .route(.mailItemDetail(mailId: card.mailId))
        tabs.selected = .mail
    }

    /// A link waits, or one already opened for this account: the tab that owns
    /// a link (Place's notifications, say) can take it before the root sees it.
    private func linkWon(_ account: String) -> Bool {
        if linkWaiting() { return true }
        guard let link = DeepLinkRouter.shared.lastLiveLink, link.account == account else { return false }
        return Self.opens(link.destination)
    }

    /// Links that open something in signed-in tabs (a join link, a password
    /// or email link, or one the app can't read opens nothing there).
    static func opens(_ destination: DeepLinkRouter.Destination) -> Bool {
        switch destination {
        case .joinInvite, .resetPassword, .verifyEmail, .unknown: false
        default: true
        }
    }

    private static var signedInAccount: String? {
        if case let .signedIn(user) = AuthManager.shared.state { return user.id }
        return nil
    }

    private static func key(_ account: String) -> String {
        "pantopus.cardWaiting.asked.\(account)"
    }

    static func asked(_ account: String) -> Bool {
        UserDefaults.standard.bool(forKey: key(account))
    }

    private static func markAsked(_ account: String) {
        UserDefaults.standard.set(true, forKey: key(account))
    }
}
