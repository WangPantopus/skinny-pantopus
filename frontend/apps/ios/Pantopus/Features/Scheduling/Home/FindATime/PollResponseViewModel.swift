//
//  PollResponseViewModel.swift
//  Pantopus
//
//  Stream I11 — F6 Find a Time · Member Poll Response. The member-facing side of
//  a time poll: load the public poll (`GET /api/public/poll/:id`), mark each
//  proposed time Works / If needed / Can't, and submit
//  (`POST /api/public/poll/:id/vote`). The public vote endpoint sends no bearer,
//  so the in-app member's name/email are passed in the body (anti-`VOTER_REQUIRED`).
//  `POLL_CLOSED` is a first-class closed state, not an error.
//

import Foundation

/// A member's answer for one proposed slot. Wire values are the public poll's
/// `yes | maybe | no`.
enum PollResponseChoice: String, Hashable, CaseIterable {
    case works = "yes"
    case ifNeeded = "maybe"
    case cant = "no"

    var title: String {
        switch self {
        case .works: "Works"
        case .ifNeeded: "If needed"
        case .cant: "Can't"
        }
    }
}

/// A proposed poll option (candidate slot).
///
/// `conflict` carries the design's conflicts-detected affordance (F6 Frame 3):
/// when the member's personal calendar clashes at this slot, the row shows a red
/// "Conflicts: …" pill plus a "From your personal calendar" caption. The public
/// poll read does not yet expose per-member busy windows, so the view-model
/// leaves this `nil` today; the rendering is wired so the frame lights up the
/// moment that data lands.
struct PollOptionRow: Identifiable, Hashable {
    let id: String
    let startAt: String?
    let endAt: String?
    /// Personal-calendar conflict title for this slot, if any (e.g. "Dentist").
    var conflict: String?

    init(id: String, startAt: String?, endAt: String?, conflict: String? = nil) {
        self.id = id
        self.startAt = startAt
        self.endAt = endAt
        self.conflict = conflict
    }
}

@Observable
@MainActor
final class PollResponseViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case closed
        case submitted
        case error(message: String)
    }

    // Dependencies / context.
    let pollId: String
    let tz: String
    private let voterName: String?
    private let voterEmail: String?
    private let client: SchedulingClient

    // State.
    private(set) var phase: Phase = .loading
    private(set) var title = ""
    private(set) var durationMin: Int?
    private(set) var pollDescription: String?
    private(set) var finalizedLabel: String?
    private(set) var options: [PollOptionRow] = []
    private(set) var selections: [String: PollResponseChoice] = [:]
    private(set) var isSubmitting = false
    var actionError: String?

    init(
        pollId: String,
        tz: String,
        voterName: String?,
        voterEmail: String?,
        client: SchedulingClient
    ) {
        self.pollId = pollId
        self.tz = tz
        self.voterName = voterName
        self.voterEmail = voterEmail
        self.client = client
    }

    // MARK: - Derived

    var isClosed: Bool {
        phase == .closed
    }

    /// Design gate (Frame 2): Submit is enabled once **at least one** slot has a
    /// vote — not all slots. Android's `any { it.vote != null }` matches this intent.
    var allAnswered: Bool {
        !options.isEmpty && options.contains { selections[$0.id] != nil }
    }

    var answeredCount: Int {
        options.filter { selections[$0.id] != nil }.count
    }

    /// Any proposed slot clashes with the member's personal calendar — drives the
    /// design's info pre-fill banner (F6 Frame 3). Backend does not yet supply
    /// per-member busy windows, so this is `false` until that data lands.
    var hasConflicts: Bool {
        options.contains { $0.conflict != nil }
    }

    var subtitle: String {
        var parts: [String] = []
        if let durationMin { parts.append("\(durationMin) min") }
        if let description = pollDescription?.trimmingCharacters(in: .whitespacesAndNewlines), !description.isEmpty {
            parts.append(description)
        } else {
            parts.append("Mark the times that work")
        }
        return parts.joined(separator: " · ")
    }

    func dayTimeLabel(for option: PollOptionRow) -> String {
        guard let start = option.startAt else { return "—" }
        return FindATimeFormat.dayTimeLabel(utcISO: start, tz: tz)
    }

    func selection(for option: PollOptionRow) -> PollResponseChoice? {
        selections[option.id]
    }

    // MARK: - Load

    func load() async {
        phase = .loading
        do {
            let response: PublicPollResponse = try await client.request(
                SchedulingPublicEndpoints.poll(id: pollId)
            )
            title = response.poll.title
            durationMin = response.poll.durationMin
            pollDescription = response.poll.description
            options = response.options.map {
                PollOptionRow(id: $0.id, startAt: $0.startAt, endAt: $0.endAt)
            }
            prefillSelections(from: response.votes)

            if let finalized = response.poll.finalizedStartAt {
                finalizedLabel = FindATimeFormat.dayTimeLabel(utcISO: finalized, tz: tz)
            }
            phase = (response.poll.status ?? "open") == "open" ? .ready : .closed
        } catch {
            phase = .error(message: Self.message(for: error))
        }
    }

    private func prefillSelections(from votes: [SchedulingPollVoteDTO]?) {
        guard let votes, let name = voterName?.lowercased() else { return }
        for vote in votes where vote.voterName?.lowercased() == name {
            if let optionId = vote.optionId,
               let raw = vote.value?.stringValue,
               let value = PollResponseChoice(rawValue: raw) {
                selections[optionId] = value
            }
        }
    }

    // MARK: - Mutations

    func setVote(_ value: PollResponseChoice, for option: PollOptionRow) {
        guard !isClosed else { return }
        selections[option.id] = value
    }

    // MARK: - Submit

    func submit() async {
        // `allAnswered` now means "at least one slot voted" (design gate).
        guard allAnswered, !isSubmitting, !isClosed else { return }
        isSubmitting = true
        actionError = nil
        let votes = options.compactMap { option -> PublicPollVoteRequest.Vote? in
            guard let value = selections[option.id] else { return nil }
            return PublicPollVoteRequest.Vote(optionId: option.id, value: value.rawValue)
        }
        let request = PublicPollVoteRequest(votes: votes, name: voterName, email: voterEmail)
        do {
            _ = try await client.send(SchedulingPublicEndpoints.votePoll(id: pollId, request))
            phase = .submitted
        } catch let error as SchedulingError {
            if error.code == "POLL_CLOSED" {
                phase = .closed
            } else {
                actionError = error.userMessage ?? "Couldn't submit your response."
            }
        } catch {
            actionError = "Couldn't submit your response."
        }
        isSubmitting = false
    }

    private static func message(for error: Error) -> String {
        if let schedulingError = error as? SchedulingError {
            return schedulingError.userMessage ?? "This poll couldn't be loaded."
        }
        return "This poll couldn't be loaded."
    }
}
