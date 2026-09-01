//
//  ManageTrainOrganizerActions.swift
//  Pantopus
//
//  S1 — the organizer management half of A13.13 that native was missing:
//  lifecycle (pause / resume / unpublish / archive / delete), the
//  co-organizer roster, per-slot add / edit / cancel, the open-slots
//  nudge, the gift-fund switch, and the per-reservation organizer
//  actions (share exact address, confirm delivery, remove from slot).
//
//  Every affordance is gated on the viewer's organizer tier as the
//  backend defines it (`backend/middleware/supportTrainPermissions.js:51`)
//  so no one sees a button the server will 403.
//

// swiftlint:disable file_length

import Foundation

// MARK: - Row models

/// One helper reservation on the Manage roster.
public struct ManageHelperRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let slotLabel: String
    public let contribution: String
    public let status: String
    public let isGuest: Bool
    public let exactAddressShared: Bool

    public init(
        id: String,
        name: String,
        slotLabel: String,
        contribution: String,
        status: String,
        isGuest: Bool,
        exactAddressShared: Bool
    ) {
        self.id = id
        self.name = name
        self.slotLabel = slotLabel
        self.contribution = contribution
        self.status = status
        self.isGuest = isGuest
        self.exactAddressShared = exactAddressShared
    }

    /// Only `reserved` signups can be pulled off a slot
    /// (`backend/routes/supportTrains.js:3013`).
    public var canRemove: Bool {
        status == "reserved"
    }

    /// `POST …/confirm` requires the reservation to be `delivered`
    /// (`backend/routes/supportTrains.js:3255`).
    public var canConfirm: Bool {
        status == "delivered"
    }

    /// The reveal route 409s on canceled reservations
    /// (`backend/routes/supportTrains.js:2800`).
    public var canShareAddress: Bool {
        status != "canceled" && !exactAddressShared
    }
}

/// One editable date on the Manage screen.
public struct ManageSlotRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let dateLabel: String
    public let metaLabel: String
    public let badge: String
    public let slotDate: String
    public let slotLabel: String
    public let supportMode: String
    public let startTime: String?
    public let endTime: String?
    public let filledCount: Int
    public let status: String

    public init(
        id: String,
        dateLabel: String,
        metaLabel: String,
        badge: String,
        slotDate: String,
        slotLabel: String,
        supportMode: String,
        startTime: String?,
        endTime: String?,
        filledCount: Int,
        status: String
    ) {
        self.id = id
        self.dateLabel = dateLabel
        self.metaLabel = metaLabel
        self.badge = badge
        self.slotDate = slotDate
        self.slotLabel = slotLabel
        self.supportMode = supportMode
        self.startTime = startTime
        self.endTime = endTime
        self.filledCount = filledCount
        self.status = status
    }

    /// The backend refuses to move or cancel a slot that already has an
    /// active reservation (`backend/routes/supportTrains.js:1005`), so the
    /// affordances hide instead of failing. Mirrors RN's
    /// `canManageSlotDate` (`support-trains/[id]/manage.tsx:867`).
    public var isEditable: Bool {
        status == "open" && filledCount == 0
    }
}

/// One co-organizer row.
public struct ManageOrganizerRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let userId: String?
    public let name: String
    public let role: String
    public let isPrimary: Bool

    public init(id: String, userId: String?, name: String, role: String, isPrimary: Bool) {
        self.id = id
        self.userId = userId
        self.name = name
        self.role = role
        self.isPrimary = isPrimary
    }
}

/// Add / edit state for the slot editor sheet.
public struct ManageSlotEditorState: Sendable, Hashable, Identifiable {
    public let slotId: String?
    public var slotDate: Date
    public var slotLabel: String
    public var supportMode: String
    public var startTime: Date
    public var endTime: Date

    public init(
        slotId: String?,
        slotDate: Date,
        slotLabel: String,
        supportMode: String,
        startTime: Date,
        endTime: Date
    ) {
        self.slotId = slotId
        self.slotDate = slotDate
        self.slotLabel = slotLabel
        self.supportMode = supportMode
        self.startTime = startTime
        self.endTime = endTime
    }

    public var id: String {
        slotId ?? "new-slot"
    }

    public var isEditing: Bool {
        slotId != nil
    }

    /// `slot_label` enum from `customSlotSchema`
    /// (`backend/routes/supportTrains.js:405`).
    public static let labels = ["Breakfast", "Lunch", "Dinner", "Groceries", "Custom"]
    /// `support_mode` enum from the same schema.
    public static let modes = ["meal", "takeout", "groceries"]
}

/// A destructive organizer action awaiting confirmation.
public struct ManageDestructiveConfirm: Sendable, Hashable, Identifiable {
    public enum Kind: Sendable, Hashable {
        case unpublishTrain
        case archiveTrain
        case deleteTrain
        case cancelSlot(slotId: String)
        case removeOrganizer(userId: String)
        case removeHelper(reservationId: String)
        case disableFund
    }

    public let kind: Kind
    public let title: String
    public let message: String
    public let confirmLabel: String

    public init(kind: Kind, title: String, message: String, confirmLabel: String) {
        self.kind = kind
        self.title = title
        self.message = message
        self.confirmLabel = confirmLabel
    }

    public var id: String {
        "\(kind)"
    }
}

// MARK: - Actions

public extension ManageTrainViewModel {
    /// Fan-out for the organizer-only feeds. Failures degrade to empty
    /// sections instead of blowing up the whole screen.
    internal func loadOrganizerSurfaces() async {
        let reservations = try? await api.request(
            SupportTrainsEndpoints.reservations(supportTrainId: supportTrainId),
            as: SupportTrainReservationsResponse.self
        )
        let organizers = try? await api.request(
            SupportTrainActionsEndpoints.organizers(supportTrainId: supportTrainId),
            as: SupportTrainOrganizersResponse.self
        )
        let fundSummary = try? await api.request(
            SupportTrainActionsEndpoints.fund(supportTrainId: supportTrainId),
            as: SupportTrainFundDTO.self
        )
        replaceOrganizerSurfaces(
            helpers: Self.helperRows(reservations?.reservations ?? [], slots: slotRows),
            organizers: Self.organizerRows(organizers?.organizers ?? []),
            fund: fundSummary
        )
    }

    // MARK: Lifecycle

    func pauseTrain() async {
        await run(
            SupportTrainActionsEndpoints.pause(supportTrainId: supportTrainId),
            success: "Train paused",
            failure: "Couldn't pause this train."
        )
    }

    func resumeTrain() async {
        await run(
            SupportTrainActionsEndpoints.resume(supportTrainId: supportTrainId),
            success: "Train resumed",
            failure: "Couldn't resume this train."
        )
    }

    func unpublishTrain() async {
        await run(
            SupportTrainActionsEndpoints.unpublish(supportTrainId: supportTrainId),
            success: "Back to draft",
            failure: "Couldn't unpublish this train."
        )
    }

    func archiveTrain() async {
        await run(
            SupportTrainActionsEndpoints.archive(supportTrainId: supportTrainId),
            success: "Train archived",
            failure: "Couldn't archive this train."
        )
    }

    /// `DELETE /:id`. Primary only; the backend 409s once helpers have
    /// committed or contributions exist, and that message is surfaced
    /// verbatim.
    func deleteTrain() async {
        guard !isSubmitting else { return }
        setSubmitting(true)
        defer { setSubmitting(false) }
        do {
            _ = try await api.request(
                SupportTrainActionsEndpoints.deleteTrain(supportTrainId: supportTrainId),
                as: EmptyResponse.self
            )
            markDeleted()
            toast = "Support train deleted"
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? "Couldn't delete this train."
        }
    }

    // MARK: Co-organizers

    func addOrganizer() async {
        let userId = newOrganizerUserId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !userId.isEmpty else { return }
        newOrganizerUserId = ""
        await run(
            SupportTrainActionsEndpoints.addOrganizer(
                supportTrainId: supportTrainId,
                body: AddSupportTrainOrganizerBody(userId: userId)
            ),
            success: "Co-organizer added",
            failure: "Couldn't add that co-organizer."
        )
    }

    func removeOrganizer(userId: String) async {
        await run(
            SupportTrainActionsEndpoints.removeOrganizer(
                supportTrainId: supportTrainId,
                userId: userId
            ),
            success: "Co-organizer removed",
            failure: "Couldn't remove that co-organizer."
        )
    }

    // MARK: Slots

    func startAddSlot() {
        slotEditor = ManageSlotEditorState(
            slotId: nil,
            slotDate: Date().addingTimeInterval(86400),
            slotLabel: "Dinner",
            supportMode: "meal",
            startTime: Self.defaultClock(hour: 17),
            endTime: Self.defaultClock(hour: 19)
        )
    }

    func startEditSlot(_ row: ManageSlotRow) {
        slotEditor = ManageSlotEditorState(
            slotId: row.id,
            slotDate: Self.slotDate(from: row.slotDate) ?? Date(),
            slotLabel: row.slotLabel,
            supportMode: row.supportMode,
            startTime: Self.clock(from: row.startTime) ?? Self.defaultClock(hour: 17),
            endTime: Self.clock(from: row.endTime) ?? Self.defaultClock(hour: 19)
        )
    }

    func dismissSlotEditor() {
        slotEditor = nil
    }

    /// `POST /:id/slots` when adding, `PATCH /:id/slots/:slotId` when
    /// editing. Times are sent as `HH:mm` per both Joi schemas.
    func saveSlot(_ editor: ManageSlotEditorState) async {
        slotEditor = nil
        let date = Self.isoDateString(editor.slotDate)
        let start = Self.clockString(editor.startTime)
        let end = Self.clockString(editor.endTime)
        if let slotId = editor.slotId {
            await run(
                SupportTrainActionsEndpoints.updateSlot(
                    supportTrainId: supportTrainId,
                    slotId: slotId,
                    body: UpdateSupportTrainSlotBody(
                        slotLabel: editor.slotLabel,
                        supportMode: editor.supportMode,
                        slotDate: date,
                        startTime: start,
                        endTime: end
                    )
                ),
                success: "Date updated",
                failure: "Couldn't update that date."
            )
        } else {
            await run(
                SupportTrainsEndpoints.addSlot(
                    supportTrainId: supportTrainId,
                    body: AddSupportTrainSlotBody(
                        slotDate: date,
                        slotLabel: editor.slotLabel,
                        supportMode: editor.supportMode,
                        startTime: start,
                        endTime: end
                    )
                ),
                success: "Date added",
                failure: "Couldn't add that date."
            )
        }
    }

    /// Removing a date is `PATCH … { status: "canceled" }` — the same
    /// call RN makes (`support-trains/[id]/manage.tsx:302`).
    func cancelSlot(slotId: String) async {
        await run(
            SupportTrainActionsEndpoints.updateSlot(
                supportTrainId: supportTrainId,
                slotId: slotId,
                body: UpdateSupportTrainSlotBody(status: "canceled")
            ),
            success: "Date removed",
            failure: "Couldn't remove that date."
        )
    }

    // MARK: Helper roster

    /// Organizer-side cancel — sends `organizer_reason` so the helper
    /// gets the "why" in their notification.
    func removeHelper(reservationId: String, reason: String?) async {
        let trimmed = reason?.trimmingCharacters(in: .whitespacesAndNewlines)
        await run(
            SupportTrainActionsEndpoints.cancelReservation(
                supportTrainId: supportTrainId,
                reservationId: reservationId,
                body: CancelReservationBody(
                    organizerReason: (trimmed?.isEmpty ?? true) ? nil : trimmed
                )
            ),
            success: "Slot reopened",
            failure: "Couldn't remove that helper."
        )
    }

    /// Share the exact address with one helper (or email a guest signup).
    /// The address itself never comes back in this response — the reload
    /// re-runs the server-side privacy gate.
    func shareExactAddress(reservationId: String) async {
        await run(
            SupportTrainActionsEndpoints.revealAddress(
                supportTrainId: supportTrainId,
                reservationId: reservationId
            ),
            success: "Exact location shared",
            failure: "Couldn't share the exact location."
        )
    }

    func confirmDelivery(reservationId: String) async {
        await run(
            SupportTrainActionsEndpoints.confirmDelivery(
                supportTrainId: supportTrainId,
                reservationId: reservationId
            ),
            success: "Delivery confirmed",
            failure: "Couldn't confirm that delivery."
        )
    }

    // MARK: Nudge

    func draftNudge() async {
        guard !isSubmitting else { return }
        setSubmitting(true)
        defer { setSubmitting(false) }
        do {
            let response: SupportTrainNudgeDraftResponse = try await api.request(
                SupportTrainActionsEndpoints.draftNudge(supportTrainId: supportTrainId)
            )
            nudgeDraft = response.message ?? ""
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? "Couldn't draft a reminder."
        }
    }

    func sendNudge() async {
        let message = (nudgeDraft ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, !isSubmitting else { return }
        setSubmitting(true)
        defer { setSubmitting(false) }
        do {
            _ = try await api.request(
                SupportTrainActionsEndpoints.sendNudge(
                    supportTrainId: supportTrainId,
                    body: SupportTrainNudgeBody(message: message)
                ),
                as: EmptyResponse.self
            )
            nudgeDraft = nil
            toast = "Reminder posted to the campaign chat"
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? "Couldn't send that reminder."
        }
    }

    func discardNudge() {
        nudgeDraft = nil
    }

    // MARK: Gift fund

    func enableFund(goalDollars: Int?) async {
        let goalCents = goalDollars.map { $0 * 100 }
        await run(
            SupportTrainActionsEndpoints.enableFund(
                supportTrainId: supportTrainId,
                body: EnableSupportTrainFundBody(goalAmount: goalCents)
            ),
            success: "Gift fund enabled",
            failure: "Couldn't enable the gift fund."
        )
    }

    func disableFund() async {
        await run(
            SupportTrainActionsEndpoints.disableFund(supportTrainId: supportTrainId),
            success: "Gift fund disabled",
            failure: "Couldn't disable the gift fund."
        )
    }

    // MARK: Confirms

    func requestConfirm(_ confirm: ManageDestructiveConfirm) {
        pendingConfirm = confirm
    }

    func dismissConfirm() {
        pendingConfirm = nil
    }

    /// Run one confirmed destructive action. The view passes the `kind`
    /// captured at tap time — SwiftUI clears `pendingConfirm` through the
    /// alert binding before the task starts.
    func perform(_ kind: ManageDestructiveConfirm.Kind) async {
        pendingConfirm = nil
        switch kind {
        case .unpublishTrain: await unpublishTrain()
        case .archiveTrain: await archiveTrain()
        case .deleteTrain: await deleteTrain()
        case let .cancelSlot(slotId): await cancelSlot(slotId: slotId)
        case let .removeOrganizer(userId): await removeOrganizer(userId: userId)
        case let .removeHelper(reservationId): await removeHelper(reservationId: reservationId, reason: nil)
        case .disableFund: await disableFund()
        }
    }

    func acknowledgeActionError() {
        actionError = nil
    }

    // MARK: - Plumbing

    private func run(_ endpoint: Endpoint, success: String, failure: String) async {
        guard !isSubmitting else { return }
        setSubmitting(true)
        defer { setSubmitting(false) }
        do {
            _ = try await api.request(endpoint, as: EmptyResponse.self)
            await load()
            toast = success
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? failure
        }
    }

    // MARK: - Projection helpers

    internal nonisolated static func helperRows(
        _ reservations: [SupportTrainReservationDTO],
        slots: [ManageSlotRow]
    ) -> [ManageHelperRow] {
        let slotById = Dictionary(uniqueKeysWithValues: slots.map { ($0.id, $0) })
        return reservations.map { reservation in
            let slot = reservation.slotId.flatMap { slotById[$0] }
            let contribution = [reservation.contributionMode?.capitalized, reservation.dishTitle]
                .compactMap { $0 }
                .filter { !$0.isEmpty }
                .joined(separator: " · ")
            return ManageHelperRow(
                id: reservation.id,
                name: reservation.displayName,
                slotLabel: slot.map { "\($0.slotLabel) · \($0.dateLabel)" } ?? "",
                contribution: contribution,
                status: reservation.status ?? "reserved",
                isGuest: reservation.isGuestSignup,
                exactAddressShared: reservation.exactAddressShared ?? false
            )
        }
    }

    internal nonisolated static func organizerRows(
        _ organizers: [SupportTrainOrganizerRowDTO]
    ) -> [ManageOrganizerRow] {
        organizers.map { organizer in
            ManageOrganizerRow(
                id: organizer.id,
                userId: organizer.userId ?? organizer.user?.id,
                name: organizer.displayName,
                role: organizer.role ?? "co_organizer",
                isPrimary: organizer.isPrimary
            )
        }
    }

    internal nonisolated static func slotRows(_ slots: [SupportTrainSlotDTO]) -> [ManageSlotRow] {
        slots
            .filter { ($0.status ?? "open") != "canceled" }
            .map { slot in
                let date = slotDate(from: slot.slotDate)
                let window = [slot.startTime, slot.endTime]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: " – ")
                let filled = slot.filledCount ?? 0
                let badge: String = if slot.status == "completed" {
                    "Completed"
                } else if filled > 0 || slot.status == "full" {
                    "Reserved"
                } else {
                    "Open"
                }
                return ManageSlotRow(
                    id: slot.id,
                    dateLabel: date.map { longDateLabel($0) } ?? (slot.slotDate ?? ""),
                    metaLabel: [slot.slotLabel, window.isEmpty ? nil : window]
                        .compactMap { $0 }
                        .joined(separator: " · "),
                    badge: badge,
                    slotDate: slot.slotDate ?? "",
                    slotLabel: slot.slotLabel ?? "Dinner",
                    supportMode: slot.supportMode ?? "meal",
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    filledCount: filled,
                    status: slot.status ?? "open"
                )
            }
    }

    // MARK: - Date helpers

    internal nonisolated static func slotDate(from value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(value.prefix(10)))
    }

    internal nonisolated static func isoDateString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    internal nonisolated static func longDateLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: date)
    }

    internal nonisolated static func clock(from value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for pattern in ["HH:mm:ss", "HH:mm"] {
            formatter.dateFormat = pattern
            if let date = formatter.date(from: value) { return date }
        }
        return nil
    }

    /// `HH:mm` — the shape both slot schemas validate.
    internal nonisolated static func clockString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    internal nonisolated static func defaultClock(hour: Int) -> Date {
        var components = DateComponents()
        components.hour = hour
        components.minute = 0
        return Calendar(identifier: .gregorian).date(from: components) ?? Date()
    }
}
