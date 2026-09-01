//
//  ResolveRoutingRequest.swift
//  Pantopus
//
//  DTO for `POST /api/mailbox/v2/resolve` — route
//  `backend/routes/mailboxV2.js:555`. Schema:
//  `resolveRoutingSchema` at line 12 of the same file.
//

import Foundation

/// Body for `POST /api/mailbox/v2/resolve`. Mirrors `resolveRoutingSchema`.
public struct ResolveRoutingRequest: Encodable, Sendable, Hashable {
    public let mailId: String
    public let drawer: String
    public let addAlias: Bool?
    public let aliasString: String?

    public init(
        mailId: String,
        drawer: String,
        addAlias: Bool? = nil,
        aliasString: String? = nil
    ) {
        self.mailId = mailId
        self.drawer = drawer
        self.addAlias = addAlias
        self.aliasString = aliasString
    }

    /// Custom encoder so nil optionals are OMITTED from the wire body
    /// instead of emitted as `null`. Backend's `resolveRoutingSchema`
    /// accepts both, but absent keys are tighter and let the test
    /// assert "no alias was sent" cleanly.
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(mailId, forKey: .mailId)
        try c.encode(drawer, forKey: .drawer)
        try c.encodeIfPresent(addAlias, forKey: .addAlias)
        try c.encodeIfPresent(aliasString, forKey: .aliasString)
    }

    private enum CodingKeys: String, CodingKey {
        case mailId, drawer, addAlias, aliasString
    }
}

/// Response for `POST /api/mailbox/v2/resolve` (line 604).
public struct ResolveRoutingResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let drawer: String
}
