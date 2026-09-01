//
//  LogMaintenanceFormViewModel.swift
//  Pantopus
//
//  P2.9 — Backs the Log-maintenance / Edit-maintenance form. Posts to
//  `POST /api/homes/:id/maintenance` (or PUT for an edit) and — when a
//  next-due date is provided — also creates a calendar reminder via
//  `POST /api/homes/:id/events` so the household calendar surfaces the
//  upcoming task.
//
//  Field encoding notes
//  --------------------
//  The backend `HomeMaintenanceLog` schema today only stores: task,
//  vendor, cost, recurrence, due_date, status. The richer form
//  (performed-by category, notes, photos, receipt) is captured locally
//  via `MaintenanceDraftStore` so the detail screen can render the
//  2x2 photo grid + receipt thumbnail + notes block the design calls
//  for. When the backend grows columns, the form view-model + store
//  flip in one diff.
//

// swiftlint:disable file_length

import Foundation
import Observation
import SwiftUI

/// Outbound events from the form. The hosting nav-stack listens and
/// translates these into route mutations.
public enum LogMaintenanceFormEvent: Sendable, Equatable {
    case dismiss
    case created(taskId: String)
    case updated(taskId: String)
}

/// Whether the form is creating a new task or editing an existing one.
public enum LogMaintenanceFormMode: Sendable, Equatable {
    case create
    case edit(taskId: String)
}

@Observable
@MainActor
// swiftlint:disable:next type_body_length
final class LogMaintenanceFormViewModel {
    // MARK: - Form fields

    var category: MaintenanceCategory
    var title: String
    var dateCompleted: Date
    var performedBy: MaintenancePerformedBy
    var performerName: String
    var performerContact: String
    var costText: String
    var notes: String
    var photos: [MaintenanceDraftFile]
    var receipt: MaintenanceDraftFile?
    var nextDueEnabled: Bool
    var nextDueDate: Date
    var recurrence: MaintenanceRecurrence

    // MARK: - Submit state

    private(set) var isSubmitting: Bool = false
    private(set) var submitError: String?
    private(set) var pendingEvent: LogMaintenanceFormEvent?
    /// Whether the form has been touched relative to its initial pose.
    /// Drives the close-confirm sheet in `FormShell`.
    private(set) var isDirty: Bool = false
    /// `true` while the form is fetching the existing task in edit
    /// mode. Drives a shimmer overlay on the form body.
    private(set) var isLoadingExisting: Bool = false

    // MARK: - Dependencies

    private let homeId: String
    private let mode: LogMaintenanceFormMode
    private let api: APIClient
    private let draftStore: MaintenanceDraftStore
    private let now: @Sendable () -> Date
    private var initial: Snapshot

    /// Max photos the form accepts — matches the design's "up to 4".
    static let maxPhotos: Int = 4

    /// One photo slot index → file pair. The slot index lets the UI
    /// pre-render four placeholder tiles even on a fresh form.
    struct PhotoSlot: Hashable, Identifiable {
        let id: Int
        let file: MaintenanceDraftFile?
    }

    var photoSlots: [PhotoSlot] {
        (0..<Self.maxPhotos).map { idx in
            PhotoSlot(id: idx, file: idx < photos.count ? photos[idx] : nil)
        }
    }

    /// Title is required; everything else is optional. The submit
    /// button activates when the title has at least one non-whitespace
    /// character — mirrors the backend's `task` validation.
    var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !isSubmitting
    }

    /// Headline for the form shell — switches between Log and Edit.
    var screenTitle: String {
        switch mode {
        case .create: "Log maintenance"
        case .edit: "Edit maintenance"
        }
    }

    var submitLabel: String {
        switch mode {
        case .create: "Log"
        case .edit: "Save"
        }
    }

    private struct Snapshot: Equatable {
        let category: MaintenanceCategory
        let title: String
        let dateCompleted: Date
        let performedBy: MaintenancePerformedBy
        let performerName: String
        let performerContact: String
        let costText: String
        let notes: String
        let photos: [MaintenanceDraftFile]
        let receipt: MaintenanceDraftFile?
        let nextDueEnabled: Bool
        let nextDueDate: Date
        let recurrence: MaintenanceRecurrence
    }

    init(
        homeId: String,
        mode: LogMaintenanceFormMode = .create,
        existing: MaintenanceTaskDTO? = nil,
        api: APIClient = .shared,
        draftStore: MaintenanceDraftStore = .shared,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.mode = mode
        self.api = api
        self.draftStore = draftStore
        self.now = now

        // Compute the initial pose into a Snapshot first so the
        // stored-property assignments below can read from it without
        // tripping Swift's "self used before all stored properties
        // initialized" diagnostic.
        let snapshot = Self.makeInitialSnapshot(
            mode: mode,
            existing: existing,
            draftStore: draftStore,
            baseNow: now()
        )
        category = snapshot.category
        title = snapshot.title
        dateCompleted = snapshot.dateCompleted
        performedBy = snapshot.performedBy
        performerName = snapshot.performerName
        performerContact = snapshot.performerContact
        costText = snapshot.costText
        notes = snapshot.notes
        photos = snapshot.photos
        receipt = snapshot.receipt
        nextDueEnabled = snapshot.nextDueEnabled
        nextDueDate = snapshot.nextDueDate
        recurrence = snapshot.recurrence
        initial = snapshot
    }

    private static func makeInitialSnapshot(
        mode: LogMaintenanceFormMode,
        existing: MaintenanceTaskDTO?,
        draftStore: MaintenanceDraftStore,
        baseNow: Date
    ) -> Snapshot {
        let nextWeek = baseNow.addingTimeInterval(30 * 24 * 60 * 60)
        if case let .edit(taskId) = mode {
            let dto = existing
            let stored = draftStore.draft(for: taskId)
            let inferredCategory = MaintenanceCategory.from(task: dto?.task)
            let dueParsed: Date? = {
                guard let dueIso = dto?.dueDate else { return nil }
                return MaintenanceListViewModel.parseDate(dueIso)
            }()
            return Snapshot(
                category: stored?.category ?? inferredCategory,
                title: dto?.task ?? "",
                dateCompleted: Self.parsePerformedDate(dto: dto) ?? baseNow,
                performedBy: stored?.performedBy ?? Self.inferPerformedBy(vendor: dto?.vendor),
                performerName: stored?.performerName ?? (dto?.vendor ?? ""),
                performerContact: stored?.performerContact ?? "",
                costText: Self.format(cost: dto?.cost),
                notes: stored?.notes ?? "",
                photos: stored?.photos ?? [],
                receipt: stored?.receipt,
                nextDueEnabled: dueParsed != nil,
                nextDueDate: dueParsed ?? nextWeek,
                recurrence: MaintenanceRecurrence(raw: dto?.recurrence) ?? .none
            )
        } else {
            return Snapshot(
                category: .generic,
                title: "",
                dateCompleted: baseNow,
                performedBy: .self,
                performerName: "",
                performerContact: "",
                costText: "",
                notes: "",
                photos: [],
                receipt: nil,
                nextDueEnabled: false,
                nextDueDate: nextWeek,
                recurrence: .none
            )
        }
    }

    // MARK: - Async load (edit mode)

    /// Fetches the existing task and re-applies it to the form's
    /// fields. No-op for create mode. Idempotent — safe to call from
    /// `.task { … }` and `.refreshable { … }`.
    func loadIfNeeded() async {
        guard case let .edit(taskId) = mode else { return }
        // Only refresh when we don't already have content for this id.
        if !title.isEmpty && initial.title == title { return }
        isLoadingExisting = true
        defer { isLoadingExisting = false }
        do {
            let response: GetHomeMaintenanceResponse = try await api.request(
                HomesEndpoints.maintenance(homeId: homeId)
            )
            guard let dto = response.tasks.first(where: { $0.id == taskId }) else { return }
            apply(existing: dto, taskId: taskId)
        } catch {
            // Edit mode falls back to blank fields if the load fails;
            // the user can still re-enter and save (or close).
        }
    }

    private func apply(existing dto: MaintenanceTaskDTO, taskId: String) {
        let stored = draftStore.draft(for: taskId)
        let inferredCategory = MaintenanceCategory.from(task: dto.task)
        category = stored?.category ?? inferredCategory
        title = dto.task
        if let parsed = Self.parsePerformedDate(dto: dto) {
            dateCompleted = parsed
        }
        performedBy = stored?.performedBy ?? Self.inferPerformedBy(vendor: dto.vendor)
        performerName = stored?.performerName ?? (dto.vendor ?? "")
        performerContact = stored?.performerContact ?? ""
        costText = Self.format(cost: dto.cost)
        notes = stored?.notes ?? ""
        photos = stored?.photos ?? []
        receipt = stored?.receipt
        recurrence = MaintenanceRecurrence(raw: dto.recurrence) ?? .none
        if let dueIso = dto.dueDate, let parsedDue = MaintenanceListViewModel.parseDate(dueIso) {
            nextDueEnabled = true
            nextDueDate = parsedDue
        }
        initial = currentSnapshot()
        isDirty = false
    }

    // MARK: - Mutations

    func recomputeDirty() {
        isDirty = currentSnapshot() != initial
    }

    func addPhoto(_ file: MaintenanceDraftFile) {
        guard photos.count < Self.maxPhotos else { return }
        photos.append(file)
        recomputeDirty()
    }

    func removePhoto(id: UUID) {
        photos.removeAll { $0.id == id }
        recomputeDirty()
    }

    func pickReceipt(_ file: MaintenanceDraftFile?) {
        receipt = file
        recomputeDirty()
    }

    func consumeEvent() {
        pendingEvent = nil
    }

    func cancel() {
        pendingEvent = .dismiss
    }

    // MARK: - Submit

    func submit() async {
        guard canSubmit else { return }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }

        let trimmedTitle = title.trimmingCharacters(in: .whitespaces)
        let vendor = vendorEncoding()
        let parsedCost = Self.parseCost(costText)
        let dueIso = nextDueEnabled ? Self.isoDayString(from: nextDueDate) : nil

        do {
            let response: HomeMaintenanceResponse
            switch mode {
            case .create:
                let req = CreateMaintenanceRequest(
                    task: trimmedTitle,
                    vendor: vendor,
                    cost: parsedCost,
                    recurrence: recurrence.rawValue,
                    dueDate: dueIso,
                    status: "completed"
                )
                response = try await api.request(
                    HomesEndpoints.createMaintenance(homeId: homeId, request: req)
                )
            case let .edit(taskId):
                let req = UpdateMaintenanceRequest(
                    task: trimmedTitle,
                    vendor: vendor,
                    cost: parsedCost,
                    recurrence: recurrence.rawValue,
                    dueDate: dueIso,
                    status: nil // Don't reset status on edit.
                )
                response = try await api.request(
                    HomesEndpoints.updateMaintenance(homeId: homeId, taskId: taskId, request: req)
                )
            }

            let taskId = response.task.id
            persistExtras(for: taskId)

            // Best-effort calendar reminder. A failure here doesn't
            // block the maintenance log — the row is already saved.
            if nextDueEnabled {
                await postCalendarReminder(taskTitle: trimmedTitle, due: nextDueDate)
            }

            Analytics.track(.ctaLogMaintenanceSubmit(result: .success))
            switch mode {
            case .create:
                pendingEvent = .created(taskId: taskId)
            case .edit:
                pendingEvent = .updated(taskId: taskId)
            }
        } catch {
            Analytics.track(.ctaLogMaintenanceSubmit(result: .error))
            submitError = (error as? APIError)?.errorDescription
                ?? "Couldn't save this maintenance entry."
        }
    }

    /// Calendar reminder for the next-due date. Reuses the existing
    /// home-events endpoint that powers the Calendar tab — no new
    /// backend wiring needed. Failures are swallowed; the toast on the
    /// calendar tab will surface the missing event on next refresh if
    /// the network call ultimately failed.
    private func postCalendarReminder(taskTitle: String, due: Date) async {
        let startAtIso = Self.isoTimestampString(from: due)
        let req = CreateHomeEventRequest(
            eventType: "maintenance",
            title: taskTitle,
            startAt: startAtIso,
            description: "Maintenance reminder",
            endAt: nil,
            locationNotes: nil,
            recurrenceRule: nil,
            assignedTo: nil,
            alertsEnabled: true
        )
        do {
            let _: HomeEventResponse = try await api.request(
                HomesEndpoints.createHomeEvent(homeId: homeId, request: req)
            )
        } catch {
            // Intentionally swallowed — calendar reminder is best-effort.
        }
    }

    private func persistExtras(for taskId: String) {
        let draft = MaintenanceDraft(
            category: category,
            performedBy: performedBy,
            performerName: performerName.trimmingCharacters(in: .whitespaces),
            performerContact: performerContact.trimmingCharacters(in: .whitespaces),
            notes: notes.trimmingCharacters(in: .whitespaces),
            photos: photos,
            receipt: receipt
        )
        draftStore.upsert(draft, for: taskId)
    }

    private func vendorEncoding() -> String? {
        let trimmed = performerName.trimmingCharacters(in: .whitespaces)
        switch performedBy {
        case .self: return nil
        case .member, .contractor:
            return trimmed.isEmpty ? nil : trimmed
        }
    }

    private func currentSnapshot() -> Snapshot {
        Snapshot(
            category: category,
            title: title,
            dateCompleted: dateCompleted,
            performedBy: performedBy,
            performerName: performerName,
            performerContact: performerContact,
            costText: costText,
            notes: notes,
            photos: photos,
            receipt: receipt,
            nextDueEnabled: nextDueEnabled,
            nextDueDate: nextDueDate,
            recurrence: recurrence
        )
    }

    // MARK: - Formatters

    static func parseCost(_ text: String) -> Decimal? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
        if trimmed.isEmpty { return nil }
        return Decimal(string: trimmed)
    }

    static func format(cost: Decimal?) -> String {
        guard let cost else { return "" }
        let n = NSDecimalNumber(decimal: cost)
        if n.doubleValue.truncatingRemainder(dividingBy: 1) == 0 {
            return String(format: "%.0f", n.doubleValue)
        }
        return String(format: "%.2f", n.doubleValue)
    }

    static func isoDayString(from date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    static func isoTimestampString(from date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: date)
    }

    static func parsePerformedDate(dto: MaintenanceTaskDTO?) -> Date? {
        guard let iso = dto?.updatedAt ?? dto?.createdAt else { return nil }
        return MaintenanceListViewModel.parseDate(iso)
    }

    static func inferPerformedBy(vendor: String?) -> MaintenancePerformedBy {
        guard let vendor, !vendor.trimmingCharacters(in: .whitespaces).isEmpty else {
            return .self
        }
        return .contractor
    }
}

/// Repeat cadence — wraps the four backend-accepted recurrence strings
/// plus a `none` (one-time) value so the segmented control has a
/// clear "no recurrence" option.
public enum MaintenanceRecurrence: String, CaseIterable, Sendable, Hashable {
    case none = "one_time"
    case monthly
    case quarterly
    case yearly

    public init?(raw: String?) {
        guard let raw else { return nil }
        switch raw {
        case "one_time": self = .none
        case "monthly": self = .monthly
        case "quarterly": self = .quarterly
        case "yearly": self = .yearly
        default: return nil
        }
    }

    public var label: String {
        switch self {
        case .none: "None"
        case .monthly: "Monthly"
        case .quarterly: "Quarterly"
        case .yearly: "Yearly"
        }
    }
}
