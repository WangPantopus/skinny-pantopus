//
//  PostPageDestination.swift
//  Pantopus
//
//  The post page for stacks that open it from a person's profile but have
//  no business-profile route of their own (Messages, Tasks, Marketplace):
//  a business link goes to the router, which opens it in the Place stack.
//

import SwiftUI

struct PostPageDestination: View {
    let postId: String
    /// The signed-in person's id, "" when signed out.
    let currentUserId: String
    let onBack: @MainActor () -> Void
    let onOpenProfile: @MainActor (String) -> Void
    /// Opens the composer on one of your own posts.
    let onEdit: @MainActor (String) -> Void

    var body: some View {
        PulsePostDetailView(
            postId: postId,
            currentUserId: currentUserId.isEmpty ? nil : currentUserId,
            onBack: onBack,
            onOpenProfile: onOpenProfile,
            onEdit: onEdit,
            // swiftlint:disable:next trailing_closure
            onOpenBusiness: { business in
                Task { @MainActor in DeepLinkRouter.shared.handle(path: "/business/\(business)") }
            }
        )
        // A post opened over another post gets its own view model and load.
        .id(postId)
    }
}
