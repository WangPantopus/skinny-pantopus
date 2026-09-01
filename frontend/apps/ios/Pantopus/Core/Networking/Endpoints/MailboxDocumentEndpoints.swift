//
//  MailboxDocumentEndpoints.swift
//  Pantopus
//
//  Document-artefact routes on the phase-2 mailbox router
//  (`backend/routes/mailboxV2Phase2.js`, mounted at
//  `/api/mailbox/v2/p2` — `backend/app.js:316`):
//
//   · the booklet PDF download (A17.2 "PDF" tile), and
//   · the certified-mail legal delivery proof (A17.3 "Proof" tile).
//
//  Both are single-shot artefact fetches off a mail item's detail
//  screen, so they live together rather than in the heavily-shared
//  `MailboxV2Endpoints`.
//

import Foundation

public enum MailboxDocumentEndpoints {
    /// `POST /api/mailbox/v2/p2/booklet/:mailId/download` — route
    /// `backend/routes/mailboxV2Phase2.js:447`. Answers
    /// `{ downloadUrl, sizeBytes }`, or 404 `{ error: 'Download not
    /// available' }` when the row carries no `download_url`.
    public static func bookletDownload(mailId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/mailbox/v2/p2/booklet/\(mailId)/download")
    }

    /// `GET /api/mailbox/v2/p2/certified/:mailId/proof` — route
    /// `backend/routes/mailboxV2Phase2.js:705`. Answers `{ proof: … }`
    /// once the item has been acknowledged; 400 before that
    /// ("Must acknowledge before downloading proof").
    public static func certifiedProof(mailId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/v2/p2/certified/\(mailId)/proof")
    }
}
