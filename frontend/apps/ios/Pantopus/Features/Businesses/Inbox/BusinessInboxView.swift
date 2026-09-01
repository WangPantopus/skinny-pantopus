//
//  BusinessInboxView.swift
//  Pantopus
//
//  The business-side inbox — an in-screen frame of the owner dashboard
//  (same idiom as the owner ↔ catalog toggle). Messages lists the rooms
//  addressed to the business identity; Mentions lists the neighborhood
//  posts matched to the business. Both ship loading / empty / loaded /
//  error.
//
//  Android twin: `ui/screens/businesses/inbox/BusinessInboxScreen.kt`.
//

import SwiftUI

@MainActor
public struct BusinessInboxView: View {
    @State private var viewModel: BusinessInboxViewModel

    private let onBack: @MainActor () -> Void
    /// Opens a chat room (`roomId`, counterpart display name, handle).
    private let onOpenRoom: @MainActor (String, String, String) -> Void
    /// Opens a matched neighborhood post by id.
    private let onOpenPost: @MainActor (String) -> Void

    public init(
        businessId: String,
        onBack: @escaping @MainActor () -> Void,
        onOpenRoom: @escaping @MainActor (String, String, String) -> Void = { _, _, _ in },
        onOpenPost: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: BusinessInboxViewModel(businessId: businessId))
        self.onBack = onBack
        self.onOpenRoom = onOpenRoom
        self.onOpenPost = onOpenPost
    }

    /// Test / preview seam — inject a view-model that skips the network.
    init(
        viewModel: BusinessInboxViewModel,
        onBack: @escaping @MainActor () -> Void,
        onOpenRoom: @escaping @MainActor (String, String, String) -> Void = { _, _, _ in },
        onOpenPost: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onOpenRoom = onOpenRoom
        self.onOpenPost = onOpenPost
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: headerTitle, onBack: onBack, action: nil)
            sectionToggle
            stateBody
        }
        // No `.offlineBanner` here — this frame always renders inside
        // `BusinessOwnerView`, which already carries the offline strip.
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("businessInbox")
        .task { await viewModel.load() }
    }

    private var headerTitle: String {
        viewModel.totalUnread > 0 ? "Inbox (\(viewModel.totalUnread))" : "Inbox"
    }

    // MARK: - Section toggle

    private var sectionToggle: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(BusinessInboxSection.allCases, id: \.self) { candidate in
                sectionChip(candidate)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("businessInbox.sections")
    }

    private func sectionChip(_ candidate: BusinessInboxSection) -> some View {
        let selected = viewModel.section == candidate
        return Button {
            Task { await viewModel.select(candidate) }
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(
                    candidate.icon,
                    size: 14,
                    color: selected ? Theme.Color.business : Theme.Color.appTextMuted
                )
                Text(candidate.title)
                    .font(.system(size: 13, weight: selected ? .semibold : .regular))
                    .foregroundStyle(selected ? Theme.Color.business : Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s2)
            .background(selected ? Theme.Color.businessBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .stroke(selected ? Theme.Color.business : Theme.Color.appBorder, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .accessibilityIdentifier("businessInbox.section.\(candidate.rawValue)")
    }

    // MARK: - States

    @ViewBuilder private var stateBody: some View {
        switch viewModel.state {
        case .loading:
            loadingLayout
        case let .loadedRooms(rooms):
            ScrollView {
                LazyVStack(spacing: Spacing.s2) {
                    ForEach(rooms) { room in
                        BusinessInboxRoomCard(room: room) {
                            onOpenRoom(room.id, room.title, room.handle)
                        }
                    }
                }
                .padding(Spacing.s4)
            }
            .refreshable { await viewModel.refresh() }
            .accessibilityIdentifier("businessInbox.messagesList")
        case let .loadedMentions(mentions):
            ScrollView {
                LazyVStack(spacing: Spacing.s2) {
                    ForEach(mentions) { mention in
                        BusinessInboxMentionCard(mention: mention) {
                            onOpenPost(mention.id)
                        }
                    }
                }
                .padding(Spacing.s4)
            }
            .refreshable { await viewModel.refresh() }
            .accessibilityIdentifier("businessInbox.mentionsList")
        case .empty:
            emptyLayout
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: viewModel.section == .messages
                    ? "Couldn't load messages"
                    : "Couldn't load mentions",
                subcopy: message,
                cta: EmptyState.CTA(title: "Retry") { await viewModel.refresh() },
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityIdentifier("businessInbox.error")
        }
    }

    private var loadingLayout: some View {
        VStack(spacing: Spacing.s2) {
            ForEach(0..<5, id: \.self) { _ in
                Shimmer(height: 72, cornerRadius: Radii.lg)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("businessInbox.loading")
    }

    @ViewBuilder private var emptyLayout: some View {
        switch viewModel.section {
        case .messages:
            EmptyState(
                icon: .messageSquare,
                headline: "No messages yet",
                subcopy: "Conversations neighbors start with this business land here.",
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityIdentifier("businessInbox.empty")
        case .mentions:
            EmptyState(
                icon: .atSign,
                headline: "No posts mention your business yet",
                subcopy: "Neighborhood posts matched to your categories show up here.",
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityIdentifier("businessInbox.empty")
        }
    }
}

// MARK: - Rows

@MainActor
struct BusinessInboxRoomCard: View {
    let room: BusinessInboxRoom
    let onOpen: @MainActor () -> Void

    var body: some View {
        Button { onOpen() } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .fill(room.isUnread ? Theme.Color.businessBg : Theme.Color.appSurfaceSunken)
                        .frame(width: 44, height: 44)
                    Text(initials)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.business)
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Spacing.s2) {
                        Text(room.title)
                            .font(.system(size: 14, weight: room.isUnread ? .bold : .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        Spacer(minLength: Spacing.s1)
                        if !room.timeAgo.isEmpty {
                            Text(room.timeAgo)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextMuted)
                        }
                    }
                    if !room.preview.isEmpty {
                        Text(room.preview)
                            .font(.system(size: 12.5))
                            .foregroundStyle(
                                room.isUnread ? Theme.Color.appText : Theme.Color.appTextSecondary
                            )
                            .lineLimit(1)
                    }
                }
                if room.isUnread {
                    Text("\(room.unreadCount)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, Spacing.s2)
                        .frame(minWidth: 20, minHeight: 20)
                        .background(Theme.Color.business)
                        .clipShape(Capsule())
                }
            }
            .padding(14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessInbox.room.\(room.id)")
    }

    private var initials: String {
        let source = room.title.hasPrefix("@") ? String(room.title.dropFirst()) : room.title
        let letters = source
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
            .joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }
}

@MainActor
struct BusinessInboxMentionCard: View {
    let mention: BusinessInboxMention
    let onOpen: @MainActor () -> Void

    var body: some View {
        Button { onOpen() } label: {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    Circle().fill(Theme.Color.businessBg).frame(width: 44, height: 44)
                    Icon(.fileText, size: 18, color: Theme.Color.business)
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Spacing.s2) {
                        Text(mention.authorName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        Spacer(minLength: Spacing.s1)
                        if !mention.timeAgo.isEmpty {
                            Text(mention.timeAgo)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextMuted)
                        }
                    }
                    if !mention.body.isEmpty {
                        Text(mention.body)
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(2)
                    }
                    if !mention.engagement.isEmpty {
                        Text(mention.engagement)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .padding(.top, Spacing.s1)
                    }
                }
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                    .padding(.top, Spacing.s1)
            }
            .padding(14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessInbox.mention.\(mention.id)")
    }
}
