//
//  MailboxDocumentDTOs.swift
//  Pantopus
//
//  Wire models for `MailboxDocumentEndpoints` — the booklet PDF
//  download and the certified-mail legal delivery proof. Both handlers
//  build their response as a JS object literal, so (unlike the `Mail`
//  row DTOs) the keys are already camelCase.
//

import Foundation

/// `POST /api/mailbox/v2/p2/booklet/:mailId/download` envelope — route
/// `backend/routes/mailboxV2Phase2.js:447`.
public struct BookletDownloadResponse: Decodable, Sendable, Hashable {
    /// Signed URL for the generated PDF.
    public let downloadURL: String?
    /// File size in bytes — RN reports it as MB in the confirmation
    /// (`src/app/mailbox/booklet.tsx:47`).
    public let sizeBytes: Int?

    public init(downloadURL: String?, sizeBytes: Int?) {
        self.downloadURL = downloadURL
        self.sizeBytes = sizeBytes
    }

    private enum CodingKeys: String, CodingKey {
        case downloadURL = "downloadUrl"
        case sizeBytes
    }

    /// "2.4 MB" — the label RN puts in its "Download Started" alert.
    public var megabytesLabel: String? {
        guard let sizeBytes, sizeBytes > 0 else { return nil }
        let megabytes = Double(sizeBytes) / (1024 * 1024)
        return String(format: "%.1f MB", megabytes)
    }
}

/// `GET /api/mailbox/v2/p2/certified/:mailId/proof` envelope — route
/// `backend/routes/mailboxV2Phase2.js:705`.
public struct CertifiedProofResponse: Decodable, Sendable, Hashable {
    public let proof: CertifiedProofDTO?

    public init(proof: CertifiedProofDTO?) {
        self.proof = proof
    }
}

/// The legal delivery proof the backend assembles from the `Mail` row.
public struct CertifiedProofDTO: Decodable, Sendable, Hashable {
    public let mailId: String?
    public let sender: String?
    public let senderTrust: String?
    public let deliveredAt: String?
    public let acknowledgedAt: String?
    public let acknowledgedBy: String?
    public let legalTimestamp: String?

    public init(
        mailId: String?,
        sender: String?,
        senderTrust: String?,
        deliveredAt: String?,
        acknowledgedAt: String?,
        acknowledgedBy: String?,
        legalTimestamp: String?
    ) {
        self.mailId = mailId
        self.sender = sender
        self.senderTrust = senderTrust
        self.deliveredAt = deliveredAt
        self.acknowledgedAt = acknowledgedAt
        self.acknowledgedBy = acknowledgedBy
        self.legalTimestamp = legalTimestamp
    }
}
