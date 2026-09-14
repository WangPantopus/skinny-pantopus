//
//  VerifyLandlordWizardViewModel.swift
//  Pantopus
//
//  Drives the A12.5 / A12.6 wizard state machine:
//
//    .start → .details → submit ─┬─ 201  → .sent (landlord now has it)
//                                ├─ known duplicate → .sent (existing pending/active lease)
//                                └─ verified no-landlord error → openPostcardVerification(homeId)
//
//  Submit posts a real tenant approval request to
//  `POST /api/v1/tenant/request-approval` (route
//  `backend/routes/landlordTenant.js:483`, mounted at `/api/v1` in
//  `backend/app.js:397`) carrying the move-in date + message the user
//  entered, with the landlord / PM details appended to the message
//  (`tenantRequestSchema` has no structured column for them). When the
//  home has no verified landlord authority the backend answers 400 —
//  that is RN's "no landlord on file" branch, and we fall back to the
//  mailed-code review screen through `openPostcardVerification`. The
//  user confirms the complete address there before a protected mail command.
//

import Foundation
import Observation

/// View model backing `VerifyLandlordWizardView`. Holds the per-field
/// form state, the current step, and the submit state machine
/// (`.idle → .submitting → .submitted / .error(_)`).
@Observable
@MainActor
final class VerifyLandlordWizardViewModel: WizardModel {
    // MARK: - Published state

    private(set) var currentStep: VerifyLandlordStep = .start
    private(set) var startContent: VerifyLandlordStartContent
    var form: VerifyLandlordForm
    /// Validation errors materialised lazily — `nil` means "user hasn't
    /// tried to submit yet, don't render error chips". Becomes
    /// `.empty` or populated after the first submit attempt.
    private(set) var errors: VerifyLandlordValidationErrors?
    private(set) var submitState: VerifyLandlordSubmitState = .idle
    /// Populated once the tenant approval request resolved. Drives the
    /// `.sent` step's content — every field comes off the wire.
    private(set) var approvalResult: VerifyLandlordApprovalResult?
    var pendingEvent: VerifyLandlordOutboundEvent?

    // MARK: - Init

    private let homeId: String
    private let submitDelayNanos: UInt64
    private let api: APIClient
    private let sessionScope: HomeClaimSessionScope
    private var isLoadingStatus = false
    private var statusNeedsRetry = false
    @ObservationIgnored private var pendingWork: Task<Void, Never>?
    @ObservationIgnored private var requestGeneration = 0

    /// Test/offline seam for the tenant approval request. When non-nil,
    /// `submit()` calls this instead of
    /// `POST /api/v1/tenant/request-approval`.
    typealias ApprovalRequester = @MainActor (TenantRequestApprovalRequest) async
        -> Result<TenantLeaseDTO, any Error>
    private let approvalRequester: ApprovalRequester?

    init(
        homeId: String,
        startContent: VerifyLandlordStartContent? = nil,
        form: VerifyLandlordForm? = nil,
        api: APIClient = .shared,
        submitDelayNanos: UInt64 = 800_000_000,
        sessionIdentity: (() -> String?)? = nil,
        approvalRequester: ApprovalRequester? = nil
    ) {
        self.homeId = homeId
        self.startContent = startContent
            ?? VerifyLandlordSampleData.startContent(for: homeId)
        self.form = form ?? VerifyLandlordSampleData.formSeed(for: homeId)
        self.api = api
        sessionScope = HomeClaimSessionScope(api: api, identity: sessionIdentity)
        self.submitDelayNanos = submitDelayNanos
        self.approvalRequester = approvalRequester
    }

    // MARK: - WizardModel

    var chrome: WizardChrome {
        let dirty = !form.ownerName.isEmpty
            || !form.contactName.isEmpty
            || !form.email.isEmpty
            || form.lease != nil
            || form.pmEnabled
        switch currentStep {
        case .start:
            return WizardChrome(
                title: "Verify landlord",
                progressLabel: .stepOf(current: 1, total: 3),
                progressFraction: 1.0 / 3.0,
                leading: .close,
                primaryCTALabel: statusNeedsRetry ? "Retry status" : "Start verification",
                primaryCTAEnabled: !isSubmitting,
                secondaryCTA: nil,
                isSubmitting: isSubmitting,
                dirty: dirty,
                showsProgressBar: true
            )
        case .details:
            let live = form.validate()
            let blocked = (errors != nil && !live.isEmpty && !statusNeedsRetry) || isSubmitting
            return WizardChrome(
                title: "Verify landlord",
                progressLabel: .stepOf(current: 2, total: 3),
                progressFraction: 2.0 / 3.0,
                leading: .back,
                primaryCTALabel: statusNeedsRetry ? "Retry status" : "Submit",
                primaryCTAEnabled: !blocked,
                secondaryCTA: nil,
                isSubmitting: isSubmitting,
                dirty: dirty,
                showsProgressBar: true
            )
        case .sent:
            return WizardChrome(
                title: "Verify landlord",
                progressLabel: .stepOf(current: 3, total: 3),
                progressFraction: 1.0,
                leading: .close,
                primaryCTALabel: statusNeedsRetry ? "Retry status" : "Done",
                primaryCTAEnabled: !isSubmitting,
                secondaryCTA: WizardSecondaryCTA(
                    label: "Review mail verification",
                    identifier: "verifyLandlordMailCodeCTA"
                ),
                isSubmitting: isSubmitting,
                dirty: false,
                showsProgressBar: true
            )
        }
    }

    var isSubmitting: Bool {
        if isLoadingStatus { return true }
        if case .submitting = submitState { return true }
        return false
    }

    func leadingTapped() {
        retirePendingWork()
        switch currentStep {
        case .start, .sent:
            pendingEvent = .dismiss
        case .details:
            currentStep = .start
            errors = nil
        }
    }

    func discardConfirmed() {
        retirePendingWork()
        pendingEvent = .dismiss
    }

    func retirePendingWork() {
        requestGeneration &+= 1
        pendingWork?.cancel()
        pendingWork = nil
        if isSubmitting { submitState = .idle }
        isLoadingStatus = false
    }

    // MARK: - Form mutations

    func setOwnerName(_ value: String) {
        form.ownerName = value
        refreshErrorsIfShown()
    }

    func setContactName(_ value: String) {
        form.contactName = value
        refreshErrorsIfShown()
    }

    func setEmail(_ value: String) {
        form.email = value
        refreshErrorsIfShown()
    }

    func setPhone(_ value: String) {
        form.phone = value
    }

    func setLease(_ lease: VerifyLandlordLeaseFile?) {
        form.lease = lease
        refreshErrorsIfShown()
    }

    func setPMEnabled(_ enabled: Bool) {
        form.pmEnabled = enabled
        if !enabled {
            form.pmName = ""
            form.pmEmail = ""
            form.pmPhone = ""
        }
        refreshErrorsIfShown()
    }

    func setPMName(_ value: String) {
        form.pmName = value
        refreshErrorsIfShown()
    }

    func setPMEmail(_ value: String) {
        form.pmEmail = value
        refreshErrorsIfShown()
    }

    func setPMPhone(_ value: String) {
        form.pmPhone = value
    }

    func setMoveInDate(_ value: String) {
        form.moveInDate = value
        refreshErrorsIfShown()
    }

    func setMessageToLandlord(_ value: String) {
        form.messageToLandlord = String(value.prefix(VerifyLandlordForm.messageMaxLength))
    }

    // MARK: - Submit

    func submit() async {
        guard isCurrentSession else { sessionChanged()
            return
        }
        guard currentStep == .details, !isSubmitting, !Task.isCancelled else { return }
        let generation = requestGeneration
        let live = form.validate()
        errors = live
        if !live.isEmpty {
            submitState = .error(message: "Fix \(live.count) thing\(live.count == 1 ? "" : "s") to submit")
            return
        }
        submitState = .submitting
        if !NetworkMonitor.shared.isOnline {
            submitState = .error(message: "You're offline. Try again when you're back online.")
            return
        }
        // Real submit: ask the home's verified landlord to approve the
        // tenancy. Everything the user typed travels with it — the
        // move-in date as `start_at`, and the note + landlord / PM
        // details folded into `message`.
        let result = await requestApproval(generation: generation)
        guard isCurrentSession else { sessionChanged()
            return
        }
        guard requestGeneration == generation, !Task.isCancelled else { return }
        switch result {
        case let .success(lease):
            approvalResult = VerifyLandlordApprovalResult(
                kind: .submitted,
                submittedAt: lease.createdAt,
                requestedStartAt: lease.startAt,
                message: lease.metadata?.message
            )
            submitState = .submitted
            currentStep = .sent
        case let .failure(error):
            await handleApprovalFailure(error)
        }
    }

    /// Only explicit lease/no-landlord responses establish these alternate states.
    private func handleApprovalFailure(_ error: any Error) async {
        guard let apiError = error as? APIError else {
            submitState = .error(message: "Couldn't send the request. Try again.")
            return
        }
        let message = apiError.errorDescription
        var status: Int?
        if case let .clientError(code, _) = apiError { status = code }
        let existingKind: VerifyLandlordApprovalResult.Kind? = switch message {
        case "You already have a pending request for this home": .alreadyPending
        case "You already have an active lease at this home": .alreadyActive
        default: nil
        }
        if status == 409, let existingKind {
            approvalResult = VerifyLandlordApprovalResult(
                kind: existingKind,
                serverMessage: message
            )
            submitState = .submitted
            currentStep = .sent
        } else if status == 400,
                  message == "This property has no verified landlord. Cannot submit a lease request." {
            await startPostcardFallback()
        } else {
            submitState = .error(
                message: message ?? "Couldn't send the request. Try again."
            )
        }
    }

    /// Opens address review without admitting a mail request. The postal
    /// screen owns confirmation, the protected original and failure recovery.
    func startPostcardFallback() async {
        guard isCurrentSession else { sessionChanged()
            return
        }
        pendingEvent = .openPostcardVerification(homeId: homeId)
        submitState = approvalResult == nil ? .idle : .submitted
    }

    /// Submits the tenant approval request. Uses the injected
    /// `approvalRequester` seam when present (previews/tests); otherwise
    /// calls `POST /api/v1/tenant/request-approval`.
    private func requestApproval(generation: Int) async -> Result<TenantLeaseDTO, any Error> {
        let request = TenantRequestApprovalRequest(
            homeId: homeId,
            startAt: form.startAtISO,
            message: form.composedMessage
        )
        do {
            if let approvalRequester {
                try await Task.sleep(nanoseconds: submitDelayNanos)
                try Task.checkCancellation()
                guard requestGeneration == generation, isCurrentSession else { throw CancellationError() }
                return await approvalRequester(request)
            }
            let status: TenantHomeStatusResponse = try await api.request(TenantEndpoints.homeStatus(homeId: homeId))
            let context = status.requestContext
            guard status.matches(homeId: homeId) else {
                return .failure(APIError.invalidResponse)
            }
            try Task.checkCancellation()
            guard requestGeneration == generation, isCurrentSession else { throw CancellationError() }
            let observedRequest = TenantRequestApprovalRequest(
                homeId: request.homeId,
                startAt: request.startAt,
                endAt: request.endAt,
                message: request.message,
                requestContext: context
            )
            let response: TenantRequestApprovalResponse = try await api.request(
                TenantEndpoints.requestApproval(observedRequest)
            )
            return .success(response.lease)
        } catch {
            return .failure(error)
        }
    }

    func acknowledgePendingEvent() {
        pendingEvent = nil
    }

    // MARK: - Variant switching

    // Used by previews / sample data toggles + the dashboard fast-track decision tree.

    func setVariant(_ variant: VerifyLandlordVariant) {
        guard variant != startContent.variant else { return }
        switch variant {
        case .canonical: startContent = VerifyLandlordSampleData.canonical
        case .fastTrack: startContent = VerifyLandlordSampleData.fastTrack
        }
    }

    // MARK: - Helpers

    /// Re-run validation only after the user has already attempted
    /// submit once — so we don't spray error chips while they're still
    /// typing the email.
    private func refreshErrorsIfShown() {
        guard errors != nil else { return }
        errors = form.validate()
    }
}

extension VerifyLandlordWizardViewModel {
    func primaryTapped() {
        guard isCurrentSession else { sessionChanged()
            return
        }
        guard !isSubmitting else { return }
        if statusNeedsRetry { resume()
            return
        }
        switch currentStep {
        case .start:
            currentStep = .details
        case .details:
            guard !isSubmitting else { return }
            pendingWork?.cancel()
            let generation = requestGeneration
            pendingWork = Task { [weak self] in
                guard let self, !Task.isCancelled, requestGeneration == generation else { return }
                await submit()
            }
        case .sent:
            retirePendingWork()
            pendingEvent = .dismiss
        }
    }

    func secondaryTapped() {
        // Only the `.sent` step carries a secondary — the mailed-code
        // fallback (RN's "Verify with a mailed code" alternative path).
        guard isCurrentSession else { sessionChanged()
            return
        }
        guard currentStep == .sent else { return }
        pendingWork?.cancel()
        let generation = requestGeneration
        pendingWork = Task { [weak self] in
            guard let self, !Task.isCancelled, requestGeneration == generation else { return }
            await startPostcardFallback()
        }
    }

    var isCurrentSession: Bool {
        sessionScope.isCurrent
    }

    func sessionChanged() {
        guard !isCurrentSession else { return }
        retirePendingWork()
        form = VerifyLandlordForm()
        approvalResult = nil
        errors = nil
        submitState = .idle
        currentStep = .start
        pendingEvent = .dismiss
    }

    /// Own the foreground read so backgrounding can retire it with other work.
    func resume() {
        guard isCurrentSession else { sessionChanged()
            return
        }
        guard !isSubmitting, pendingEvent == nil else { return }
        pendingWork?.cancel()
        let generation = requestGeneration
        pendingWork = Task { [weak self] in
            guard let self, !Task.isCancelled, requestGeneration == generation else { return }
            await restoreSavedRequest()
        }
    }

    /// Recover the actor's existing request without creating another request.
    func restoreSavedRequest() async {
        guard isCurrentSession else { sessionChanged()
            return
        }
        guard !isSubmitting, !Task.isCancelled else { return }
        let generation = requestGeneration
        isLoadingStatus = true
        defer { if requestGeneration == generation { isLoadingStatus = false } }
        do {
            let status: TenantHomeStatusResponse = try await api.request(TenantEndpoints.homeStatus(homeId: homeId))
            guard isCurrentSession else { sessionChanged()
                return
            }
            guard requestGeneration == generation, !Task.isCancelled else { return }
            guard status.matches(homeId: homeId), let saved = status.lease else { throw APIError.invalidResponse }
            if saved.state == .pending || saved.state == .active {
                guard let lease = saved.lease, lease.homeId == homeId,
                      lease.id == status.requestContext.leaseId, lease.state == saved.state,
                      lease.state.rawValue == status.requestContext.leaseState else { throw APIError.invalidResponse }
                approvalResult = VerifyLandlordApprovalResult(
                    kind: saved.state == .active ? .alreadyActive : .alreadyPending,
                    submittedAt: lease.createdAt,
                    requestedStartAt: lease.startAt,
                    message: lease.metadata?.message
                )
                currentStep = .sent
                submitState = .submitted
            } else {
                approvalResult = nil
                if currentStep != .details { currentStep = .start }
                submitState = .idle
            }
            statusNeedsRetry = false
        } catch {
            guard isCurrentSession else { sessionChanged()
                return
            }
            guard requestGeneration == generation, !Task.isCancelled else { return }
            statusNeedsRetry = true
            submitState = .error(message: "Couldn't check your saved request. Retry before continuing.")
        }
    }
}
