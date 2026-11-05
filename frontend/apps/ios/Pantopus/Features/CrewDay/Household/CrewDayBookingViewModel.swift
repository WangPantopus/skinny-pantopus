//
//  CrewDayBookingViewModel.swift
//  Pantopus
//
//  5. Your Crew Day (build kit 01-spec.md): `GET /api/crew-days/bookings/:id`
//  and every answer the household gives on the page: approve or decline a
//  price, Gate is ready, Everything looks good, a new date, the note for the
//  crew, home details, cancel, ask the crew to cancel, Remind me next fall.
//  Each write answers `{ booking }`, which replaces the page.
//

import Foundation

@Observable
@MainActor
final class CrewDayBookingViewModel {
    let bookingId: String
    private(set) var state: CrewDayLoad<CrewDayBookingDTO> = .loading
    /// Not this person's booking, or gone.
    private(set) var unavailable = false
    /// The action running now (its button shows a spinner).
    private(set) var working: Action?
    /// What failed, under the state card.
    var actionError: String?
    /// A short confirmation (a toast).
    var notice: String?
    /// The day's price list, for "Change my home details" and the share kit's preview.
    private(set) var priceList: CrewDayLoad<CrewDayInvitationDTO>?

    enum Action: Equatable {
        case approve, decline, gate, confirm, remind, note, cancel, askRelease, newDate, cancelDate, details
    }

    init(bookingId: String) {
        self.bookingId = bookingId
    }

    var booking: CrewDayBookingDTO? {
        state.value
    }

    func load() async {
        do {
            let booking: CrewDayBookingDTO = try await APIClient.shared.request(CrewDayEndpoints.booking(bookingId: bookingId))
            state = .loaded(booking)
            unavailable = false
        } catch {
            if case APIError.notFound = error {
                unavailable = true
                state = .failed("This booking isn't yours, or it's gone.")
            } else if state.value == nil {
                state = .failed(CrewDayErrors.sentence(for: error))
            }
        }
    }

    // MARK: - Answers

    func answerPrice(approve: Bool) async {
        await write(approve ? .approve : .decline, done: approve ? "You're on the route." : "Declined. Nothing was charged.") {
            CrewDayEndpoints.priceAnswer(bookingId: $0, approve: approve)
        }
    }

    func gateReady() async {
        await write(.gate, done: "We told the crew the gate is ready.") { CrewDayEndpoints.gateReady(bookingId: $0) }
    }

    /// "Everything looks good": charges now.
    func confirm() async {
        await write(.confirm, done: nil) { CrewDayEndpoints.confirm(bookingId: $0) }
    }

    func remindNextSeason() async {
        await write(.remind, done: "We'll ask you next fall.") {
            CrewDayEndpoints.updateBooking(bookingId: $0, CrewDayBookingPatch(remindNextSeason: true))
        }
    }

    @discardableResult
    func saveNote(_ text: String) async -> Bool {
        let note = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return await write(.note, done: "Note saved.") {
            CrewDayEndpoints.updateBooking(bookingId: $0, CrewDayBookingPatch(accessNote: note))
        }
    }

    func cancel() async {
        await write(.cancel, done: "Cancelled. Nothing was charged.") { CrewDayEndpoints.cancelBooking(bookingId: $0) }
    }

    /// Inside the cutoff: asks the crew to release the home, then opens the conversation with it.
    func askRelease() async {
        let crew = booking.map(CrewDayBookingPageCopy.crewName) ?? "The crew"
        if await write(.askRelease, done: "We asked \(crew) to release your home.", { CrewDayEndpoints.askRelease(bookingId: $0) }) {
            await messageCrew()
        }
    }

    func answerNewDate(_ choice: String) async {
        guard let proposal = booking?.proposal else { return }
        let cancelling = choice == "cancel"
        await write(
            cancelling ? .cancelDate : .newDate,
            done: cancelling ? "Cancelled. Nothing was charged." : "You're on the route for the new date."
        ) {
            CrewDayEndpoints.newDate(bookingId: $0, proposalId: proposal.id, choice: choice)
        }
    }

    /// Stories and add-ons, re-priced (a look-first option goes back to the crew).
    @discardableResult
    func changeDetails(optionId: String, addOnIds: [String], done: String) async -> Bool {
        await write(.details, done: done) {
            CrewDayEndpoints.updateBooking(bookingId: $0, CrewDayBookingPatch(optionId: optionId, addOnIds: addOnIds))
        }
    }

    /// The direct conversation with the crew's business, in Messages.
    func messageCrew() async {
        guard let crewUserId = booking?.crewDay.crew?.businessUserId else { return }
        do {
            let room: CreateDirectChatResponse = try await APIClient.shared.request(
                ChatEndpoints.createDirectChat(otherUserId: crewUserId)
            )
            DeepLinkRouter.shared.handle(path: "/chat/\(room.roomId)")
        } catch {
            actionError = "Couldn't open the conversation with the crew. Try again."
        }
    }

    /// The day's price list (the public invitation), read once when a sheet needs it.
    func loadPriceList() async {
        guard let code = booking?.crewDay.code else { return }
        if priceList?.value != nil { return }
        priceList = .loading
        do {
            let invitation: CrewDayInvitationDTO = try await APIClient.shared.request(CrewDayEndpoints.invitation(code: code))
            priceList = .loaded(invitation)
        } catch {
            priceList = .failed(CrewDayErrors.sentence(for: error))
        }
    }

    /// A problem report (or a note added to one) answered with the booking.
    func replace(with booking: CrewDayBookingDTO, notice: String?) {
        state = .loaded(booking)
        self.notice = notice
        NotificationCenter.default.post(name: .crewDayChanged, object: nil)
    }

    // MARK: - One write

    @discardableResult
    private func write(_ action: Action, done: String?, _ endpoint: (String) -> Endpoint) async -> Bool {
        guard working == nil else { return false }
        working = action
        actionError = nil
        defer { working = nil }
        do {
            let response: CrewDayBookingWriteResponse = try await APIClient.shared.request(endpoint(bookingId))
            state = .loaded(response.booking)
            if let done { notice = done }
            NotificationCenter.default.post(name: .crewDayChanged, object: nil)
            return true
        } catch {
            actionError = CrewDayErrors.sentence(for: error)
            // Someone changed it meanwhile (the crew, the deadline): show what is true now.
            if CrewDayErrors.code(for: error) != nil { await load() }
            return false
        }
    }
}
