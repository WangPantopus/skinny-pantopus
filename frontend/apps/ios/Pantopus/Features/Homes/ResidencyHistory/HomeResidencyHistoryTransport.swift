import Foundation

@MainActor
protocol HomeResidencyHistoryTransport {
    func session(actorId: String) async throws -> HomeResidencyHistorySession
    func list(
        identity: HomeResidencyHistoryIdentity,
        session: HomeResidencyHistorySession,
        after: HomeResidencyHistoryCursor?
    ) async throws -> HomeResidencyHistoryPage
    func detail(
        identity: HomeResidencyHistoryIdentity,
        session: HomeResidencyHistorySession,
        receiptId: String
    ) async throws -> HomeResidencyHistoryItem
}

@MainActor
struct APIHomeResidencyHistoryTransport: HomeResidencyHistoryTransport {
    let api: APIClient
    private let root = "/api/homes/residency-review-history"

    func session(actorId: String) async throws -> HomeResidencyHistorySession {
        guard HomeResidencyHistoryValidation.uuid(actorId) else { throw HomeResidencyHistoryError.sessionChanged }
        let value = try await read(path: root + "/session")
        let fields = try HomeResidencyHistoryValidation.fields(value, keys: ["session"])
        return try HomeResidencyHistorySession.parse(fields["session"] ?? .null, actorId: actorId)
    }

    func list(
        identity: HomeResidencyHistoryIdentity,
        session: HomeResidencyHistorySession,
        after: HomeResidencyHistoryCursor?
    ) async throws -> HomeResidencyHistoryPage {
        try require(identity, session: session)
        if let after { _ = try HomeResidencyHistoryCursor.parse(after.raw, identity: identity) }
        let value = try await read(path: root + "/" + identity.homeId, session: session, query: after.map { ["after": $0.raw] } ?? [:])
        return try HomeResidencyHistoryPage.parse(value, identity: identity, session: session, after: after)
    }

    func detail(
        identity: HomeResidencyHistoryIdentity,
        session: HomeResidencyHistorySession,
        receiptId: String
    ) async throws -> HomeResidencyHistoryItem {
        try require(identity, session: session)
        guard HomeResidencyHistoryValidation.uuid(receiptId) else { throw HomeResidencyHistoryError.notFound }
        let value = try await read(path: root + "/" + identity.homeId + "/" + receiptId, session: session)
        let fields = try HomeResidencyHistoryValidation.envelope(
            value,
            keys: ["home_id", "actor_id", "item", "session"],
            identity: identity,
            session: session
        )
        return try HomeResidencyHistoryItem.parse(fields["item"] ?? .null, identity: identity, receiptId: receiptId)
    }

    private func require(_ identity: HomeResidencyHistoryIdentity, session: HomeResidencyHistorySession) throws {
        guard identity.isValid, session.actorId == identity.actorId, HomeClaimReviewSnapshot.validToken(session.scope) else {
            throw HomeResidencyHistoryError.sessionChanged
        }
    }

    private func read(path: String, session: HomeResidencyHistorySession? = nil, query: [String: String] = [:]) async throws -> JSONValue {
        var headers = ["Cache-Control": "no-cache, no-store"]
        if let session { headers["X-Pantopus-Session-Scope"] = session.scope }
        let endpoint = Endpoint(method: .get, path: path, query: query, headers: headers, cachePolicy: .reloadIgnoringLocalCacheData)
        do {
            let result = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
            guard result.response.statusCode == 200 else {
                throw safeError(status: result.response.statusCode, body: result.data)
            }
            guard let value = try? JSONDecoder().decode(JSONValue.self, from: result.data)
            else { throw HomeResidencyHistoryError.unavailable }
            return value
        } catch let error as HomeResidencyHistoryError { throw error
        } catch APIError.unauthorized { throw HomeResidencyHistoryError.sessionChanged
        } catch let APIError.clientError(status, text) {
            throw safeError(status: status, body: text?.data(using: .utf8))
        } catch { throw HomeResidencyHistoryError.unavailable }
    }

    private func safeError(status: Int, body: Data?) -> HomeResidencyHistoryError {
        let value = body.flatMap { try? JSONDecoder().decode(JSONValue.self, from: $0) }
        guard let fields = try? HomeResidencyHistoryValidation.fields(value, keys: ["code", "error"]),
              let code = fields["code"]?.stringValue, fields["error"]?.stringValue != nil else { return .unavailable }
        switch (status, code) {
        case (403, "MEMBERS_MANAGE_REQUIRED"): return .forbidden
        case (404, "HOME_NOT_FOUND"): return .homeUnavailable
        case (404, "RESIDENCY_HISTORY_NOT_FOUND"): return .notFound
        case (400, "RESIDENCY_HISTORY_CURSOR_INVALID"): return .cursorInvalid
        case (409, "SESSION_SCOPE_CHANGED"): return .sessionChanged
        default: return .unavailable
        }
    }
}
