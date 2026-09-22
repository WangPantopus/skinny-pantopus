import Foundation

enum GigAssignedAuthorizationEndpoints {
    /// Route backend/routes/gigs.js:7936. Reconciles provider state without creating or confirming a hold.
    static func status(gigId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/refresh-payment-status")
    }

    /// Route backend/routes/gigs.js:7935. Resumes the displayed payment under its opening server session.
    static func resume(gigId: String, body: GigAssignedAuthorizationBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/continue-authorization", body: body)
    }
}
