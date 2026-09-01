//
//  VerifyLandlordWizardViewModel.swift
//  Pantopus
//
//  Drives the A12.5 / A12.6 wizard state machine:
//
//    .start → .details → submit ─┬─ 201  → .sent (landlord now has it)
//                                ├─ 409  → .sent (existing pending/active lease)
//                                └─ 400  → openPostcardVerification(homeId)
//
//  Submit posts a real tenant approval request to
//  `POST /api/v1/tenant/request-approval` (route
//  `backend/routes/landlordTenant.js:483`, mounted at `/api/v1` in
//  `backend/app.js:397`) carrying the move-in date + message the user
//  entered, with the landlord / PM details appended to the message
//  (`tenantRequestSchema` has no structured column for them). When the
//  home has no verified landlord authority the backend answers 400 —
//  that is RN's "no landlord on file" branch, and we fall back to the
//  mailed-code path: `POST /api/homes/:id/request-postcard` (route
//  `backend/routes/homeOwnership.js:2452`) followed by the outbound
//  `openPostcardVerification` event.
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

    /// Test/offline seam for the postcard request. When non-nil,
    /// `submit()` calls this instead of
    /// `POST /api/homes/:id/request-postcard`.
    typealias PostcardRequester = @MainActor () async -> Result<Void, any Error>
    private let postcardRequester: PostcardRequester?

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
        postcardRequester: PostcardRequester? = nil,
        approvalRequester: ApprovalRequester? = nil
    ) {
        self.homeId = homeId
        self.startContent = startContent
            ?? VerifyLandlordSampleData.startContent(for: homeId)
        self.form = form ?? VerifyLandlordSampleData.formSeed(for: homeId)
        self.api = api
        self.submitDelayNanos = submitDelayNanos
        self.postcardRequester = postcardRequester
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
                primaryCTALabel: "Start verification",
                primaryCTAEnabled: true,
                secondaryCTA: nil,
                isSubmitting: false,
                dirty: dirty,
                showsProgressBar: true
            )
        case .details:
            let live = form.validate()
            let blocked = (errors != nil && !live.isEmpty) || isSubmitting
            return WizardChrome(
                title: "Verify landlord",
                progressLabel: .stepOf(current: 2, total: 3),
                progressFraction: 2.0 / 3.0,
                leading: .back,
                primaryCTALabel: "Submit",
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
                primaryCTALabel: "Done",
                primaryCTAEnabled: !isSubmitting,
                secondaryCTA: WizardSecondaryCTA(
                    label: "Mail me a code",
                    identifier: "verifyLandlordMailCodeCTA"
                ),
                isSubmitting: isSubmitting,
                dirty: false,
                showsProgressBar: true
            )
        }
    }

    var isSubmitting: Bool {
        if case .submitting = submitState { return true }
        return false
    }

    func leadingTapped() {
        switch currentStep {
        case .start, .sent:
            pendingEvent = .dismiss
        case .details:
            currentStep = .start
            errors = nil
        }
    }

    func discardConfirmed() {
        pendingEvent = .dismiss
    }

    func primaryTapped() {
        switch currentStep {
        case .start:
            currentStep = .details
        case .details:
            Task { await submit() }
        case .sent:
            pendingEvent = .dismiss
        }
    }

    func secondaryTapped() {
        // Only the `.sent` step carries a secondary — the mailed-code
        // fallback (RN's "Verify with a mailed code" alternative path).
        guard currentStep == .sent else { return }
        Task { await startPostcardFallback() }
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
        if isSubmitting { return }
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
        switch await requestApproval() {
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

    /// Branches the `request-approval` non-2xx answers into the states
    /// we can observe without a tenant status endpoint.
    private func handleApprovalFailure(_ error: any Error) async {
        guard let apiError = error as? APIError else {
            submitState = .error(message: "Couldn't send the request. Try again.")
            return
        }
        let message = apiError.errorDescription
        var status: Int?
        if case let .clientError(code, _) = apiError { status = code }
        if case .notFound = apiError { status = 404 }

        switch status {
        case 409:
            // Duplicate request — the server just told us the real
            // state, so render it instead of failing the wizard.
            let isActive = message?.localizedCaseInsensitiveContains("active lease") == true
            approvalResult = VerifyLandlordApprovalResult(
                kind: isActive ? .alreadyActive : .alreadyPending,
                serverMessage: message
            )
            submitState = .submitted
            currentStep = .sent
        case 400, 404:
            // "This property has no verified landlord…" — RN's
            // no-landlord branch. Fall back to the mailed-code path so
            // the tenant still has a way through.
            await startPostcardFallback()
        default:
            submitState = .error(
                message: message ?? "Couldn't send the request. Try again."
            )
        }
    }

    /// Mails the verification postcard and hands the user off to the
    /// A12.7 tracker. Used both as the no-landlord fallback and as the
    /// `.sent` step's secondary CTA.
    func startPostcardFallback() async {
        submitState = .submitting
        switch await requestPostcard() {
        case .success:
            submitState = .submitted
            pendingEvent = .openPostcardVerification(homeId: homeId)
        case let .failure(error):
            // A pending/duplicate code (400) or address cap (429) means a
            // postcard is already on its way — proceed to enter it. Other
            // failures surface inline so the user can retry.
            if case let .clientError(status, _) = (error as? APIError), status == 400 || status == 429 {
                submitState = .submitted
                pendingEvent = .openPostcardVerification(homeId: homeId)
            } else {
                submitState = .error(
                    message: (error as? APIError)?.errorDescription
                        ?? "Couldn't request the verification postcard. Try again."
                )
            }
        }
    }

    /// Submits the tenant approval request. Uses the injected
    /// `approvalRequester` seam when present (previews/tests); otherwise
    /// calls `POST /api/v1/tenant/request-approval`.
    private func requestApproval() async -> Result<TenantLeaseDTO, any Error> {
        let request = TenantRequestApprovalRequest(
            homeId: homeId,
            startAt: form.startAtISO,
            message: form.composedMessage
        )
        if let approvalRequester {
            try? await Task.sleep(nanoseconds: submitDelayNanos)
            return await approvalRequester(request)
        }
        do {
            let response: TenantRequestApprovalResponse = try await api.request(
                TenantEndpoints.requestApproval(request)
            )
            return .success(response.lease)
        } catch {
            return .failure(error)
        }
    }

    /// Mails the verification postcard. Uses the injected
    /// `postcardRequester` seam when present (previews/tests); otherwise
    /// calls `POST /api/homes/:id/request-postcard`.
    private func requestPostcard() async -> Result<Void, any Error> {
        if let postcardRequester {
            try? await Task.sleep(nanoseconds: submitDelayNanos)
            return await postcardRequester()
        }
        do {
            _ = try await api.request(
                HomesEndpoints.requestPostcard(homeId: homeId),
                as: RequestPostcardResponse.self
            )
            return .success(())
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
