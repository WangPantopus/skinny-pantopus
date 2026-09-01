//
//  UploadDocumentFormViewModel.swift
//  Pantopus
//
//  P2.10 — Backs `UploadDocumentFormView`. Posts to
//  `POST /api/homes/:id/documents` (route `backend/routes/home.js:5193`).
//
//  Single-page form (not a Wizard) — the picked-file preview + title +
//  category + tags + linked-to + visibility fields fit one scroll and
//  the design's empty-state CTA reads "Upload document", not "Start
//  wizard".
//
//  Linked-to entities are fetched lazily when the picker sheet opens:
//  bills, maintenance tasks, and pets from the same home. The selected
//  entity rides on the request body as `details["linked_entity_kind"]`
//  + `details["linked_entity_id"]` so the backend can keep the schema
//  open until a structured `linked_to` column lands.
//

import Foundation
import Observation
import SwiftUI
import UniformTypeIdentifiers

/// A document category the user can choose at upload time. The nine
/// choices come from the P2.10 design spec; each maps onto a closest-
/// match backend `doc_type` via [`docType`], and onto a design swatch
/// via [`palette`].
public enum UploadDocumentCategory: CaseIterable, Sendable, Identifiable, Hashable {
    case insurance
    case mortgage
    case warranty
    case receipt
    case contract
    case identity
    case medical
    case tax
    case other

    /// Stable identifier used by the chip-selector and accessibility ids.
    public var id: String {
        switch self {
        case .insurance: "insurance"
        case .mortgage: "mortgage"
        case .warranty: "warranty"
        case .receipt: "receipt"
        case .contract: "contract"
        case .identity: "id"
        case .medical: "medical"
        case .tax: "tax"
        case .other: "other"
        }
    }

    /// Short label rendered on the chip selector.
    public var label: String {
        switch self {
        case .insurance: "Insurance"
        case .mortgage: "Mortgage"
        case .warranty: "Warranty"
        case .receipt: "Receipt"
        case .contract: "Contract"
        case .identity: "ID"
        case .medical: "Medical"
        case .tax: "Tax"
        case .other: "Other"
        }
    }

    /// Wire-format `doc_type` string sent on the POST body. Several
    /// user-facing categories collapse onto the canonical backend
    /// enum (`lease` covers mortgages; `manual` covers medical; tax
    /// rolls into `receipt`; `id` has no backend equivalent so it
    /// rides as `other` until the schema adds an identity bucket).
    public var docType: String {
        switch self {
        case .insurance: "insurance"
        case .mortgage: "lease"
        case .warranty: "warranty"
        case .receipt: "receipt"
        case .contract: "permit"
        case .identity: "other"
        case .medical: "manual"
        case .tax: "receipt"
        case .other: "other"
        }
    }

    /// Maps onto the design's seven category swatches.
    public var palette: DocumentCategory {
        switch self {
        case .mortgage: .lease
        case .insurance: .insurance
        case .warranty, .medical: .warranty
        case .receipt, .tax: .tax
        case .contract: .permit
        case .identity: .identity
        case .other: .other
        }
    }
}

/// Visibility scope for a newly-uploaded document.
public enum UploadDocumentVisibility: String, CaseIterable, Sendable {
    case owners = "managers"
    case allMembers = "members"

    public var label: String {
        switch self {
        case .owners: "Owners only"
        case .allMembers: "All members"
        }
    }
}

/// Kind of entity that can be linked from a document.
public enum UploadDocumentLinkKind: String, CaseIterable, Sendable {
    case bill
    case maintenance
    case pet

    public var label: String {
        switch self {
        case .bill: "Bill"
        case .maintenance: "Maintenance"
        case .pet: "Pet"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .bill: .receiptText
        case .maintenance: .hammer
        case .pet: .pawPrint
        }
    }
}

/// One row in the linked-to picker sheet.
public struct UploadDocumentLinkOption: Identifiable, Hashable, Sendable {
    public let id: String
    public let kind: UploadDocumentLinkKind
    public let title: String
    public let subtitle: String?

    public init(id: String, kind: UploadDocumentLinkKind, title: String, subtitle: String? = nil) {
        self.id = id
        self.kind = kind
        self.title = title
        self.subtitle = subtitle
    }
}

/// Lifecycle state for the linked-to picker.
public enum UploadDocumentLinkOptionsState: Sendable, Equatable {
    case idle
    case loading
    case loaded([UploadDocumentLinkOption])
    case error(String)
}

/// Display-only handle on a picked file. The view-model never reads
/// bytes — the actual upload is a follow-up patch once Supabase
/// storage signing lands; today we POST the metadata.
public struct PickedFile: Equatable, Sendable {
    public let filename: String
    public let sizeBytes: Int64?
    public let mimeType: String?

    public init(filename: String, sizeBytes: Int64? = nil, mimeType: String? = nil) {
        self.filename = filename
        self.sizeBytes = sizeBytes
        self.mimeType = mimeType
    }

    public var fileType: DocumentFileType {
        DocumentFileType.from(mimeType: mimeType, filename: filename)
    }
}

@Observable
@MainActor
final class UploadDocumentFormViewModel {
    // MARK: - Inputs the view binds to

    var pickedFile: PickedFile? {
        didSet { onPickedFileChanged(oldValue) }
    }

    var titleField = FormFieldState(id: "title", originalValue: "")
    var category: UploadDocumentCategory = .other
    var tags: [String] = []
    var tagDraft: String = ""
    var linkedEntity: UploadDocumentLinkOption?
    var visibility: UploadDocumentVisibility = .allMembers

    // MARK: - Surface state

    private(set) var isSaving: Bool = false
    var toast: ToastMessage?
    private(set) var shouldDismiss: Bool = false
    /// Used to drive the FormShell shake on submit failure.
    private(set) var shakeTrigger: Int = 0
    /// State of the linked-to picker sheet. Loaded the first time the
    /// user taps "Add link".
    private(set) var linkOptionsState: UploadDocumentLinkOptionsState = .idle

    // MARK: - Dependencies

    let homeId: String
    private let api: APIClient
    private let onUploaded: @Sendable (HomeDocumentDTO) -> Void

    init(
        homeId: String,
        api: APIClient = .shared,
        onUploaded: @escaping @Sendable (HomeDocumentDTO) -> Void = { _ in }
    ) {
        self.homeId = homeId
        self.api = api
        self.onUploaded = onUploaded
    }

    // MARK: - Derived flags

    var isValid: Bool {
        pickedFile != nil && !trimmedTitle.isEmpty && titleField.error == nil
    }

    var isDirty: Bool {
        pickedFile != nil
            || !trimmedTitle.isEmpty
            || !tags.isEmpty
            || linkedEntity != nil
    }

    private var trimmedTitle: String {
        titleField.value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Field mutations

    func updateTitle(_ value: String) {
        titleField.value = value
        titleField.touched = true
        titleField.error = validator.validate(value)
    }

    func selectCategory(_ choice: UploadDocumentCategory) {
        category = choice
    }

    func selectVisibility(_ choice: UploadDocumentVisibility) {
        visibility = choice
    }

    /// Add the current `tagDraft` as a new chip. Trims, dedupes, caps at
    /// 24 chars per chip and 12 chips total.
    func commitTagDraft() {
        let trimmed = tagDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        tagDraft = ""
        guard !trimmed.isEmpty, trimmed.count <= 24, tags.count < 12 else { return }
        let normalized = trimmed.lowercased()
        if tags.map({ $0.lowercased() }).contains(normalized) { return }
        tags.append(trimmed)
    }

    func removeTag(_ tag: String) {
        tags.removeAll { $0 == tag }
    }

    func clearLinkedEntity() {
        linkedEntity = nil
    }

    func selectLink(_ option: UploadDocumentLinkOption) {
        linkedEntity = option
    }

    // MARK: - File picking

    /// Called by the SwiftUI `.fileImporter` once the user picks a file.
    /// Defaults the title to the filename (sans extension) when the
    /// title field is still untouched.
    func acceptPicked(url: URL) {
        let attributes = try? FileManager.default.attributesOfItem(atPath: url.path)
        let size = (attributes?[.size] as? NSNumber)?.int64Value
        let utType = UTType(filenameExtension: url.pathExtension) ?? .data
        let mime = utType.preferredMIMEType
        pickedFile = PickedFile(
            filename: url.lastPathComponent,
            sizeBytes: size,
            mimeType: mime
        )
    }

    func clearPickedFile() {
        pickedFile = nil
    }

    private func onPickedFileChanged(_ previous: PickedFile?) {
        guard let pickedFile else { return }
        if titleField.value.isEmpty || !titleField.touched {
            let defaultTitle = pickedFile.filename.split(separator: ".").dropLast().joined(separator: ".")
            let seed = defaultTitle.isEmpty ? pickedFile.filename : defaultTitle
            titleField = FormFieldState(id: "title", originalValue: seed)
            titleField.value = seed
        }
        let suggested = UploadDocumentCategory.suggested(for: pickedFile)
        if let suggested, previous == nil {
            category = suggested
        }
    }

    // MARK: - Linked-to picker

    /// Lazily fetch the link options the first time the user opens the
    /// linked-to picker. Bills + maintenance + pets are loaded in
    /// parallel and joined for display.
    func loadLinkOptionsIfNeeded() async {
        switch linkOptionsState {
        case .loaded, .loading:
            return
        case .idle, .error:
            break
        }
        linkOptionsState = .loading
        async let bills: [UploadDocumentLinkOption] = fetchBillOptions()
        async let maintenance: [UploadDocumentLinkOption] = fetchMaintenanceOptions()
        async let pets: [UploadDocumentLinkOption] = fetchPetOptions()
        let combined = await (bills + maintenance + pets)
        linkOptionsState = .loaded(combined)
    }

    private func fetchBillOptions() async -> [UploadDocumentLinkOption] {
        let response: GetHomeBillsResponse? = try? await api.request(
            HomesEndpoints.bills(homeId: homeId)
        )
        return (response?.bills ?? []).map { bill in
            UploadDocumentLinkOption(
                id: bill.id,
                kind: .bill,
                title: bill.providerName ?? bill.billType.capitalized,
                subtitle: bill.dueDate.map { "Due \($0)" }
            )
        }
    }

    private func fetchMaintenanceOptions() async -> [UploadDocumentLinkOption] {
        let response: GetHomeMaintenanceResponse? = try? await api.request(
            HomesEndpoints.maintenance(homeId: homeId)
        )
        return (response?.tasks ?? []).map { task in
            UploadDocumentLinkOption(
                id: task.id,
                kind: .maintenance,
                title: task.task,
                subtitle: task.dueDate.map { "Due \($0)" } ?? task.vendor
            )
        }
    }

    private func fetchPetOptions() async -> [UploadDocumentLinkOption] {
        let response: PetsResponse? = try? await api.request(
            HomesEndpoints.listPets(homeId: homeId)
        )
        return (response?.pets ?? []).map { pet in
            UploadDocumentLinkOption(
                id: pet.id,
                kind: .pet,
                title: pet.name,
                subtitle: pet.species.capitalized
            )
        }
    }

    // MARK: - Submit

    @discardableResult
    func submit() async -> Bool {
        titleField.error = validator.validate(titleField.value)
        titleField.touched = true
        guard isValid, let pickedFile, !isSaving else {
            shakeTrigger &+= 1
            toast = ToastMessage(text: "Pick a file and add a title.", kind: .error)
            return false
        }
        if !NetworkMonitor.shared.isOnline {
            toast = ToastMessage(
                text: "You're offline. Try again when you're back online.",
                kind: .error
            )
            return false
        }
        isSaving = true
        defer { isSaving = false }

        var details: [String: String] = [:]
        if !tags.isEmpty {
            details["tags"] = tags.joined(separator: ",")
        }
        if let linkedEntity {
            details["linked_entity_kind"] = linkedEntity.kind.rawValue
            details["linked_entity_id"] = linkedEntity.id
            details["linked_entity_title"] = linkedEntity.title
        }

        let request = CreateDocumentRequest(
            docType: category.docType,
            title: trimmedTitle,
            mimeType: pickedFile.mimeType,
            sizeBytes: pickedFile.sizeBytes,
            visibility: visibility.rawValue,
            details: details.isEmpty ? nil : details
        )

        do {
            let response: CreateDocumentResponse = try await api.request(
                HomesEndpoints.createDocument(homeId: homeId, request: request)
            )
            toast = ToastMessage(text: "Document uploaded.", kind: .success)
            shouldDismiss = true
            onUploaded(response.document)
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription
                    ?? "Couldn't upload this document.",
                kind: .error
            )
            return false
        }
    }

    func acknowledgeDismiss() {
        shouldDismiss = false
    }

    private var validator: FormValidator {
        .all([.required("Title"), .maxLength(255)])
    }
}

// MARK: - Category suggestion

private extension UploadDocumentCategory {
    /// Suggest a category from the filename heuristics. Same shape as
    /// `DocumentCategory.from(docType:)` but works backwards from a
    /// picked-file filename: e.g. `LeaseRenewal.pdf` → `.mortgage`.
    static func suggested(for file: PickedFile) -> UploadDocumentCategory? {
        let lower = file.filename.lowercased()
        if lower.contains("lease") || lower.contains("mortgage") { return .mortgage }
        if lower.contains("insurance") || lower.contains("policy") { return .insurance }
        if lower.contains("warranty") || lower.contains("manual") { return .warranty }
        if lower.contains("tax") || lower.contains("1098") || lower.contains("1099") { return .tax }
        if lower.contains("receipt") { return .receipt }
        if lower.contains("contract") { return .contract }
        if lower.contains("passport") || lower.contains("license") || lower.contains("id ") { return .identity }
        if lower.contains("medical") || lower.contains("vet") || lower.contains("vaccine") { return .medical }
        return nil
    }
}
