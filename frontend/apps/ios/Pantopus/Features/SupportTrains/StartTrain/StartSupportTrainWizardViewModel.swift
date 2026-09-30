//
//  StartSupportTrainWizardViewModel.swift
//  Pantopus
//
//  P2.6 — Start-a-Support-Train wizard view model. Owns the three-step
//  state machine + recipient autocomplete + the launch sequence (create
//  draft → POST each generated slot → publish). On success, emits
//  `.openTrain(trainId:)` so the host stack can pop the wizard and
//  push the new train's review-signups screen.
//

import Foundation
import Observation

// swiftlint:disable type_body_length

@Observable
@MainActor
public final class StartSupportTrainWizardViewModel: WizardModel {
    // MARK: - Public state

    public private(set) var step: StartSupportTrainStep = .whoAndWhy
    public private(set) var pendingEvent: StartSupportTrainEvent?

    // Step 1 — Who & why
    public var beneficiaryQuery: String = ""
    public private(set) var beneficiaryResults: [MailRecipientDTO] = []
    public private(set) var isSearchingBeneficiary: Bool = false
    /// The last recipient search failed (offline, server error). A failed
    /// search found nobody, so the "no one by that name" branch stays hidden.
    public private(set) var beneficiarySearchFailed: Bool = false
    /// The recipient field is being edited. The no-match card replaces the
    /// field, so it waits until editing ends instead of swallowing the rest
    /// of a name mid-typing.
    public private(set) var isEditingBeneficiaryQuery: Bool = false
    public private(set) var selectedBeneficiary: MailRecipientDTO?
    public var selectedReason: StartSupportTrainReason = .surgery
    public var reason: String = ""
    public var inviteOnly: Bool = true
    public var blockVisible: Bool = false
    public var inviteMethod: StartSupportTrainInviteMethod = .phone

    // Step 2 — What & when
    public var kind: SupportTrainKind = .meals
    public var startDate: Date
    public var endDate: Date
    public var slotDuration: StartSupportTrainSlotDuration = .sixty

    // Step 3 — Review & launch
    public var allowComments: Bool = true
    public var visibility: StartSupportTrainVisibility = .connections // "Invite only" is on by default
    public private(set) var launchError: String?
    public private(set) var publishedTrainId: String?
    /// A half-built draft a failed launch couldn't delete; the next launch removes it first.
    private var leftoverTrainId: String?
    /// The create's request id, kept until its reply arrives, so a retry reaches the same draft.
    private var createRequestId: String?

    // MARK: - Constants

    public static let reasonCharLimit: Int = 500

    // MARK: - Dependencies

    private let api: APIClient
    private var searchTask: Task<Void, Never>?
    private var isSubmittingFlag: Bool = false

    init(
        api: APIClient = .shared,
        startDate: Date = Date(),
        endDate: Date = Date().addingTimeInterval(60 * 60 * 24 * 6)
    ) {
        self.api = api
        let cal = Calendar.current
        self.startDate = cal.startOfDay(for: startDate)
        self.endDate = cal.startOfDay(for: endDate)
    }

    // MARK: - Derived projections

    public var generatedSlots: [StartSupportTrainSlot] {
        StartSupportTrainSlotGenerator.generate(
            startDate: startDate,
            endDate: endDate,
            durationMinutes: slotDuration.rawValue,
            startHour: kind.defaultStartHour
        )
    }

    public var reasonRemainingChars: Int {
        max(0, Self.reasonCharLimit - reason.count)
    }

    public var derivedTitle: String {
        let recipientName = selectedBeneficiary?.name
            ?? selectedBeneficiary?.username
            ?? beneficiaryQuery.trimmingCharacters(in: .whitespaces)
        let name = recipientName.isEmpty ? "a neighbor" : recipientName
        return "\(kind.title) for \(name)"
    }

    /// Mutual connections shared with the selected recipient, for the
    /// recipient card's micro-avatar strip. There is no mutuals lookup yet,
    /// so none are shown (the sample names were shown for everyone).
    public var recipientMutuals: [StartSupportTrainMutual] {
        []
    }

    /// The Frame-2 invite candidate when the organizer typed a name that
    /// matched no verified neighbor. The contact handles are stubbed
    /// (real contact-picker integration is out of scope); only the typed
    /// name is live.
    public var inviteCandidate: StartSupportTrainInviteCandidate? {
        guard isInviteRecipientBranch else { return nil }
        let typed = beneficiaryQuery.trimmingCharacters(in: .whitespaces)
        // No contact handles: sample ones must never reach the live card.
        return StartSupportTrainInviteCandidate(typedName: typed, phone: "", email: "")
    }

    // MARK: - Step 1 actions

    public func updateBeneficiaryQuery(_ value: String) {
        beneficiaryQuery = value
        if let current = selectedBeneficiary, value != displayName(current) {
            selectedBeneficiary = nil
        }
        beneficiarySearchFailed = false
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else {
            searchTask?.cancel()
            beneficiaryResults = []
            isSearchingBeneficiary = false
            return
        }
        scheduleBeneficiarySearch(trimmed)
    }

    /// Re-runs the recipient search for the current text (the "Try again"
    /// after a failed search).
    public func retryBeneficiarySearch() {
        let trimmed = beneficiaryQuery.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else { return }
        beneficiarySearchFailed = false
        scheduleBeneficiarySearch(trimmed)
    }

    /// The recipient field gained or lost focus.
    public func setEditingBeneficiaryQuery(_ editing: Bool) {
        isEditingBeneficiaryQuery = editing
    }

    public func selectBeneficiary(_ recipient: MailRecipientDTO) {
        selectedBeneficiary = recipient
        beneficiaryQuery = displayName(recipient)
        beneficiaryResults = []
        isEditingBeneficiaryQuery = false
    }

    /// "Change" on the chosen recipient: start a fresh search. Keeping the
    /// chosen name in the field with no results read as "no one by that
    /// name" for a person who is on Pantopus.
    public func clearBeneficiary() {
        searchAgain()
    }

    public func searchAgain() {
        searchTask?.cancel()
        selectedBeneficiary = nil
        beneficiaryQuery = ""
        beneficiaryResults = []
        isSearchingBeneficiary = false
        beneficiarySearchFailed = false
        isEditingBeneficiaryQuery = false
    }

    public func selectReason(_ value: StartSupportTrainReason) {
        selectedReason = value
    }

    public func updateReason(_ value: String) {
        if value.count > Self.reasonCharLimit {
            reason = String(value.prefix(Self.reasonCharLimit))
        } else {
            reason = value
        }
    }

    /// Step 1's two switches and the review's Visibility are one setting, so the review shows what launches.
    public func toggleInviteOnly(_ value: Bool) {
        inviteOnly = value
        if value { blockVisible = false }
        visibility = .from(inviteOnly: inviteOnly, blockVisible: blockVisible)
    }

    public func toggleBlockVisible(_ value: Bool) {
        blockVisible = value
        if value { inviteOnly = false }
        visibility = .from(inviteOnly: inviteOnly, blockVisible: blockVisible)
    }

    public func selectInviteMethod(_ value: StartSupportTrainInviteMethod) {
        inviteMethod = value
    }

    // MARK: - Step 2 actions

    public func selectKind(_ value: SupportTrainKind) {
        kind = value
    }

    public func setStartDate(_ value: Date) {
        let cal = Calendar.current
        startDate = cal.startOfDay(for: value)
        if endDate < startDate {
            endDate = startDate
        }
    }

    public func setEndDate(_ value: Date) {
        let cal = Calendar.current
        let day = cal.startOfDay(for: value)
        endDate = day < startDate ? startDate : day
    }

    public func selectSlotDuration(_ value: StartSupportTrainSlotDuration) {
        slotDuration = value
    }

    // MARK: - Step 3 actions

    public func toggleAllowComments(_ value: Bool) {
        allowComments = value
    }

    public func selectVisibility(_ value: StartSupportTrainVisibility) {
        visibility = value
        inviteOnly = value == .connections
        blockVisible = value == .neighbors
    }

    // MARK: - WizardModel

    public var chrome: WizardChrome {
        WizardChrome(
            title: stepTitle,
            progressLabel: step.stepNumber.map {
                .stepOf(current: $0, total: StartSupportTrainStep.progressTotal)
            } ?? .hidden,
            progressFraction: step.stepNumber.map {
                Double($0) / Double(StartSupportTrainStep.progressTotal)
            },
            leading: step == .whoAndWhy ? .close : .back,
            primaryCTALabel: primaryCTALabel,
            primaryCTAEnabled: primaryCTAEnabled,
            secondaryCTA: secondaryCTA,
            isSubmitting: isSubmittingFlag,
            dirty: stepDirty,
            showsProgressBar: step != .success
        )
    }

    public func leadingTapped() {
        switch step {
        case .whoAndWhy:
            pendingEvent = .dismiss
        case .whatAndWhen:
            step = .whoAndWhy
        case .reviewAndLaunch:
            step = .whatAndWhen
        case .success:
            pendingEvent = .dismiss
        }
    }

    public func discardConfirmed() {
        pendingEvent = .dismiss
    }

    public func primaryTapped() {
        switch step {
        case .whoAndWhy:
            guard canAdvanceFromWhoAndWhy else { return }
            // The field leaves the screen still focused, and no focus change reports it.
            isEditingBeneficiaryQuery = false
            step = .whatAndWhen
        case .whatAndWhen:
            guard canAdvanceFromWhatAndWhen else { return }
            step = .reviewAndLaunch
        case .reviewAndLaunch:
            guard !isSubmittingFlag else { return }
            Task { await launch() }
        case .success:
            handleSuccessExit()
        }
    }

    /// "Search again" belongs to the recipient step; "Back to trains" returns to the list.
    public func secondaryTapped() {
        if step == .whoAndWhy, isInviteRecipientBranch {
            searchAgain()
        } else if step == .success {
            pendingEvent = .dismiss
        }
    }

    public func acknowledgePendingEvent() {
        pendingEvent = nil
    }

    // MARK: - Computed gate state

    public var canAdvanceFromWhoAndWhy: Bool {
        selectedBeneficiary != nil
            || beneficiaryQuery.trimmingCharacters(in: .whitespaces).count >= 2
    }

    /// The typed name matched no one: shown only after a search that
    /// worked, and once the field is no longer being edited.
    public var isInviteRecipientBranch: Bool {
        selectedBeneficiary == nil
            && beneficiaryQuery.trimmingCharacters(in: .whitespaces).count >= 2
            && beneficiaryResults.isEmpty
            && !isSearchingBeneficiary
            && !beneficiarySearchFailed
            && !isEditingBeneficiaryQuery
    }

    public var canAdvanceFromWhatAndWhen: Bool {
        endDate >= startDate && !generatedSlots.isEmpty
    }

    private var primaryCTAEnabled: Bool {
        switch step {
        case .whoAndWhy: canAdvanceFromWhoAndWhy
        case .whatAndWhen: canAdvanceFromWhatAndWhen
        case .reviewAndLaunch: !isSubmittingFlag && !generatedSlots.isEmpty
        case .success: true
        }
    }

    private var stepTitle: String {
        switch step {
        case .whoAndWhy: "Start a support train"
        case .whatAndWhen: "What & when"
        case .reviewAndLaunch: "Review & launch"
        case .success: "Train launched"
        }
    }

    private var primaryCTALabel: String {
        switch step {
        // No invite is sent from the wizard, so the CTA doesn't promise one.
        case .whoAndWhy: "Continue"
        case .whatAndWhen: "Continue"
        case .reviewAndLaunch: "Launch train"
        case .success: "Open train"
        }
    }

    private var secondaryCTA: WizardSecondaryCTA? {
        if step == .success {
            return WizardSecondaryCTA(
                label: "Back to trains",
                identifier: "startSupportTrainBackToList"
            )
        }
        if step == .whoAndWhy, isInviteRecipientBranch {
            return WizardSecondaryCTA(
                label: "Search again",
                identifier: "startSupportTrainSearchAgain"
            )
        }
        return nil
    }

    private var stepDirty: Bool {
        switch step {
        case .whoAndWhy:
            canAdvanceFromWhoAndWhy
                || !beneficiaryQuery.isEmpty
                || !reason.isEmpty
                || selectedReason != .surgery
                || !inviteOnly
                || blockVisible
        case .whatAndWhen, .reviewAndLaunch: true
        case .success: false
        }
    }

    // MARK: - Network

    private func scheduleBeneficiarySearch(_ query: String) {
        searchTask?.cancel()
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await self?.searchBeneficiary(query: query)
        }
    }

    private func searchBeneficiary(query: String) async {
        isSearchingBeneficiary = true
        defer { isSearchingBeneficiary = false }
        do {
            let response: MailComposeRecipientsResponse = try await api.request(
                MailComposeEndpoints.recipients(query: query)
            )
            beneficiaryResults = response.recipients
            beneficiarySearchFailed = false
        } catch {
            // A superseded search is cancelled, not failed.
            guard !Task.isCancelled else { return }
            beneficiaryResults = []
            beneficiarySearchFailed = true
        }
    }

    private func launch() async {
        isSubmittingFlag = true
        launchError = nil
        defer { isSubmittingFlag = false }
        if let leftover = leftoverTrainId,
           await deleteDraft(leftover) {
            leftoverTrainId = nil
        }
        let trimmedReason = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        let requestId = createRequestId ?? UUID().uuidString
        createRequestId = requestId
        let body = CreateSupportTrainBody(
            draftPayload: CreateSupportTrainBody.DraftPayload(story: trimmedReason),
            title: derivedTitle,
            recipientUserId: selectedBeneficiary?.userId,
            sharingMode: visibility.sharingModeWire,
            clientRequestId: requestId
        )
        var createdTrainId: String?
        do {
            let created: CreateSupportTrainResponse = try await api.request(
                SupportTrainsEndpoints.create(body: body)
            )
            createRequestId = nil
            createdTrainId = created.id
            publishedTrainId = created.id
            // The whole schedule in one request (a slot on every day of the range): a request
            // per slot ran a long train into the write limits partway through.
            if let first = generatedSlots.first, let last = generatedSlots.last {
                let schedule = GenerateSupportTrainSlotsBody(
                    startDate: first.dateKey,
                    endDate: last.dateKey,
                    startTime: first.startTime,
                    endTime: first.endTime,
                    slotLabel: kind.defaultSlotLabel,
                    supportMode: kind.supportMode
                )
                _ = try await api.request(
                    SupportTrainsEndpoints.generateSlots(supportTrainId: created.id, body: schedule),
                    as: EmptyResponse.self
                )
            }
            _ = try await api.request(
                SupportTrainsEndpoints.publish(supportTrainId: created.id),
                as: EmptyResponse.self
            )
            step = .success
        } catch {
            // Launching is several calls. If a later one fails, remove the
            // half-built draft so trying again makes exactly one train.
            if let id = createdTrainId {
                publishedTrainId = nil
                let deleted = await deleteDraft(id)
                if !deleted { leftoverTrainId = id }
            }
            launchError = (error as? APIError)?.errorDescription
                ?? "Couldn't launch the train. Try again."
        }
    }

    /// Deletes a draft this wizard created; false when the delete didn't go through.
    private func deleteDraft(_ trainId: String) async -> Bool {
        let endpoint = SupportTrainActionsEndpoints.deleteTrain(supportTrainId: trainId)
        return await (try? api.request(endpoint, as: EmptyResponse.self)) != nil
    }

    // MARK: - Helpers

    private func handleSuccessExit() {
        if let id = publishedTrainId {
            pendingEvent = .openTrain(trainId: id)
        } else {
            pendingEvent = .dismiss
        }
    }

    private func displayName(_ recipient: MailRecipientDTO) -> String {
        recipient.name ?? recipient.username ?? "Recipient"
    }
}
