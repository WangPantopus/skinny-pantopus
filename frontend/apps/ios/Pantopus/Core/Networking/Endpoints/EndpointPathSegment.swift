import Foundation

extension Endpoint {
    /// `value` (a token, code or slug from a link) as exactly one path
    /// segment. `APIClient` percent-encodes the path but keeps `/`, so a
    /// value carrying one would add segments to the route.
    static func pathSegment(_ value: String) -> String {
        value.replacingOccurrences(of: "/", with: "%2F")
    }
}
