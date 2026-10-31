//
//  MailSentViewModel.swift
//  Pantopus
//
//  Sent in the Mailbox (launch key `mailbox`): what this person has sent,
//  newest first, 25 at a time. The cards still waiting for the 7 a.m.
//  pickup sit in their own well at the top, where they can be taken back;
//  the rest go by the day they were sent. `GET /api/mailbox/sent` and the
//  card's own `POST /api/mailbox/cards/:id/take-back`.
//

import Foundation
import Observation

enum MailSentState: Equatable {
    case loading
    case loaded
    case empty
    case error(message: String)
}

/// The cards sent on one day (this phone's clock).
struct MailSentDay: Identifiable, Equatable {
    let id: String
    let title: String
    let pieces: [MailSentPiece]
}

@Observable
@MainActor
final class MailSentViewModel {
    private(set) var state: MailSentState = .loading
    private(set) var items: [MailSentPiece] = []
    private(set) var next: String?
    private(set) var loadingMore = false
    private(set) var loadMoreError: String?
    /// The card being taken back, and why one couldn't be (under its row).
    private(set) var takingBack: String?
    private(set) var takeBackError: (id: String, message: String)?
    /// Asks "Take your card back?" for this card first.
    var confirmsTakeBack: MailSentPiece?
    /// A card came back (or went): the Mailbox reads its flag and today's card again.
    var onChange: (@MainActor () -> Void)?

    private let api: APIClient
    private var generation = 0
    private var didLoad = false

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Cards to a person still before the pickup.
    var waiting: [MailSentPiece] {
        items.filter { $0.status == .waiting }
    }

    /// The rest, by the day they were sent.
    var days: [MailSentDay] {
        var days: [MailSentDay] = []
        for piece in items where piece.status != .waiting {
            let title = MailSentWords.dayTitle(piece.sentAt)
            if let last = days.last, last.title == title {
                days[days.count - 1] = MailSentDay(id: last.id, title: title, pieces: last.pieces + [piece])
            } else {
                days.append(MailSentDay(id: "\(days.count)-\(title)", title: title, pieces: [piece]))
            }
        }
        return days
    }

    /// The first page, once; a second visit reads it again keeping the rows.
    func load() async {
        if didLoad {
            await refresh()
            return
        }
        state = .loading
        await fetchFirstPage()
    }

    func refresh() async {
        await fetchFirstPage()
    }

    func retry() async {
        state = .loading
        await fetchFirstPage()
    }

    private func fetchFirstPage() async {
        generation &+= 1
        let current = generation
        loadMoreError = nil
        do {
            let page: MailSentPage = try await api.request(MailSentEndpoints.sent())
            guard current == generation else { return }
            didLoad = true
            items = page.items
            next = page.next
            state = items.isEmpty ? .empty : .loaded
        } catch {
            guard current == generation else { return }
            // A failed refresh keeps what's on screen.
            if items.isEmpty { state = .error(message: Self.loadFailure(error)) }
        }
    }

    /// The next 25, when the list's end shows.
    func loadMoreIfNeeded() async {
        guard let next, !loadingMore, loadMoreError == nil else { return }
        await fetchPage(after: next)
    }

    /// Try again on a page that didn't come.
    func retryLoadMore() async {
        guard let next, !loadingMore else { return }
        loadMoreError = nil
        await fetchPage(after: next)
    }

    private func fetchPage(after cursor: String) async {
        loadingMore = true
        let current = generation
        defer { loadingMore = false }
        do {
            let page: MailSentPage = try await api.request(MailSentEndpoints.sent(before: cursor))
            guard current == generation else { return }
            let known = Set(items.map(\.id))
            items += page.items.filter { !known.contains($0.id) }
            next = page.next
        } catch {
            guard current == generation else { return }
            // Sent changed under that page (a card taken back elsewhere): start again from the top.
            if HolidayCardFlowViewModel.refusalCode(error) == "SENT_CURSOR_INVALID" {
                await fetchFirstPage()
                return
            }
            // The server's sentence ("Couldn’t load what you’ve sent…") or offline, over Try again.
            loadMoreError = Self.loadFailure(error)
        }
    }

    // MARK: Take it back

    /// After "Take your card back?": the card goes from Sent (and, before
    /// the pickup, from the day's one card). Too late: the server's
    /// sentence under its row, and it stays where it now is.
    func takeBack(_ piece: MailSentPiece) async {
        confirmsTakeBack = nil
        guard takingBack == nil else { return }
        takingBack = piece.id
        takeBackError = nil
        defer { takingBack = nil }
        do {
            let _: TakeBackHolidayCardResponse = try await HolidayCardFlowViewModel.answer(
                HolidayCardEndpoints.takeBack(cardId: piece.id),
                api: api
            )
            items.removeAll { $0.id == piece.id }
            if items.isEmpty, next == nil { state = .empty }
            onChange?()
        } catch {
            takeBackError = (
                piece.id,
                HolidayCardFlowViewModel.refusal(error, fallback: "Couldn’t take your card back just now. Try again in a moment.")
            )
            // Where it is now (picked up, say).
            await refresh()
        }
    }

    /// A card taken back on its own page: gone from the list too.
    func dropPiece(_ id: String) {
        items.removeAll { $0.id == id }
        if items.isEmpty, next == nil { state = .empty }
    }

    /// Why Sent couldn't load: the server's sentence when it gave one, else
    /// offline or "try again".
    static func loadFailure(_ error: any Error) -> String {
        HolidayCardFlowViewModel.refusal(error, fallback: "Pantopus is having trouble just now. Try again in a moment.")
    }
}
