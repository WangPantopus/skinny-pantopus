//
//  ParkedInvitationEmail.swift
//  Pantopus
//
//  An emailed household invitation only works for the address it was sent
//  to. When someone opens one while signed out, the link waits in
//  `PendingDeepLinkStore` until they sign in, and sign-up can start with that
//  address instead of an empty field (as the web does from the invite page).
//

import Foundation

enum ParkedInvitationEmail {
    /// The invited address of the household invitation waiting for sign-in, if it's still pending.
    @MainActor
    static func load(api: APIClient = .shared) async -> String? {
        guard let path = PendingDeepLinkStore.peek(), let token = token(in: path),
              let response: HomeInviteResponse = try? await api.request(TokenAcceptEndpoints.homeInvite(token: token)),
              response.invitation?.status == "pending", response.expired != true,
              let email = response.invitation?.inviteeEmail?.trimmingCharacters(in: .whitespacesAndNewlines),
              email.contains("@") else { return nil }
        return email
    }

    /// The token of a parked `pantopus://invite/<token>` link (lease invitations aren't household ones).
    static func token(in path: String) -> String? {
        let prefix = "pantopus://invite/"
        guard path.hasPrefix(prefix) else { return nil }
        let token = path.dropFirst(prefix.count).prefix { $0 != "/" && $0 != "?" && $0 != "#" }
        return token.range(of: "^[A-Za-z0-9]{16,128}$", options: .regularExpression) == nil ? nil : String(token)
    }
}
