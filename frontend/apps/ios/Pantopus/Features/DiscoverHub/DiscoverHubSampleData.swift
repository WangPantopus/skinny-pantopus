//
//  DiscoverHubSampleData.swift
//  Pantopus
//
//  A11.3 Discover magazine sample data. Backend is intentionally not used
//  for this surface; the view-model seeds deterministic content so previews,
//  app renders, and snapshot tests stay stable.
//

import Foundation
import SwiftUI

public enum DiscoverHubMagazineScenario: Sendable, Hashable {
    case loading
    case empty
    case populated
    case error
}

public enum DiscoverHubMagazineState: Sendable, Hashable {
    case loading
    case empty
    case populated(DiscoverHubMagazineContent)
    case error(message: String)
}

public struct DiscoverHubMagazineContent: Sendable, Hashable {
    public let pins: [DiscoverHubMapPin]
    public let cluster: DiscoverHubMapCluster
    public let tasks: [DiscoverHubTaskCard]
    public let marketplace: [DiscoverHubMarketplaceCard]
    public let posts: [DiscoverHubPostCard]
}

public enum DiscoverHubMapKind: String, CaseIterable, Sendable, Hashable {
    case task
    case item
    case post
    case spot
    case event

    public var label: String {
        switch self {
        case .task: "Task"
        case .item: "Item"
        case .post: "Post"
        case .spot: "Spot"
        case .event: "Event"
        }
    }

    public var pluralLabel: String {
        switch self {
        case .task: "Tasks"
        case .item: "Items"
        case .post: "Posts"
        case .spot: "Spots"
        case .event: "Events"
        }
    }

    public var color: Color {
        switch self {
        case .task: Theme.Color.handyman
        case .item: Theme.Color.goods
        case .post: Theme.Color.primary500
        case .spot: Theme.Color.home
        case .event: Theme.Color.business
        }
    }

    public var softColor: Color {
        switch self {
        case .task: Theme.Color.warningBg
        case .item: Theme.Color.businessBg
        case .post: Theme.Color.primary50
        case .spot: Theme.Color.homeBg
        case .event: Theme.Color.businessBg
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .task: .hammer
        case .item: .tag
        case .post: .messageCircle
        case .spot: .shoppingBag
        case .event: .calendar
        }
    }
}

public struct DiscoverHubMapPin: Identifiable, Sendable, Hashable {
    public let id: String
    public let kind: DiscoverHubMapKind
    public let x: CGFloat
    public let y: CGFloat
    public let pulses: Bool

    public init(
        id: String,
        kind: DiscoverHubMapKind,
        x: CGFloat,
        y: CGFloat,
        pulses: Bool = false
    ) {
        self.id = id
        self.kind = kind
        self.x = x
        self.y = y
        self.pulses = pulses
    }
}

public struct DiscoverHubMapCluster: Sendable, Hashable {
    public let count: Int
    public let x: CGFloat
    public let y: CGFloat
}

public struct DiscoverHubTaskCard: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let price: String
    public let distance: String
    public let bids: String
}

public struct DiscoverHubMarketplaceCard: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let price: String
    public let distance: String
    public let icon: PantopusIcon
}

public struct DiscoverHubPostCard: Identifiable, Sendable, Hashable {
    public let id: String
    public let intent: String
    public let title: String
    public let body: String
    public let author: String
    public let replies: Int
}

public enum DiscoverHubSampleData {
    public static let populated = DiscoverHubMagazineContent(
        pins: [
            DiscoverHubMapPin(id: "pin-task-1", kind: .task, x: 0.19, y: 0.53, pulses: true),
            DiscoverHubMapPin(id: "pin-item-1", kind: .item, x: 0.42, y: 0.26),
            DiscoverHubMapPin(id: "pin-spot-1", kind: .spot, x: 0.63, y: 0.63),
            DiscoverHubMapPin(id: "pin-post-1", kind: .post, x: 0.82, y: 0.39),
            DiscoverHubMapPin(id: "pin-event-1", kind: .event, x: 0.14, y: 0.84),
            DiscoverHubMapPin(id: "pin-task-2", kind: .task, x: 0.86, y: 0.84)
        ],
        cluster: DiscoverHubMapCluster(count: 9, x: 0.56, y: 0.82),
        tasks: [
            DiscoverHubTaskCard(
                id: "gig-shelves",
                title: "Hang 3 floating shelves",
                price: "$60",
                distance: "0.2 mi",
                bids: "4 bids"
            ),
            DiscoverHubTaskCard(
                id: "gig-clean",
                title: "Deep clean 2BR before move-out",
                price: "$180",
                distance: "0.5 mi",
                bids: "7 bids"
            ),
            DiscoverHubTaskCard(
                id: "gig-dog-walks",
                title: "Midday dog walks Tue/Thu",
                price: "$22/walk",
                distance: "0.3 mi",
                bids: "2 bids"
            )
        ],
        marketplace: [
            DiscoverHubMarketplaceCard(
                id: "item-sideboard",
                title: "Mid-century walnut sideboard",
                price: "$420",
                distance: "0.4 mi",
                icon: .home
            ),
            DiscoverHubMarketplaceCard(
                id: "item-bike",
                title: "Vintage Trek road bike, 56cm",
                price: "$240",
                distance: "0.7 mi",
                icon: .package
            ),
            DiscoverHubMarketplaceCard(
                id: "item-skillet",
                title: "Cast-iron Lodge skillet set",
                price: "$45",
                distance: "0.2 mi",
                icon: .utensils
            ),
            DiscoverHubMarketplaceCard(
                id: "item-kallax",
                title: "Ikea Kallax 4x4, white",
                price: "Free",
                distance: "0.6 mi",
                icon: .archive
            )
        ],
        posts: [
            DiscoverHubPostCard(
                id: "post-cardiologist",
                intent: "Ask",
                title: "Anyone know a good cardiologist nearby?",
                body: "Specifically near Hayes Valley - recently moved and looking for someone who takes Blue Shield.",
                author: "Maya - 0.1 mi",
                replies: 8
            ),
            DiscoverHubPostCard(
                id: "post-ramen",
                intent: "Recommend",
                title: "The new ramen place on Divisadero is fantastic",
                body: "Went last night. Tonkotsu was excellent. They open at 5 and the line moves fast.",
                author: "Dre - 0.3 mi",
                replies: 14
            )
        ]
    )

    public static let emptySkeletonRailTitles = [
        "Tasks near you",
        "Marketplace picks"
    ]
}
