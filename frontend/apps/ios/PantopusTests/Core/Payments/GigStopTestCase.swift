import XCTest
@testable import Pantopus

@MainActor
final class StopMemoryStore: PendingGigStopStoring {
    var request: GigStopRequest?
    var fail = false
    func load(scope _: String) throws -> GigStopRequest? {
        if fail { throw APIError.invalidResponse }
        return request
    }

    func save(_ request: GigStopRequest, scope _: String) throws {
        if fail { throw APIError.invalidResponse }
        self.request = request
    }

    func clear(scope _: String, matching request: GigStopRequest) throws {
        if fail { throw APIError.invalidResponse }
        if self.request == request { self.request = nil }
    }
}

@MainActor
final class StopIdentity {
    var actor = "aabb0000-0000-4000-8000-000000000001"
    var session = "opening-session"
    var origin = "https://staging.example.invalid"
    var value: GigStopViewModel.Identity {
        .init(actor: actor, session: session, origin: origin)
    }
}

@MainActor
class GigStopTestCase: XCTestCase {
    let gig = "aabb0000-0000-4000-8000-000000000101"
    let actor = "aabb0000-0000-4000-8000-000000000001"
    let worker = "aabb0000-0000-4000-8000-000000000002"
    let payment = "aabb0000-0000-4000-8000-000000000301"
    let requestId = "aabb0000-0000-4000-8000-000000000901"
    let session = String(repeating: "a", count: 64)
    var previewPath: String {
        "/api/gigs/\(gig)/stop-preview"
    }

    var submitPath: String {
        "/api/gigs/\(gig)/stop-requests"
    }

    var posts: [URLRequest] {
        SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }
    }

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    func terms(action: GigStopAction = .cancel) -> GigStopTerms {
        GigStopTerms(
            gigId: gig,
            ownerId: action == .workerRelease ? worker : actor,
            workerId: action == .close ? nil : (action == .workerRelease ? actor : worker),
            paymentId: action == .close ? nil : payment,
            amountCents: 1000,
            currency: "usd",
            gigStatus: action == .close ? "open" : "assigned",
            acceptedAt: nil,
            acceptedBidId: nil,
            policy: "standard",
            policyFeeCents: 0
        )
    }

    func request(
        action: GigStopAction = .cancel,
        actor: String? = nil,
        requestId: String? = nil,
        financial: GigStopFinancialAction = .release
    ) -> GigStopRequest {
        GigStopRequest(
            requestId: requestId ?? self.requestId,
            gigId: gig,
            actorId: actor ?? self.actor,
            action: action,
            terms: terms(action: action),
            reason: .changedPlans,
            rollbackMode: nil,
            financialAction: action == .close ? .none : financial
        )
    }

    func object(_ value: some Encodable) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as? [String: Any])
    }

    func json(_ value: [String: Any]) throws -> String {
        try XCTUnwrap(String(data: JSONSerialization.data(withJSONObject: value), encoding: .utf8))
    }

    func preview(
        action: GigStopAction = .cancel,
        active: String? = nil,
        eligible: Bool = true,
        session: String? = nil,
        financial: String = "release"
    ) throws -> String {
        try json([
            "actorId": actor,
            "sessionScope": session ?? self.session,
            "action": action.rawValue,
            "terms": object(terms(action: action)),
            "eligible": eligible,
            "unavailableReason": eligible ? NSNull() : "REVIEW_REQUIRED",
            "financialAction": financial,
            "activeRequestId": active as Any? ?? NSNull()
        ])
    }

    func progress(
        _ request: GigStopRequest,
        completed: Bool = false,
        canRetry: Bool = true,
        session: String? = nil
    ) throws -> [String: Any] {
        let financial = completed ? request.financialAction
            .completedStatus : (request.financialAction == .refund ? "refund_pending" : "release_pending")
        return try [
            "actorId": actor,
            "sessionScope": session ?? self.session,
            "requestId": request.requestId,
            "action": request.action.rawValue,
            "status": completed ? "completed" : "pending",
            "financialStatus": financial,
            "canRetry": completed ? false : canRetry,
            "request": object(request),
            "receipt": completed ? [
                "requestId": request.requestId,
                "gigId": gig,
                "paymentId": request.terms.paymentId as Any? ?? NSNull(),
                "ownerId": request.terms.ownerId,
                "workerId": request.terms.workerId as Any? ?? NSNull(),
                "amountCents": 1000,
                "currency": "usd",
                "action": request.action.rawValue,
                "gigStatus": request.action.resultingStatus,
                "financialStatus": financial
            ] : NSNull()
        ]
    }

    func make(
        _ store: StopMemoryStore,
        action: GigStopAction = .cancel,
        identity: StopIdentity = StopIdentity()
    ) -> GigStopViewModel {
        GigStopViewModel(
            gig: gig,
            actor: actor,
            action: action,
            api: APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none),
            store: store
        ) { identity.value }
    }

    func body(_ request: URLRequest) throws -> [String: Any] {
        if let data = request.httpBody { return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any]) }
        let stream = try XCTUnwrap(request.httpBodyStream)
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let size = stream.read(&buffer, maxLength: buffer.count)
            guard size > 0 else { break }
            data.append(buffer, count: size)
        }
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
