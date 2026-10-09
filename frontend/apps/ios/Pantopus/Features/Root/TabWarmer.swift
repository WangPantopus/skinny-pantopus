//
//  TabWarmer.swift
//  Pantopus
//
//  "Get there first" (Instant Screens design, tool 6): once the first tab has
//  loaded after launch, the other tabs' first reads run quietly so opening
//  them is instant. Today shares Place's copy and Messages the chat badge's,
//  so only Nearby is read here. Never in Low Data Mode or offline, and once
//  per account per launch.
//

import Foundation

@MainActor
enum TabWarmer {
    private static var warmedAccount: String?

    static func warm(auth: AuthManager = .shared, network: NetworkMonitor = .shared) async {
        guard case let .signedIn(user) = auth.state, warmedAccount != user.id else { return }
        // Let the tab on screen finish its own reads first.
        try? await Task.sleep(for: .seconds(2))
        guard network.isOnline, !network.isLowData, case let .signedIn(current) = auth.state, current.id == user.id else { return }
        warmedAccount = user.id
        await NeighborhoodViewModel().load()
    }
}
