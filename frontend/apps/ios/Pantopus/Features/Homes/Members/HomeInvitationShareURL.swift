import Foundation

/// Explicit build configuration and documented API/web pairs keep a local or
/// staging capability from being shared as a production invitation.
enum HomeInvitationShareURL {
    static func make(token: String, apiOrigin: URL, configuredWebOrigin: String?) -> URL? {
        guard HomeClaimReviewSnapshot.validToken(token), let configuredWebOrigin,
              var web = URLComponents(string: configuredWebOrigin), let host = web.host?.lowercased(),
              web.user == nil, web.password == nil, web.query == nil, web.fragment == nil,
              web.path.isEmpty || web.path == "/", let apiHost = apiOrigin.host?.lowercased() else { return nil }
        let loopback: Set<String> = ["localhost", "127.0.0.1", "::1"]
        let valid: Bool = if loopback.contains(apiHost) {
            loopback.contains(host) && ["http", "https"].contains(web.scheme ?? "")
        } else if ["api.pantopus.app", "api.pantopus.com"].contains(apiHost) {
            apiOrigin.scheme == "https" && web.scheme == "https" && host == "pantopus.com" && web.port == nil
        } else if ["staging.api.pantopus.app", "staging-api.pantopus.com"].contains(apiHost) {
            apiOrigin.scheme == "https" && web.scheme == "https" && host == "staging.pantopus.com" && web.port == nil
        } else { false }
        guard valid else { return nil }
        web.path = "/invite/" + token
        return web.url
    }
}
