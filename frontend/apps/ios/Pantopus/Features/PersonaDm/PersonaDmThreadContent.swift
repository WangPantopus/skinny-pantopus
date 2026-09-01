//
//  PersonaDmThreadContent.swift
//  Pantopus
//
//  A15.4 "Creator thread" / A15.5 "Fan thread" — render models for the
//  persona-DM thread. This is a *separate surface* from generic chat:
//  there is no counterparty user id, the header renders the persona (fan
//  view) or the fan's pseudonymous handle (creator view), and a fan-side
//  reply-policy banner states the SLA the creator committed to.
//

import Foundation

/// Which side of the thread the signed-in viewer is on.
public enum PersonaDmViewerRole: String, Sendable, Hashable {
    case fan
    case creator

    init(wire: String?) {
        self = wire == "creator" ? .creator : .fan
    }
}

/// One rendered bubble. `fromViewer` drives the right/left alignment and
/// the filled/outlined bubble treatment.
public struct PersonaDmMessageContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let fromViewer: Bool
    public let body: String
    public let timeLabel: String
    /// "Read" receipt shown under the viewer's own bubbles once the other
    /// side has opened the thread.
    public let readByCounterparty: Bool

    public init(
        id: String,
        fromViewer: Bool,
        body: String,
        timeLabel: String,
        readByCounterparty: Bool
    ) {
        self.id = id
        self.fromViewer = fromViewer
        self.body = body
        self.timeLabel = timeLabel
        self.readByCounterparty = readByCounterparty
    }
}

/// Fan-side reply-policy banner. `.missed` is the state that unlocks the
/// membership refund request (`reason: sla_missed`).
public struct PersonaDmPolicyBanner: Sendable, Hashable {
    public enum Kind: Sendable, Hashable {
        case onTrack
        case missed
    }

    public let kind: Kind
    public let text: String

    public init(kind: Kind, text: String) {
        self.kind = kind
        self.text = text
    }
}

/// Loaded thread composition.
public struct PersonaDmThreadLoaded: Sendable, Hashable {
    /// `@handle` of the other side (persona for a fan, fan for a creator).
    public let title: String
    /// Display name of the other side.
    public let subtitle: String
    public let initials: String
    public let viewerRole: PersonaDmViewerRole
    public let policyBanner: PersonaDmPolicyBanner?
    public let messages: [PersonaDmMessageContent]

    public init(
        title: String,
        subtitle: String,
        initials: String,
        viewerRole: PersonaDmViewerRole,
        policyBanner: PersonaDmPolicyBanner?,
        messages: [PersonaDmMessageContent]
    ) {
        self.title = title
        self.subtitle = subtitle
        self.initials = initials
        self.viewerRole = viewerRole
        self.policyBanner = policyBanner
        self.messages = messages
    }

    /// Same header with a different message list — used after an optimistic
    /// send so the composer can clear before the refetch lands.
    public func replacingMessages(_ next: [PersonaDmMessageContent]) -> PersonaDmThreadLoaded {
        PersonaDmThreadLoaded(
            title: title,
            subtitle: subtitle,
            initials: initials,
            viewerRole: viewerRole,
            policyBanner: policyBanner,
            messages: next
        )
    }
}

/// Top-level render state. `.empty` carries the resolved header so the
/// chrome stays stable while the "no messages yet" body renders.
public enum PersonaDmThreadState: Sendable {
    case loading
    case loaded(PersonaDmThreadLoaded)
    case empty(PersonaDmThreadLoaded)
    case error(message: String)
}
