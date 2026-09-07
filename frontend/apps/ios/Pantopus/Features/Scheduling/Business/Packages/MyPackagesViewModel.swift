//
//  MyPackagesViewModel.swift
//  Pantopus
//
//  G11 My Packages / Credits (customer) — Stream I15. The buyer-side counterpart
//  to the owner packages list: `GET /my-packages` credits, each showing
//  remaining sessions, with "book with a credit" (→ apply-credit flow) and
//  "buy again". Behind `SchedulingFeatureFlags.paidEnabled`. Matches
//  `mypackages-frames.jsx` (active / empty / expired-used / expiring-soon).
//
//  Data note: `my-packages` credits expose remaining_sessions + nested package
//  meta (name, sessions_count, owner) only — there's no expiry date, owner
//  display name, or redemption history in the contract, so the design's expiry
//  banners + history rows aren't rendered (flagged for a backend follow-up).
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class MyPackagesViewModel {
    enum Phase: Equatable { case loading, loaded, empty, error(String), comingSoon }

    // MARK: Inputs

    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var credits: [PackageCreditDTO] = []
    /// The credit currently driving the "use a credit" sheet (nil = hidden).
    var creditForUse: PackageCreditDTO?

    init(push: @escaping @MainActor (SchedulingRoute) -> Void, client: SchedulingClient) {
        self.push = push
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        guard SchedulingFeatureFlags.paidEnabled else { phase = .comingSoon
            return
        }
        phase = .loading
        do {
            let result: MyPackagesResponse = try await client.request(SchedulingEndpoints.getMyPackages())
            credits = result.credits
            phase = credits.isEmpty ? .empty : .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load your packages.")
        } catch {
            phase = .error("Couldn't load your packages.")
        }
    }

    func refresh() async {
        await load()
    }

    // MARK: Actions

    func useCredit(_ credit: PackageCreditDTO) {
        creditForUse = credit
    }

    func browseServices() {
        push(.customerMyBookings)
    }

    func buyAgain(_ credit: PackageCreditDTO) {
        guard let packageId = credit.packageId else { return }
        push(.buyPackage(owner: owner(for: credit.bookingPackage), packageId: packageId))
    }

    /// Called when the apply-credit sheet succeeds — reload so the meter reflects
    /// the new remaining-session count from the server.
    func creditApplied() async {
        creditForUse = nil
        await load()
    }

    // MARK: Derived

    func owner(for meta: PackageMetaDTO?) -> SchedulingOwner {
        guard let meta, let id = meta.ownerId else { return .personal }
        switch meta.ownerType?.lowercased() {
        case "business": return .business(id: id)
        case "home": return .home(homeId: id)
        default: return .personal
        }
    }

    func theme(for credit: PackageCreditDTO) -> SchedulingIdentityTheme {
        owner(for: credit.bookingPackage).theme
    }

    func remaining(_ credit: PackageCreditDTO) -> Int {
        credit.remainingSessions ?? 0
    }

    func total(_ credit: PackageCreditDTO) -> Int {
        max(credit.bookingPackage?.sessionsCount ?? remaining(credit), remaining(credit))
    }

    func isSpent(_ credit: PackageCreditDTO) -> Bool {
        remaining(credit) == 0
    }

    func progress(_ credit: PackageCreditDTO) -> Double {
        let totalCount = total(credit)
        guard totalCount > 0 else { return 0 }
        return Double(remaining(credit)) / Double(totalCount)
    }
}
