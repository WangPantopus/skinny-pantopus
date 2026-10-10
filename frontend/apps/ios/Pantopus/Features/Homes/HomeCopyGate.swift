//
//  HomeCopyGate.swift
//  Pantopus
//
//  Founder decision 3 (Instant Screens contract section 5) for a Home's own
//  screens: an owner's or household member's open-ended access may see the
//  last copy while it is checked again; a guest, service provider or access
//  that ends waits for the server. The Home dashboard keeps the viewer's
//  access only for them, checks it again on every visit and drops it when
//  the access changes (`HomeDashboardAccess`), so its copy is what a Home's
//  screens go by; opened without it, they wait for the server every time.
//

import Foundation

@MainActor
enum HomeCopyGate {
    /// Whether this Home's screens may show their copy before the re-check.
    static func showsCopy(homeId: String, store: ScreenStore) -> Bool {
        guard let access = store.peek(HomeDashboardAccess.endpoint(homeId: homeId), as: HomeAccessDTO.self)?.value else {
            return false
        }
        return HomeDashboardViewModel.isHousehold(access, expiresAt: nil)
    }
}
