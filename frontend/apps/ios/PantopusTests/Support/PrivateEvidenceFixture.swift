import Foundation
import XCTest
@testable import Pantopus

@MainActor
struct PrivateEvidenceFixture {
    let home = "10000000-0000-4000-8000-000000000001"
    let claim = "10000000-0000-4000-8000-000000000002"
    let actor = "10000000-0000-4000-8000-000000000003"
    let upload = "10000000-0000-4000-8000-000000000004"
    let scope = String(repeating: "a", count: 64)
    let token = String(repeating: "b", count: 64)
    let inspection = String(repeating: "c", count: 64)
    var path: String {
        "/api/upload/home-claim-evidence/\(home)/\(claim)"
    }

    var uploadPath: String {
        "/api/upload/ownership-evidence/\(home)/\(claim)"
    }

    var file: ClaimPickedFile {
        .init(filename: "document.txt", mimeType: "text/plain", data: Data("exact private proof".utf8))
    }

    func json(_ value: [String: Any]) -> String {
        do { return try String(bytes: JSONSerialization.data(withJSONObject: value), encoding: .utf8) ?? "{}" } catch {
            XCTFail("Invalid test fixture: \(error)")
            return "{}"
        }
    }

    func record(_ changes: [String: Any] = [:]) -> [String: Any] {
        [
            "id": upload,
            "home_id": home,
            "claim_id": claim,
            "evidence_type": "deed",
            "file_name": file.filename,
            "file_size": file.sizeBytes,
            "mime_type": file.mimeType,
            "status": "pending",
            "state": "ready",
            "available": true,
            "eligible_for_review": false
        ]
        .merging(changes) { _, value in value }
    }

    func list(_ changes: [String: Any] = [:], records: [[String: Any]]? = nil) -> String {
        json([
            "evidence": records ?? [record()],
            "can_verify": true,
            "review_token": token,
            "claim_session": ["actor_id": actor, "session_scope": scope, "home_id": home, "claim_id": claim]
        ]
        .merging(changes) { _, value in value })
    }

    func claims(existing: Bool = false, status: String = "under_review") -> String {
        json([
            "claims": existing ? [
                [
                    "id": claim,
                    "home_id": home,
                    "claim_type": "owner",
                    "method": "doc_upload",
                    "status": status,
                    "created_at": "2026-09-10T00:00:00Z",
                    "updated_at": "2026-09-10T00:00:00Z"
                ]
            ] : [],
            "upload_session": ["actor_id": actor, "session_scope": scope]
        ])
    }

    func verification(_ changes: [String: Any] = [:]) -> String {
        json([
            "ok": true,
            "home_id": home,
            "claim_id": claim,
            "upload_id": upload,
            "action": "verify_evidence",
            "review_token": String(repeating: "d", count: 64),
            "record": record(["status": "verified", "eligible_for_review": true]),
            "replayed": false
        ].merging(changes) { _, value in value })
    }

    func client(identity: @escaping () -> String? = { "opening" }) -> PrivateClaimEvidenceClient {
        PrivateClaimEvidenceClient(
            api: api(),
            uploader: MultipartUploader(session: SequencedURLProtocol.makeSession()),
            actorId: actor,
            identity: identity
        )
    }

    func api() -> APIClient {
        APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    func routes(listBody: String? = nil) {
        SequencedURLProtocol.routeResponses = [
            path: Array(repeating: .status(200, body: listBody ?? list()), count: 25),
            "/api/homes/my-ownership-claims": Array(repeating: .status(200, body: claims()), count: 12),
            "/api/homes/\(home)/public-profile": [.status(200, body: json(["home": ["id": home, "address": "Verified fixture address"]]))],
            "/api/homes/\(home)/ownership-claims": [
                .status(
                    201,
                    body: json(["message": "Saved", "claim": ["id": claim, "status": "under_review"]])
                )
            ],
            uploadPath: [.status(200, body: json(["evidence": record()]))],
            "\(path)/\(upload)/download": [
                .status(
                    200,
                    body: "exact private proof",
                    headers: ["Content-Type": "text/plain", "X-Claim-Evidence-Inspection": inspection]
                )
            ],
            "\(path)/\(upload)/verify": [.status(200, body: verification())]
        ]
    }

    func decodedRecord(_ changes: [String: Any] = [:]) throws -> PrivateClaimEvidenceDTO {
        try JSONDecoder().decode(PrivateClaimEvidenceDTO.self, from: Data(json(record(changes)).utf8))
    }
}
