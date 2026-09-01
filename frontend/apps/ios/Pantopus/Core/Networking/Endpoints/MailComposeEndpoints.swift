//
//  MailComposeEndpoints.swift
//  Pantopus
//
//  T3.7 Ceremonial Mail Compose endpoints. The compose flow uses
//  the existing mailbox routes — the prompt's `/api/mail-compose/*`
//  is mounted at `/api/mailbox/compose/*` (see
//  `backend/app.js:311`). Send happens via `POST /api/mailbox/send`,
//  which already supports `object.payload.{stationeryTheme,
//  inkSelection, voicePostscriptUri}` per
//  `backend/routes/mailbox.js:73`.
//

import Foundation

public enum MailComposeEndpoints {
    /// `GET /api/mailbox/compose/recipients?q=...&homeId=...`. Route
    /// `backend/routes/mailCompose.js:166`.
    public static func recipients(query: String, homeId: String? = nil) -> Endpoint {
        var params: [String: String] = ["q": query]
        if let homeId { params["homeId"] = homeId }
        return Endpoint(method: .get, path: "/api/mailbox/compose/recipients", query: params)
    }

    /// `GET /api/mailbox/compose/home-context/:homeId`. Route
    /// `backend/routes/mailCompose.js:349`.
    public static func homeContext(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/compose/home-context/\(homeId)")
    }

    /// `POST /api/mailbox/send`. Route
    /// `backend/routes/mailbox.js:1697`.
    public static func send(body: SendMailBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/send", body: body)
    }
}

/// Subset of the `sendMailSchema` the ceremonial-mail wizard fills.
/// Extra fields are sent as nested `object.payload` so the
/// stationery/ink/voice slots survive the round-trip.
public struct SendMailBody: Encodable, Sendable {
    public let recipientUserId: String?
    public let recipientHomeId: String?
    public let type: String
    public let subject: String
    public let content: String
    public let object: SendMailObject
    public let expiresAt: String?

    public init(
        recipientUserId: String?,
        recipientHomeId: String?,
        type: String = "letter",
        subject: String,
        content: String,
        object: SendMailObject,
        expiresAt: String? = nil
    ) {
        self.recipientUserId = recipientUserId
        self.recipientHomeId = recipientHomeId
        self.type = type
        self.subject = subject
        self.content = content
        self.object = object
        self.expiresAt = expiresAt
    }

    enum CodingKeys: String, CodingKey {
        case recipientUserId
        case recipientHomeId
        case type, subject, content, object
        case expiresAt
    }
}

public struct SendMailObject: Encodable, Sendable {
    public let format: String
    public let title: String?
    public let content: String?
    public let payload: SendMailPayload

    public init(
        format: String = "mailjson_v1",
        title: String?,
        content: String?,
        payload: SendMailPayload
    ) {
        self.format = format
        self.title = title
        self.content = content
        self.payload = payload
    }
}

/// Ceremonial slots that ride on `object.payload`. The backend
/// accepts these as `Joi.object().unknown(true)` so we don't have
/// to upstream every key.
public struct SendMailPayload: Encodable, Sendable {
    public let stationeryTheme: String
    public let inkSelection: String
    public let sealChoice: String
    public let intent: String
    public let returnAddressShared: Bool
    public let voicePostscriptUri: String?

    public init(
        stationeryTheme: String,
        inkSelection: String,
        sealChoice: String,
        intent: String,
        returnAddressShared: Bool,
        voicePostscriptUri: String? = nil
    ) {
        self.stationeryTheme = stationeryTheme
        self.inkSelection = inkSelection
        self.sealChoice = sealChoice
        self.intent = intent
        self.returnAddressShared = returnAddressShared
        self.voicePostscriptUri = voicePostscriptUri
    }
}
