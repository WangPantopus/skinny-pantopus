//
//  HomeSettingsEndpoints.swift
//  Pantopus
//
//  Mutations owned by the per-home Settings index (A14.1). Kept out of
//  `HomesEndpoints.swift` so the settings surface can grow without
//  contending on that heavily-shared file.
//

import Foundation

/// Endpoint builders for per-home settings mutations in
/// `backend/routes/home.js`.
public enum HomeSettingsEndpoints {
    /// `PATCH /api/homes/:id` — route `backend/routes/home.js:3097`,
    /// validated by `updateHomeSchema` (same file, line 132). The handler
    /// requires the `home.edit` IAM permission and 403s otherwise.
    ///
    /// RN's settings screen sends `public_info: { nickname }`
    /// (`src/app/homes/[id]/settings/index.tsx:55`), but `public_info` is
    /// not in `updateHomeSchema` and is never copied into `updates` — the
    /// column the handler actually writes for a home's display name is
    /// `name` (route line 3120), so that is what we send.
    public static func updateHome(homeId: String, request: UpdateHomeRequest) -> Endpoint {
        Endpoint(method: .patch, path: "/api/homes/\(homeId)", body: request)
    }
}
