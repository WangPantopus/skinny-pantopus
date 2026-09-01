//
//  JSONValue.swift
//  Pantopus
//
//  Escape hatch for response fields whose shape is provider-dependent or
//  untyped at the backend (e.g. the `today` payload from the hub/today
//  endpoint, ATTOM property bundles, S3-sourced mail object payloads).
//  Prefer a typed DTO whenever the route commits to a stable shape.
//

import Foundation

/// A dynamic JSON value we can losslessly round-trip through `Codable`.
public indirect enum JSONValue: Codable, Sendable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unknown JSON value"
            )
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null:
            try container.encodeNil()
        case let .bool(value):
            try container.encode(value)
        case let .number(value):
            try container.encode(value)
        case let .string(value):
            try container.encode(value)
        case let .object(value):
            try container.encode(value)
        case let .array(value):
            try container.encode(value)
        }
    }

    /// String value if this case is `.string`, otherwise nil.
    public var stringValue: String? {
        if case let .string(v) = self { v } else { nil }
    }

    /// Numeric value if this case is `.number`, otherwise nil.
    public var numberValue: Double? {
        if case let .number(v) = self { v } else { nil }
    }

    /// Boolean value if this case is `.bool`, otherwise nil.
    public var boolValue: Bool? {
        if case let .bool(v) = self { v } else { nil }
    }

    /// Dictionary projection if this case is `.object`, otherwise nil.
    public var dictValue: [String: JSONValue]? {
        if case let .object(dict) = self { dict } else { nil }
    }

    /// Array projection if this case is `.array`, otherwise nil.
    public var arrayValue: [JSONValue]? {
        if case let .array(arr) = self { arr } else { nil }
    }
}
