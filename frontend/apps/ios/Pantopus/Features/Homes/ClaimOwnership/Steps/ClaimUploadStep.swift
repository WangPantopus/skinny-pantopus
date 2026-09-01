//
//  ClaimUploadStep.swift
//  Pantopus
//
//  A12.4 — Claim ownership · Evidence (wizard step 2). Home chip + headline,
//  two evidence `UploadSlot`s with per-file address-match confirmations, an
//  optional `ClaimStatement`, and the encryption footer. PDF support is
//  TODO(picker); the system Photos picker is wired and the accept hint
//  advertises JPG/PNG only.
//

import PhotosUI
import SwiftUI

/// Copy shared with the Android screen — keep both platforms word-for-word.
enum ClaimUploadCopy {
    static let statementPlaceholder =
        "Add a short statement to help the reviewer (e.g. how long you've owned, anyone else on title)…"
    static let encryptionFooter =
        "Encrypted in transit. Visible only to the reviewer assigned to your claim."
}

/// One slot's display descriptor, assembled from the view model (or from
/// sample fixtures in snapshot tests).
struct ClaimUploadSlotModel: Identifiable, Equatable {
    let id: String
    let label: String
    let required: Bool
    let hint: String
    let state: UploadSlotState
}

// MARK: - Pure content (snapshot-testable)

/// The Evidence step body as a pure function of its state. `ClaimUploadStep`
/// builds this from the view model; snapshot tests render it from fixtures.
struct ClaimUploadStepContent: View {
    let homeLabel: String
    let slots: [ClaimUploadSlotModel]
    @Binding var statement: String
    var verificationType: ClaimVerificationType = .owner
    /// Document kinds the user must choose between. Empty for the owner
    /// variant, whose slots carry fixed `evidence_type`s.
    var documentOptions: [ClaimDocumentOption] = []
    var selectedDocumentType: String?
    var submitError: String?
    var onPick: (String) -> Void = { _ in }
    var onRemove: (String) -> Void = { _ in }
    var onSelectDocumentType: (String) -> Void = { _ in }

    private var attachedCount: Int {
        slots.filter(\.state.isAttached).count
    }

    private var isResidency: Bool {
        verificationType == .residency
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            ClaimHomeChip(label: homeLabel)

            HeadlineBlock(headline, subtitle: subtitle)

            InfoBanner(text: infoText)

            if !documentOptions.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    Text("1. Select document type")
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    ClaimDocumentTypePicker(
                        options: documentOptions,
                        selected: selectedDocumentType,
                        onSelect: onSelectDocumentType
                    )
                }
            }

            if documentOptions.isEmpty || selectedDocumentType != nil {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    Text(uploadSectionLabel)
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    ForEach(slots) { slot in
                        UploadSlot(
                            id: slot.id,
                            label: slot.label,
                            required: slot.required,
                            hint: slot.hint,
                            state: slot.state,
                            onPick: { onPick(slot.id) },
                            onRemove: { onRemove(slot.id) }
                        )
                    }
                }
            }

            ClaimStatement(text: $statement, placeholder: ClaimUploadCopy.statementPlaceholder)

            if let submitError {
                ClaimUploadErrorBanner(message: submitError)
            }

            EncryptionFooter()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var headline: String {
        isResidency ? "Verify you live here" : "Upload your evidence"
    }

    private var subtitle: String {
        if isResidency {
            return "Upload a document that proves you live at \(homeLabel). " +
                "Your access will be limited until verified."
        }
        return "Two documents help us verify you own \(homeLabel). " +
            "We auto-check the address against your account."
    }

    /// Copy lifted from RN's info banner (`evidence.tsx:283-289`).
    private var infoText: String {
        if isResidency {
            return "For residency verification, please upload a lease agreement, utility bill " +
                "(electric, gas, water, internet), or similar document showing your name at this address."
        }
        return "For ownership verification, please upload a deed, closing disclosure, or property " +
            "tax statement. Utility bills and leases can only be used for residency verification."
    }

    private var uploadSectionLabel: String {
        let heading = documentOptions.isEmpty ? "Documents" : "2. Upload your document"
        // Multi-slot variants (owner: ID + ownership proof) keep the
        // attached-count readout; the single-slot residency variant
        // matches RN's plain "2. Upload your document".
        guard slots.count > 1 else { return heading }
        return "\(heading) · \(attachedCount) of \(slots.count) attached"
    }
}

// MARK: - Info banner

private struct InfoBanner: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 18, color: Theme.Color.primary600)
            Text(text)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.primary700)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("claimOwnership_infoBanner")
    }
}

// MARK: - View-model-bound step

struct ClaimUploadStep: View {
    @Bindable var viewModel: ClaimOwnershipWizardViewModel
    @State private var photosPickerSlot: ClaimEvidenceSlot?
    @State private var photosPickerSelection: PhotosPickerItem?

    var body: some View {
        ClaimUploadStepContent(
            homeLabel: viewModel.startContent.homeLabel,
            slots: viewModel.activeSlots.map(slotModel(for:)),
            statement: $viewModel.note,
            verificationType: viewModel.verificationType,
            documentOptions: viewModel.documentOptions,
            selectedDocumentType: viewModel.selectedDocumentType,
            submitError: viewModel.submitError,
            onPick: { id in
                if let slot = ClaimEvidenceSlot(rawValue: id) { photosPickerSlot = slot }
            },
            onRemove: { id in
                if let slot = ClaimEvidenceSlot(rawValue: id) { viewModel.remove(slot) }
            },
            onSelectDocumentType: { viewModel.selectDocumentType($0) }
        )
        // Driving the sheet directly off `photosPickerSlot` (rather than an
        // intermediate onAppear hop) keeps the picker reachable after a
        // remove + re-tap of the same slot.
        .photosPicker(
            isPresented: Binding(
                get: { photosPickerSlot != nil },
                set: { if !$0 { photosPickerSlot = nil } }
            ),
            selection: $photosPickerSelection,
            matching: .images
        )
        .onChange(of: photosPickerSelection) { _, newItem in
            handlePicked(newItem)
        }
    }

    private func slotModel(for slot: ClaimEvidenceSlot) -> ClaimUploadSlotModel {
        // A chooser slot takes the label of the document kind the user
        // picked, so the tile reads "Utility Bill" rather than a generic
        // "Proof of residency".
        let pickedLabel = slot.documentOptions
            .first { $0.id == viewModel.selectedDocumentType }?
            .label
        return ClaimUploadSlotModel(
            id: slot.rawValue,
            label: pickedLabel ?? slot.title,
            required: true,
            hint: slot.acceptHint,
            state: viewState(for: slot)
        )
    }

    private func viewState(for slot: ClaimEvidenceSlot) -> UploadSlotState {
        switch viewModel.slots[slot] ?? .empty {
        case .empty:
            return .empty
        case let .uploading(file, fraction):
            return .uploading(file: displayFile(file), progress: fraction)
        case .picked, .uploaded, .failed:
            guard let file = viewModel.slots[slot]?.pickedFile else { return .empty }
            let verdict = viewModel.addressMatches[slot]
                ?? ClaimOwnershipSampleData.addressMatch(
                    forFilename: file.filename,
                    homeLabel: viewModel.startContent.homeLabel
                )
            switch verdict {
            case let .matches(detail):
                return .done(file: displayFile(file), detail: detail)
            case let .differs(detail):
                return .warn(file: displayFile(file), detail: detail)
            }
        }
    }

    private func displayFile(_ file: ClaimPickedFile) -> UploadSlotFile {
        let isPDF = file.mimeType == "application/pdf"
            || file.filename.lowercased().hasSuffix(".pdf")
        return UploadSlotFile(
            name: file.filename,
            sizeLabel: formatClaimFileSize(file.sizeBytes),
            pageCount: nil,
            kind: isPDF ? .pdf : .image
        )
    }

    private func handlePicked(_ newItem: PhotosPickerItem?) {
        guard let newItem, let slot = photosPickerSlot else { return }
        Task {
            if let data = try? await newItem.loadTransferable(type: Data.self) {
                if data.count > CLAIM_FILE_MAX_BYTES {
                    // Client-side guard so the user sees an inline error
                    // instead of a 413 round-trip.
                    viewModel.fileTooLarge(for: slot)
                } else {
                    let filename = "\(slot.rawValue)-\(UUID().uuidString.prefix(6)).jpg"
                    viewModel.picked(slot, file: ClaimPickedFile(
                        filename: filename,
                        mimeType: "image/jpeg",
                        data: data
                    ))
                }
            }
            photosPickerSelection = nil
            photosPickerSlot = nil
        }
    }
}

// MARK: - Footer + error banner

private struct EncryptionFooter: View {
    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.lock, size: 12, color: Theme.Color.appTextSecondary)
            Text(ClaimUploadCopy.encryptionFooter)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("claimOwnership_encryptionFooter")
    }
}

private struct ClaimUploadErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 18, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("claimOwnership_errorBanner")
    }
}

/// Human-readable file size, e.g. "1.4 MB" / "820 KB".
func formatClaimFileSize(_ bytes: Int) -> String {
    let mb = Double(bytes) / 1_048_576.0
    if mb >= 1 { return String(format: "%.1f MB", mb) }
    let kb = Double(bytes) / 1024.0
    return String(format: "%.0f KB", kb)
}
