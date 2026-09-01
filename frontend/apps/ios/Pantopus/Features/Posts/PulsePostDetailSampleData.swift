//
//  PulsePostDetailSampleData.swift
//  Pantopus
//
//  Deterministic A10.4 post detail fixtures for previews and snapshot tests.
//

import Foundation

@MainActor
public enum PulsePostDetailSampleData {
    public static let populated = content(intent: .lostFound, comments: resolvedThread, reactions: resolvedReactions)

    public static func empty(intent: PostIntent = .ask) -> PulsePostDetailContent {
        content(intent: intent, comments: [], reactions: PostReactionCounts())
    }

    public static func content(
        intent: PostIntent,
        comments: [PostCommentRow],
        reactions: PostReactionCounts
    ) -> PulsePostDetailContent {
        let post = postDTO(intent: intent, commentCount: comments.count, likeCount: reactions.helpful)
        return PulsePostDetailContent(
            post: post,
            authorDisplayName: "Nadia Velez",
            authorAvatarURL: nil,
            authorIdentity: .personal,
            authorVerified: true,
            timeAndLocality: "22m · Elm Park · 5th & Elm",
            intent: intent,
            media: [],
            reactions: reactions,
            comments: comments,
            hiddenReplyCount: 0
        )
    }

    private static let resolvedReactions = PostReactionCounts(
        helpful: 18,
        heart: 7,
        going: 2,
        userReaction: .helpful
    )

    private static let resolvedThread: [PostCommentRow] = [
        PostCommentRow(
            id: "c-lena",
            authorName: "Lena P.",
            authorAvatarURL: nil,
            authorIdentity: .home,
            body: "I think I saw her under the Subaru parked across from 514 Elm — small + scared, "
                + "ran when I got close. Going to try again with treats.",
            timestamp: "18m",
            reactionCount: 4,
            indentLevel: 0,
            authorUserId: "u-lena"
        ),
        PostCommentRow(
            id: "c-nadia-1",
            authorName: "Nadia Velez",
            authorAvatarURL: nil,
            authorIdentity: .personal,
            body: "Oh thank you — heading there now with her favorite churu pouch.",
            timestamp: "15m",
            reactionCount: 2,
            userReacted: true,
            indentLevel: 1,
            authorUserId: "u-nadia"
        ),
        PostCommentRow(
            id: "c-ravi",
            authorName: "Ravi D.",
            authorAvatarURL: nil,
            authorIdentity: .personal,
            body: "Posted to the building chat at 510 + 514. Doorman says he'll keep an eye out tonight.",
            timestamp: "11m",
            reactionCount: 1,
            indentLevel: 0,
            authorUserId: "u-ravi"
        ),
        PostCommentRow(
            id: "c-marco",
            authorName: "Marco K.",
            authorAvatarURL: nil,
            authorIdentity: .business,
            body: "If you need a humane trap I have one in the basement — text me, 555-0193.",
            timestamp: "6m",
            indentLevel: 0,
            authorUserId: "u-marco"
        ),
        PostCommentRow(
            id: "c-nadia-2",
            authorName: "Nadia Velez",
            authorAvatarURL: nil,
            authorIdentity: .personal,
            body: "UPDATE: GOT HER. She was under the Subaru after all. Thank you Lena, Ravi, Marco, this block.",
            timestamp: "2m",
            reactionCount: 6,
            userReacted: true,
            indentLevel: 1,
            authorUserId: "u-nadia"
        )
    ]

    private static func postDTO(
        intent: PostIntent,
        commentCount: Int,
        likeCount: Int
    ) -> PostDetailDTO {
        let body = "Has anyone seen a tortoise-shell cat near 5th & Elm tonight? She slipped out of a "
            + "window around 9pm. Her name is Mochi, she's about 8 lb, no collar but she's chipped. "
            + "Very friendly — will come if you crouch and click your tongue. Please DM if you spot "
            + "her. Will be out walking the block until midnight."
        let json = """
        {
          "post": {
            "id": "post-a10-4-\(intent.rawValue)",
            "user_id": "u-nadia",
            "title": null,
            "content": "\(body)",
            "post_type": "\(postType(for: intent))",
            "post_format": "standard",
            "purpose": "\(purpose(for: intent))",
            "media_urls": [],
            "media_live_urls": [],
            "media_types": [],
            "created_at": "2026-05-22T04:19:00.000Z",
            "updated_at": null,
            "is_edited": false,
            "like_count": \(likeCount),
            "comment_count": \(commentCount),
            "share_count": 0,
            "view_count": 34,
            "userHasLiked": \(likeCount > 0 ? "true" : "false"),
            "userHasSaved": false,
            "userHasReposted": false,
            "creator": {
              "id": "u-nadia",
              "username": "nadiav",
              "name": "Nadia Velez",
              "first_name": "Nadia",
              "last_name": "Velez",
              "profile_picture_url": null,
              "city": "Elm Park",
              "state": null,
              "account_type": "personal"
            },
            "home": null,
            "comments": []
          }
        }
        """
        let data = Data(json.utf8)
        do {
            return try JSONDecoder().decode(PostDetailResponse.self, from: data).post
        } catch {
            preconditionFailure("Invalid PulsePostDetailSampleData fixture: \(error)")
        }
    }

    private static func purpose(for intent: PostIntent) -> String {
        switch intent {
        case .lostFound: "lost_found"
        case .ask: "ask"
        case .offer: "offer"
        case .event: "event"
        case .share: "share"
        case .alert: "alert"
        }
    }

    private static func postType(for intent: PostIntent) -> String {
        switch intent {
        case .lostFound: "lost_found"
        default: "general"
        }
    }
}
