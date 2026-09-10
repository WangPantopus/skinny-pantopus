//
//  ClaimOwnershipWizardViewModel.swift
//  Pantopus
//
//  Private manual evidence is uploaded once under its immutable retry identity.
//  Saving a document never approves a claim.
//
// swiftlint:disable cyclomatic_complexity file_length type_body_length

import Foundation
import Observation

/// Outbound events the wizard view must react to.
public enum ClaimOwnershipOutboundEvent: Sendable, Equatable {
    case dismiss
    case openClaimsList
    /// Someone else's verification already blocks this home — send the
    /// user to the "Find or Add Home" discovery surface so they can
    /// request to join instead. Mirrors RN
    /// `claim-owner/evidence.tsx:210` (`router.replace('/homes/find')`).
    case openFindHome
}

/// The manual document path and the separate request to a verified owner.
public enum ClaimStartMethod: String, Sendable, CaseIterable {
    case verifyOwnership
    case askVerifiedOwner
}

/// ViewModel backing `ClaimOwnershipWizardView`.
@Observable
@MainActor
final class ClaimOwnershipWizardViewModel: WizardModel {
    // MARK: - Published state

    private(set) var currentStep: ClaimOwnershipStep = .start
    /// Which verification this run is performing. Drives the slot set,
    /// the wizard copy, and the `claim_type` sent on submit.
    let verificationType: ClaimVerificationType
    /// Selected `evidence_type` for slots that accept several document
    /// kinds (residency). `nil` until the user picks one.
    var selectedDocumentType: String?
    private var storedSlots: [ClaimEvidenceSlot: ClaimSlotUiState] = [:]
    var slots: [ClaimEvidenceSlot: ClaimSlotUiState] {
        evidenceClient.isCurrent ? storedSlots : [:]
    }

    var hasCurrentSession: Bool {
        evidenceClient.isCurrent
    }

    /// No address-verification verdict is inferred from a selected filename.
    var addressMatches: [ClaimEvidenceSlot: ClaimAddressMatch] = [:]
    var note: String = ""
    private(set) var startContent: ClaimOwnershipStartContent
    private(set) var isSubmitting: Bool = false
    private(set) var submitError: String?
    var pendingEvent: ClaimOwnershipOutboundEvent?

    // MARK: - Start-step method picker (A12.3)

    /// `has_verified_owner && !is_member` from
    /// `GET /api/homes/:id/public-profile` — the exact condition RN uses
    /// at `src/app/homes/[id]/claim-owner/index.tsx:52`.
    private(set) var hasVerifiedOwner: Bool = false
    private(set) var isMember: Bool = false
    /// Only render the "ask a verified owner" option when the home has a
    /// verified owner AND the viewer is not already a member.
    var showsAskVerifiedOwner: Bool {
        hasVerifiedOwner && !isMember
    }

    var selectedStartMethod: ClaimStartMethod = .verifyOwnership
    /// True while `POST /:id/request-household-from-owner` is in flight.
    private(set) var isSendingAskRequest: Bool = false
    /// Success copy shown in a confirm alert; dismissing it closes the wizard.
    private(set) var askRequestConfirmation: String?
    /// Failure copy shown in an alert; dismissing it keeps the wizard open.
    private(set) var askRequestError: String?

    /// Non-nil when the claim POST came back 409 (or with a nil claim
    /// id) because another person's verification already owns this
    /// home. The view shows an alert whose "Search homes" action opens
    /// the Find-or-Add-Home discovery route.
    private(set) var blockedByOtherClaimPrompt: String?

    /// Non-nil when the backend's `routing_classification` needs the
    /// claimant to acknowledge something before their evidence goes up.
    /// The view renders it as a single-action "Continue" alert, matching
    /// RN's blocking `Alert.alert(…, [{ text: 'Continue' }])`
    /// (`claim-owner/evidence.tsx:223-241`).
    private(set) var routingWarning: ClaimRoutingWarning?

    /// Describes the pending manual submission without implying verification.
    private(set) var submissionOutcomeNote: String?

    /// The server routing classification is retained through a retry.
    private var routingClassification: String?
    /// True once the user tapped "Continue" on the routing warning, so a
    /// resumed submit doesn't re-prompt.
    private var acknowledgedRoutingWarning = false

    /// RN sends different copy per variant
    /// (`claim-owner/evidence.tsx:206-212`).
    private var blockedByOtherClaimCopy: String {
        if verificationType == .residency {
            return "Someone else's verification is already in progress for this home, so you can't "
                + "upload documents on this path. Search for the home and request to join, or ask "
                + "your household for an invite."
        }
        return "Someone else's verification is already in progress for this home, so you can't upload "
            + "documents here. Search for this home and request to join the household, or use "
            + "Support if you believe this is wrong."
    }

    /// Server-side claim id once `POST /ownership-claims` succeeds. Held
    /// across retry attempts so a partial-success → retry doesn't create
    /// a duplicate claim row server-side.
    private var pendingClaimId: String?
    /// Stable private upload reservations are retained with the selected bytes
    /// so a lost response can recover the same immutable upload.
    private var pendingUploadIDs: [ClaimEvidenceSlot: String] = [:]
    private var attemptedUploadSlots: Set<ClaimEvidenceSlot> = []
    private let evidenceClient: PrivateClaimEvidenceClient
    private let makeUploadId: () -> String
    private(set) var sessionReady = false
    private var canAct: Bool {
        sessionReady && evidenceClient.isCurrent && !isSubmitting
    }

    var canPick: Bool {
        canAct && attemptedUploadSlots.isEmpty
    }

    var needsUploadRecovery: Bool {
        canAct && !attemptedUploadSlots.isEmpty && currentStep != .success
    }

    func manageSavedDocuments() {
        guard needsUploadRecovery else { return }
        pendingEvent = .openClaimsList
    }

    func retire() {
        evidenceClient.retire()
        sessionReady = false
        storedSlots = [:]
        pendingUploadIDs = [:]
        attemptedUploadSlots = []
        pendingClaimId = nil
        note = ""
    }

    // MARK: - Init

    private let homeId: String
    private let api: APIClient
    private let isOnlineProvider: @MainActor () -> Bool

    init(
        homeId: String,
        api: APIClient = .shared,
        uploader: MultipartUploader = .shared,
        startContent: ClaimOwnershipStartContent? = nil,
        verificationType: ClaimVerificationType = .owner,
        // Defaults to the live monitor in production. Tests inject a fixed
        // value so CI simulator reachability does not gate stubbed requests.
        evidenceClient: PrivateClaimEvidenceClient? = nil,
        makeUploadId: @escaping () -> String = { UUID().uuidString.lowercased() },
        isOnlineProvider: @escaping @MainActor () -> Bool = { NetworkMonitor.shared.isOnline }
    ) {
        self.homeId = homeId
        self.api = api
        self.evidenceClient = evidenceClient ?? PrivateClaimEvidenceClient(api: api, uploader: uploader)
        self.makeUploadId = makeUploadId
        self.verificationType = verificationType
        self.isOnlineProvider = isOnlineProvider
        self.startContent = startContent ?? ClaimOwnershipStartContent(homeLabel: "This home", contestedClaim: nil)
        for slot in ClaimEvidenceSlot.allCases {
            storedSlots[slot] = .empty
        }
        currentStep = verificationType.steps.first ?? .start
        // Residency requires an explicit document choice; ownership defaults to a deed.
        selectedDocumentType = verificationType == .owner ? "deed" : nil
    }

    /// Slots this run requires — `verificationType.slots`.
    var activeSlots: [ClaimEvidenceSlot] {
        verificationType.slots
    }

    /// Document kinds the user must choose between before uploading.
    /// Empty when every active slot has a fixed `evidence_type`.
    var documentOptions: [ClaimDocumentOption] {
        activeSlots.flatMap(\.documentOptions)
    }

    /// True when the active slot set needs an explicit document-kind pick
    /// and the user hasn't made one yet.
    var needsDocumentTypeSelection: Bool {
        !documentOptions.isEmpty && selectedDocumentType == nil
    }

    func selectDocumentType(_ id: String) {
        guard canPick, documentOptions.contains(where: { $0.id == id }) else { return }
        if selectedDocumentType != id { pendingUploadIDs = [:] }
        selectedDocumentType = id
        submitError = nil
    }

    /// Resolves the `evidence_type` sent for a slot: fixed for owner
    /// slots, user-picked for the residency slot.
    func evidenceType(for slot: ClaimEvidenceSlot) -> String {
        slot.fixedBackendType ?? selectedDocumentType ?? slot.backendType
    }

    // MARK: - WizardModel

    /// 1-indexed position of `currentStep` inside the variant's step list.
    private var stepIndex: Int {
        (verificationType.steps.firstIndex(of: currentStep) ?? 0) + 1
    }

    private var stepTotal: Int {
        verificationType.steps.count
    }

    var chrome: WizardChrome {
        switch currentStep {
        case .start:
            WizardChrome(
                title: verificationType.wizardTitle,
                progressLabel: .stepOf(current: stepIndex, total: stepTotal),
                progressFraction: Double(stepIndex) / Double(stepTotal),
                leading: .close,
                primaryCTALabel: selectedStartMethod == .askVerifiedOwner
                    ? "Send request"
                    : "Start claim",
                primaryCTAEnabled: canPick && !isSendingAskRequest,
                secondaryCTA: nil,
                isSubmitting: isSendingAskRequest,
                // Once the user has filled any slot or typed a note on the
                // upload step, going back to Start must still surface the
                // discard-confirm so an X tap doesn't dump the in-memory
                // bytes silently.
                dirty: anySlotHasFile || !note.isEmpty,
                showsProgressBar: true
            )
        case .upload:
            WizardChrome(
                title: verificationType.wizardTitle,
                progressLabel: .stepOf(current: stepIndex, total: stepTotal),
                progressFraction: Double(stepIndex) / Double(stepTotal),
                // Residency starts on Upload, so there is nothing to go
                // back to — the leading control closes the wizard.
                leading: verificationType.steps.first == .upload ? .close : .back,
                primaryCTALabel: verificationType == .residency ? "Submit" : "Submit claim",
                primaryCTAEnabled: canSubmit && !isSubmitting,
                secondaryCTA: nil,
                isSubmitting: isSubmitting,
                footerHint: isSubmitting ? "Waiting for upload to finish" : nil,
                dirty: anySlotHasFile || !note.isEmpty,
                showsProgressBar: true
            )
        case .success:
            WizardChrome(
                title: verificationType.wizardTitle,
                progressLabel: .hidden,
                progressFraction: nil,
                leading: .close,
                primaryCTALabel: "View status",
                primaryCTAEnabled: true,
                secondaryCTA: WizardSecondaryCTA(label: "Back to home", identifier: "claimOwnership_backToHome"),
                isSubmitting: false,
                dirty: false,
                showsProgressBar: false
            )
        }
    }

    func leadingTapped() {
        switch currentStep {
        case .start:
            pendingEvent = .dismiss
        case .upload:
            // Residency has no preceding step — close instead of popping
            // into a step this variant never renders.
            if verificationType.steps.first == .upload {
                pendingEvent = .dismiss
            } else {
                currentStep = .start
            }
        case .success:
            pendingEvent = .dismiss
        }
    }

    func discardConfirmed() {
        pendingEvent = .dismiss
    }

    func primaryTapped() {
        switch currentStep {
        case .start:
            if selectedStartMethod == .askVerifiedOwner {
                Task { await sendHouseholdRequest() }
            } else {
                currentStep = .upload
            }
        case .upload:
            Task { await submit() }
        case .success:
            pendingEvent = .openClaimsList
        }
    }

    // MARK: - Start step

    func selectStartMethod(_ method: ClaimStartMethod) {
        guard method != .askVerifiedOwner || showsAskVerifiedOwner else { return }
        selectedStartMethod = method
    }

    /// Resolve `has_verified_owner` / `is_member` so the start step can
    /// decide whether to render the "ask a verified owner" option, and
    /// replace the sample home label with the real address.
    func load() async {
        do {
            _ = try await evidenceClient.claims()
            try evidenceClient.requireCurrent()
            sessionReady = true
            let response: HomePublicPreviewResponse = try await api.request(
                HomeDiscoveryEndpoints.publicProfile(homeId: homeId)
            )
            try evidenceClient.requireCurrent()
            guard response.home.id == homeId else { throw APIError.invalidResponse }
            hasVerifiedOwner = response.hasVerifiedOwner
            isMember = response.isMember
            let label = response.home.displayAddress
            if !label.isEmpty {
                startContent = ClaimOwnershipStartContent(
                    homeLabel: label,
                    contestedClaim: startContent.contestedClaim
                )
            }
            if !showsAskVerifiedOwner, selectedStartMethod == .askVerifiedOwner {
                selectedStartMethod = .verifyOwnership
            }
        } catch {
            // The picker degrades to the ownership-verification path
            // when the preview can't be read — never invent the flag.
            sessionReady = false
            submitError = HomeClaimReviewError.message(for: error)
            if !evidenceClient.isCurrent { retire() }
        }
    }

    /// `POST /api/homes/:id/request-household-from-owner` — notifies the
    /// home's verified owner(s) that a non-member wants to be added.
    func sendHouseholdRequest() async {
        guard canPick, !isSendingAskRequest else { return }
        if !isOnlineProvider() {
            askRequestError = "You're offline. Try again when you're back online."
            return
        }
        isSendingAskRequest = true
        defer { isSendingAskRequest = false }
        do {
            try evidenceClient.requireCurrent()
            _ = try await api.request(
                HomeDiscoveryEndpoints.requestHouseholdFromOwner(
                    homeId: homeId,
                    request: RequestHouseholdFromOwnerRequest(requestedIdentity: "owner")
                )
            ) as RequestHouseholdFromOwnerResponse
            try evidenceClient.requireCurrent()
            askRequestConfirmation = "Your household request was saved. Check its status before sending another."
        } catch {
            askRequestError = (error as? APIError)?.errorDescription ?? "Try again later."
        }
    }

    /// Dismiss the "Request sent" alert → close the wizard (RN pops back
    /// to the homes list on OK).
    func acknowledgeAskConfirmation() {
        askRequestConfirmation = nil
        pendingEvent = .dismiss
    }

    func acknowledgeAskError() {
        askRequestError = nil
    }

    /// "OK" on the blocked-claim alert — stay put.
    func dismissBlockedByOtherClaim() {
        blockedByOtherClaimPrompt = nil
    }

    /// "Search homes" on the blocked-claim alert.
    func openFindHomeFromBlockedClaim() {
        blockedByOtherClaimPrompt = nil
        pendingEvent = .openFindHome
    }

    func secondaryTapped() {
        // Only fires on success — "Back to home".
        pendingEvent = .dismiss
    }

    // MARK: - Slot management

    func picked(_ slot: ClaimEvidenceSlot, file: ClaimPickedFile) {
        guard canPick, activeSlots.contains(slot) else { return }
        guard !file.data.isEmpty, file.sizeBytes <= CLAIM_FILE_MAX_BYTES,
              PrivateClaimEvidenceClient.allowedMIMEs.contains(file.mimeType) else {
            submitError = "Choose a PDF, text file or supported image of 25 MB or less."
            return
        }
        storedSlots[slot] = .picked(file: file)
        addressMatches[slot] = nil
        pendingUploadIDs[slot] = makeUploadId()
        submitError = nil
    }

    func remove(_ slot: ClaimEvidenceSlot) {
        guard canPick else { return }
        storedSlots[slot] = .empty
        addressMatches[slot] = nil
        pendingUploadIDs[slot] = nil
    }

    /// Surface a "file too large" error inline rather than letting the
    /// upload round-trip to a 413. Called by the picker when the user
    /// selects a file over `CLAIM_FILE_MAX_BYTES`.
    func fileTooLarge(for _: ClaimEvidenceSlot) {
        submitError = "That file is over 25 MB. Choose a smaller document."
    }

    func filePickFailed(_ error: any Error) {
        guard canPick else { return }
        submitError = error.localizedDescription
    }

    /// Every slot the active variant requires carries a file.
    var bothSlotsHaveFiles: Bool {
        activeSlots.allSatisfy { storedSlots[$0]?.hasFile == true }
    }

    var anySlotHasFile: Bool {
        activeSlots.contains { storedSlots[$0]?.hasFile == true }
    }

    /// Submit gate — files in every required slot, plus an explicit
    /// document-kind pick when the variant offers a choice.
    var canSubmit: Bool {
        canAct && bothSlotsHaveFiles && !needsDocumentTypeSelection
    }

    // MARK: - Submit

    func submit() async {
        guard canSubmit, !isSubmitting else { return }
        guard isOnlineProvider() else { submitError = "You're offline. Try again when you're back online."
            return
        }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }
        do {
            let claims = try await evidenceClient.claims().claims
            if pendingClaimId == nil {
                // A closed page or lost create reply can rediscover the exact
                // user's existing open claim instead of duplicating it.
                let existing = claims
                    .filter { $0.homeId == homeId && $0.claimType == verificationType.claimType && $0.status == "under_review" }
                guard existing.count <= 1 else { throw HomeClaimReviewError.snapshotChanged }
                pendingClaimId = existing.first?.id
            }
            if pendingClaimId == nil {
                let result = try await evidenceClient.submit(homeId: homeId, type: verificationType.claimType)
                guard let id = result.claim.id, UUID(uuidString: id) != nil else { throw HomeClaimReviewError.snapshotChanged }
                pendingClaimId = id
                routingClassification = result.claim.routingClassification
            }
            guard let claimId = pendingClaimId else { throw APIError.invalidResponse }
            if routingClassification == SubmitClaimResponse.RoutingClassification.challengeClaim {
                submitError = "This address needs the dedicated dispute review flow. Document upload cannot open a challenge here."
                return
            }
            for slot in activeSlots {
                if case .uploaded = storedSlots[slot] { continue }
                guard let file = storedSlots[slot]?.pickedFile else { throw APIError.invalidResponse }
                let uploadId = pendingUploadIDs[slot] ?? makeUploadId()
                pendingUploadIDs[slot] = uploadId
                storedSlots[slot] = .uploading(file: file, fraction: 0)
                attemptedUploadSlots.insert(slot)
                do {
                    let record = try await evidenceClient.upload(
                        homeId: homeId,
                        claimId: claimId,
                        uploadId: uploadId,
                        type: evidenceType(for: slot),
                        file: file
                    )
                    try evidenceClient.requireCurrent()
                    storedSlots[slot] = .uploaded(file: file, fileURL: record.id)
                } catch {
                    if evidenceClient.isCurrent { storedSlots[slot] = .failed(file: file, message: "Upload unconfirmed. Retry this file.") }
                    throw error
                }
            }
            try evidenceClient.requireCurrent()
            submissionOutcomeNote = "Your private document is saved as pending evidence. "
                + "A reviewer must inspect it before making a separate claim decision."
            currentStep = .success
            Analytics.track(.ctaClaimOwnershipSubmit(result: .success))
        } catch {
            submitError = HomeClaimReviewError.message(for: error)
            if !evidenceClient.isCurrent { retire() }
            Analytics.track(.ctaClaimOwnershipSubmit(result: .error))
        }
    }

    /// "Continue" on the routing warning — resume the same submit with
    /// the already-created claim id.
    func acknowledgeRoutingWarning() {
        // Idempotent: SwiftUI fires both the button action and the
        // binding's dismiss, and a second resume would re-run submit.
        guard routingWarning != nil else { return }
        routingWarning = nil
        acknowledgedRoutingWarning = true
        Task { await submit() }
    }

    func acknowledgePendingEvent() {
        pendingEvent = nil
    }

    // MARK: - Routing classification (parity contract — mirrored in Android)

    /// Evidence types strong enough to challenge a verified household.
    /// Copied from RN's `STRONG_CHALLENGE_DOCS`
    /// (`src/app/homes/[id]/claim-owner/evidence.tsx:40`).
    static let strongChallengeDocs: Set<String> = []

    /// Pre-upload warning copy per `routing_classification`. Verbatim
    /// from RN (`claim-owner/evidence.tsx:223-241`).
    static func routingWarning(for classification: String?) -> ClaimRoutingWarning? {
        switch classification {
        case SubmitClaimResponse.RoutingClassification.parallelClaim:
            ClaimRoutingWarning(
                title: "Another claim is pending",
                message: "Another person has a pending claim on this address. You can still submit "
                    + "your own claim. If you are part of the same household, the verified occupant "
                    + "may be able to invite you later."
            )
        case SubmitClaimResponse.RoutingClassification.challengeClaim:
            ClaimRoutingWarning(
                title: "Verified household exists",
                message: "This address needs the dedicated dispute review flow. Uploading a document does not open a challenge."
            )
        default:
            nil
        }
    }

    /// Success-step note describing what the submission actually did.
    static func outcomeNote(
        routingClassification: String?,
        challengeOpened: Bool
    ) -> String? {
        if challengeOpened {
            return "A dispute requires its dedicated review flow. No challenge was opened by this upload."
        }
        if routingClassification == SubmitClaimResponse.RoutingClassification.parallelClaim {
            return "Another person also has a pending claim on this address. Both claims will be reviewed."
        }
        return nil
    }
}

/// One blocking acknowledgement the claimant must clear before their
/// evidence is uploaded.
public struct ClaimRoutingWarning: Sendable, Equatable {
    public let title: String
    public let message: String

    public init(title: String, message: String) {
        self.title = title
        self.message = message
    }
}
