//
//  LossyList.swift
//  Pantopus
//
//  Tolerant decoding (Pulse slice S2; contract "Unknown values"): a list
//  decodes row by row and leaves out the rows it can't read, and an
//  optional field that is missing, null or of a shape this build doesn't
//  know reads as absent. One odd row or field never costs a whole screen.
//  The list helper started in the Plans DTOs.
//

import Foundation

/// Decodes an array, dropping the elements it can't read.
struct LossyList<Element: Decodable & Sendable>: Decodable {
    let items: [Element]

    init(from decoder: any Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var items: [Element] = []
        while !container.isAtEnd {
            if let item = try? container.decode(Element.self) {
                items.append(item)
            } else {
                _ = try? container.decode(SkippedValue.self)
            }
        }
        self.items = items
    }
}

/// Consumes one value of any shape.
private struct SkippedValue: Decodable {}

extension KeyedDecodingContainer {
    /// The value at `key`, or nil when it is missing, null or not a `T`.
    func lenient<T: Decodable>(_ type: T.Type, forKey key: Key) -> T? {
        try? decodeIfPresent(type, forKey: key)
    }

    /// The list at `key` without the elements this build can't read; empty
    /// when the key is missing, null or not a list.
    func lossyList<T: Decodable & Sendable>(_: T.Type, forKey key: Key) -> [T] {
        lenient(LossyList<T>.self, forKey: key)?.items ?? []
    }
}
