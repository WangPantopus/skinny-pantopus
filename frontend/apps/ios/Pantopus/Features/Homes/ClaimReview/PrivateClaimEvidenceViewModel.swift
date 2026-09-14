import Foundation
import Observation
import PDFKit
import UIKit

@Observable
@MainActor
final class PrivateClaimEvidenceViewModel: Identifiable {
    nonisolated let id = UUID()
    struct Preview: Identifiable {
        let record: PrivateClaimEvidenceDTO
        let bytes: Data
        let token: String?
        let inspection: String?
        var id: String {
            record.id
        }

        var canRender: Bool {
            if record.mimeType == "application/pdf" { return (PDFDocument(data: bytes)?.pageCount ?? 0) > 0 }
            if record.mimeType == "text/plain" { return String(data: bytes, encoding: .utf8) != nil }
            return PrivateClaimImagePreview.decode(bytes) != nil
        }
    }

    let homeId: String
    let claimId: String
    let platform: Bool
    let claimant: Bool
    let uploadType: ClaimVerificationType?
    private let client: PrivateClaimEvidenceClient
    private var records: [PrivateClaimEvidenceDTO] = []
    private var canVerify = false
    private var accessConfirmed = false
    private var reviewToken: String?
    private var expectedReviewToken: String?
    private var generation = 0
    private(set) var busy = false
    private(set) var error: String?
    private(set) var notice: String?
    private(set) var preview: Preview?
    private struct VerificationDecision {
        let record: PrivateClaimEvidenceDTO
        let token: String
        let inspection: String
    }

    private var pendingDecision: VerificationDecision?
    var pendingVerification: Bool {
        pendingDecision != nil
    }

    var confirmedDocument = false
    var selectedDocumentType = "deed"
    struct PendingUpload {
        let file: ClaimPickedFile
        let id: String
        let type: String
    }

    private(set) var pendingUpload: PendingUpload?

    init(
        homeId: String,
        claimId: String,
        platform: Bool = false,
        claimant: Bool = false,
        uploadType: ClaimVerificationType? = nil,
        expectedReviewToken: String? = nil,
        client: PrivateClaimEvidenceClient = PrivateClaimEvidenceClient()
    ) {
        self.homeId = homeId
        self.claimId = claimId
        self.platform = platform
        self.claimant = claimant
        self.uploadType = uploadType
        self.expectedReviewToken = expectedReviewToken
        selectedDocumentType = uploadType == .residency ? "lease" : "deed"
        self.client = client
    }

    var isCurrent: Bool {
        client.isCurrent
    }

    var evidence: [PrivateClaimEvidenceDTO] {
        isCurrent && accessConfirmed ? records : []
    }

    var visiblePreview: Preview? {
        isCurrent && accessConfirmed ? preview : nil
    }

    var documentOptions: [ClaimDocumentOption] {
        uploadType?.slots.flatMap(\.documentOptions) ?? []
    }

    var mayUpload: Bool {
        isCurrent && claimant && uploadType != nil && !busy && !pendingVerification
    }

    var mayVerify: Bool {
        isCurrent && !busy && canVerify && (pendingDecision != nil
            || (accessConfirmed && preview?.inspection != nil && preview?.canRender == true && confirmedDocument))
    }

    func mayRetire(_ record: PrivateClaimEvidenceDTO) -> Bool {
        isCurrent && accessConfirmed && claimant && !busy && !pendingVerification
            && (record.state != "retired" || record.cleanupPending == true) && record.status != "verified"
    }

    func retire() {
        generation += 1
        client.retire()
        records = []
        preview = nil
        pendingDecision = nil
        confirmedDocument = false
        pendingUpload = nil
        accessConfirmed = false
    }

    func closePreview() {
        guard !busy, !pendingVerification else { return }
        generation += 1
        preview = nil
        confirmedDocument = false
    }

    func load() async {
        guard !busy, !pendingVerification else { return }
        busy = true
        accessConfirmed = false
        records = []
        preview = nil
        let revision = generation
        defer { busy = false }
        do {
            let result = try await client.list(homeId: homeId, claimId: claimId, platform: platform)
            try client.requireCurrent()
            guard revision == generation else { return }
            guard claimant || (HomeClaimReviewSnapshot.validToken(expectedReviewToken)
                && result.reviewToken == expectedReviewToken) else { throw HomeClaimReviewError.snapshotChanged }
            accept(result)
            error = nil
        } catch { fail(error, revision: revision) }
    }

    func open(_ record: PrivateClaimEvidenceDTO) async {
        guard !busy, !pendingVerification, evidence.contains(record), record.available else { return }
        busy = true
        accessConfirmed = false
        let revision = generation
        preview = nil
        confirmedDocument = false
        defer { busy = false }
        do {
            let token = canVerify && record.status == "pending" ? reviewToken : nil
            let (bytes, inspection) = try await client.download(record, token: token, platform: platform)
            try client.requireCurrent()
            guard revision == generation else { return }
            preview = Preview(record: record, bytes: bytes, token: token, inspection: inspection)
            accessConfirmed = true
            error = nil
        } catch { fail(error, revision: revision) }
    }

    func verify() async {
        guard mayVerify else { return }
        let decision: VerificationDecision
        if let pendingDecision {
            decision = pendingDecision
        } else {
            guard let preview, let token = preview.token, let inspection = preview.inspection else { return }
            decision = VerificationDecision(record: preview.record, token: token, inspection: inspection)
        }
        busy = true
        pendingDecision = decision
        let revision = generation
        defer { busy = false }
        do {
            let result = try await client.verify(
                decision.record,
                token: decision.token,
                inspection: decision.inspection,
                platform: platform
            )
            try client.requireCurrent()
            guard revision == generation else { return }
            records.removeAll { $0.id == result.record.id }
            records.append(result.record)
            accessConfirmed = true
            reviewToken = result.reviewToken
            expectedReviewToken = result.reviewToken
            pendingDecision = nil
            preview = nil
            confirmedDocument = false
            error = nil
            notice = "Document verified. Claim approval is a separate decision."
        } catch {
            if HomeClaimReviewError.isFinalClientFailure(error) {
                pendingDecision = nil
                preview = nil
                confirmedDocument = false
            }
            fail(error, revision: revision)
        }
    }

    func remove(_ record: PrivateClaimEvidenceDTO) async {
        guard mayRetire(record), evidence.contains(record) else { return }
        busy = true
        let revision = generation
        defer { busy = false }
        do {
            let retired = try await client.remove(record)
            try client.requireCurrent()
            guard revision == generation else { return }
            records = records.map { $0.id == retired.id ? retired : $0 }
            accessConfirmed = true
            preview = nil
            error = nil
            notice = "Pending document removed. Its history is retained."
        } catch { fail(error, revision: revision) }
    }

    func picked(_ file: ClaimPickedFile) {
        guard mayUpload, pendingUpload == nil, documentOptions.contains(where: { $0.id == selectedDocumentType }) else { return }
        pendingUpload = PendingUpload(file: file, id: UUID().uuidString.lowercased(), type: selectedDocumentType)
    }

    func upload() async {
        guard mayUpload, let pendingUpload else { return }
        busy = true
        let revision = generation
        defer { busy = false }
        do {
            let record = try await client.upload(
                homeId: homeId,
                claimId: claimId,
                uploadId: pendingUpload.id,
                type: pendingUpload.type,
                file: pendingUpload.file
            )
            try client.requireCurrent()
            guard revision == generation else { return }
            records.removeAll { $0.id == record.id }
            records.append(record)
            accessConfirmed = true
            self.pendingUpload = nil
            error = nil
            notice = "Private document saved as pending evidence."
        } catch { fail(error, revision: revision) }
    }

    private func accept(_ result: PrivateClaimEvidenceList) {
        records = result.evidence
        accessConfirmed = true
        canVerify = result.canVerify && !claimant
        reviewToken = result.reviewToken
    }

    private func fail(_ error: any Error, revision: Int) {
        guard revision == generation else { return }
        self.error = HomeClaimReviewError.message(for: error)
        accessConfirmed = false
        records = []
        preview = nil
        confirmedDocument = false
        if HomeClaimReviewError.isFinalClientFailure(error) { pendingDecision = nil }
        if !client.isCurrent { retire() }
    }
}
