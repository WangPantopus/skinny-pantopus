//
//  AddBillWizardViewModel.swift
//  Pantopus
//
//  3-step Wizard for `POST /api/homes/:id/bills` (route
//  `backend/routes/home.js:4539`) and the matching
//  `PUT /api/homes/:id/bills/:billId` (route `backend/routes/home.js:4585`)
//  when opened in edit mode.
//
//   1. Payee + amount + due date
//   2. Schedule (one-time / recurring monthly) — stored in `details.schedule`
//   3. Review & confirm — POSTs (create) or PUTs (edit) the bill
//
//  Backend caveat: there is no POST/PATCH for `:billId/splits` today, so
//  the design's "Split between household members" step is not modelled
//  here. That decision is tracked in the parity audit and surfaces in
//  the wizard as a note on the review step.
//
//  Edit mode: when initialised with a `billId`, the VM fetches the
//  parent list (no GET-by-id endpoint today), seeds every step from
//  the matching row, retitles the primary CTA to "Save changes", and
//  routes submit through `PUT` instead of `POST`.
//

import Foundation
import Observation

/// Step identifiers for the Add Bill wizard.
public enum AddBillStep: String, Sendable, CaseIterable {
    case details
    case schedule
    case review
    case success
}

/// Recurrence options exposed on step 2.
public enum AddBillSchedule: String, Sendable, CaseIterable, Identifiable {
    case oneTime
    case monthly
    case quarterly
    case yearly

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .oneTime: "One-time"
        case .monthly: "Recurring monthly"
        case .quarterly: "Recurring quarterly"
        case .yearly: "Recurring yearly"
        }
    }

    public var detailsKey: String {
        switch self {
        case .oneTime: "one_time"
        case .monthly: "monthly"
        case .quarterly: "quarterly"
        case .yearly: "yearly"
        }
    }

    /// Map a `details.schedule` (or `details.frequency`) string back to
    /// the enum so the wizard can re-hydrate from a fetched bill. Falls
    /// back to `.oneTime` for unknown / empty values.
    public static func from(detailsKey raw: String?) -> AddBillSchedule {
        switch raw {
        case "monthly": .monthly
        case "quarterly": .quarterly
        case "yearly": .yearly
        default: .oneTime
        }
    }
}

/// Outbound events the wizard view must react to.
public enum AddBillOutboundEvent: Sendable, Equatable {
    case dismiss
    case created(billId: String)
    case updated(billId: String)
}

@Observable
@MainActor
final class AddBillWizardViewModel: WizardModel {
    // Step 1 fields
    var payee: String = ""
    var amount: String = ""
    var dueDate: Date?

    /// Step 2 fields
    var schedule: AddBillSchedule = .oneTime

    // Lifecycle
    private(set) var currentStep: AddBillStep = .details
    private(set) var isSubmitting: Bool = false
    private(set) var submitError: String?
    private(set) var createdBillId: String?
    /// `true` while the wizard is hydrating an existing bill in edit
    /// mode. The shell renders the form chrome with disabled inputs
    /// underneath; the VM keeps the CTA off until hydration lands.
    private(set) var isLoadingExisting: Bool = false
    /// Surface for the rare case the parent list 404s the row — the
    /// review step renders this instead of the normal submit error.
    private(set) var loadError: String?
    var pendingEvent: AddBillOutboundEvent?

    private let homeId: String
    /// Non-nil ⇒ edit mode. Drives every behaviour fork (load on init,
    /// PUT instead of POST, "Save changes" CTA, updated event).
    let billId: String?
    private let api: APIClient
    /// Snapshot of the hydrated values. Used to detect dirtiness in
    /// edit mode so a clean re-open doesn't show the discard sheet.
    private var hydratedSnapshot: Snapshot?

    private struct Snapshot: Equatable {
        let payee: String
        let amount: String
        let dueDate: Date?
        let schedule: AddBillSchedule
    }

    var isEditing: Bool {
        billId != nil
    }

    init(homeId: String, billId: String? = nil, api: APIClient = .shared) {
        self.homeId = homeId
        self.billId = billId
        self.api = api
        if billId != nil {
            // Lift the loading flag immediately so the first chrome
            // snapshot reflects the spinner state — `load()` is fired
            // by the view's `.task { … }` block.
            isLoadingExisting = true
        }
    }

    // MARK: - Lifecycle

    /// Hydrate the wizard from an existing bill. No-op in create mode.
    func load() async {
        guard let billId else { return }
        isLoadingExisting = true
        loadError = nil
        defer { isLoadingExisting = false }
        do {
            let response: GetHomeBillsResponse = try await api.request(
                HomesEndpoints.bills(homeId: homeId)
            )
            guard let bill = response.bills.first(where: { $0.id == billId }) else {
                loadError = "This bill is no longer available."
                return
            }
            apply(existing: bill)
        } catch {
            loadError = (error as? APIError)?.errorDescription
                ?? "Couldn't load this bill."
        }
    }

    /// Seed every field from a fetched bill and record the snapshot so
    /// `isDirty` flips back to false when nothing has been touched.
    private func apply(existing bill: BillDTO) {
        payee = bill.providerName ?? ""
        amount = Self.formatAmountForEditing(bill.displayAmount)
        dueDate = bill.dueDate.flatMap(BillsListViewModel.parseDate)
        // `details.schedule` is the canonical key the wizard writes on
        // create. Older rows may have only `details.frequency`, so try
        // that as a fallback — both round-trip through the same enum.
        let scheduleKey = bill.details?["schedule"] ?? bill.details?["frequency"]
        schedule = AddBillSchedule.from(detailsKey: scheduleKey)
        hydratedSnapshot = Snapshot(
            payee: payee,
            amount: amount,
            dueDate: dueDate,
            schedule: schedule
        )
    }

    // MARK: - WizardModel

    var chrome: WizardChrome {
        let creating = !isEditing
        switch currentStep {
        case .details:
            return WizardChrome(
                title: isEditing ? "Edit bill" : "Add a bill",
                progressLabel: .stepOf(current: 1, total: 3),
                progressFraction: 1.0 / 3.0,
                leading: .close,
                primaryCTALabel: "Next",
                primaryCTAEnabled: detailsValid && !isLoadingExisting,
                isSubmitting: false,
                dirty: isDirty,
                showsProgressBar: true
            )
        case .schedule:
            return WizardChrome(
                title: "Schedule",
                progressLabel: .stepOf(current: 2, total: 3),
                progressFraction: 2.0 / 3.0,
                leading: .back,
                primaryCTALabel: "Next",
                primaryCTAEnabled: true,
                isSubmitting: false,
                dirty: isDirty,
                showsProgressBar: true
            )
        case .review:
            return WizardChrome(
                title: "Review",
                progressLabel: .stepOf(current: 3, total: 3),
                progressFraction: 3.0 / 3.0,
                leading: .back,
                primaryCTALabel: creating ? "Add bill" : "Save changes",
                primaryCTAEnabled: !isSubmitting,
                isSubmitting: isSubmitting,
                dirty: isDirty,
                showsProgressBar: true
            )
        case .success:
            return WizardChrome(
                title: creating ? "Bill added" : "Bill updated",
                progressLabel: .hidden,
                progressFraction: nil,
                leading: .close,
                primaryCTALabel: "Done",
                primaryCTAEnabled: true,
                secondaryCTA: nil,
                isSubmitting: false,
                dirty: false,
                showsProgressBar: false
            )
        }
    }

    func leadingTapped() {
        switch currentStep {
        case .details:
            pendingEvent = .dismiss
        case .schedule:
            currentStep = .details
        case .review:
            currentStep = .schedule
        case .success:
            pendingEvent = .dismiss
        }
    }

    func discardConfirmed() {
        pendingEvent = .dismiss
    }

    func primaryTapped() {
        switch currentStep {
        case .details:
            currentStep = .schedule
            Analytics.track(.screenAddBillWizardStepViewed(stepNumber: 2, stepName: "schedule"))
        case .schedule:
            currentStep = .review
            Analytics.track(.screenAddBillWizardStepViewed(stepNumber: 3, stepName: "review"))
        case .review:
            Task { await submit() }
        case .success:
            if isEditing, let id = billId {
                pendingEvent = .updated(billId: id)
            } else if let id = createdBillId {
                pendingEvent = .created(billId: id)
            } else {
                pendingEvent = .dismiss
            }
        }
    }

    // MARK: - Validation

    var detailsValid: Bool {
        !payee.trimmingCharacters(in: .whitespaces).isEmpty
            && parsedAmount() != nil
    }

    var isDirty: Bool {
        if let snapshot = hydratedSnapshot {
            return payee != snapshot.payee
                || amount != snapshot.amount
                || dueDate != snapshot.dueDate
                || schedule != snapshot.schedule
        }
        return !payee.trimmingCharacters(in: .whitespaces).isEmpty
            || !amount.trimmingCharacters(in: .whitespaces).isEmpty
            || dueDate != nil
            || schedule != .oneTime
    }

    func parsedAmount() -> Decimal? {
        let trimmed = amount.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty,
              let value = Decimal(string: trimmed),
              value > 0
        else {
            return nil
        }
        return value
    }

    // MARK: - Submit

    func submit() async {
        guard let amountValue = parsedAmount(), !isSubmitting else { return }
        if !NetworkMonitor.shared.isOnline {
            submitError = "You're offline. Try again when you're back online."
            return
        }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }

        do {
            let response: HomeBillResponse
            let details = Self.buildDetails(schedule: schedule)
            if let billId {
                let request = UpdateBillRequest(
                    amount: amountValue,
                    providerName: payee.trimmingCharacters(in: .whitespaces),
                    dueDate: dueDate.map(Self.formatISODate),
                    details: details
                )
                response = try await api.request(
                    HomesEndpoints.updateBill(homeId: homeId, billId: billId, request: request)
                )
                Analytics.track(.ctaAddBillSubmit(result: .success))
            } else {
                let request = CreateBillRequest(
                    billType: "other",
                    providerName: payee.trimmingCharacters(in: .whitespaces),
                    amount: amountValue,
                    dueDate: dueDate.map(Self.formatISODate),
                    details: details
                )
                response = try await api.request(
                    HomesEndpoints.createBill(homeId: homeId, request: request)
                )
                createdBillId = response.bill.id
                Analytics.track(.ctaAddBillSubmit(result: .success))
            }
            currentStep = .success
        } catch {
            submitError = (error as? APIError)?.errorDescription
                ?? (isEditing ? "Couldn't save these changes." : "Couldn't add this bill.")
            Analytics.track(.ctaAddBillSubmit(result: .error))
        }
    }

    /// Compose the `details` JSONB bag for create + update payloads.
    /// `schedule` is the canonical key; `frequency` is mirrored for
    /// recurring options so older readers that only look at the
    /// legacy key continue to work.
    private static func buildDetails(schedule: AddBillSchedule) -> [String: String] {
        var details: [String: String] = ["schedule": schedule.detailsKey]
        if schedule != .oneTime {
            details["frequency"] = schedule.detailsKey
        }
        return details
    }

    /// `yyyy-MM-dd` formatter built per-call so we don't have to manage a
    /// static `DateFormatter` under Swift 6 strict concurrency.
    private static func formatISODate(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    /// Format a fetched bill's amount as the bare decimal string the
    /// text field accepts (`"142.80"`, not `"$142.80"`). Drops trailing
    /// zeros and the locale grouping separator so the user sees the
    /// canonical input form they can edit in place.
    private static func formatAmountForEditing(_ amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = false
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter.string(from: amount as NSDecimalNumber) ?? "\(amount)"
    }
}
