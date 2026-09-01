//
//  PollDetailView.swift
//  Pantopus
//
//  Read + vote-cast detail surface for a single household poll. Built on
//  the shared `ContentDetailShell` (T2.6 archetype). Fetches the parent
//  list to find the matching row by id (the backend has no GET-by-id on
//  polls today), then renders the question, status meta, per-option
//  result bars, and a "Cast vote" CTA wired to
//  `POST /api/homes/:id/polls/:pollId/vote`.
//
//  Optimistic vote: the moment the user taps an option we patch the
//  in-memory `PollDTO` so the result bar reflects the selection
//  immediately, then re-fetch on success. On failure we roll back to
//  the prior `PollDTO`.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class PollDetailViewModel {
    enum State: Equatable {
        case loading
        case loaded(PollDTO)
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var voteError: String?
    /// Option id currently being submitted — drives per-row spinners.
    private(set) var votingOptionId: String?
    /// Snapshot of the DTO before an optimistic vote, used to roll back
    /// on failure. Cleared when the round-trip succeeds.
    private var preVoteSnapshot: PollDTO?

    private let homeId: String
    private let pollId: String
    private let api: APIClient
    private let onChanged: @Sendable () -> Void

    init(
        homeId: String,
        pollId: String,
        api: APIClient = .shared,
        onChanged: @escaping @Sendable () -> Void = {}
    ) {
        self.homeId = homeId
        self.pollId = pollId
        self.api = api
        self.onChanged = onChanged
    }

    func load() async {
        state = .loading
        do {
            let response: GetHomePollsResponse = try await api.request(
                HomesEndpoints.listPolls(homeId: homeId)
            )
            guard let poll = response.polls.first(where: { $0.id == pollId }) else {
                state = .error(message: "This poll is no longer available.")
                return
            }
            state = .loaded(poll)
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this poll."
            )
        }
    }

    func castVote(optionId: String) async {
        guard case let .loaded(current) = state else { return }
        guard votingOptionId == nil else { return }
        // Block voting on closed polls; the row UI already disables tap
        // but defend the VM regardless.
        let nowDate = Date()
        if PollsListViewModel.chipStatus(for: current, now: nowDate) == .closed {
            return
        }
        voteError = nil
        votingOptionId = optionId
        preVoteSnapshot = current
        state = .loaded(
            PollDetailViewModel.applyOptimisticVote(poll: current, optionId: optionId)
        )
        defer { votingOptionId = nil }
        do {
            _ = try await api.request(
                HomesEndpoints.castPollVote(
                    homeId: homeId,
                    pollId: pollId,
                    request: CastVoteRequest(selectedOptions: [optionId])
                )
            ) as CastVoteResponse
            Analytics.track(.ctaPollVoteSubmit(result: .success))
            // Re-fetch to pick up the authoritative counts (other members
            // may have voted in the meantime).
            await load()
            preVoteSnapshot = nil
            onChanged()
        } catch {
            // Roll back to the snapshot.
            if let snapshot = preVoteSnapshot {
                state = .loaded(snapshot)
                preVoteSnapshot = nil
            }
            voteError = (error as? APIError)?.errorDescription
                ?? "Couldn't cast your vote. Try again."
            Analytics.track(.ctaPollVoteSubmit(result: .error))
        }
    }

    /// Pure projection: returns a new `PollDTO` with the viewer's vote
    /// applied. Adjusts `optionCounts` + `voteCount` accordingly so the
    /// optimistic render matches what the server will return on success.
    static func applyOptimisticVote(poll: PollDTO, optionId: String) -> PollDTO {
        let previousVote = poll.myVote?.first
        var counts = poll.optionCounts
        var voteCount = poll.voteCount
        if let previous = previousVote, !previous.isEmpty {
            // Subtract previous vote.
            counts[previous] = max(0, (counts[previous] ?? 1) - 1)
            if counts[previous] == 0 { counts.removeValue(forKey: previous) }
        } else {
            voteCount += 1
        }
        counts[optionId] = (counts[optionId] ?? 0) + 1
        return PollDTO(
            id: poll.id,
            homeId: poll.homeId,
            title: poll.title,
            description: poll.description,
            pollType: poll.pollType,
            options: poll.options,
            status: poll.status,
            closesAt: poll.closesAt,
            visibility: poll.visibility,
            createdAt: poll.createdAt,
            createdBy: poll.createdBy,
            voteCount: voteCount,
            optionCounts: counts,
            myVote: [optionId]
        )
    }
}

struct PollDetailView: View {
    @State private var viewModel: PollDetailViewModel
    private let onBack: @Sendable () -> Void

    init(
        homeId: String,
        pollId: String,
        onBack: @escaping @Sendable () -> Void,
        onChanged: @escaping @Sendable () -> Void = {}
    ) {
        _viewModel = State(initialValue: PollDetailViewModel(
            homeId: homeId,
            pollId: pollId,
            onChanged: onChanged
        ))
        self.onBack = onBack
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingShell(onBack: onBack)
            case let .loaded(poll):
                LoadedShell(
                    poll: poll,
                    voteError: viewModel.voteError,
                    votingOptionId: viewModel.votingOptionId,
                    onBack: onBack
                ) { optionId in
                    Task { await viewModel.castVote(optionId: optionId) }
                }
            case let .error(message):
                ErrorShell(
                    message: message,
                    onBack: onBack
                ) {
                    Task { await viewModel.load() }
                }
            }
        }
        .accessibilityIdentifier("pollDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .onAppear { Analytics.track(.screenPollDetailViewed) }
        .task { await viewModel.load() }
    }
}

// MARK: - Shells

private struct LoadingShell: View {
    let onBack: () -> Void
    var body: some View {
        ContentDetailShell(
            title: "Poll",
            onBack: onBack,
            header: {
                Shimmer(height: 80, cornerRadius: Radii.lg)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 56, cornerRadius: Radii.md)
                    Shimmer(height: 56, cornerRadius: Radii.md)
                    Shimmer(height: 56, cornerRadius: Radii.md)
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }
}

private struct ErrorShell: View {
    let message: String
    let onBack: () -> Void
    let onRetry: () -> Void
    var body: some View {
        ContentDetailShell(
            title: "Poll",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load this poll",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") { onRetry() }
                )
                .frame(height: 400)
            }
        )
    }
}

private struct LoadedShell: View {
    let poll: PollDTO
    let voteError: String?
    let votingOptionId: String?
    let onBack: () -> Void
    let onVote: (String) -> Void

    var body: some View {
        let projection = PollsListViewModel.project(poll: poll, now: Date())
        let totalVotes = poll.options.reduce(0) { sum, option in
            sum + (poll.optionCounts[option.id] ?? poll.optionCounts[option.label] ?? 0)
        }
        let isActive = projection.chipStatus != .closed
        let topVotes = poll.options
            .map {
                poll.optionCounts[$0.id] ?? poll.optionCounts[$0.label] ?? 0
            }
            .max() ?? 0
        return ContentDetailShell(
            title: "Poll",
            onBack: onBack,
            header: {
                PollHeader(
                    poll: poll,
                    projection: projection
                )
                .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    if let description = poll.description, !description.isEmpty {
                        Text(description)
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .padding(.horizontal, Spacing.s4)
                    }
                    VStack(spacing: Spacing.s2) {
                        ForEach(poll.options) { option in
                            let votes = poll.optionCounts[option.id]
                                ?? poll.optionCounts[option.label]
                                ?? 0
                            let isMyVote = poll.myVote?.contains(option.id) == true
                                || poll.myVote?.contains(option.label) == true
                            let isWinner = !isActive && votes == topVotes && topVotes > 0
                            PollResultBar(
                                label: option.label,
                                votes: votes,
                                totalVotes: totalVotes,
                                isMyVote: isMyVote,
                                isWinner: isWinner,
                                isLoading: votingOptionId == option.id,
                                onTap: isActive
                                    ? { onVote(option.id) }
                                    : nil
                            )
                        }
                    }
                    .padding(.horizontal, Spacing.s4)
                    if let voteError {
                        Text(voteError)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                            .padding(.horizontal, Spacing.s4)
                            .accessibilityIdentifier("pollDetail_voteError")
                    }
                    PollMetaGrid(poll: poll, projection: projection)
                        .padding(.horizontal, Spacing.s4)
                }
            }
        )
    }
}

private struct PollHeader: View {
    let poll: PollDTO
    let projection: PollRowProjection

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(projection.kind.background)
                    .frame(width: 48, height: 48)
                Icon(projection.kind.icon, size: 24, color: projection.kind.foreground)
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(projection.kind.label.uppercased())
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(projection.kind.foreground)
                Text(poll.title)
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                StatusChip(projection.chipText, variant: projection.chipVariant, icon: projection.chipIcon)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }
}

private struct PollMetaGrid: View {
    let poll: PollDTO
    let projection: PollRowProjection

    var body: some View {
        VStack(spacing: Spacing.s0) {
            row(label: "Status", value: projection.chipText)
            divider
            row(label: "Votes cast", value: "\(poll.voteCount)")
            if let meta = projection.timeMeta {
                divider
                row(label: projection.chipStatus == .closed ? "Closed" : "Closes", value: meta)
            }
            if let visibility = poll.visibility {
                divider
                row(label: "Visibility", value: visibility.capitalized)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private func row(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Text(value)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }
}

#Preview {
    PollDetailView(homeId: "preview", pollId: "poll-1") {}
}
