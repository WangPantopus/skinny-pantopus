//
//  CrewDaysCrewViewModel.swift
//  Pantopus
//
//  13. Crew Days for a crew (build kit 01-spec.md, board `CrewList`): the
//  business's street days by section, and what it still needs before it
//  can run one. `GET /api/crew-days/business/:businessId`.
//

import Foundation

@Observable
@MainActor
final class CrewDaysCrewViewModel {
    private(set) var state: CrewDayLoad<CrewDayBusinessResponse> = .loading
    /// The businesses the person is on; a picker shows when there are several.
    private(set) var businesses: [BusinessMembership] = []
    private(set) var businessId: String?
    private let requestedBusinessId: String?

    init(businessId: String?) {
        requestedBusinessId = businessId
        self.businessId = businessId
    }

    var business: BusinessMembership? {
        businesses.first { $0.businessUserId == businessId }
    }

    func load() async {
        let membership = CrewDayMembership.shared
        if membership.businesses.isEmpty {
            await membership.refresh(account: AuthManager.shared.store.get(SecureStoreKey.userId))
        }
        businesses = membership.businesses
        if businessId == nil {
            businessId = requestedBusinessId ?? businesses.first?.businessUserId
        }
        await read()
    }

    func refresh() async {
        await read()
    }

    func select(_ id: String) async {
        guard id != businessId else { return }
        businessId = id
        state = .loading
        await read()
    }

    private func read() async {
        guard let businessId else {
            state = .failed("You aren't on a business's team yet. Start a business page to run Crew Days.")
            return
        }
        do {
            let response: CrewDayBusinessResponse = try await APIClient.shared.request(
                CrewDayEndpoints.business(businessId: businessId)
            )
            state = .loaded(response)
        } catch {
            if state.value == nil { state = .failed(CrewDayErrors.sentence(for: error)) }
        }
    }
}
