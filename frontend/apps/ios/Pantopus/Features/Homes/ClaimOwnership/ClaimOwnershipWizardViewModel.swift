//
//  ClaimOwnershipWizardViewModel.swift
//  Pantopus
//
//  3-step claim-ownership wizard. Backend flow:
//   1. POST /api/homes/:id/ownership-claims  (claim_type=owner, method=doc_upload)
//   2. For each evidence file:
//        a. POST /api/files/upload (multipart) → file URL
//        b. POST /api/homes/:id/ownership-claims/:claimId/evidence with storage_ref
//   3. On all-success: advance to .success
//   4. On any failure: stay on .upload, mark the failing slot, preserve files
//
//  Backend reality vs P20 spec — flagged in the PR description:
//  - submitClaimSchema does NOT accept a `note` field. The textarea
//    value is sent as `metadata.note` on the FIRST evidence upload.
//  - The evidence endpoint takes JSON `storage_ref`, not multipart.
//    Real bytes go through `/api/files/upload` first.
//
// swiftlint:disable cyclomatic_complexity file_length function_body_length type_body_length

import Foundation
import Logging
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

/// How the viewer wants to get onto this home. Mirrors RN
/// `src/app/homes/[id]/claim-owner/index.tsx:14-15` — the document /
/// escrow / IDV methods all funnel into the same evidence upload
/// natively, so they collapse into `.verifyOwnership`; the
/// `ask_verified_owner` branch posts instead of uploading.
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
    var slots: [ClaimEvidenceSlot: ClaimSlotUiState] = [:]
    /// Per-slot address-match verdict from the on-upload OCR check. Computed
    /// when a file is picked (sample-data heuristic until the evidence
    /// pipeline returns a parsed address) and cleared when the slot is reset.
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

    /// Extra line on the success step describing what the submission
    /// actually did — a parallel claim, or a challenge that opened.
    private(set) var submissionOutcomeNote: String?

    /// `routing_classification` from the claim POST, held across the
    /// warning round-trip and the challenge activation.
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
    /// File URLs successfully pushed through `/api/files/upload` whose
    /// evidence registration later failed. Held so retry can POST the
    /// evidence call directly with the existing `storage_ref` instead
    /// of re-uploading the bytes (which would orphan the prior file).
    private var pendingUploadURLs: [ClaimEvidenceSlot: String] = [:]

    // MARK: - Init

    private let homeId: String
    private let api: APIClient
    private let uploader: MultipartUploader
    private let isOnlineProvider: @MainActor () -> Bool
    private let logger = Logger(label: "app.pantopus.ios.ClaimOwnershipWizard")

    init(
        homeId: String,
        api: APIClient = .shared,
        uploader: MultipartUploader = .shared,
        startContent: ClaimOwnershipStartContent? = nil,
        verificationType: ClaimVerificationType = .owner,
        // Defaults to the live monitor in production. Tests inject a fixed
        // value so CI simulator reachability does not gate stubbed requests.
        isOnlineProvider: @escaping @MainActor () -> Bool = { NetworkMonitor.shared.isOnline }
    ) {
        self.homeId = homeId
        self.api = api
        self.uploader = uploader
        self.verificationType = verificationType
        self.isOnlineProvider = isOnlineProvider
        self.startContent = startContent ?? ClaimOwnershipSampleData.startContent(for: homeId)
        for slot in ClaimEvidenceSlot.allCases {
            slots[slot] = .empty
        }
        currentStep = verificationType.steps.first ?? .start
        // Residency's single slot accepts three document kinds; RN forces
        // an explicit pick (`evidence.tsx:162`), so we start unselected.
        //
        // The owner variant carries a second, fixed "Government ID" slot
        // alongside the ownership proof, so its picker starts on `deed` —
        // the type this wizard sent before the picker existed. The
        // claimant can switch to any of the other four ownership document
        // kinds (RN `OWNERSHIP_DOC_OPTIONS`, `evidence.tsx:26-32`).
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
        guard documentOptions.contains(where: { $0.id == id }) else { return }
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
                primaryCTAEnabled: !isSendingAskRequest,
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
            let response: HomePublicPreviewResponse = try await api.request(
                HomeDiscoveryEndpoints.publicProfile(homeId: homeId)
            )
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
            logger.warning("Claim start public-profile load failed: \(error)")
        }
    }

    /// `POST /api/homes/:id/request-household-from-owner` — notifies the
    /// home's verified owner(s) that a non-member wants to be added.
    func sendHouseholdRequest() async {
        guard !isSendingAskRequest else { return }
        if !isOnlineProvider() {
            askRequestError = "You're offline. Try again when you're back online."
            return
        }
        isSendingAskRequest = true
        defer { isSendingAskRequest = false }
        do {
            _ = try await api.request(
                HomeDiscoveryEndpoints.requestHouseholdFromOwner(
                    homeId: homeId,
                    request: RequestHouseholdFromOwnerRequest(requestedIdentity: "owner")
                )
            ) as RequestHouseholdFromOwnerResponse
            askRequestConfirmation =
                "Verified owners were notified. They can add you from the home Members screen."
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
        slots[slot] = .picked(file: file)
        // Run the address check on upload completion (sample-data heuristic
        // for now) so the slot can render its done/warn confirmation.
        addressMatches[slot] = ClaimOwnershipSampleData.addressMatch(
            forFilename: file.filename,
            homeLabel: startContent.homeLabel
        )
        // Picking a new file invalidates any prior URL we'd cached for
        // this slot — the next submit must re-upload these bytes.
        pendingUploadURLs[slot] = nil
        submitError = nil
    }

    func remove(_ slot: ClaimEvidenceSlot) {
        slots[slot] = .empty
        addressMatches[slot] = nil
        pendingUploadURLs[slot] = nil
    }

    /// Surface a "file too large" error inline rather than letting the
    /// upload round-trip to a 413. Called by the picker when the user
    /// selects a file over `CLAIM_FILE_MAX_BYTES`.
    func fileTooLarge(for _: ClaimEvidenceSlot) {
        submitError = "That file is over 10 MB. Try a smaller photo."
    }

    /// Every slot the active variant requires carries a file.
    var bothSlotsHaveFiles: Bool {
        activeSlots.allSatisfy { slots[$0]?.hasFile == true }
    }

    var anySlotHasFile: Bool {
        activeSlots.contains { slots[$0]?.hasFile == true }
    }

    /// Submit gate — files in every required slot, plus an explicit
    /// document-kind pick when the variant offers a choice.
    var canSubmit: Bool {
        bothSlotsHaveFiles && !needsDocumentTypeSelection
    }

    // MARK: - Submit

    func submit() async {
        guard canSubmit, !isSubmitting else { return }
        if !isOnlineProvider() {
            submitError = "You're offline. Try again when you're back online."
            return
        }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }

        // Step 1: create the claim — but only once across retry attempts.
        // Holding the id in `pendingClaimId` keeps a partial-success retry
        // from creating a duplicate claim row server-side.
        let claimId: String
        if let existing = pendingClaimId {
            claimId = existing
        } else {
            let claimResponse: SubmitClaimResponse
            do {
                claimResponse = try await api.request(
                    HomesEndpoints.submitClaim(
                        homeId: homeId,
                        request: SubmitClaimRequest(
                            claimType: verificationType.claimType,
                            method: "doc_upload"
                        )
                    )
                )
            } catch {
                // 409 = someone else's verification is already in
                // flight for this home (EXISTING_IN_FLIGHT_CLAIM /
                // DUPLICATE_CLAIM). RN offers "Search homes" here
                // (`claim-owner/evidence.tsx:194-212`); mirror that so
                // the user has somewhere to go.
                if case let .clientError(status, _) = error as? APIError ?? .invalidResponse,
                   status == 409 {
                    blockedByOtherClaimPrompt = blockedByOtherClaimCopy
                } else {
                    submitError = "Couldn't submit. Retry."
                }
                logger.warning("Claim submit failed: \(error)")
                Analytics.track(.ctaClaimOwnershipSubmit(result: .error))
                return
            }
            guard let id = claimResponse.claim.id else {
                // Opaque-handshake path can return nil claim id when a
                // duplicate exists — same user-visible outcome as the
                // 409 above.
                blockedByOtherClaimPrompt = blockedByOtherClaimCopy
                Analytics.track(.ctaClaimOwnershipSubmit(result: .error))
                return
            }
            claimId = id
            pendingClaimId = id
            routingClassification = claimResponse.claim.routingClassification
        }

        // Step 1b: surface the backend's routing verdict before anything
        // is uploaded. RN blocks on the same two alerts
        // (`claim-owner/evidence.tsx:223-241`) and only continues once
        // the claimant taps "Continue". Residency claims skip both.
        if verificationType != .residency,
           !acknowledgedRoutingWarning,
           let warning = Self.routingWarning(for: routingClassification) {
            routingWarning = warning
            return
        }

        // Step 2: upload each slot's file then register evidence. Skip
        // any slot we already finished on a prior attempt, and skip the
        // upload step for slots whose bytes are already in storage —
        // both retry-paths exist so partial failures don't repeat work.
        for (index, slot) in activeSlots.enumerated() {
            if case .uploaded = slots[slot] { continue }
            guard let file = slots[slot]?.pickedFile else { continue }
            let metadata: [String: String]? =
                index == 0 && !note.trimmingCharacters(in: .whitespaces).isEmpty
                    ? ["note": note] : nil
            do {
                let fileURL: String
                if let cached = pendingUploadURLs[slot] {
                    fileURL = cached
                } else {
                    slots[slot] = .uploading(file: file, fraction: 0.4)
                    let upload = try await uploader.uploadFile(
                        MultipartFile(
                            fieldName: "file",
                            filename: file.filename,
                            mimeType: file.mimeType,
                            data: file.data
                        ),
                        formFields: ["file_type": "claim_evidence", "visibility": "private"]
                    )
                    fileURL = upload.file.url
                    pendingUploadURLs[slot] = fileURL
                }
                slots[slot] = .uploading(file: file, fraction: 0.8)
                _ = try await api.request(
                    HomesEndpoints.uploadEvidence(
                        homeId: homeId,
                        claimId: claimId,
                        request: UploadEvidenceRequest(
                            evidenceType: evidenceType(for: slot),
                            storageRef: fileURL,
                            metadata: metadata
                        )
                    )
                ) as UploadEvidenceResponse
                slots[slot] = .uploaded(file: file, fileURL: fileURL)
                // Evidence row exists — no need to keep the URL cache.
                pendingUploadURLs[slot] = nil
            } catch {
                logger.warning("Evidence upload failed for slot \(slot.rawValue): \(error)")
                slots[slot] = .failed(file: file, message: "Upload failed")
                submitError = "Couldn't submit. Retry."
                Analytics.track(.ctaClaimOwnershipSubmit(result: .error))
                return
            }
        }

        // Step 3: a challenge-classified claim backed by a strong
        // ownership document opens a formal challenge against the
        // verified household. RN does the same at
        // `claim-owner/evidence.tsx:285-297`; failures are non-fatal
        // (the backend 409s when the evidence isn't strong enough).
        var challengeOpened = false
        if verificationType != .residency,
           routingClassification == SubmitClaimResponse.RoutingClassification.challengeClaim,
           activeSlots.contains(where: { Self.strongChallengeDocs.contains(evidenceType(for: $0)) }) {
            do {
                _ = try await api.request(
                    HomeOwnershipClaimEndpoints.challenge(homeId: homeId, claimId: claimId)
                ) as ChallengeClaimResponse
                challengeOpened = true
            } catch {
                logger.warning("Challenge activation skipped: \(error)")
            }
        }
        submissionOutcomeNote = Self.outcomeNote(
            routingClassification: routingClassification,
            challengeOpened: challengeOpened
        )

        // All uploads succeeded — advance to success.
        Analytics.track(.ctaClaimOwnershipSubmit(result: .success))
        currentStep = .success
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
    static let strongChallengeDocs: Set<String> = [
        "deed", "closing_disclosure", "escrow_attestation", "title_match"
    ]

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
                message: "This address already has a verified household. You can still submit "
                    + "ownership proof. If your documents are stronger, your claim can challenge "
                    + "the current verification."
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
            return "Your documents were strong enough to challenge the current verified household. "
                + "A reviewer will compare both sets of evidence."
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
