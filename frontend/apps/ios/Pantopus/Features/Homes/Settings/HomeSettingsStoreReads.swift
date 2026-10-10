//
//  HomeSettingsStoreReads.swift
//  Pantopus
//
//  The per-home Settings index's reads through the screen store (Instant
//  Screens): the Home (required, the same entry the dashboard keeps), its
//  occupants and your access (best-effort, so a failure on either still lets
//  the identity card and navigation render), read at once. Typed task groups,
//  not `async let` fan-outs (the iOS runtime-crash repair the dashboard keeps).
//

import Foundation

/// What the Settings index shows: the Home, its occupants and your access.
struct HomeSettingsReads {
    let detail: HomeDetail
    let occupants: OccupantsResponse?
    let access: HomeAccessDTO?
    /// "Couldn't refresh. Showing 3:42 PM." for an old copy after a failed refresh.
    let refreshNotice: String?
}

@MainActor
enum HomeSettingsStoreReads {
    private enum Read {
        case detail(HomeDetail)
        case occupants(OccupantsResponse?)
        case access(HomeAccessDTO?)
    }

    /// The index as last read, when this Home's copies may show before the re-check (`HomeCopyGate`).
    static func copy(homeId: String, store: ScreenStore) -> HomeSettingsReads? {
        guard HomeCopyGate.showsCopy(homeId: homeId, store: store),
              let detail = store.peek(HomesEndpoints.detail(homeId: homeId), as: HomeDetailResponse.self)
        else { return nil }
        return HomeSettingsReads(
            detail: detail.value.home,
            occupants: store.peek(HomesEndpoints.listOccupants(homeId: homeId), as: OccupantsResponse.self)?.value,
            access: store.peek(HomeAdminEndpoints.myAccess(homeId: homeId), as: HomeAccessDTO.self)?.value,
            refreshNotice: detail.refreshNotice
        )
    }

    /// `household` decides whether the replies may show before the next re-check (decision 3).
    static func read(
        homeId: String,
        store: ScreenStore,
        force: Bool,
        household: Bool
    ) async throws -> HomeSettingsReads {
        let topics: Set<String> = [ScreenTopic.home(homeId)]
        let detailGate: @Sendable (HomeDetailResponse) -> Bool = { _ in household }
        let occupantsGate: @Sendable (OccupantsResponse) -> Bool = { _ in household }
        let accessGate: @Sendable (HomeAccessDTO) -> Bool = { _ in household }
        var detail: HomeDetail?
        var occupants: OccupantsResponse?
        var access: HomeAccessDTO?
        try await withThrowingTaskGroup(of: Read.self) { group in
            group.addTask {
                let reply = try await store.load(
                    HomesEndpoints.detail(homeId: homeId),
                    as: HomeDetailResponse.self,
                    kind: .homes,
                    topics: topics,
                    force: force,
                    showsBeforeRecheck: detailGate
                )
                return .detail(reply.value.home)
            }
            group.addTask {
                let reply = try? await store.load(
                    HomesEndpoints.listOccupants(homeId: homeId),
                    as: OccupantsResponse.self,
                    kind: .homes,
                    topics: topics,
                    force: force,
                    showsBeforeRecheck: occupantsGate
                )
                return .occupants(reply?.value)
            }
            group.addTask {
                let reply = try? await store.load(
                    HomeAdminEndpoints.myAccess(homeId: homeId),
                    as: HomeAccessDTO.self,
                    kind: .homes,
                    topics: topics,
                    force: force,
                    showsBeforeRecheck: accessGate
                )
                return .access(reply?.value)
            }
            for try await result in group {
                switch result {
                case let .detail(value): detail = value
                case let .occupants(value): occupants = value
                case let .access(value): access = value
                }
            }
        }
        guard let detail else { throw APIError.invalidResponse }
        let notice = store.peek(HomesEndpoints.detail(homeId: homeId), as: HomeDetailResponse.self)?.refreshNotice
        return HomeSettingsReads(detail: detail, occupants: occupants, access: access, refreshNotice: notice)
    }
}
