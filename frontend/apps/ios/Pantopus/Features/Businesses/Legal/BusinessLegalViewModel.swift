//
//  BusinessLegalViewModel.swift
//  Pantopus
//
//  A10.7 owner surface — "Legal & verification". Two things live here:
//
//    1. The business's *private* record — legal name, tax-id last four,
//       support email (`GET`/`PATCH /api/businesses/:id/private`).
//    2. Verification — status + evidence ledger, self-attestation, and
//       document evidence upload (`backend/routes/businessVerification.js`).
//
//  PII discipline: the private values live in this view-model's memory for
//  the lifetime of the screen and nowhere else. Nothing here is logged,
//  persisted, or put in a query string; `clearSensitive()` wipes the fields
//  when the screen goes away.
//
//  Mirrors RN `src/components/business/tabs/LegalTab.tsx`.
//

import Foundation

/// Verification tiers the backend can report
/// (`backend/utils/businessConstants.js` `VERIFICATION_RANK`).
public enum BusinessVerificationTier: String, Sendable, Hashable {
    case unverified
    case selfAttested = "self_attested"
    case documentVerified = "document_verified"
    case governmentVerified = "government_verified"

    public init(raw: String) {
        self = BusinessVerificationTier(rawValue: raw) ?? .unverified
    }

    public var label: String {
        switch self {
        case .unverified: "Unverified"
        case .selfAttested: "Self-attested"
        case .documentVerified: "Document verified"
        case .governmentVerified: "Government verified"
        }
    }

    public var blurb: String {
        switch self {
        case .unverified:
            "Neighbors see no verification badge yet. Attest to your legal details to get started."
        case .selfAttested:
            "You've attested to your legal name and address. Upload a document to reach the next tier."
        case .documentVerified:
            "A reviewer approved your documents. Your page shows a verified badge."
        case .governmentVerified:
            "Verified against a government registry — the highest tier."
        }
    }
}

/// Document types the backend accepts for evidence upload
/// (`businessVerification.js:27`). `self_attestation` is not uploadable.
public enum BusinessEvidenceType: String, CaseIterable, Sendable, Hashable, Identifiable {
    case businessLicense = "business_license"
    case einLetter = "ein_letter"
    case utilityBill = "utility_bill"
    case stateRegistration = "state_registration"
    case einVerification = "ein_verification"
    case taxExemptLetter = "tax_exempt_letter"

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .businessLicense: "Business license"
        case .einLetter: "EIN letter"
        case .utilityBill: "Utility bill"
        case .stateRegistration: "State registration"
        case .einVerification: "EIN verification"
        case .taxExemptLetter: "501(c)(3) determination letter"
        }
    }

    /// Human label for any evidence row, including `self_attestation` which
    /// the ledger can carry but the picker can't offer.
    public static func label(forRaw raw: String) -> String {
        if let known = BusinessEvidenceType(rawValue: raw) { return known.label }
        if raw == "self_attestation" { return "Self-attestation" }
        return raw.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

/// One evidence row projected for display.
public struct BusinessEvidenceRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    /// `pending | approved | rejected`.
    public let status: String
    public let dateLabel: String?

    public init(id: String, title: String, status: String, dateLabel: String?) {
        self.id = id
        self.title = title
        self.status = status
        self.dateLabel = dateLabel
    }
}

/// Loaded payload for the Legal screen.
public struct BusinessLegalContent: Sendable, Equatable {
    public let tier: BusinessVerificationTier
    public let verifiedDateLabel: String?
    public let evidence: [BusinessEvidenceRow]
    public let canSelfAttest: Bool
    public let selfAttestBlockedReason: String?
    public let canUploadEvidence: Bool
    public let nonprofit: BusinessNonprofitVerificationDTO?
    /// True once the `BusinessPrivate` row exists (Save vs. Update copy).
    public let hasPrivateRecord: Bool
    /// Set when `/private` answered 403 — the viewer is staff without
    /// `sensitive.view`, so the form is hidden rather than shown empty.
    public let privateAccessDenied: Bool

    public init(
        tier: BusinessVerificationTier,
        verifiedDateLabel: String?,
        evidence: [BusinessEvidenceRow],
        canSelfAttest: Bool,
        selfAttestBlockedReason: String?,
        canUploadEvidence: Bool,
        nonprofit: BusinessNonprofitVerificationDTO?,
        hasPrivateRecord: Bool,
        privateAccessDenied: Bool
    ) {
        self.tier = tier
        self.verifiedDateLabel = verifiedDateLabel
        self.evidence = evidence
        self.canSelfAttest = canSelfAttest
        self.selfAttestBlockedReason = selfAttestBlockedReason
        self.canUploadEvidence = canUploadEvidence
        self.nonprofit = nonprofit
        self.hasPrivateRecord = hasPrivateRecord
        self.privateAccessDenied = privateAccessDenied
    }
}

public enum BusinessLegalState: Sendable, Equatable {
    case loading
    case loaded(BusinessLegalContent)
    case error(message: String)
}

public enum BusinessLegalAction: Sendable, Equatable {
    case idle
    case saving
    case attesting
    case uploading
    case succeeded(message: String)
    case failed(message: String)
}

/// A file the owner picked for evidence upload — bytes are held only until
/// the upload completes.
public struct PickedEvidenceFile: Sendable, Hashable {
    public let filename: String
    public let mimeType: String
    public let data: Data

    public init(filename: String, mimeType: String, data: Data) {
        self.filename = filename
        self.mimeType = mimeType
        self.data = data
    }
}

@Observable
@MainActor
public final class BusinessLegalViewModel {
    public private(set) var state: BusinessLegalState = .loading
    public private(set) var action: BusinessLegalAction = .idle

    // Private-record form (PII — memory only, cleared on disappear).
    public var legalName: String = ""
    public var taxIdLast4: String = ""
    public var supportEmail: String = ""
    /// The self-attestation checkbox — the route rejects anything but `true`.
    public var addressConfirmed = false

    private let businessId: String
    private let api: APIClient
    private let uploader: MultipartUploader
    private let seededContent: BusinessLegalContent?

    /// Production initialiser — `APIClient` is module-internal.
    public convenience init(businessId: String) {
        self.init(businessId: businessId, api: .shared)
    }

    init(
        businessId: String,
        api: APIClient,
        uploader: MultipartUploader = .shared,
        seededContent: BusinessLegalContent? = nil
    ) {
        self.businessId = businessId
        self.api = api
        self.uploader = uploader
        self.seededContent = seededContent
        if let seededContent { state = .loaded(seededContent) }
    }

    /// Preview seam.
    public init(businessId: String, content: BusinessLegalContent) {
        self.businessId = businessId
        api = .shared
        uploader = .shared
        seededContent = content
        state = .loaded(content)
    }

    public func load() async {
        guard seededContent == nil else { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        guard seededContent == nil else { return }
        await fetch()
    }

    private func fetch() async {
        // Verification status is the spine of the screen — a failure there is
        // a screen-level error.
        let verification: BusinessVerificationStatusResponse
        do {
            verification = try await api.request(
                BusinessFinanceEndpoints.verificationStatus(businessId: businessId)
            )
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription ?? "Couldn't load verification status."
            )
            return
        }

        // `/private` 403s for staff without `sensitive.view`; that's a
        // legitimate, renderable outcome rather than a screen failure.
        var privateDenied = false
        var privateRecord: BusinessPrivateDTO?
        do {
            let response: BusinessPrivateResponse = try await api.request(
                BusinessFinanceEndpoints.privateRecord(businessId: businessId)
            )
            privateRecord = response.privateRecord
        } catch let error as APIError {
            if case .forbidden = error { privateDenied = true }
        } catch {
            // Leave the form empty; the verification half still renders.
        }

        if let privateRecord {
            legalName = privateRecord.legalName ?? ""
            taxIdLast4 = privateRecord.taxIdLast4 ?? ""
            supportEmail = privateRecord.supportEmail ?? ""
        }

        state = .loaded(
            Self.content(
                verification: verification,
                privateRecord: privateRecord,
                privateAccessDenied: privateDenied
            )
        )
    }

    // MARK: - Private record

    /// `PATCH /private`. Only the three fields this screen owns are sent.
    public func savePrivateRecord() async {
        guard seededContent == nil else { return }
        action = .saving
        let name = legalName.trimmingCharacters(in: .whitespacesAndNewlines)
        let last4 = taxIdLast4.filter(\.isNumber).suffix(4)
        let email = supportEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            _ = try await api.request(
                BusinessFinanceEndpoints.updatePrivateRecord(
                    businessId: businessId,
                    body: UpdateBusinessPrivateRequest(
                        legalName: name.isEmpty ? nil : name,
                        taxIdLast4: last4.isEmpty ? nil : String(last4),
                        supportEmail: email.isEmpty ? nil : email
                    )
                ),
                as: BusinessPrivateResponse.self
            )
            taxIdLast4 = String(last4)
            action = .succeeded(message: "Legal information updated.")
            await refresh()
        } catch {
            action = .failed(
                message: (error as? APIError)?.errorDescription ?? "Couldn't save legal information."
            )
        }
    }

    // MARK: - Verification

    /// `POST /verify/self-attest`. Requires a legal name and an explicit
    /// address confirmation; the route also demands at least one geocoded
    /// location and answers 400 `NO_VERIFIED_LOCATION` otherwise.
    public func selfAttest() async {
        guard seededContent == nil else { return }
        let name = legalName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            action = .failed(message: "Enter your registered legal business name first.")
            return
        }
        guard addressConfirmed else {
            action = .failed(message: "Confirm your registered address to attest.")
            return
        }
        action = .attesting
        do {
            let response: BusinessSelfAttestResponse = try await api.request(
                BusinessFinanceEndpoints.selfAttest(
                    businessId: businessId,
                    body: BusinessSelfAttestRequest(legalName: name, addressConfirmed: true)
                )
            )
            action = .succeeded(message: response.message ?? "Business self-attestation complete.")
            await refresh()
        } catch {
            action = .failed(
                message: (error as? APIError)?.errorDescription ?? "Couldn't complete self-attestation."
            )
        }
    }

    /// Upload a document, then register it as verification evidence.
    /// Two hops: `POST /api/files/upload` for the `File` UUID, then
    /// `POST /verify/upload-evidence`.
    public func uploadEvidence(type: BusinessEvidenceType, file: PickedEvidenceFile) async {
        guard seededContent == nil else { return }
        action = .uploading
        do {
            let upload = try await uploader.uploadFile(
                MultipartFile(
                    fieldName: "file",
                    filename: file.filename,
                    mimeType: file.mimeType,
                    data: file.data
                ),
                formFields: ["file_type": "business_verification", "visibility": "private"]
            )
            _ = try await api.request(
                BusinessFinanceEndpoints.uploadVerificationEvidence(
                    businessId: businessId,
                    body: BusinessUploadEvidenceRequest(
                        evidenceType: type.rawValue,
                        fileId: upload.file.id
                    )
                ),
                as: BusinessUploadEvidenceResponse.self
            )
            action = .succeeded(message: "Document submitted for review.")
            await refresh()
        } catch {
            action = .failed(
                message: (error as? APIError)?.errorDescription ?? "Couldn't submit the document."
            )
        }
    }

    public func clearAction() {
        action = .idle
    }

    /// Wipe the PII fields when the screen goes away so the values don't
    /// outlive the surface that needed them.
    public func clearSensitive() {
        legalName = ""
        taxIdLast4 = ""
        supportEmail = ""
        addressConfirmed = false
    }

    // MARK: - Mapping (pure — unit-test surface)

    public static func content(
        verification: BusinessVerificationStatusResponse,
        privateRecord: BusinessPrivateDTO?,
        privateAccessDenied: Bool
    ) -> BusinessLegalContent {
        BusinessLegalContent(
            tier: BusinessVerificationTier(raw: verification.verificationStatus),
            verifiedDateLabel: BusinessInvoicesViewModel.shortDate(verification.verifiedAt),
            evidence: verification.evidence.map { row in
                BusinessEvidenceRow(
                    id: row.id,
                    title: BusinessEvidenceType.label(forRaw: row.type),
                    status: row.status.lowercased(),
                    dateLabel: BusinessInvoicesViewModel.shortDate(row.reviewedAt ?? row.createdAt)
                )
            },
            canSelfAttest: verification.canSelfAttest,
            selfAttestBlockedReason: verification.canSelfAttestReason,
            canUploadEvidence: verification.canUploadEvidence,
            nonprofit: verification.nonprofitVerification,
            hasPrivateRecord: privateRecord?.businessUserId != nil,
            privateAccessDenied: privateAccessDenied
        )
    }
}
