//
//  MailboxTasksEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the mail-linked task writes in
//  `backend/routes/mailboxV2Phase3.js` (mounted at `/api/mailbox/v2/p3`,
//  `backend/app.js:317`). The read (`GET /p3/tasks`) and the partial
//  update (`PATCH /p3/tasks/:id`) already live on `MailboxV2Endpoints`;
//  this file adds the two writes the Mail-tasks list surface needs so the
//  heavily-shared V2 file stays small.
//

import Foundation

public enum MailboxTasksEndpoints {
    /// `POST /api/mailbox/v2/p3/tasks/from-mail` — route
    /// `backend/routes/mailboxV2Phase3.js:886`. Creates a `HomeTask`
    /// linked to a mail item and stamps `Mail.linked_task_id`. Returns
    /// `{ task }`, decodable as `P3TaskResponse`.
    public static func createTaskFromMail(_ request: P3CreateTaskFromMailRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/tasks/from-mail",
            body: request
        )
    }

    /// `POST /api/mailbox/v2/p3/tasks/:id/to-gig` — route
    /// `backend/routes/mailboxV2Phase3.js:977`. Posts the task as a
    /// neighbor gig, links it back onto the task
    /// (`converted_to_gig_id`), and flips the task to `in_progress`.
    /// Returns `{ gigId, title }`.
    public static func convertTaskToGig(taskId: String, request: P3TaskToGigRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/tasks/\(taskId)/to-gig",
            body: request
        )
    }
}
