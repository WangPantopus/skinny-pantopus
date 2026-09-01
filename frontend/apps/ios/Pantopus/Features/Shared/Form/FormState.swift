//
//  FormState.swift
//  Pantopus
//
//  Lightweight field state used by the Form archetype. Each field tracks
//  its current text, original value, touched flag, and live error. Wraps
//  the raw bindings so `FormShell` can compute dirty + valid without the
//  feature VM needing to reinvent it.
//

import Foundation

/// Live + canonical pose for a single form field.
public struct FormFieldState: Identifiable, Equatable, Sendable {
    public let id: String
    public var value: String
    public var originalValue: String
    public var touched: Bool
    public var error: String?

    public init(id: String, originalValue: String) {
        self.id = id
        value = originalValue
        self.originalValue = originalValue
        touched = false
        error = nil
    }

    /// True when the current value differs from `originalValue`.
    public var isDirty: Bool {
        value != originalValue
    }

    /// Reset the original-value baseline to the current value. Call after a
    /// successful PATCH to clear dirty tracking.
    public mutating func commit() {
        originalValue = value
        touched = false
    }
}

/// Dirty + validity snapshot for an entire `FormShell`.
public struct FormAggregate: Sendable, Equatable {
    public let isDirty: Bool
    public let isValid: Bool

    public init(fields: [FormFieldState]) {
        isDirty = fields.contains { $0.isDirty }
        isValid = fields.allSatisfy { $0.error == nil }
    }
}
