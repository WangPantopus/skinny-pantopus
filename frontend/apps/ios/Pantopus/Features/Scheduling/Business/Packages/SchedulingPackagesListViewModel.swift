//
//  SchedulingPackagesListViewModel.swift
//  Pantopus
//
//  G8 Packages List (owner) — Stream I15. Lists the owner's session packages
//  (`GET /packages`), split Active / Archived (soft-delete = is_active=false),
//  with the Stripe-not-connected gate driven by `GET /payments/status`. Behind
//  `SchedulingFeatureFlags.paidEnabled`. Matches `packageslist-frames.jsx`
//  (active / empty / payouts-gate / archived / loading).
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class SchedulingPackagesListViewModel {
    enum Phase: Equatable { case loading, loaded, error(String), comingSoon }
    enum Filter: Int { case active, archived }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    /// Inline archive/restore failure — keeps the loaded list mounted (phase
    /// `.error` is reserved for load failures).
    private(set) var actionError: String?
    private(set) var packages: [SchedulingPackageDTO] = []
    /// Stripe connection — nil while unknown; drives the payouts gate.
    private(set) var paymentsConnected = false
    private(set) var paymentsApplicable = true
    var filter: Filter = .active

    // MARK: Derived

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    var activePackages: [SchedulingPackageDTO] {
        packages.filter { $0.isActive != false }
    }

    var archivedPackages: [SchedulingPackageDTO] {
        packages.filter { $0.isActive == false }
    }

    var visiblePackages: [SchedulingPackageDTO] {
        filter == .active ? activePackages : archivedPackages
    }

    /// The owner has no live packages AND hasn't connected payouts yet — frame 3.
    var showsPayoutsGate: Bool {
        filter == .active && activePackages.isEmpty && paymentsApplicable && !paymentsConnected
    }

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
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
            let result: PackagesResponse = try await client.request(SchedulingEndpoints.getPackages(owner: owner))
            packages = result.packages
            // Payments status is best-effort — a failure here shouldn't blank the list.
            if let status: PaymentsStatusDTO = try? await client.request(SchedulingEndpoints.paymentsStatus(owner: owner)) {
                paymentsConnected = status.connected
                paymentsApplicable = status.applicable
            }
            phase = .loaded
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

    func createPackage() {
        push(.packageEditor(owner: owner, packageId: nil))
    }

    func openPackage(_ package: SchedulingPackageDTO) {
        push(.packageEditor(owner: owner, packageId: package.id))
    }

    func connectPayments() {
        push(.paymentsSetup(owner: owner))
    }

    /// Soft-delete (archive) a live package — `DELETE /packages/:id` sets
    /// is_active=false. Optimistically flips the local flag, then reloads.
    /// A failed mutation surfaces inline (`actionError`) — flipping `phase`
    /// to `.error` here blanked the already-loaded list.
    func archive(_ package: SchedulingPackageDTO) async {
        actionError = nil
        do {
            try await client.send(SchedulingEndpoints.deletePackage(owner: owner, id: package.id))
            await load()
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Couldn't archive that package."
        } catch {
            actionError = "Couldn't archive that package."
        }
    }

    /// Restore an archived package — `PUT /packages/:id { is_active:true }`.
    func restore(_ package: SchedulingPackageDTO) async {
        actionError = nil
        do {
            let _: PackageResponse = try await client.request(
                SchedulingEndpoints.updatePackage(owner: owner, id: package.id, SchedulingUpdatePackageRequest(isActive: true))
            )
            await load()
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Couldn't restore that package."
        } catch {
            actionError = "Couldn't restore that package."
        }
    }

    // MARK: Row formatting

    /// "5 sessions · $220 · $44 each" — the per-row subtitle math.
    func subtitle(for package: SchedulingPackageDTO) -> String {
        let sessions = package.sessionsCount ?? 0
        let sessionLabel = "\(sessions) session\(sessions == 1 ? "" : "s")"
        let total = SchedulingMoney.format(cents: package.priceCents, currency: package.currency)
        let each = SchedulingMoney.perSession(totalCents: package.priceCents, sessions: sessions, currency: package.currency)
        return "\(sessionLabel) · \(total) · \(each) each"
    }

    /// "· 12 sold" beside the status chip, or `nil` when the package has no
    /// recorded purchases (or the count is absent) so brand-new packages stay clean.
    func soldLabel(for package: SchedulingPackageDTO) -> String? {
        guard let sold = package.soldCount, sold > 0 else { return nil }
        return "· \(sold) sold"
    }
}
