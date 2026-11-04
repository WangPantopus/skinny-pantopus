//
//  EditAccessCodeFormViewModel+Roster.swift
//  Pantopus
//
//  Field validation and the "Shared with" picker's roster summaries, apart from the form's
//  load / validate / save / delete flow.
//

import Foundation

extension EditAccessCodeFormViewModel {
    /// Household-roster summary string used by the visibility picker
    /// ("All 4 members"). Empty until the roster loads.
    func rosterSummary(for scope: AccessVisibility) -> String {
        let count = roster.count
        switch scope {
        case .everyone:
            return count == 0 ? scope.headline : "Everyone (\(count) members + guests)"
        case .members:
            return count == 0 ? scope.headline : "All household members (\(count))"
        case .managers:
            let managers = roster.filter(\.canManageAccess)
            return managers.isEmpty
                ? scope.headline
                : "Owners & managers (\(managers.count))"
        case .sensitive:
            let owners = roster.filter { $0.role?.lowercased() == "owner" }
            return owners.isEmpty
                ? scope.headline
                : "Owners only (\(owners.count))"
        }
    }

    /// Names of members the selected visibility scope grants access to.
    /// Drives the "Shared with" preview strip — keeps the picker visibly
    /// tied to the actual roster rather than abstract scope labels.
    func sharedWithNames() -> [String] {
        switch visibility {
        case .everyone, .members:
            roster.map(\.displayName)
        case .managers:
            roster.filter(\.canManageAccess).map(\.displayName)
        case .sensitive:
            roster.filter { $0.role?.lowercased() == "owner" }.map(\.displayName)
        }
    }
}

extension EditAccessCodeFormViewModel {
    // MARK: - Aggregate

    var aggregate: FormAggregate {
        FormAggregate(fields: EditAccessCodeField.allCases.compactMap { fields[$0] })
    }

    var isDirty: Bool {
        aggregate.isDirty
    }

    /// Required fields: category, label, value. Notes + visibility are
    /// optional (visibility has a default).
    var isValid: Bool {
        guard aggregate.isValid else { return false }
        let label = (fields[.label]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let value = (fields[.value]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return !label.isEmpty && !value.isEmpty
    }

    // MARK: - Validation table

    func validator(for field: EditAccessCodeField) -> FormValidator {
        switch field {
        case .category:
            FormValidator { value in
                AccessCategory(rawValue: value) == nil ? "Pick a category." : nil
            }
        case .label:
            .all([.required("Label"), .maxLength(120)])
        case .value:
            .all([.required("Code"), .maxLength(512)])
        case .notes:
            .maxLength(2000)
        case .sharedWith:
            FormValidator { value in
                AccessVisibility(rawValue: value) == nil ? "Pick a visibility scope." : nil
            }
        }
    }

    @discardableResult
    func validateAll() -> EditAccessCodeField? {
        var firstInvalid: EditAccessCodeField?
        for field in EditAccessCodeField.allCases {
            guard var snapshot = fields[field] else { continue }
            let message = validator(for: field).validate(snapshot.value)
            snapshot.error = message
            snapshot.touched = true
            fields[field] = snapshot
            if firstInvalid == nil, message != nil { firstInvalid = field }
        }
        return firstInvalid
    }
}
