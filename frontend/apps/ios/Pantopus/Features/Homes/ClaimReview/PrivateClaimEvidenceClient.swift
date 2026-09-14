import Foundation

/// Private document requests are bound to the opening local and server session.
@MainActor
final class PrivateClaimEvidenceClient {
    nonisolated static let allowedMIMEs: Set<String> = [
        "application/pdf", "text/plain", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"
    ]
    nonisolated static let allowedTypes: Set<String> = ["deed", "closing_disclosure", "tax_bill", "utility_bill", "lease"]
    private let api: APIClient
    private let uploader: MultipartUploader
    private let scope: HomeClaimSessionScope
    private let actorId: String?
    private var serverSession: String?
    private var retired = false

    init(
        api: APIClient = .shared,
        uploader: MultipartUploader = .shared,
        actorId: String? = nil,
        identity: (() -> String?)? = nil
    ) {
        self.api = api
        self.uploader = uploader
        scope = HomeClaimSessionScope(api: api, identity: identity)
        if let actorId {
            self.actorId = actorId
        } else if case let .signedIn(user) = (api.authProvider ?? AuthManager.shared).state {
            self.actorId = user.id
        } else {
            self.actorId = nil
        }
    }

    var isCurrent: Bool {
        !retired && actorId != nil && scope.isCurrent && api.apiBaseURL == uploader.apiBaseURL
    }

    var hasServerSession: Bool {
        isCurrent && serverSession != nil
    }

    func retire() {
        retired = true
        serverSession = nil
    }

    func requireCurrent() throws {
        guard isCurrent, !Task.isCancelled else { retire()
            throw HomeClaimReviewError.sessionChanged
        }
    }

    private var headers: [String: String] {
        serverSession.map { ["X-Pantopus-Session-Scope": $0] } ?? [:]
    }

    func claims() async throws -> MyOwnershipClaimsResponse {
        try requireCurrent()
        let result: MyOwnershipClaimsResponse = try await api.request(Endpoint(
            method: .get,
            path: "/api/homes/my-ownership-claims",
            headers: headers,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        ))
        try requireCurrent()
        guard let session = result.uploadSession, session.isValid, session.actorId == actorId,
              serverSession == nil || session.sessionScope == serverSession else {
            retire()
            throw HomeClaimReviewError.sessionChanged
        }
        serverSession = session.sessionScope
        return result
    }

    func submit(homeId: String, type: String) async throws -> SubmitClaimResponse {
        _ = try await claims()
        try requireCurrent()
        let result: SubmitClaimResponse = try await api.request(Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/ownership-claims",
            body: SubmitClaimRequest(
                claimType: type,
                method: "doc_upload"
            ),
            headers: headers,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        ))
        try requireCurrent()
        return result
    }

    func list(homeId: String, claimId: String, platform: Bool = false) async throws -> PrivateClaimEvidenceList {
        try requireCurrent()
        guard UUID(uuidString: homeId) != nil, UUID(uuidString: claimId) != nil else { throw APIError.invalidResponse }
        let result: PrivateClaimEvidenceList = try await api.request(endpoint(home: homeId, claim: claimId, platform: platform))
        try requireCurrent()
        let session = result.claimSession
        guard session.actorId == actorId, session.homeId == homeId, session.claimId == claimId,
              HomeClaimReviewSnapshot.validToken(session.sessionScope), HomeClaimReviewSnapshot.validToken(result.reviewToken),
              serverSession == nil || session.sessionScope == serverSession else {
            retire()
            throw HomeClaimReviewError.sessionChanged
        }
        guard result.evidence.allSatisfy({ $0.matches(home: homeId, claim: claimId) }),
              Set(result.evidence.map(\.id)).count == result.evidence.count else { throw APIError.invalidResponse }
        serverSession = session.sessionScope
        return result
    }

    func upload(
        homeId: String,
        claimId: String,
        uploadId: String,
        type: String,
        file: ClaimPickedFile
    ) async throws -> PrivateClaimEvidenceDTO {
        _ = try await list(homeId: homeId, claimId: claimId)
        try requireCurrent()
        guard let serverSession, let actorId, UUID(uuidString: uploadId) != nil, Self.allowedTypes.contains(type),
              Self.allowedMIMEs.contains(file.mimeType), !file.data.isEmpty, file.data.count <= CLAIM_FILE_MAX_BYTES,
              !file.safeFilename.isEmpty, file.safeFilename.utf16.count <= 255 else { throw APIError.invalidResponse }
        let result = try await uploader.uploadClaimEvidence(
            scope: PrivateClaimEvidenceSession(actorId: actorId, sessionScope: serverSession, homeId: homeId, claimId: claimId),
            uploadId: uploadId,
            evidenceType: type,
            file: MultipartFile(
                fieldName: "file",
                filename: file.safeFilename,
                mimeType: file.mimeType,
                data: file.data
            )
        )
        try requireCurrent()
        _ = try await list(homeId: homeId, claimId: claimId)
        let record = result.evidence
        guard record.matches(home: homeId, claim: claimId, evidence: uploadId), record.state == "ready", record.available,
              record.fileName == file.safeFilename, record.fileSize == file.data.count, record.mimeType == file.mimeType,
              record.evidenceType == type else { throw APIError.invalidResponse }
        return record
    }

    func download(_ record: PrivateClaimEvidenceDTO, token: String?, platform: Bool) async throws -> (Data, String?) {
        let before = try await list(homeId: record.homeId, claimId: record.claimId, platform: platform)
        try requireDownloadContext(before, record: record, token: token)
        try requireCurrent()
        let result = try await api.requestDataResponse(endpoint(
            home: record.homeId,
            claim: record.claimId,
            suffix: "/\(record.id)/download",
            platform: platform,
            reviewToken: token
        ))
        try requireCurrent()
        let after = try await list(homeId: record.homeId, claimId: record.claimId, platform: platform)
        try requireDownloadContext(after, record: record, token: token)
        guard result.data.count == record.fileSize,
              result.response.mimeType == record.mimeType else { throw APIError.invalidResponse }
        let inspection = result.response.value(forHTTPHeaderField: "X-Claim-Evidence-Inspection")
        if token != nil, !HomeClaimReviewSnapshot.validToken(inspection) { throw APIError.invalidResponse }
        return (result.data, inspection)
    }

    private func requireDownloadContext(
        _ result: PrivateClaimEvidenceList,
        record: PrivateClaimEvidenceDTO,
        token: String?
    ) throws {
        guard record.available, record.state == "ready",
              result.evidence.first(where: { $0.id == record.id }) == record,
              token == nil || (result.canVerify && result.reviewToken == token) else {
            throw HomeClaimReviewError.snapshotChanged
        }
    }

    func verify(
        _ record: PrivateClaimEvidenceDTO,
        token: String,
        inspection: String,
        platform: Bool
    ) async throws -> PrivateClaimEvidenceVerification {
        _ = try await list(homeId: record.homeId, claimId: record.claimId, platform: platform)
        try requireCurrent()
        guard HomeClaimReviewSnapshot.validToken(token),
              HomeClaimReviewSnapshot.validToken(inspection) else { throw APIError.invalidResponse }
        let result: PrivateClaimEvidenceVerification = try await api.request(endpoint(
            home: record.homeId,
            claim: record.claimId,
            suffix: "/\(record.id)/verify",
            platform: platform,
            method: .post,
            body: [
                "review_token": token,
                "inspection": inspection
            ]
        ))
        try requireCurrent()
        _ = try await list(homeId: record.homeId, claimId: record.claimId, platform: platform)
        guard result.ok, result.homeId == record.homeId, result.claimId == record.claimId,
              result.uploadId == record.id, result.action == "verify_evidence", HomeClaimReviewSnapshot.validToken(result.reviewToken),
              result.record.matches(home: record.homeId, claim: record.claimId, evidence: record.id),
              result.record.status == "verified", result.record.eligibleForReview else { throw APIError.invalidResponse }
        return result
    }

    func remove(_ record: PrivateClaimEvidenceDTO) async throws -> PrivateClaimEvidenceDTO {
        _ = try await list(homeId: record.homeId, claimId: record.claimId)
        try requireCurrent()
        let result: PrivateClaimEvidenceEnvelope = try await api.request(endpoint(
            home: record.homeId,
            claim: record.claimId,
            suffix: "/\(record.id)",
            method: .delete
        ))
        try requireCurrent()
        _ = try await list(homeId: record.homeId, claimId: record.claimId)
        guard result.evidence.matches(home: record.homeId, claim: record.claimId, evidence: record.id),
              result.evidence.state == "retired", !result.evidence.available else { throw APIError.invalidResponse }
        return result.evidence
    }

    private func endpoint(
        home: String,
        claim: String,
        suffix: String = "",
        platform: Bool = false,
        reviewToken: String? = nil,
        method: Endpoint.Method = .get,
        body: [String: String]? = nil
    ) -> Endpoint {
        var query = ["review": platform ? "platform" : "home"]
        if let reviewToken { query["review_token"] = reviewToken }
        return Endpoint(
            method: method,
            path: "/api/upload/home-claim-evidence/\(home)/\(claim)\(suffix)",
            query: query,
            body: body,
            headers: headers,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        )
    }
}
