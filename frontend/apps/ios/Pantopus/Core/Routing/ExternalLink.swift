import Foundation

/// Addresses other people or outside sources set — a Beacon link, a business
/// website, a carrier's tracking page, certified-mail terms — open only as web
/// pages. Opening any other scheme launches whatever handles it: the dialer
/// for `tel:`, another app for its scheme, or one of this app's own
/// `pantopus://` routes, on a tap the person meant for a web page.
enum ExternalLink {
    /// `raw` as an http(s) address with a host, else nil.
    static func webURL(_ raw: String?) -> URL? {
        guard let raw, let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)) else { return nil }
        return isWeb(url) ? url : nil
    }

    /// Whether `url` is an http(s) address with a host.
    static func isWeb(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http" else { return false }
        return url.host?.isEmpty == false
    }
}
