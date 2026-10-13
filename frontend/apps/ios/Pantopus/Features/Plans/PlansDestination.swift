//
//  PlansDestination.swift
//  Pantopus
//
//  The screen for each Plans route on the Nearby stack, and the plan's
//  chat (board A4) on top of the existing chat screen.
//

import SwiftUI

struct PlansDestination: View {
    let route: PlansRoute
    @Binding var path: [PlansRoute]
    let onHost: (PlansHostStart?) -> Void

    var body: some View {
        Group {
            switch route {
            case let .plan(id, intent):
                PlanScreen(planId: id, intent: intent, path: $path, onHost: onHost)
            case let .requests(planId):
                PlanRequestsScreen(planId: planId) { pop() }
            case let .change(planId):
                PlanChangeScreen(planId: planId) { pop() }
            case let .profile(userId):
                PublicProfileView(userId: userId) { pop() }
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
        // A link that replaces the screen on top (another plan) must start a
        // fresh screen: the stack reuses its slot, and the old plan's state with it.
        .id(route)
    }

    private func pop() {
        if !path.isEmpty { path.removeLast() }
    }
}

/// The plan's group chat.
struct PlanChatRoute: Hashable, Identifiable {
    let roomId: String
    let planId: String
    let title: String
    let kind: PlanKind
    /// "Sun 1:25 PM".
    let when: String
    /// "Sam's place", or the place's name.
    let place: String
    /// Set once the chat is read-only.
    let closedNote: String?
    /// Everyone in, the host included.
    let peopleCount: Int?

    var id: String {
        roomId
    }
}

/// Board A4: the plan's chat is the existing chat screen, titled with the
/// plan, with the plan above the messages.
struct PlanChatScreen: View {
    let route: PlanChatRoute
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ChatConversationView(
            viewModel: ChatConversationViewModel(
                mode: .room(id: route.roomId),
                counterparty: .group(name: route.title, memberCount: route.peopleCount),
                currentUserId: PlansStoreReads.viewerId ?? ""
            ),
            mode: .dm
        ) { dismiss() }
            .environment(\.chatPlanContext, ChatPlanContext(
                kind: route.kind,
                when: route.when,
                place: route.place,
                closedNote: route.closedNote
            ) { dismiss() })
            .toolbar(.hidden, for: .navigationBar)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("planChat")
    }
}
