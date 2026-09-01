//
//  ChatSharePickers.swift
//  Pantopus
//
//  Share sheets for attaching gigs and listings to a chat thread.
//

import SwiftUI

struct ChatShareGigPickerSheet: View {
    @Bindable var viewModel: ChatConversationViewModel
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoadingShareOptions {
                    ProgressView("Loading your tasks…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = viewModel.shareOptionsError {
                    ContentUnavailableView(
                        "Couldn't load tasks",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                } else if viewModel.shareableGigs.isEmpty {
                    ContentUnavailableView(
                        "No tasks to share",
                        systemImage: "briefcase",
                        description: Text("Post a task first, then share it here.")
                    )
                } else {
                    List(viewModel.shareableGigs) { gig in
                        Button {
                            Task {
                                await viewModel.sendGigOffer(gig)
                                onDismiss()
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(gig.title)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appText)
                                HStack(spacing: Spacing.s2) {
                                    if let category = gig.category, !category.isEmpty {
                                        Text(category)
                                            .font(.system(size: 12))
                                            .foregroundStyle(Theme.Color.appTextSecondary)
                                    }
                                    if let price = gig.price {
                                        Text("$\(Int(price))")
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(Theme.Color.appText)
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Share a Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onDismiss)
                }
            }
            .task { await viewModel.loadShareableGigs() }
        }
    }
}

struct ChatShareListingPickerSheet: View {
    @Bindable var viewModel: ChatConversationViewModel
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoadingShareOptions {
                    ProgressView("Loading your listings…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = viewModel.shareOptionsError {
                    ContentUnavailableView(
                        "Couldn't load listings",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                } else if viewModel.shareableListings.isEmpty {
                    ContentUnavailableView(
                        "No listings to share",
                        systemImage: "tag",
                        description: Text("List something first, then share it here.")
                    )
                } else {
                    List(viewModel.shareableListings) { listing in
                        Button {
                            Task {
                                await viewModel.sendListingOffer(listing)
                                onDismiss()
                            }
                        } label: {
                            HStack(spacing: Spacing.s3) {
                                if let imageURL = listing.imageURL, let url = URL(string: imageURL) {
                                    AsyncImage(url: url) { phase in
                                        switch phase {
                                        case let .success(image):
                                            image.resizable().scaledToFill()
                                        default:
                                            Rectangle().fill(Theme.Color.appSurfaceSunken)
                                        }
                                    }
                                    .frame(width: 48, height: 48)
                                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                                }
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(listing.title)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Theme.Color.appText)
                                    HStack(spacing: Spacing.s2) {
                                        if let category = listing.category, !category.isEmpty {
                                            Text(category)
                                                .font(.system(size: 12))
                                                .foregroundStyle(Theme.Color.appTextSecondary)
                                        }
                                        Text(listing.isFree ? "FREE" : listing.price.map { "$\(Int($0))" } ?? "Make Offer")
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(Theme.Color.appText)
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Share a Listing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onDismiss)
                }
            }
            .task { await viewModel.loadShareableListings() }
        }
    }
}
