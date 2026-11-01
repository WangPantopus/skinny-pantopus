//
//  ProfilePinnedPosts.swift
//  Pantopus
//
//  Pinned posts on a profile (the 11-01 redesign, `Main.dc.html`): the
//  horizontal "Pinned" row (each card shows the post's first photo, else its
//  kind's tint and icon; its first line; its kind and main count), and
//  "Pin to profile" / "Unpin from profile" for every ⋯ menu on your own
//  posts (`POST`/`DELETE /api/posts/:id/profile-pin`, at most three).
//

import SwiftUI

/// Pinning your own posts to your profile, shared by every ⋯ menu that
/// offers it: the feeds, the post page, your profile and My posts. A change
/// made here is remembered for the session, so each menu offers the right
/// item before its list is read again.
@MainActor
@Observable
public final class ProfilePins {
    public static let shared = ProfilePins()
    /// The server keeps at most three pins.
    public static let maxPins = 3

    /// Pins changed in this session, by post id.
    private var changed: [String: Bool] = [:]
    /// Bumps on every change, so your profile re-reads its Pinned row.
    public private(set) var revision = 0

    /// Whether your post is pinned; nil when the server didn't say (other
    /// people's posts, an older server), which hides the menu item.
    public func isPinned(_ postId: String, server: Bool?) -> Bool? {
        changed[postId] ?? server
    }

    /// "Pin to profile" or "Unpin from profile"; nil hides the item.
    public func menuTitle(_ postId: String, server: Bool?) -> String? {
        isPinned(postId, server: server).map { $0 ? "Unpin from profile" : "Pin to profile" }
    }

    /// Pins or unpins your post and says what happened, or the server's
    /// sentence (a fourth pin: "You can pin up to 3 posts. Unpin one first.").
    public func toggle(_ postId: String, server: Bool?, client: APIClient = .shared) async -> ToastMessage {
        await set(postId, pinned: !(isPinned(postId, server: server) ?? false), client: client)
    }

    /// Pins (or unpins) your post and says what happened.
    public func set(_ postId: String, pinned pin: Bool, client: APIClient = .shared) async -> ToastMessage {
        do {
            let endpoint = pin ? PostsEndpoints.pinToProfile(postId: postId) : PostsEndpoints.unpinFromProfile(postId: postId)
            let response = try await client.request(endpoint, as: ProfilePinResponse.self)
            changed[postId] = response.profilePinned
            revision += 1
            ScreenStore.shared.markStale(topics: [ScreenTopic.profileMe])
            return ToastMessage(
                text: response.profilePinned ? "Pinned to your profile." : "Unpinned from your profile.",
                kind: .success
            )
        } catch {
            let message = (error as? APIError)?.errorDescription
            return ToastMessage(text: message ?? "Couldn't change your pinned posts. Try again.", kind: .error)
        }
    }

    /// Forget the session's changes (sign-out).
    public func reset() {
        changed = [:]
        revision += 1
    }
}

// MARK: - Pinned row

/// "Pinned": up to three cards side by side, newest pin first. Hidden when
/// there are none, for signed-out visitors and in the "Anyone" preview.
@MainActor
struct ProfilePinnedRow: View {
    let posts: [FeedPostDTO]
    var onEdit: (@MainActor () -> Void)?
    let onOpen: @MainActor (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ProfileSectionTitle(title: "Pinned", icon: .pin, onEdit: onEdit, editLabel: "Edit your pinned posts")
                .padding(.horizontal, Spacing.s5)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: Spacing.s3) {
                    ForEach(posts) { post in
                        Button { onOpen(post.id) } label: {
                            ProfilePinnedCard(post: post)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("publicProfilePinned_\(post.id)")
                    }
                }
                // Every card as tall as the tallest.
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, Spacing.s5)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("publicProfilePinned")
    }
}

/// One pinned post: its first photo (else its kind's tint and icon), its
/// first line, and its kind with the main count ("Event · 18 going").
@MainActor
private struct ProfilePinnedCard: View {
    let post: FeedPostDTO

    @ScaledMetric(relativeTo: .subheadline) private var scaledWidth: CGFloat = 168

    private var intent: PulseIntent {
        PulseIntent.from(postType: post.postType)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            top
                .frame(height: 72)
                .frame(maxWidth: .infinity)
                .clipped()
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 10) {
                Text(ProfilePinnedPost.title(post))
                    .scaledFont(15, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: Spacing.s0)
                meta
                    .scaledFont(13)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(2)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
            .padding(.bottom, 14)
        }
        .frame(width: min(scaledWidth, 260), alignment: .leading)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(ProfilePinnedPost.spoken(post))
        .accessibilityHint("Opens the post")
    }

    @ViewBuilder private var top: some View {
        if let photo = ProfilePinnedPost.firstPhoto(post) {
            CachedAsyncImage(url: photo) { phase in
                if case let .success(image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    intent.tintBackground
                }
            }
        } else {
            ZStack {
                intent.tintBackground
                Icon(intent.icon, size: 26, color: intent.tint)
            }
        }
    }

    private var meta: Text {
        let kind = Text(verbatim: intent.cardChipLabel).fontWeight(.semibold).foregroundStyle(intent.tint)
        guard let count = ProfilePinnedPost.mainCount(post) else { return kind }
        return kind + Text(verbatim: " · \(count)")
    }
}

/// What a pinned card says about its post.
enum ProfilePinnedPost {
    /// The post's first line: its title, else the first line of its text.
    static func title(_ post: FeedPostDTO) -> String {
        if let title = post.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty { return title }
        let firstLine = post.content.split(whereSeparator: \.isNewline).first.map(String.init) ?? post.content
        return firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// The first photo, when the post has one (never a video's first frame).
    static func firstPhoto(_ post: FeedPostDTO) -> URL? {
        for (index, raw) in post.mediaURLs.enumerated() {
            let type = index < post.mediaTypes.count ? post.mediaTypes[index] : "image"
            guard type.hasPrefix("image") else { continue }
            let thumbnail = index < post.mediaThumbnails.count ? post.mediaThumbnails[index] : ""
            return URL(string: thumbnail.isEmpty ? raw : thumbnail)
        }
        return nil
    }

    /// The kind's main count, as its card counts it: "18 going", "31 likes",
    /// "12 helpful", "9 seen"; nil at zero.
    static func mainCount(_ post: FeedPostDTO) -> String? {
        let count = post.likeCount
        guard count > 0 else { return nil }
        return switch PulseIntent.from(postType: post.postType) {
        case .event: "\(count) going"
        case .lost, .announce, .alert: "\(count) seen"
        case .neighborhoodWin, .generic, .all: "\(count) \(count == 1 ? "like" : "likes")"
        case .ask, .recommend, .deal, .visitorGuide: "\(count) helpful"
        }
    }

    static func spoken(_ post: FeedPostDTO) -> String {
        let intent = PulseIntent.from(postType: post.postType)
        return [title(post), intent.cardChipLabel, mainCount(post)].compactMap { $0 }.joined(separator: ", ")
    }
}
