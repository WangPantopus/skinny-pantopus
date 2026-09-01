//
//  WalletActivityListViewModel.swift
//  Pantopus
//
//  WS5.1 — full wallet transaction history from `GET /api/wallet/transactions`.
//  Reached from Wallet history + "All activity" affordances.
//

import Foundation
import Observation

@Observable
@MainActor
public final class WalletActivityListViewModel {
    public enum State: Equatable, Sendable {
        case loading
        case loaded([WalletActivityItem])
        case empty
        case error(message: String)
    }

    public let title: String
    public private(set) var state: State = .loading

    private let api: APIClient
    private let calendar: Calendar
    private let now: @Sendable () -> Date
    private var offset = 0
    private var hasMore = true
    private var isFetching = false
    /// Bumped on every reset fetch. An in-flight page fetch whose
    /// generation no longer matches is stale — its rows are dropped so a
    /// refresh overlapping a page load can't corrupt `offset`.
    private var generation = 0
    private var items: [WalletActivityItem] = []

    init(
        title: String = "Activity",
        api: APIClient = .shared,
        calendar: Calendar = .current,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.title = title
        self.api = api
        self.calendar = calendar
        self.now = now
    }

    public func load() async {
        guard !isFetching else { return }
        if case .loaded = state { return }
        await fetch(reset: true)
    }

    public func refresh() async {
        await fetch(reset: true)
    }

    public func loadMoreIfNeeded(currentItemId: String?) async {
        guard hasMore, !isFetching, let currentItemId else { return }
        guard items.last?.id == currentItemId else { return }
        await fetch(reset: false)
    }

    private func fetch(reset: Bool) async {
        if reset {
            generation += 1
            offset = 0
            hasMore = true
            items = []
            state = .loading
        }
        let fetchGeneration = generation
        isFetching = true
        defer { if fetchGeneration == generation { isFetching = false } }
        do {
            let pageSize = 50
            let response: WalletTransactionsResponse = try await api.request(
                WalletEndpoints.transactions(limit: pageSize, offset: offset)
            )
            guard fetchGeneration == generation else { return }
            let mapped = response.transactions.map {
                WalletViewModel.activityItem(from: $0, calendar: calendar, now: now())
            }
            if reset {
                items = mapped
            } else {
                items.append(contentsOf: mapped)
            }
            offset += mapped.count
            hasMore = mapped.count >= pageSize
            state = items.isEmpty ? .empty : .loaded(items)
        } catch {
            guard fetchGeneration == generation else { return }
            let message = (error as? LocalizedError)?.errorDescription ?? "Couldn't load activity."
            state = reset && items.isEmpty ? .error(message: message) : state
        }
    }
}
