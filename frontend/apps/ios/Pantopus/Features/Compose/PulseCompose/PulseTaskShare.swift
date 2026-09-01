//
//  PulseTaskShare.swift
//  Pantopus
//
//  "Share this task to the feed" payload. RN's gig detail opens the same
//  PostTargetPicker + composer the Pulse tab uses, prefilled with the
//  task's title, a budget/summary body and the task link, and submits
//  with `refTaskId` so the post renders a "View task" ref card
//  (`apps/mobile/src/app/gig/[id].tsx:531-561,627`;
//  `backend/routes/posts.js:252,1237`).
//

import Foundation

/// Prefill for a task-referencing Pulse post.
public struct PulseTaskShare: Identifiable, Sendable, Hashable {
    /// The gig id — also the `refTaskId` sent with `POST /api/posts`.
    public let taskId: String
    /// Prefills the composer's Title field.
    public let title: String
    /// Prefills the composer's Body field.
    public let body: String

    public var id: String {
        taskId
    }

    public init(taskId: String, title: String, body: String) {
        self.taskId = taskId
        self.title = title
        self.body = body
    }

    /// RN's body template (`gig/[id].tsx:539-551`): lead-in, budget,
    /// a 220-character description summary, and the task link.
    public static func composeBody(
        title _: String,
        price: Double?,
        description: String?,
        shareURL: String
    ) -> String {
        let trimmed = (description ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let summary = trimmed.count > 220
            ? String(trimmed.prefix(219)).trimmingCharacters(in: .whitespaces) + "…"
            : trimmed
        let priceLabel = price.map { String(format: "Budget: $%.2f", $0) }
        return [
            "Thought this task might be helpful for someone nearby.",
            priceLabel,
            summary.isEmpty ? nil : summary,
            "Task link: \(shareURL)"
        ]
        .compactMap { $0 }
        .joined(separator: "\n\n")
    }
}
