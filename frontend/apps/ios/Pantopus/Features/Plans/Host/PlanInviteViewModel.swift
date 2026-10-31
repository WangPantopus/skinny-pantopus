//
//  PlanInviteViewModel.swift
//  Pantopus
//
//  The host's "Invite friends" (founder decision, October 31): people they
//  know on Pantopus (connections, people who came to their plans), anyone
//  by email, and a one-person link to text. The invitations already sent,
//  with where each stands, and taking one back. Everything is the server's
//  (planInvites.js): this screen never decides who may be invited.
//

import Foundation
import Observation

@Observable
@MainActor
final class PlanInviteViewModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case error(String)
    }

    /// What "Share your address?" is for: sending the invitations, or making a text invite.
    private enum Pending {
        case send
        case link
    }

    let planId: String
    let atHome: Bool
    private(set) var phase: Phase = .loading
    /// People the host can invite, for the search text.
    private(set) var people: [PlanInviteCandidateDTO] = []
    /// The invitations already sent.
    private(set) var list: PlanInviteListDTO?
    /// Chosen to invite, in the order chosen.
    private(set) var chosenPeople: [PlanInviteCandidateDTO] = []
    private(set) var chosenEmails: [String] = []
    private(set) var isSending = false
    private(set) var isMakingLink = false
    /// The search box: a name, or an address to invite by email.
    var query = ""
    /// Why the last action didn't go through.
    var error: String?
    /// A toast ("Invited 3").
    var notice: String?
    /// At a home, the first invitation asks the host to agree that people who say they're in see the address.
    var asksAboutAddress = false
    /// A text invite ready for the share sheet.
    var textInvite: PlanTextInvite?

    private var pending: Pending?
    private var addressAgreed = false
    private let api: APIClient
    private let store: ScreenStore

    init(planId: String, atHome: Bool, api: APIClient = .shared) {
        self.planId = planId
        self.atHome = atHome
        self.api = api
        store = ScreenStore.store(for: api)
    }

    // MARK: - Reading

    func load() async {
        async let peopleRead: PlanInvitePeopleResponse = api.request(PlansEndpoints.invitePeople(planId: planId))
        async let listRead: PlanInviteListDTO = api.request(PlansEndpoints.invites(planId: planId))
        do {
            let (found, sent) = try await (peopleRead, listRead)
            people = found.people
            list = sent
            phase = .loaded
        } catch is CancellationError {
            return
        } catch {
            if list == nil { phase = .error(PlanErrors.sentence(for: error)) }
        }
    }

    /// The people list for the search text (names only; an address shows as "Invite … by email").
    func search() async {
        let text = searchText
        guard emailInQuery == nil else { return }
        do {
            let found: PlanInvitePeopleResponse = try await api.request(PlansEndpoints.invitePeople(planId: planId, query: text))
            guard text == searchText else { return }
            people = found.people
        } catch {
            return
        }
    }

    private func reloadList() async {
        if let sent: PlanInviteListDTO = try? await api.request(PlansEndpoints.invites(planId: planId)) { list = sent }
        if let found: PlanInvitePeopleResponse = try? await api.request(PlansEndpoints.invitePeople(planId: planId, query: searchText)) {
            people = found.people
        }
    }

    // MARK: - Choosing

    var searchText: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// The search text when it's an address not chosen yet: "Invite alex@example.com by email".
    var emailInQuery: String? {
        let email = searchText.lowercased()
        guard PlanInviteEmail.isValid(email), !chosenEmails.contains(email) else { return nil }
        return email
    }

    var chosenCount: Int {
        chosenPeople.count + chosenEmails.count
    }

    var emailsLeft: Int {
        max(0, (list?.emailsLeft ?? 20) - chosenEmails.count)
    }

    func isChosen(_ person: PlanInviteCandidateDTO) -> Bool {
        chosenPeople.contains { $0.userId == person.userId }
    }

    func toggle(_ person: PlanInviteCandidateDTO) {
        guard person.state == nil else { return }
        if let index = chosenPeople.firstIndex(where: { $0.userId == person.userId }) {
            chosenPeople.remove(at: index)
        } else {
            chosenPeople.append(person)
        }
        error = nil
    }

    func addEmailFromQuery() {
        guard let email = emailInQuery else { return }
        guard emailsLeft > 0 else {
            error = "You can invite 20 people by email to a plan."
            return
        }
        chosenEmails.append(email)
        query = ""
        error = nil
    }

    func removeEmail(_ email: String) {
        chosenEmails.removeAll { $0 == email }
    }

    func removePerson(_ userId: String) {
        chosenPeople.removeAll { $0.userId == userId }
    }

    // MARK: - Sending

    /// Sends the chosen invitations. At a home the first one asks about the address first.
    func send() async {
        guard chosenCount > 0, !isSending else { return }
        isSending = true
        error = nil
        defer { isSending = false }
        let body = PlanInviteBody(
            userIds: chosenPeople.map(\.userId),
            emails: chosenEmails,
            confirmSharesAddress: addressAgreed ? true : nil
        )
        do {
            let sent: PlanInviteListDTO = try await api.request(PlansEndpoints.invite(planId: planId, body))
            list = sent
            let invited = sent.results.filter { $0.outcome == "invited" }.count
            let already = sent.results.filter { $0.outcome == "already_invited" || $0.outcome == "already_in" }.count
            notice = invited > 0
                ? "Invited \(invited == 1 ? "1 person" : "\(invited) people")"
                : already > 0 ? "They're already invited" : "No one new to invite"
            chosenPeople = []
            chosenEmails = []
            query = ""
            PlansStoreReads.changed(planId: planId, store: store)
            await reloadList()
        } catch {
            if needsAddressAnswer(error) {
                pending = .send
                asksAboutAddress = true
            } else {
                self.error = PlanErrors.sentence(for: error)
            }
        }
    }

    /// "Text an invite": a one-person link and the words to send with it, for the share sheet.
    func makeTextInvite() async {
        guard !isMakingLink else { return }
        isMakingLink = true
        error = nil
        defer { isMakingLink = false }
        do {
            let link: PlanInviteLinkResponse = try await api.request(
                PlansEndpoints.inviteLink(planId: planId, confirmSharesAddress: addressAgreed ? true : nil)
            )
            guard let url = URL(string: link.url) else { return }
            textInvite = PlanTextInvite(message: link.message, url: url)
        } catch {
            if needsAddressAnswer(error) {
                pending = .link
                asksAboutAddress = true
            } else {
                self.error = PlanErrors.sentence(for: error)
            }
        }
    }

    /// The share sheet closed: the list shows the text invite.
    func textInviteShared() async {
        notice = "Done. That link works for one person."
        PlansStoreReads.changed(planId: planId, store: store)
        await reloadList()
    }

    /// "Share your address?" answered yes: do what was asked.
    func agreeToShareAddress() async {
        addressAgreed = true
        let action = pending
        pending = nil
        switch action {
        case .send: await send()
        case .link: await makeTextInvite()
        case nil: break
        }
    }

    /// Takes back an invitation nobody has said yes to.
    func cancel(_ row: PlanInviteRowDTO) async {
        error = nil
        do {
            let sent: PlanInviteListDTO = try await api.request(PlansEndpoints.cancelInvite(planId: planId, inviteId: row.id))
            list = sent
            notice = "Invitation taken back"
            PlansStoreReads.changed(planId: planId, store: store)
            await reloadList()
        } catch {
            self.error = PlanErrors.sentence(for: error)
        }
    }

    private func needsAddressAnswer(_ error: any Error) -> Bool {
        guard case let .clientError(status, body) = error as? APIError, status == 409 else { return false }
        return PlanErrors.code(in: body) == "confirm_shares_address"
    }
}

/// A text invite for the share sheet: the host's words, then the one-person link.
struct PlanTextInvite: Identifiable {
    let id = UUID()
    let message: String
    let url: URL

    var items: [Any] {
        [message, url]
    }
}

/// An address the host can invite by email (the server checks it again).
enum PlanInviteEmail {
    static func isValid(_ text: String) -> Bool {
        let parts = text.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, let local = parts.first, let domain = parts.last,
              !local.isEmpty, local.count <= 64, text.count <= 254,
              domain.contains("."), !domain.hasPrefix("."), !domain.hasSuffix("."),
              let tld = domain.split(separator: ".").last, tld.count >= 2 else { return false }
        return !text.contains { $0.isWhitespace || "<>()[]\\,;:\"".contains($0) }
    }
}
