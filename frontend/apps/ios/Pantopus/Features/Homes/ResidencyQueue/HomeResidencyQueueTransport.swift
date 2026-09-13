import Foundation

@MainActor
protocol HomeResidencyQueueTransport {
    func session(actorId: String) async throws -> HomeResidencyQueueSession
    func list(identity: HomeResidencyQueueIdentity, session: HomeResidencyQueueSession) async throws -> HomeResidencyQueuePage
}

@MainActor
struct APIHomeResidencyQueueTransport: HomeResidencyQueueTransport {
    let api: APIClient

    func session(actorId: String) async throws -> HomeResidencyQueueSession {
        guard HomeResidencyQueueValidation.uuid(actorId) else { throw HomeResidencyQueueError.sessionChanged }
        let value = try await read(path: "/api/homes/residency-claims/session")
        let fields = try HomeResidencyQueueValidation.fields(value, keys: ["session"])
        return try HomeResidencyQueueSession.parse(fields["session"], actorId: actorId)
    }

    func list(identity: HomeResidencyQueueIdentity, session: HomeResidencyQueueSession) async throws -> HomeResidencyQueuePage {
        guard identity.isValid, session.actorId == identity.actorId, HomeClaimReviewSnapshot.validToken(session.scope) else {
            throw HomeResidencyQueueError.sessionChanged
        }
        let value = try await read(path: "/api/homes/" + identity.homeId + "/claims", session: session)
        return try HomeResidencyQueuePage.parse(value, identity: identity, session: session)
    }

    private func read(path: String, session: HomeResidencyQueueSession? = nil) async throws -> JSONValue {
        var headers = ["Cache-Control": "no-cache, no-store"]
        if let session { headers["X-Pantopus-Session-Scope"] = session.scope }
        let endpoint = Endpoint(method: .get, path: path, headers: headers, cachePolicy: .reloadIgnoringLocalCacheData)
        do {
            let result = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
            guard result.response.statusCode == 200 else {
                throw safeError(status: result.response.statusCode, body: result.data)
            }
            guard let value = try? JSONDecoder().decode(JSONValue.self, from: result.data)
            else { throw HomeResidencyQueueError.unavailable }
            return value
        } catch let error as HomeResidencyQueueError { throw error
        } catch APIError.unauthorized { throw HomeResidencyQueueError.sessionChanged
        } catch let APIError.clientError(status, text) {
            throw safeError(status: status, body: text?.data(using: .utf8))
        } catch { throw HomeResidencyQueueError.unavailable }
    }

    private func safeError(status: Int, body: Data?) -> HomeResidencyQueueError {
        let value = body.flatMap { try? JSONDecoder().decode(JSONValue.self, from: $0) }
        guard let fields = try? HomeResidencyQueueValidation.fields(value, keys: ["code", "error"]),
              let code = fields["code"]?.stringValue, fields["error"]?.stringValue != nil else { return .unavailable }
        switch (status, code) {
        case (403, "MEMBERS_MANAGE_REQUIRED"): return .forbidden
        case (404, "HOME_NOT_FOUND"): return .homeUnavailable
        case (409, "SESSION_SCOPE_CHANGED"): return .sessionChanged
        default: return .unavailable
        }
    }
}
