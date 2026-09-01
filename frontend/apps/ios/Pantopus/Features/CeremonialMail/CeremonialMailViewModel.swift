//
//  CeremonialMailViewModel.swift
//  Pantopus
//
//  T3.7 Ceremonial Mail Compose VM — conforms to WizardModel so it
//  plugs into the shared WizardShell. Owns the four-step state
//  machine + recipient search + address verification + voice
//  postscript upload + final send.
//

import Foundation
import Observation

@Observable
@MainActor
public final class CeremonialMailViewModel: WizardModel {
    // MARK: - Public state

    public private(set) var step: CeremonialMailStep = .decide
    public private(set) var pendingEvent: CeremonialMailEvent?

    // Step 1: decide
    public var recipientQuery: String = ""
    public private(set) var recipientResults: [MailRecipientDTO] = []
    public private(set) var isSearchingRecipients: Bool = false
    public private(set) var selectedRecipient: MailRecipientDTO?
    public var intent: CeremonialMailIntent = .sayHello

    // Step 2: verify
    public private(set) var homeContext: MailHomeContextResponse?
    public var addressConfirmed: Bool = false
    public var returnAddressShared: Bool = false

    // Step 3: compose
    public var stationery: CeremonialMailStationery = .classicCream
    public var ink: CeremonialMailInk = .walnut
    public var seal: CeremonialMailSeal = .waxRed
    public var bodyText: String = ""
    public private(set) var voiceStatus: VoicePostscriptStatus = .empty

    /// Step 4: commit
    public var sendTiming: CeremonialMailSendTiming = .now

    /// Submission
    public private(set) var submitError: String?

    private let api: APIClient
    private let multipart: MultipartUploader
    private var lastSearchTask: Task<Void, Never>?
    private var isSubmitting: Bool = false

    init(
        api: APIClient = .shared,
        multipart: MultipartUploader = .shared
    ) {
        self.api = api
        self.multipart = multipart
    }

    // MARK: - Step 1: decide

    public func updateRecipientQuery(_ value: String) {
        recipientQuery = value
        if selectedRecipient != nil, value != displayName(selectedRecipient) {
            // The user is editing the field after picking — clear the
            // selection so they can pick a different recipient.
            selectedRecipient = nil
            homeContext = nil
        }
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else {
            lastSearchTask?.cancel()
            recipientResults = []
            isSearchingRecipients = false
            return
        }
        lastSearchTask?.cancel()
        lastSearchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await self?.searchRecipients(query: trimmed)
        }
    }

    public func selectRecipient(_ recipient: MailRecipientDTO) {
        selectedRecipient = recipient
        recipientQuery = displayName(recipient)
        homeContext = nil
        addressConfirmed = false
    }

    public func selectIntent(_ value: CeremonialMailIntent) {
        intent = value
    }

    // MARK: - Step 2: verify

    public func loadHomeContext() async {
        guard let homeId = selectedRecipient?.homeId else { return }
        do {
            let response: MailHomeContextResponse =
                try await api.request(MailComposeEndpoints.homeContext(homeId: homeId))
            homeContext = response
        } catch {
            // Surfaced inline on the verify step; the user can still
            // proceed (the recipient already has a known address).
            homeContext = nil
        }
    }

    public func toggleAddressConfirmed(_ value: Bool) {
        addressConfirmed = value
    }

    public func toggleReturnAddressShared(_ value: Bool) {
        returnAddressShared = value
    }

    // MARK: - Step 3: compose

    public func selectStationery(_ value: CeremonialMailStationery) {
        stationery = value
    }

    public func selectInk(_ value: CeremonialMailInk) {
        ink = value
    }

    public func selectSeal(_ value: CeremonialMailSeal) {
        seal = value
    }

    public func updateBody(_ value: String) {
        bodyText = value
    }

    /// View-layer calls this once it has produced a recorded audio
    /// file URI. The VM kicks off the multipart upload.
    public func voicePostscriptDidRecord(localUri: String) async {
        voiceStatus = .uploading
        do {
            let url = URL(fileURLWithPath: localUri.replacingOccurrences(of: "file://", with: ""))
            let data = try Data(contentsOf: url)
            let file = MultipartFile(
                fieldName: "file",
                filename: url.lastPathComponent,
                mimeType: "audio/m4a",
                data: data
            )
            let response = try await multipart.uploadFile(
                file,
                formFields: ["file_type": "voice_postscript"]
            )
            voiceStatus = .uploaded(remoteUrl: response.file.url)
        } catch {
            voiceStatus = .error(message: "Couldn't upload postscript. Try again.")
        }
    }

    public func clearVoicePostscript() {
        voiceStatus = .empty
    }

    public func voicePostscriptDidStartRecording() {
        voiceStatus = .recording
    }

    /// Mark the recording as captured before the upload kicks off.
    /// The view sets the URI; the upload then runs through
    /// `voicePostscriptDidRecord`.
    public func voicePostscriptDidCapture(localUri: String) {
        voiceStatus = .captured(localUri: localUri)
    }

    // MARK: - Step 4: commit

    public func selectSendTiming(_ value: CeremonialMailSendTiming) {
        sendTiming = value
    }

    // MARK: - WizardModel

    public var chrome: WizardChrome {
        WizardChrome(
            title: stepTitle,
            progressLabel: step.stepNumber.map { .stepOf(current: $0, total: CeremonialMailStep.progressTotal) }
                ?? .hidden,
            progressFraction: step.stepNumber.map { Double($0) / Double(CeremonialMailStep.progressTotal) },
            leading: step == .decide ? .close : .back,
            primaryCTALabel: primaryCtaLabel,
            primaryCTAEnabled: primaryCtaEnabled,
            secondaryCTA: step == .success
                ? WizardSecondaryCTA(label: "Back to Hub", identifier: "ceremonialBackToHub")
                : nil,
            isSubmitting: isSubmitting,
            dirty: stepDirty,
            showsProgressBar: step != .success
        )
    }

    public func leadingTapped() {
        guard step != .decide else { pendingEvent = .dismiss
            return
        }
        switch step {
        case .verify: step = .decide
        case .compose: step = .verify
        case .commit: step = .compose
        case .success: pendingEvent = .dismiss
        case .decide: break
        }
    }

    public func discardConfirmed() {
        pendingEvent = .dismiss
    }

    public func primaryTapped() {
        switch step {
        case .decide:
            guard selectedRecipient != nil else { return }
            step = .verify
            Task { await loadHomeContext() }
        case .verify:
            guard addressConfirmed else { return }
            step = .compose
        case .compose:
            guard !bodyText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
            step = .commit
        case .commit:
            guard !isSubmitting else { return }
            Task { await submit() }
        case .success:
            pendingEvent = .dismiss
        }
    }

    public func secondaryTapped() {
        if step == .success {
            pendingEvent = .dismiss
        }
    }

    public func acknowledgePendingEvent() {
        pendingEvent = nil
    }

    // MARK: - Computed

    private var stepTitle: String {
        // T6.5e — Step titles match the ceremonial-compose design
        // (Porch Call · Address It · Write It · Seal & Send) while the
        // internal enum stays decide / verify / compose / commit so
        // existing tests and analytics events keep their stable names.
        switch step {
        case .decide: "Porch Call"
        case .verify: "Address It"
        case .compose: "Write It"
        case .commit: "Seal & Send"
        case .success: "Letter on its way"
        }
    }

    private var primaryCtaLabel: String {
        switch step {
        case .decide: "Continue"
        case .verify: "Continue to letter"
        case .compose: "Continue"
        case .commit: "Seal and send"
        case .success: "Done"
        }
    }

    private var primaryCtaEnabled: Bool {
        switch step {
        case .decide: selectedRecipient != nil
        case .verify: addressConfirmed
        case .compose: !bodyText.trimmingCharacters(in: .whitespaces).isEmpty
        case .commit: !isSubmitting
        case .success: true
        }
    }

    private var stepDirty: Bool {
        switch step {
        case .decide: selectedRecipient != nil || !recipientQuery.isEmpty
        case .verify, .compose, .commit: true
        case .success: false
        }
    }

    // MARK: - Network

    private func searchRecipients(query: String) async {
        isSearchingRecipients = true
        defer { isSearchingRecipients = false }
        do {
            let response: MailComposeRecipientsResponse =
                try await api.request(MailComposeEndpoints.recipients(query: query))
            recipientResults = response.recipients
        } catch {
            recipientResults = []
        }
    }

    private func submit() async {
        guard let recipient = selectedRecipient else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        submitError = nil
        let voiceRemote: String? = {
            if case let .uploaded(remoteUrl) = voiceStatus { return remoteUrl }
            return nil
        }()
        let body = SendMailBody(
            recipientUserId: recipient.userId,
            recipientHomeId: recipient.homeId,
            type: "letter",
            subject: subjectFromIntent(),
            content: bodyText.trimmingCharacters(in: .whitespacesAndNewlines),
            object: SendMailObject(
                title: subjectFromIntent(),
                content: bodyText.trimmingCharacters(in: .whitespacesAndNewlines),
                payload: SendMailPayload(
                    stationeryTheme: stationery.rawValue,
                    inkSelection: ink.rawValue,
                    sealChoice: seal.rawValue,
                    intent: intent.rawValue,
                    returnAddressShared: returnAddressShared,
                    voicePostscriptUri: voiceRemote
                )
            ),
            expiresAt: nil
        )
        do {
            let response: SendMailResponse = try await api.request(MailComposeEndpoints.send(body: body))
            step = .success
            if let mailId = response.mail?.id {
                pendingEvent = .openMail(mailId: mailId)
            }
        } catch {
            submitError = (error as? APIError)?.errorDescription ?? "Couldn't send your letter. Try again."
        }
    }

    // MARK: - Helpers

    private func subjectFromIntent() -> String {
        switch intent {
        case .sayHello: "A note from a friend"
        case .congratulations: "Congratulations!"
        case .condolences: "Thinking of you"
        case .businessNote: "A business note"
        case .justBecause: "Just because"
        }
    }

    private func displayName(_ recipient: MailRecipientDTO?) -> String {
        guard let recipient else { return "" }
        return recipient.name ?? recipient.username ?? "Recipient"
    }
}
