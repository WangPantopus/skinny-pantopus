import Foundation

@MainActor
protocol HomeResidencyReviewTransport {
    func read(scope: HomeResidencyReviewScope, claimId: String, sessionScope: String?) async throws -> HomeResidencyCurrentReview
    func decide(_ draft: PendingHomeResidencyReview, sessionScope: String) async throws -> HomeResidencyReviewReceipt
}

@MainActor
struct APIHomeResidencyReviewTransport: HomeResidencyReviewTransport {
    let api: APIClient

    func read(scope: HomeResidencyReviewScope, claimId: String, sessionScope: String?) async throws -> HomeResidencyCurrentReview {
        guard scope.isValid, HomePostalValidation.uuid(claimId) else { throw HomeResidencyReviewError.sessionChanged }
        let endpoint = Endpoint(
            method: .get,
            path: "/api/homes/\(scope.homeId)/claim/\(claimId)/review",
            headers: sessionScope.map { ["X-Pantopus-Session-Scope": $0] } ?? [:],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
        let value: JSONValue
        do {
            value = try await api.request(endpoint)
        } catch APIError.unauthorized {
            throw HomeResidencyReviewError.sessionChanged
        } catch {
            throw HomeResidencyReviewError.unavailable
        }
        let review = HomeResidencyCurrentReview(value: value)
        guard review.matches(scope, claimId: claimId, expectedSession: sessionScope) else { throw HomeResidencyReviewError.unavailable }
        return review
    }

    func decide(_ draft: PendingHomeResidencyReview, sessionScope: String) async throws -> HomeResidencyReviewReceipt {
        guard draft.matches(draft.scope), HomeClaimReviewSnapshot.validToken(sessionScope) else { throw HomeResidencyReviewError.changed }
        let endpoint = Endpoint(
            method: .post,
            path: "/api/homes/\(draft.scope.homeId)/claim/\(draft.claimId)/\(draft.action.rawValue)",
            body: draft.body,
            headers: ["X-Pantopus-Session-Scope": sessionScope],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
        let bytes: Data
        let status: Int
        do {
            let response = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
            bytes = response.data
            status = response.response.statusCode
        } catch let APIError.clientError(code, body) {
            guard let data = body?.data(using: .utf8) else { throw HomeResidencyReviewError.unknown }
            bytes = data
            status = code
        } catch APIError.unauthorized {
            throw HomeResidencyReviewError.sessionChanged
        } catch {
            throw HomeResidencyReviewError.unknown
        }
        guard let value = try? JSONDecoder().decode(JSONValue.self, from: bytes), let fields = value.dictValue else {
            throw HomeResidencyReviewError.unknown
        }
        if status != 200 { throw refusal(status: status, code: fields["code"]?.stringValue) }
        let review = HomeResidencyCurrentReview(value: value)
        guard review.matches(draft.scope, claimId: draft.claimId, expectedSession: sessionScope),
              fields["claim_id"]?.stringValue == draft.claimId,
              fields["target_id"]?.stringValue == review.applicantId,
              fields["action"]?.stringValue == draft.action.rawValue,
              fields["replayed"]?.boolValue != nil, let rawReceipt = fields["receipt"] else { throw HomeResidencyReviewError.unknown }
        let receipt = HomeResidencyReviewReceipt(value: rawReceipt)
        guard receipt.matches(draft) else { throw HomeResidencyReviewError.unknown }
        return receipt.projected()
    }

    private func refusal(status: Int, code: String?) -> HomeResidencyReviewError {
        let finalCodes = [
            "RESIDENCY_REVIEW_CHANGED",
            "CLAIM_NOT_PENDING",
            "OWNERSHIP_FLOW_REQUIRED",
            "MEMBERSHIP_RENEWAL_REQUIRED",
            "RESIDENCY_ROLE_FORBIDDEN",
            "PROPOSED_ROLE_FORBIDDEN",
            "PERMISSION_DELEGATION_FORBIDDEN"
        ]
        if [403, 409].contains(status), let code, finalCodes.contains(code) { return .refusal(code) }
        if [401, 403, 404].contains(status) || code == "SESSION_SCOPE_CHANGED" { return .unavailable }
        return .unknown
    }
}
