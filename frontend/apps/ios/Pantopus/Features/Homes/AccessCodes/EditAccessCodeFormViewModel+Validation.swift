//
//  EditAccessCodeFormViewModel+Validation.swift
//  Pantopus
//
//  Existing field validation and aggregate state for the Access Code editor.
//

import Foundation

extension EditAccessCodeFormViewModel {
    /// Recovery is only for this actor's exact retained intent, never a generic label conflict.
    func matchesCreateIntent(_ secret: HomeAccessSecretDTO, actorId: String) -> Bool {
        func value(_ field: EditAccessCodeField) -> String {
            (fields[field]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return secret.homeId == homeId && secret.createdBy == actorId
            && secret.accessType == category.backendAccessType && secret.visibility == visibility.rawValue
            && secret.label == value(.label) && secret.secretValue == value(.value)
            && (secret.notes ?? "") == value(.notes)
    }

    func creationMayHaveSucceeded(after error: any Error) -> Bool {
        guard let error = error as? APIError else { return true }
        switch error {
        case .invalidResponse, .server, .transport, .decoding, .retriesExhausted: return true
        case let .clientError(status, _): return status == 408
        case .invalidURL, .unauthorized, .forbidden, .notFound: return false
        }
    }

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
