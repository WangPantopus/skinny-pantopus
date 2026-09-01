//
//  ClaimOwnershipSteps.swift
//  Pantopus
//
//  Step descriptors + form state for the claim-ownership wizard.
//

import Foundation

/// Steps the claim-ownership wizard can be on. Order is meaningful —
/// the wizard advances `start → upload → success` and back-navigates
/// `upload → start`. Success has no back chevron and ends the flow.
///
/// Chrome (top-bar readout + progress fraction) is computed in the VM's
/// `chrome` accessor; per-step numeric metadata isn't needed because the
/// wizard doesn't survive process death (no save/restore key).
public enum ClaimOwnershipStep: String, CaseIterable, Sendable {
    case start
    case upload
    case success
}

/// Which verification the wizard is running. Selects both the document
/// slot set and the `claim_type` sent on
/// `POST /api/homes/:id/ownership-claims`
/// (`submitClaimSchema`, `backend/routes/homeOwnership.js:34` —
/// `claim_type` accepts `owner | admin | resident`).
///
/// Mirrors RN `src/app/homes/[id]/claim-owner/evidence.tsx:33-37, :92-95`,
/// where `verificationType=residency` swaps the doc list and sends
/// `claim_type: 'resident'`.
public enum ClaimVerificationType: String, CaseIterable, Sendable {
    case owner
    case residency

    /// `claim_type` on the submit body.
    public var claimType: String {
        switch self {
        case .owner: "owner"
        case .residency: "resident"
        }
    }

    /// Wizard top-bar title.
    public var wizardTitle: String {
        switch self {
        case .owner: "Claim ownership"
        case .residency: "Verify residency"
        }
    }

    /// Steps this variant walks. RN's residency entry point
    /// (`homes/index.tsx:275`) links straight to the evidence screen, so
    /// the residency variant skips the ownership explainer step.
    public var steps: [ClaimOwnershipStep] {
        switch self {
        case .owner: [.start, .upload, .success]
        case .residency: [.upload, .success]
        }
    }

    /// Upload tiles required before submit is enabled.
    public var slots: [ClaimEvidenceSlot] {
        switch self {
        case .owner: [.identity, .ownership]
        case .residency: [.residency]
        }
    }
}

/// One selectable document kind inside a slot that accepts several
/// `evidence_type` values. `id` is the backend `evidence_type` from
/// `uploadEvidenceSchema` (`backend/routes/homeOwnership.js:44-47`).
public struct ClaimDocumentOption: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String
    public let detail: String
    public let icon: PantopusIcon

    public init(id: String, label: String, detail: String, icon: PantopusIcon) {
        self.id = id
        self.label = label
        self.detail = detail
        self.icon = icon
    }
}

/// Identifier for one of the wizard's upload tiles.
public enum ClaimEvidenceSlot: String, CaseIterable, Sendable {
    case identity
    case ownership
    /// Residency proof — the user picks which document kind they're
    /// attaching from `documentOptions`.
    case residency

    /// Backend `evidence_type` enum value sent on upload —
    /// `uploadEvidenceSchema` (`backend/routes/homeOwnership.js:43`).
    /// `nil` for slots whose type is chosen by the user; read
    /// `documentOptions` instead.
    public var fixedBackendType: String? {
        switch self {
        case .identity: "idv"
        // The ownership proof is one of five document kinds the
        // claimant declares (RN `OWNERSHIP_DOC_OPTIONS`,
        // `evidence.tsx:26-32`), so the type is user-picked, not fixed.
        case .ownership, .residency: nil
        }
    }

    /// Legacy accessor kept for the owner variant's fixed slots.
    public var backendType: String {
        fixedBackendType ?? (documentOptions.first?.id ?? "utility_bill")
    }

    /// Document kinds this slot accepts. Empty for fixed slots.
    /// Ownership list copied verbatim from RN's `OWNERSHIP_DOC_OPTIONS`
    /// (`evidence.tsx:26-32`); residency list from
    /// `RESIDENCY_DOC_OPTIONS` (`evidence.tsx:34-38`).
    public var documentOptions: [ClaimDocumentOption] {
        switch self {
        case .identity:
            []
        case .ownership:
            [
                ClaimDocumentOption(
                    id: "deed",
                    label: "Deed",
                    detail: "Property deed or title document",
                    icon: .fileText
                ),
                ClaimDocumentOption(
                    id: "closing_disclosure",
                    label: "Closing Disclosure",
                    detail: "Settlement statement from purchase",
                    icon: .fileText
                ),
                ClaimDocumentOption(
                    id: "tax_bill",
                    label: "Property Tax Statement",
                    detail: "Tax bill showing property owner",
                    icon: .receipt
                ),
                ClaimDocumentOption(
                    id: "escrow_attestation",
                    label: "Title/Escrow Attestation",
                    detail: "Letter from title or escrow company",
                    icon: .shieldCheck
                ),
                ClaimDocumentOption(
                    id: "title_match",
                    label: "Title Record Match",
                    detail: "Public record title match",
                    icon: .checkCircle
                )
            ]
        case .residency:
            [
                ClaimDocumentOption(
                    id: "lease",
                    label: "Lease Agreement",
                    detail: "Current rental or lease agreement",
                    icon: .fileText
                ),
                ClaimDocumentOption(
                    id: "utility_bill",
                    label: "Utility Bill",
                    detail: "Electric, gas, water, or internet bill at this address",
                    icon: .receipt
                ),
                ClaimDocumentOption(
                    id: "tax_bill",
                    label: "Property Tax Statement",
                    detail: "Tax bill showing this address",
                    icon: .receipt
                )
            ]
        }
    }

    public var title: String {
        switch self {
        case .identity: "Government ID"
        case .ownership: "Proof of ownership"
        case .residency: "Proof of residency"
        }
    }

    public var acceptHint: String {
        "JPG or PNG up to 10 MB"
    }
}

/// Maximum file size accepted by the wizard's client-side picker.
/// Mirrors the backend's `/api/files/upload` cap so the user sees an
/// inline error instead of a 413 round-trip.
public let CLAIM_FILE_MAX_BYTES: Int = 10 * 1024 * 1024

/// One picked file held in the VM until submit time.
public struct ClaimPickedFile: Sendable, Equatable {
    public let filename: String
    public let mimeType: String
    public let data: Data

    public init(filename: String, mimeType: String, data: Data) {
        self.filename = filename
        self.mimeType = mimeType
        self.data = data
    }

    public var sizeBytes: Int {
        data.count
    }
}

/// Per-slot upload state surfaced to the UI.
public enum ClaimSlotUiState: Sendable, Equatable {
    case empty
    case picked(file: ClaimPickedFile)
    case uploading(file: ClaimPickedFile, fraction: Double)
    case uploaded(file: ClaimPickedFile, fileURL: String)
    case failed(file: ClaimPickedFile, message: String)

    public var hasFile: Bool {
        switch self {
        case .empty: false
        default: true
        }
    }

    public var pickedFile: ClaimPickedFile? {
        switch self {
        case let .picked(file), let .uploading(file, _),
             let .uploaded(file, _), let .failed(file, _):
            file
        case .empty:
            nil
        }
    }
}
