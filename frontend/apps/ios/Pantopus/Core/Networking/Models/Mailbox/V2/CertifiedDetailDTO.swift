//
//  CertifiedDetailDTO.swift
//  Pantopus
//
//  Certified-mail sub-payload decoded from `mail.object_payload` when
//  `mail_type == "certified"`. Backend stores this as untyped JSON in
//  S3 (route handler at `backend/routes/mailboxV2.js:412`); the DTO is
//  defensive and `decode(from:)` returns nil if the payload doesn't
//  carry a reference number.
//

import Foundation

/// One step in the chain-of-custody timeline rendered by the certified
/// body.
public struct CertifiedChainStep: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let occurredAt: String?
    public let isComplete: Bool

    public init(id: String, label: String, occurredAt: String?, isComplete: Bool) {
        self.id = id
        self.label = label
        self.occurredAt = occurredAt
        self.isComplete = isComplete
    }
}

/// Certified detail payload — drives the FrameCertified body.
public struct CertifiedDetailDTO: Sendable, Hashable {
    public let referenceNumber: String
    public let documentType: String?
    public let acknowledgeBy: String?
    public let chain: [CertifiedChainStep]
    public let noticeBody: String?
    public let termsURL: URL?
    public let isAcknowledged: Bool

    public init(
        referenceNumber: String,
        documentType: String?,
        acknowledgeBy: String?,
        chain: [CertifiedChainStep],
        noticeBody: String?,
        termsURL: URL?,
        isAcknowledged: Bool
    ) {
        self.referenceNumber = referenceNumber
        self.documentType = documentType
        self.acknowledgeBy = acknowledgeBy
        self.chain = chain
        self.noticeBody = noticeBody
        self.termsURL = termsURL
        self.isAcknowledged = isAcknowledged
    }

    public static func decode(from value: JSONValue?) -> CertifiedDetailDTO? {
        guard let dict = value?.dictValue else { return nil }
        guard let reference = dict["reference_number"]?.stringValue
            ?? dict["reference"]?.stringValue, !reference.isEmpty else {
            return nil
        }
        let chainArr = dict["chain"]?.arrayValue ?? []
        let chain = chainArr.compactMap { entry -> CertifiedChainStep? in
            guard let stepDict = entry.dictValue,
                  let id = stepDict["id"]?.stringValue ?? stepDict["status"]?.stringValue,
                  let label = stepDict["label"]?.stringValue ?? stepDict["title"]?.stringValue
            else { return nil }
            return CertifiedChainStep(
                id: id,
                label: label,
                occurredAt: stepDict["occurred_at"]?.stringValue,
                isComplete: stepDict["complete"]?.boolValue
                    ?? (stepDict["occurred_at"] != nil)
            )
        }
        return CertifiedDetailDTO(
            referenceNumber: reference,
            documentType: dict["document_type"]?.stringValue,
            acknowledgeBy: dict["acknowledge_by"]?.stringValue,
            chain: chain,
            noticeBody: dict["notice_body"]?.stringValue ?? dict["body"]?.stringValue,
            termsURL: dict["terms_url"]?.stringValue.flatMap(URL.init(string:)),
            isAcknowledged: dict["is_acknowledged"]?.boolValue ?? false
        )
    }
}
