//
//  MarketplaceTabRoot.swift
//  Pantopus
//
//  Marketplace tab — local listings grid. Mirrors the React Native
//  Marketplace tab; hosts its own NavigationStack.
//

import SwiftUI

// swiftlint:disable function_body_length multiple_closures_with_trailing_closure

/// Typed routes within the Marketplace tab's NavigationStack.
public enum MarketplaceRoute: Hashable {
    case listingDetail(listingId: String)
    case composeListing
    case editListing(listingId: String, jumpToStep: ListingComposeStep?)
    case listingOffers(listingId: String, titleHint: String?)
    case publicProfile(userId: String)
    case chatConversation(InboxConversationDestination)
}

/// NavigationStack wrapper for the Marketplace tab.
public struct MarketplaceTabRoot: View {
    @Environment(AuthManager.self) private var auth
    @State private var path = RouteStack<MarketplaceRoute>()
    @State private var router = DeepLinkRouter.shared
    @State private var systemSheet: SystemSheetRequest?

    public init() {}

    private var currentUserId: String {
        if case let .signedIn(user) = auth.state { return user.id }
        return ""
    }

    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let joined = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return joined.isEmpty ? "··" : joined
    }

    public var body: some View {
        NavigationStack(path: navigationPathBinding) {
            MarketplaceView(
                onOpenListing: { listingId in
                    path.append(.listingDetail(listingId: listingId))
                },
                onCompose: { path.append(.composeListing) },
                onBack: nil
            )
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: MarketplaceRoute.self) { route in
                destination(for: route)
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
        .onChange(of: router.pending) { _, pending in
            consumeDeepLinkIfNeeded(pending: pending)
        }
        .task {
            consumeDeepLinkIfNeeded(pending: router.pending)
        }
        .sheet(item: $systemSheet) { request in request.makeView() }
    }

    private var navigationPathBinding: Binding<NavigationPath> {
        Binding(
            get: { path.navigationPath },
            set: { path.replaceNavigationPath($0) }
        )
    }

    private func consumeDeepLinkIfNeeded(pending: DeepLinkRouter.Destination?) {
        guard let pending else { return }
        switch pending {
        case let .listing(id):
            path.replaceNavigationPath(NavigationPath())
            path.append(.listingDetail(listingId: id))
            _ = router.consume()
        default:
            break
        }
    }

    @MainActor
    private func pop() {
        if !path.isEmpty { path.removeLast() }
    }

    @ViewBuilder
    private func destination(for route: MarketplaceRoute) -> some View {
        switch route {
        case let .listingDetail(listingId):
            ListingDetailView(
                viewModel: ListingDetailViewModel(listingId: listingId),
                onBack: pop,
                onMessage: { listing in
                    Task { @MainActor in
                        guard let sellerId = listing.userId else { return }
                        let name = listing.title ?? "Seller"
                        path.append(.chatConversation(InboxConversationDestination(
                            mode: .person(otherUserId: sellerId),
                            displayName: name,
                            initials: Self.initials(from: name),
                            identityKind: nil,
                            verified: false,
                            initialTopic: ChatInitialTopic(topicType: "listing", topicRefId: listing.id, title: name)
                        )))
                    }
                },
                onViewOffers: { dto in
                    Task { @MainActor in
                        path.append(.listingOffers(listingId: dto.id, titleHint: dto.title))
                    }
                },
                onEditListing: { dto in
                    Task { @MainActor in
                        path.append(.editListing(listingId: dto.id, jumpToStep: nil))
                    }
                }
            )
        case .composeListing:
            ListingComposeWizardView { listingId in
                path.removeAll { route in
                    if case .composeListing = route { return true }
                    return false
                }
                path.append(.listingDetail(listingId: listingId))
            }
        case let .editListing(listingId, jumpToStep):
            ListingComposeWizardView(
                mode: .edit(listingId: listingId, jumpToStep: jumpToStep),
                // swiftlint:disable:next trailing_closure
                onListingUpdated: { _ in pop() }
            )
        case let .listingOffers(listingId, titleHint):
            ListingOffersView(
                viewModel: ListingOffersViewModel(
                    listingId: listingId,
                    listingTitleHint: titleHint,
                    onShareListing: {
                        let name = titleHint ?? "this listing"
                        systemSheet = .share(
                            items: ["Check out \(name) on Pantopus — \(InviteLinks.downloadURLString)"]
                        )
                    },
                    onOpenBuyer: { buyer in
                        Task { @MainActor in path.append(.publicProfile(userId: buyer.id)) }
                    },
                    onOpenTransaction: { _ in },
                    onEditPrice: {
                        Task { @MainActor in
                            path.append(.editListing(listingId: listingId, jumpToStep: .price))
                        }
                    }
                )
            )
        case let .publicProfile(userId):
            PublicProfileView(
                userId: userId,
                onBack: pop,
                onOpenGig: { gigId in
                    // The Marketplace stack has no gig-detail route; hand
                    // the public `/gig/:id` link to the router, which
                    // switches to the Tasks tab and pushes it there
                    // (`RootTabView.swift:149`, `TasksTabRoot.swift:100`).
                    Task { @MainActor in DeepLinkRouter.shared.handle(path: "/gig/\(gigId)") }
                },
                onOpenProfile: { reviewerId in
                    Task { @MainActor in path.append(.publicProfile(userId: reviewerId)) }
                }
            )
        case let .chatConversation(dest):
            ChatConversationView(
                viewModel: ChatConversationViewModel(
                    mode: Self.chatMode(for: dest.mode),
                    counterparty: Self.chatCounterparty(for: dest),
                    currentUserId: currentUserId,
                    initialTopic: dest.initialTopic
                ),
                mode: dest.kind,
                onUseAIDraft: { draft in
                    if draft.type == "listing" {
                        path.append(.composeListing)
                    }
                }
            ) {
                pop()
            }
        }
    }

    private static func chatMode(for mode: InboxConversationDestination.Mode) -> ChatThreadMode {
        switch mode {
        case .ai: .ai
        case let .room(id): .room(id: id)
        case let .person(otherUserId): .person(otherUserId: otherUserId)
        }
    }

    private static func chatCounterparty(for dest: InboxConversationDestination) -> ChatCounterparty {
        switch dest.mode {
        case .ai:
            .ai(name: dest.displayName)
        case .room:
            .group(name: dest.displayName, memberCount: nil)
        case .person:
            .person(
                name: dest.displayName,
                initials: dest.initials,
                locality: nil,
                verified: dest.verified,
                online: false
            )
        }
    }
}

#Preview {
    MarketplaceTabRoot()
        .environment(AuthManager.previewSignedIn)
}
