//
//  BusinessPostsEndpoints.swift
//  Pantopus
//
//  "Post as this business" — the owner dashboard's compose affordance
//  publishes a business-authored post into the neighborhood feed. The
//  backend sets `business_author_id` / `post_as = 'business'` itself and
//  back-fills coordinates from the primary location, so the client only
//  has to send the post body.
//

import Foundation

/// Endpoints for business-authored posts.
public enum BusinessPostsEndpoints {
    /// `POST /api/businesses/:businessId/posts` — create a post authored
    /// by the business. Requires `profile.edit` (owner / admin / editor);
    /// a viewer or staff seat gets a 403.
    ///
    /// The handler destructures the camelCase keys `content` (required),
    /// `title`, `mediaUrls`, `mediaTypes`, `postType`, `visibility`,
    /// `tags`, `audience`, `targetPlaceId`, `eventDate`, `eventEndDate`,
    /// `eventVenue`, `dealExpiresAt`, `dealBusinessName`,
    /// `serviceCategory`, `latitude`, `longitude`, `locationName`,
    /// `locationAddress` — a subset of `PostCreateRequest`, which is why
    /// the shared Pulse compose body is reused verbatim. Response is
    /// `{ message, post }`, decoded by `PostCreateResponse`.
    ///
    /// Route `backend/routes/businesses.js:4192`.
    public static func createPost(businessId: String, body: PostCreateRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/posts",
            body: body
        )
    }
}
