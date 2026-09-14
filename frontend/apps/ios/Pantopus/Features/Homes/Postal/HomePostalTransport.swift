import Foundation

enum HomePostalAction { case submit, check, cancel }

@MainActor
protocol HomePostalTransport {
    func resolve(_ draft: PendingHomePostalCommand, action: HomePostalAction) async throws -> HomePostalOutcome
}

@MainActor
struct APIHomePostalTransport: HomePostalTransport {
    let api: APIClient

    func resolve(_ draft: PendingHomePostalCommand, action: HomePostalAction) async throws -> HomePostalOutcome {
        guard draft.matches(draft.scope) else { throw HomePostalError.changed }
        let base = "/api/homes/\(draft.scope.homeId)"
        let submitPath: String
        switch draft.kind {
        case .mail: submitPath = "\(base)/postcard-requests"
        case .code:
            guard let postcard = draft.postcardId else { throw HomePostalError.changed }
            submitPath = "\(base)/postcards/\(postcard)/verifications"
        }
        let path = action == .submit ? submitPath : "\(submitPath)/\(draft.requestId)\(action == .cancel ? "/cancel" : "")"
        let endpoint = Endpoint(
            method: action == .check ? .get : .post,
            path: path,
            body: action == .submit ? draft.body : nil,
            cachePolicy: .reloadIgnoringLocalCacheData
        )
        let data: Data
        let status: Int
        do {
            let response = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
            data = response.data
            status = response.response.statusCode
        } catch let APIError.clientError(code, body) {
            guard let bytes = body?.data(using: .utf8) else { throw HomePostalError.unknown }
            data = bytes
            status = code
        } catch APIError.unauthorized {
            throw HomePostalError.sessionChanged
        } catch {
            throw HomePostalError.unknown
        }
        guard let raw = try? JSONDecoder().decode(JSONValue.self, from: data) else { throw HomePostalError.unknown }
        let outcome = HomePostalOutcome(value: raw)
        guard outcome.matches(draft), accepts(status, state: outcome.state) else { throw HomePostalError.unknown }
        return outcome.projected()
    }

    private func accepts(_ status: Int, state: String) -> Bool {
        switch state {
        case "completed", "cancelled": status == 200
        case "pending": status == 202
        case "rejected": [400, 403, 404, 409, 410, 422, 429].contains(status)
        default: false
        }
    }
}
