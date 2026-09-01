//
//  MailboxRecordsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the Home Records asset hub. The Phase-3 router
//  is mounted at `/api/mailbox/v2/p3` (`backend/app.js:317`) from
//  `backend/routes/mailboxV2Phase3.js`, so every path below is that
//  prefix + the route-relative declaration.
//
//  Mirrors `data/api/services/MailboxRecordsApi.kt` on Android.
//

import Foundation

/// Home-Records routes from `backend/routes/mailboxV2Phase3.js`.
public enum MailboxRecordsEndpoints {
    /// `GET /api/mailbox/v2/p3/records/assets` — route
    /// `backend/routes/mailboxV2Phase3.js:182`. Assets for one home, or
    /// for every accessible home when `homeId` is omitted. Returns
    /// `{ assets, rooms }`; `rooms` backs the filter chips.
    public static func assets(homeId: String? = nil) -> Endpoint {
        var query: [String: String] = [:]
        if let homeId { query["homeId"] = homeId }
        return Endpoint(method: .get, path: "/api/mailbox/v2/p3/records/assets", query: query)
    }

    /// `GET /api/mailbox/v2/p3/records/asset/:id/mail` — route
    /// `backend/routes/mailboxV2Phase3.js:238`. Asset detail with its
    /// linked mail and photos. 403s when the asset's home is not one the
    /// caller occupies.
    public static func assetMail(assetId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/p3/records/asset/\(assetId)/mail")
    }

    /// `POST /api/mailbox/v2/p3/records/auto-detect` — route
    /// `backend/routes/mailboxV2Phase3.js:338`. Scans the 50 most recent
    /// mail items carrying `key_facts` for appliance / warranty mentions.
    /// `homeId` is required by the validator (route line 26).
    public static func autoDetect(homeId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/records/auto-detect",
            body: AutoDetectAssetsRequest(homeId: homeId)
        )
    }

    /// `GET /api/mailbox/v2/p3/records/suggestions` — route
    /// `backend/routes/mailboxV2Phase3.js:380`. Up to 10 not-yet-linked
    /// mail items that mention an asset, each with its detections.
    public static func suggestions(homeId: String? = nil) -> Endpoint {
        var query: [String: String] = [:]
        if let homeId { query["homeId"] = homeId }
        return Endpoint(
            method: .get,
            path: "/api/mailbox/v2/p3/records/suggestions",
            query: query
        )
    }

    /// `POST /api/mailbox/v2/p3/records/link` — route
    /// `backend/routes/mailboxV2Phase3.js:296`. Links a mail item to an
    /// asset and returns the created `MailAssetLink` — the only response
    /// that exposes its primary key, so keep it for the unlink call.
    public static func link(
        mailId: String,
        assetId: String,
        linkType: String = "manual"
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/records/link",
            body: LinkMailToAssetRequest(
                mailId: mailId,
                assetId: assetId,
                linkType: linkType
            )
        )
    }

    /// `DELETE /api/mailbox/v2/p3/records/unlink/:id` — route
    /// `backend/routes/mailboxV2Phase3.js:323`. `:id` is the
    /// `MailAssetLink` primary key returned by ``link(mailId:assetId:linkType:)``.
    public static func unlink(linkId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/mailbox/v2/p3/records/unlink/\(linkId)")
    }
}
