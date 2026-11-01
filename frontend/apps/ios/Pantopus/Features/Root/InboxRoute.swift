//
//  InboxRoute.swift
//  Pantopus
//
//  The Inbox tab's routes and the conversation push's payload, shared by
//  its stack and, on a wide screen, its two columns (`InboxSplitView`).
//

import Foundation

/// Typed routes within the Inbox tab's NavigationStack.
public enum InboxRoute: Hashable {
    case conversation(InboxConversationDestination)
    case compose
    case search
    case composeGig(category: String)
    case composeListing
    case composePost(intent: String)
    /// An assistant draft opened in the Pulse composer with its text and
    /// every other field it carries (event, deal, Lost & Found, Heads Up).
    case composePostDraft(PulseComposeDraft)
    /// An assistant Support Train card opened in the start wizard with its story.
    case startSupportTrain(story: String)
    /// A person's public profile, opened from a DM header.
    case publicProfile(userId: String)
    /// A post opened from a profile's Posts tab.
    case post(postId: String)
    /// One of your own posts, edited from its page.
    case editPost(postId: String)
}

/// Routing payload for a conversation push — captures the mode the
/// view-model needs (room id / other-user id / AI sentinel) plus
/// header presentation data derived from the chat-list row.
public struct InboxConversationDestination: Hashable, Sendable {
    public enum Mode: Hashable, Sendable {
        case room(id: String)
        case person(otherUserId: String)
        case ai
    }

    public let mode: Mode
    /// Presentation mode for the conversation chrome. `.aiAssistant` for
    /// the Ask Pantopus thread; `.dm` for human DMs/groups.
    public let kind: ChatConversationMode
    public let displayName: String
    public let initials: String
    public let identityKind: String?
    public let verified: Bool
    public let initialTopic: ChatInitialTopic?
    /// Message to scroll to on open (set when arriving from Chat Search
    /// with a body match). `nil` opens the conversation at the latest
    /// message.
    public let scrollToMessageId: String?
    /// For gig-room rows: the backing gig id (unified-conversations
    /// `gig_id`), so the thread can pin the gig context strip.
    public let gigId: String?
    /// The room a chat link named when it opened as a person thread, so the
    /// link's arrival still completes for that room.
    public let arrivalRoomId: String?
    /// Explicit business-inbox context; ordinary chats keep the person's identity.
    public let asBusinessUserId: String?
    /// The assistant thread opened at a brief or nudge (`pantopus://assistant?nudge=`).
    public let assistantNudge: AIAssistantNudge?

    public init(
        mode: Mode,
        kind: ChatConversationMode = .dm,
        displayName: String,
        initials: String,
        identityKind: String?,
        verified: Bool,
        scrollToMessageId: String? = nil,
        initialTopic: ChatInitialTopic? = nil,
        gigId: String? = nil,
        arrivalRoomId: String? = nil,
        asBusinessUserId: String? = nil,
        assistantNudge: AIAssistantNudge? = nil
    ) {
        self.mode = mode
        self.kind = kind
        self.displayName = displayName
        self.initials = initials
        self.identityKind = identityKind
        self.verified = verified
        self.scrollToMessageId = scrollToMessageId
        self.initialTopic = initialTopic
        self.gigId = gigId
        self.arrivalRoomId = arrivalRoomId
        self.asBusinessUserId = asBusinessUserId
        self.assistantNudge = assistantNudge
    }
}
