//
//  BlockFoundersEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/blockFounders.js` (mounted
//  under `/api/homes`). Both routes are hard-gated to VERIFIED
//  occupants: the rank is a claim only a verified home can hold, the
//  meters surface the raw insider count, and invites spend real money
//  in the sender's name.
//
//  The recipient's opt-out (`POST /api/public/block-invites/opt-out/:code`)
//  is deliberately absent: the code is printed on a mailed postcard and
//  redeemed on the public WEB page by someone who has no account and no
//  app, so the app has no call site for it.
//

import Foundation

public enum BlockFoundersEndpoints {
    /// `GET /api/homes/:id/block-founders` — route
    /// `backend/routes/blockFounders.js:54`. Founding rank, verified
    /// count, the three unlock meters, and this week's invite budget.
    /// 403 `VERIFICATION_REQUIRED` below T4.
    public static func status(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/block-founders")
    }

    /// `POST /api/homes/:id/block-founders/invites` — route
    /// `backend/routes/blockFounders.js:67`. One template postcard.
    /// 429 `WEEKLY_CAP` · 502 `SEND_FAILED` · 400 for the address and
    /// safeguard rejections (`BAD_ADDRESS`, `OPTED_OUT`,
    /// `ALREADY_MEMBER`, `RECENTLY_INVITED`).
    public static func sendInvite(homeId: String, recipient: BlockInviteRecipient) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/block-founders/invites",
            body: SendBlockInviteRequest(recipient: recipient)
        )
    }
}
