import UIKit

/// AASA path prefixes can include pages with no native destination. Return
/// those arrivals to the external browser, where web OAuth keeps its session.
@MainActor
enum WebLinkFallback {
    private static let hosts: Set<String> = ["pantopus.com", "www.pantopus.com", "pantopus.app", "www.pantopus.app"]
    private static var lastURL: URL?
    private static var lastHandoff: TimeInterval = 0
    private static var consecutiveHandoffs = 0

    /// Returns true when this universal-link arrival belongs to the browser.
    /// Custom schemes, other hosts and known destinations stay with the router.
    static func openIfNeeded(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "https",
              let host = url.host?.lowercased(), hosts.contains(host),
              case .unknown = DeepLinkRouter.shared.resolve(url: url) else { return false }

        // UIApplication opens our own universal links in the browser. Bound
        // repeated handoffs too, in case a browser redirects back into the app.
        let now = ProcessInfo.processInfo.systemUptime
        consecutiveHandoffs = url == lastURL && now - lastHandoff < 3 ? consecutiveHandoffs + 1 : 1
        lastURL = url
        lastHandoff = now
        guard consecutiveHandoffs <= 3 else { return true }

        // An in-app Safari view has separate website data: the web OAuth
        // callback must finish in the person's browser, with the URL intact.
        UIApplication.shared.open(url)
        return true
    }
}
