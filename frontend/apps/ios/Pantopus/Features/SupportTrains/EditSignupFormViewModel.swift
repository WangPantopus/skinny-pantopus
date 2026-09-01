//
//  EditSignupFormViewModel.swift
//  Pantopus
//
//  P3.7 — Edit Signup form (organizer-side mutation of a helper
//  reservation). The form prefills from the current reservation and
//  commits its patch into `SupportTrainReservationsStore.shared` so
//  the Review-signups list can replay it on appear. The corresponding
//  backend route (`PATCH /api/support-trains/:id/reservations
//  /:reservationId`) lands separately; until then the optimistic store
//  patch is the user-facing source of truth — same precedent the
//  Confirm action already follows.
//

import Foundation
import Observation

/// Stable identifiers for every editable Edit-Signup field. Ordering
/// matches the form's visual top-to-bottom flow.
public enum EditSignupField: String, CaseIterable, Sendable {
    /// Meal description for cook/groceries, restaurant name for
    /// takeout. The active label + placeholder swap on
    /// `contributionMode`.
    case contribution
    /// `HH:mm` drop-off time within the recipient's slot window.
    case dropoffTime
    /// Organizer-only dietary / accommodation notes
    /// (`private_note_to_organizer`).
    case dietaryNotes
}

/// Lightweight render-state enum for the form. Mirrors the
/// `FormShell` precedent (`InviteOwnerFormViewModel`,
/// `EditProfileView`) — loading/error states aren't surfaced here
/// because the form receives its seed reservation by value from the
/// caller and never needs to fetch.
public enum EditSignupFormState: Sendable, Equatable {
    case editing
    case savedWaitingForDismiss
}

@Observable
@MainActor
public final class EditSignupFormViewModel {
    // MARK: - Render state

    public private(set) var state: EditSignupFormState = .editing
    public var fields: [EditSignupField: FormFieldState] = [:]
    public private(set) var isSaving: Bool = false
    public var toast: ToastMessage?
    public private(set) var shakeTrigger: Int = 0
    /// True after a successful save — the view watches this to pop the
    /// nav stack once the success toast has had a beat to render.
    public private(set) var shouldDismiss: Bool = false

    // MARK: - Seed data

    public let reservation: SupportTrainReservationDTO

    // MARK: - Dependencies / callbacks

    private let store: SupportTrainReservationsStore
    private let onSaved: @MainActor (SupportTrainReservationDTO) -> Void

    public init(
        reservation: SupportTrainReservationDTO,
        store: SupportTrainReservationsStore = .shared,
        onSaved: @escaping @MainActor (SupportTrainReservationDTO) -> Void = { _ in }
    ) {
        self.reservation = reservation
        self.store = store
        self.onSaved = onSaved
        for field in EditSignupField.allCases {
            fields[field] = FormFieldState(
                id: field.rawValue,
                originalValue: Self.originalValue(for: field, in: reservation)
            )
        }
    }

    // MARK: - Bindings

    /// Update a field and re-run its validator. Idempotent — setting
    /// the field to its current value clears any prior error without
    /// re-marking the field as touched.
    public func update(_ field: EditSignupField, to value: String) {
        guard var snapshot = fields[field] else { return }
        snapshot.value = value
        snapshot.touched = true
        snapshot.error = validator(for: field).validate(value)
        fields[field] = snapshot
    }

    // MARK: - Aggregate

    public var aggregate: FormAggregate {
        FormAggregate(fields: EditSignupField.allCases.compactMap { fields[$0] })
    }

    public var isValid: Bool {
        aggregate.isValid
    }

    public var isDirty: Bool {
        aggregate.isDirty
    }

    // MARK: - Copy

    /// Localised label for the kind-specific contribution field. Drives
    /// the form's first text input. Meal trains in cook mode show
    /// "Meal description"; takeout mode shows "Restaurant"; everything
    /// else falls back to a generic "Contribution" label.
    public var contributionLabel: String {
        switch reservation.contributionMode ?? "" {
        case "cook":
            "Meal description"
        case "groceries":
            "Groceries description"
        case "takeout":
            "Restaurant"
        default:
            "Contribution"
        }
    }

    public var contributionPlaceholder: String {
        switch reservation.contributionMode ?? "" {
        case "cook":
            "e.g. Veggie chili with cornbread"
        case "groceries":
            "e.g. Pantry staples + fresh produce"
        case "takeout":
            "e.g. Sweetgreen on Market"
        default:
            "What you're bringing"
        }
    }

    /// True when the contributing field maps to `restaurant_name`
    /// rather than `dish_title` on the wire.
    public var contributionMapsToRestaurant: Bool {
        reservation.contributionMode == "takeout"
    }

    // MARK: - Save

    /// Validate, build the patched DTO, optimistically commit it to
    /// the shared store, and notify the host. Returns true on success.
    @discardableResult
    public func save() async -> Bool {
        if validateAll() != nil {
            shakeTrigger &+= 1
            toast = ToastMessage(text: "Fix the highlighted field.", kind: .error)
            return false
        }
        isSaving = true
        defer { isSaving = false }
        let updated = buildUpdatedReservation()
        store.apply(updated)
        onSaved(updated)
        toast = ToastMessage(text: "Signup updated.", kind: .success)
        state = .savedWaitingForDismiss
        // Hold the toast briefly so it actually renders before the
        // host pops the nav stack — matches the `InviteOwnerFormView`
        // success cadence.
        try? await Task.sleep(nanoseconds: 700_000_000)
        shouldDismiss = true
        return true
    }

    /// Called by the view after it consumes `shouldDismiss`.
    public func acknowledgeDismiss() {
        shouldDismiss = false
    }

    // MARK: - Validation

    @discardableResult
    public func validateAll() -> EditSignupField? {
        var firstInvalid: EditSignupField?
        for field in EditSignupField.allCases {
            guard var snapshot = fields[field] else { continue }
            let message = validator(for: field).validate(snapshot.value)
            snapshot.error = message
            snapshot.touched = true
            fields[field] = snapshot
            if firstInvalid == nil, message != nil { firstInvalid = field }
        }
        return firstInvalid
    }

    // MARK: - Private

    private func validator(for field: EditSignupField) -> FormValidator {
        switch field {
        case .contribution:
            // Optional on the wire (Joi `.allow(null, '')`) but we
            // cap at 200 chars to match the reserve schema.
            .all([.maxLength(200)])
        case .dropoffTime:
            .all([.timeHHmm()])
        case .dietaryNotes:
            .all([.maxLength(1000)])
        }
    }

    private func buildUpdatedReservation() -> SupportTrainReservationDTO {
        let trimmedContribution = (fields[.contribution]?.value ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNotes = (fields[.dietaryNotes]?.value ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let dishTitle: String?
        let restaurantName: String?
        if contributionMapsToRestaurant {
            dishTitle = reservation.dishTitle
            restaurantName = trimmedContribution.isEmpty ? nil : trimmedContribution
        } else {
            dishTitle = trimmedContribution.isEmpty ? nil : trimmedContribution
            restaurantName = reservation.restaurantName
        }
        let arrival = newArrivalISO()
        return SupportTrainReservationDTO(
            id: reservation.id,
            slotId: reservation.slotId,
            userId: reservation.userId,
            guestName: reservation.guestName,
            status: reservation.status,
            contributionMode: reservation.contributionMode,
            dishTitle: dishTitle,
            restaurantName: restaurantName,
            estimatedArrivalAt: arrival,
            noteToRecipient: reservation.noteToRecipient,
            privateNoteToOrganizer: trimmedNotes.isEmpty ? nil : trimmedNotes,
            createdAt: reservation.createdAt,
            // Bumping `updatedAt` flips the row to the "Edited" chip in
            // the list view — same client-side derivation
            // `SupportTrainReservationDTO.wasEdited` uses.
            updatedAt: Self.isoNow(),
            canceledAt: reservation.canceledAt,
            helper: reservation.helper
        )
    }

    /// Build the new `estimated_arrival_at` ISO string by overlaying
    /// the picked `HH:mm` on the original arrival date. Falls back to
    /// the original value when no time is set or the original arrival
    /// is missing / unparseable.
    private func newArrivalISO() -> String? {
        let value = (fields[.dropoffTime]?.value ?? "")
            .trimmingCharacters(in: .whitespaces)
        guard !value.isEmpty else { return reservation.estimatedArrivalAt }
        let parts = value.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else { return reservation.estimatedArrivalAt }
        let calendar = Calendar(identifier: .gregorian)
        let baseDate: Date = if let original = reservation.estimatedArrivalAt,
                                let parsed = Self.parseISO(original) {
            parsed
        } else {
            Date()
        }
        var components = calendar.dateComponents(
            [.year, .month, .day, .timeZone],
            from: baseDate
        )
        components.hour = hour
        components.minute = minute
        components.second = 0
        guard let composed = calendar.date(from: components) else {
            return reservation.estimatedArrivalAt
        }
        return Self.isoFormatter.string(from: composed)
    }

    // MARK: - Seeds

    private static func originalValue(
        for field: EditSignupField,
        in reservation: SupportTrainReservationDTO
    ) -> String {
        switch field {
        case .contribution:
            if reservation.contributionMode == "takeout" {
                return reservation.restaurantName ?? ""
            }
            return reservation.dishTitle ?? ""
        case .dropoffTime:
            guard let iso = reservation.estimatedArrivalAt,
                  let date = parseISO(iso) else { return "" }
            return timeFormatter.string(from: date)
        case .dietaryNotes:
            return reservation.privateNoteToOrganizer ?? ""
        }
    }

    // MARK: - Formatters

    /// Parse an ISO-8601 instant tolerating both the fractional-second
    /// (`…00.000Z`) and whole-second (`…00Z`) forms. Postgres emits
    /// either depending on the column's stored precision, and
    /// `ISO8601DateFormatter` is strict: `.withFractionalSeconds`
    /// rejects whole-second strings, so try both spellings.
    private static func parseISO(_ iso: String) -> Date? {
        isoFormatter.date(from: iso) ?? isoFormatterNoFraction.date(from: iso)
    }

    private nonisolated(unsafe) static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private nonisolated(unsafe) static let isoFormatterNoFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        f.calendar = Calendar(identifier: .gregorian)
        return f
    }()

    private static func isoNow() -> String {
        isoFormatter.string(from: Date())
    }
}
