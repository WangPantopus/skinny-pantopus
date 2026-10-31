//
//  MailSentPieceViewModel.swift
//  Pantopus
//
//  One sent card's page in Sent (launch key `mailbox`): the card with the
//  sender's own note (also while it's sealed for them) and its trail, and
//  taking it back while it can be. `GET /api/mailbox/sent/:id` (404 for
//  anyone but its sender) and `POST /api/mailbox/cards/:id/take-back`.
//

import Foundation
import Observation

enum MailSentPieceState {
    case loading
    case loaded(MailSentPiece)
    case error(message: String)
    /// Taken back (here or elsewhere) or never theirs: the server's sentence.
    case gone(message: String)
}

@Observable
@MainActor
final class MailSentPieceViewModel {
    let id: String
    private(set) var state: MailSentPieceState = .loading
    private(set) var takingBack = false
    private(set) var takeBackError: String?
    /// Asks "Take your card back?" first.
    var confirmsTakeBack = false

    private let api: APIClient

    init(id: String, api: APIClient = .shared) {
        self.id = id
        self.api = api
    }

    var piece: MailSentPiece? {
        if case let .loaded(piece) = state { return piece }
        return nil
    }

    func load() async {
        if piece == nil { state = .loading }
        await fetch()
    }

    func retry() async {
        state = .loading
        await fetch()
    }

    private func fetch() async {
        do {
            let detail: MailSentDetail = try await HolidayCardFlowViewModel.answer(MailSentEndpoints.piece(id: id), api: api)
            state = .loaded(detail.item)
        } catch {
            let sentence = HolidayCardFlowViewModel.refusal(
                error,
                fallback: "Pantopus is having trouble just now. Try again in a moment."
            )
            if HolidayCardFlowViewModel.refusalCode(error) == "SENT_NOT_FOUND" {
                state = .gone(message: sentence)
                return
            }
            // A refresh that fails keeps the card on screen.
            guard piece == nil else { return }
            state = .error(message: sentence)
        }
    }

    /// After "Take your card back?". True when it's gone; too late, the
    /// server's sentence shows and the card stays, read again.
    func takeBack() async -> Bool {
        confirmsTakeBack = false
        guard !takingBack else { return false }
        takingBack = true
        takeBackError = nil
        defer { takingBack = false }
        do {
            let _: TakeBackHolidayCardResponse = try await HolidayCardFlowViewModel.answer(
                HolidayCardEndpoints.takeBack(cardId: id),
                api: api
            )
            return true
        } catch {
            takeBackError = HolidayCardFlowViewModel.refusal(
                error,
                fallback: "Couldn’t take your card back just now. Try again in a moment."
            )
            await fetch()
            return false
        }
    }
}
