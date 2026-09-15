import Foundation

enum GigStopEndpoints {
    /// Reads the current local task/payment terms without starting a provider action.
    static func preview(gig: String, action: GigStopAction) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/gigs/\(gig)/stop-preview",
            query: ["action": action.rawValue],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    static func status(gig: String, request: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gig)/stop-requests/\(request)", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    static func submit(gig: String, command: GigStopCommand) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gig)/stop-requests", body: command)
    }
}
