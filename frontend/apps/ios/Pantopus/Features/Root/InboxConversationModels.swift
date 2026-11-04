//
//  InboxConversationModels.swift
//  Pantopus
//
//  What the Inbox tab's screens hold, kept above its two layouts. Open, the
//  iPhone Duo shows Messages in two columns (`InboxSplitView`); closed, one
//  stack. A fold or a turn swaps one layout for the other and makes every
//  screen in it anew, so a screen's model lives here instead, for as long as
//  its route is on the stack: a conversation's messages, draft and reading
//  place, the search and its results, New message's search, a post being
//  written from an assistant draft, a Support Train being started.
//

import Foundation

/// Owned above both navigation branches. Only routes still on this account's
/// stack keep their models; leaving a thread releases its in-memory content.
@MainActor
final class InboxConversationModels {
    private var userId = ""
    private var models: [InboxConversationDestination: ChatConversationViewModel] = [:]
    private var searchModel: ChatSearchViewModel?
    /// New message's picker, with what was typed into its search.
    private var newMessageModel: NewMessageViewModel?
    /// The post composers open from an assistant draft's "Use" or a post's Edit: their step and draft.
    private var composeSessions: [InboxRoute: PulseComposeSession] = [:]
    /// The Support Train wizards open from an assistant card, at their step.
    private var supportTrainStarts: [InboxRoute: StartSupportTrainWizardViewModel] = [:]

    func model(
        for destination: InboxConversationDestination,
        userId: String,
        make: () -> ChatConversationViewModel
    ) -> ChatConversationViewModel {
        if self.userId != userId {
            retain(routes: [], userId: userId)
        }
        if let model = models[destination] { return model }
        let model = make()
        models[destination] = model
        return model
    }

    func search(userId: String) -> ChatSearchViewModel {
        if self.userId != userId { retain(routes: [], userId: userId) }
        if let searchModel { return searchModel }
        let model = ChatSearchViewModel()
        searchModel = model
        return model
    }

    func newMessage(userId: String, make: () -> NewMessageViewModel) -> NewMessageViewModel {
        if self.userId != userId { retain(routes: [], userId: userId) }
        if let newMessageModel { return newMessageModel }
        let model = make()
        newMessageModel = model
        return model
    }

    func composeSession(for route: InboxRoute, userId: String) -> PulseComposeSession {
        if self.userId != userId { retain(routes: [], userId: userId) }
        if let session = composeSessions[route] { return session }
        let isEditing = if case .editPost = route { true } else { false }
        let session = PulseComposeSession(editing: isEditing)
        composeSessions[route] = session
        return session
    }

    func supportTrainStart(
        for route: InboxRoute,
        userId: String,
        make: () -> StartSupportTrainWizardViewModel
    ) -> StartSupportTrainWizardViewModel {
        if self.userId != userId { retain(routes: [], userId: userId) }
        if let model = supportTrainStarts[route] { return model }
        let model = make()
        supportTrainStarts[route] = model
        return model
    }

    func retain(routes: [InboxRoute], userId: String) {
        let destinations = Set(routes.compactMap { route -> InboxConversationDestination? in
            guard case let .conversation(destination) = route else { return nil }
            return destination
        })
        models = self.userId == userId ? models.filter { destinations.contains($0.key) } : [:]
        composeSessions = self.userId == userId ? composeSessions.filter { routes.contains($0.key) } : [:]
        supportTrainStarts = self.userId == userId ? supportTrainStarts.filter { routes.contains($0.key) } : [:]
        if self.userId != userId || !routes.contains(.search) {
            searchModel?.teardown()
            searchModel = nil
        }
        if self.userId != userId || !routes.contains(.compose) {
            newMessageModel?.stopSearch()
            newMessageModel = nil
        }
        self.userId = userId
    }
}
