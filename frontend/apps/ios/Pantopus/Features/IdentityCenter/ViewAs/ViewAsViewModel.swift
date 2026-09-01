//
//  ViewAsViewModel.swift
//  Pantopus
//
//  B5.2 (A18.5) / P1-F — backs the "View as" identity preview: render YOUR
//  profile as a chosen `ViewerAudience` would see it.
//
//  The production path resolves the preview live from
//  `GET /api/identity-center/view-as` (route `identityCenter.js:489`), which
//  performs the per-field privacy resolution server-side and returns the
//  `visible` profile + the `hidden` field keys. The view-model maps that onto
//  the design's disclosure ladder (location / member-since / rating / mutuals
//  / contact) plus the banner, badges, and note. Fields the backend doesn't
//  surface degrade to `.hidden` (graceful — there is no error state on this
//  screen, so a fetch failure falls back to the local sample render).
//
//  Previews / snapshots / tests still drive the deterministic
//  `ViewAsSampleData` matrix via `init(selected:startLoaded:)`.
//

import Foundation
import Observation

@Observable
@MainActor
public final class ViewAsViewModel {
    public private(set) var state: ViewAsState
    public private(set) var selected: ViewerAudience

    private let api: APIClient
    private let isLive: Bool

    /// Production initializer — live privacy resolution. Public-safe: no
    /// `APIClient` parameter (the client is module-internal).
    public convenience init() {
        self.init(api: .shared)
    }

    /// Designated live initializer. `api` injectable for tests.
    init(api: APIClient, selected: ViewerAudience = .connection) {
        self.api = api
        self.selected = selected
        isLive = true
        state = .loading
    }

    /// Sample/preview path. `startLoaded` seeds straight into `.loaded` from
    /// the local privacy matrix; the live screen leaves it false.
    public init(selected: ViewerAudience, startLoaded: Bool = false) {
        api = .shared
        self.selected = selected
        isLive = false
        state = startLoaded
            ? .loaded(ViewAsLoaded(selected: selected, render: ViewAsSampleData.render(for: selected)))
            : .loading
    }

    /// Resolve the initial render.
    public func load() async {
        if isLive {
            await fetchLive(showLoading: true)
        } else {
            resolveSample()
        }
    }

    /// Switch the previewed audience and re-resolve the render.
    public func select(_ viewer: ViewerAudience) {
        guard viewer != selected else { return }
        selected = viewer
        if isLive {
            Task { @MainActor in await fetchLive(showLoading: false) }
        } else if case .loaded = state {
            resolveSample()
        }
    }

    // MARK: - Sample path

    private func resolveSample() {
        state = .loaded(
            ViewAsLoaded(selected: selected, render: ViewAsSampleData.render(for: selected))
        )
    }

    // MARK: - Live path

    private func fetchLive(showLoading: Bool) async {
        if showLoading { state = .loading }
        let params = Self.backendParams(for: selected)
        do {
            let response: ViewAsResponse = try await api.request(
                IdentityCenterEndpoints.viewAs(surface: params.surface, viewer: params.viewer)
            )
            let render = Self.makeRender(from: response, audience: selected)
            state = .loaded(ViewAsLoaded(selected: selected, render: render))
        } catch {
            // No error state on this surface — fall back to the local sample
            // render so the screen always shows something.
            state = .loaded(
                ViewAsLoaded(selected: selected, render: ViewAsSampleData.render(for: selected))
            )
        }
    }

    /// Map the iOS audience onto the backend `surface` + `viewer` query.
    static func backendParams(for audience: ViewerAudience) -> (surface: String, viewer: String) {
        switch audience {
        case .public: ("local", "public")
        case .personaAudience: ("persona", "persona_audience_member")
        case .neighbor: ("local", "neighbor")
        case .gigParticipant: ("local", "gig_participant")
        case .household: ("local", "household_member")
        case .connection: ("local", "connection")
        }
    }

    // MARK: - Mapping (pure — unit-test surface)

    /// Project the privacy-resolved response onto the design render. Optional
    /// `visible` fields degrade to `.hidden` so a sparse payload never crashes.
    static func makeRender(from response: ViewAsResponse, audience: ViewerAudience) -> ViewAsRender {
        let visible = response.visible
        let hidden = Set((response.hidden ?? []).map { $0.lowercased() })
        let context = response.context
        let fields = [
            locationField(visible?.locality, hidden: hidden),
            ViewAsField(id: "memberSince", icon: .calendar, label: "Member since", disclosure: .hidden),
            ratingField(visible?.stats),
            mutualsField(context, hidden: hidden),
            contactField(visible?.viewer, hidden: hidden)
        ]
        let hiddenCount = fields.filter(\.disclosure.isHidden).count
        let tone: ViewAsTone = hiddenCount >= 3 ? .restricted : .info
        let label = response.viewerLabel ?? audience.label
        let name = visible?.displayName ?? "You"
        return ViewAsRender(
            viewer: audience,
            banner: ViewAsBanner(
                icon: bannerIcon(for: audience),
                viewerLabel: label,
                subtitle: tone == .restricted ? "Most details are hidden" : "This is what they see",
                tone: tone
            ),
            head: ViewAsHead(
                name: name,
                handle: visible?.handle.map { "@\($0)" },
                initials: initials(from: name),
                avatarTone: audience == .public ? .masked : .personal,
                identity: .personal,
                verified: visible?.badges?.contains("verified_resident") ?? false
            ),
            badges: badges(from: visible?.badges ?? []),
            fields: fields,
            note: ViewAsContextNote(
                icon: tone == .restricted ? .eyeOff : .users,
                text: noteText(tone: tone, label: label),
                tone: tone
            ),
            footerText: "Resolved live from your privacy settings."
        )
    }

    // MARK: - Field mappers

    private static func locationField(
        _ locality: ViewAsResponse.ViewAsVisibleProfile.Locality?,
        hidden: Set<String>
    ) -> ViewAsField {
        let disclosure: ViewAsFieldDisclosure
        if hidden.contains(where: { $0.contains("local") }) {
            disclosure = .hidden
        } else if let neighborhood = locality?.neighborhood, !neighborhood.isEmpty {
            disclosure = .visible(neighborhood)
        } else if let city = locality?.city, !city.isEmpty {
            let state = locality?.state.map { ", \($0)" } ?? ""
            disclosure = .coarse("\(city)\(state)")
        } else {
            disclosure = .hidden
        }
        return ViewAsField(id: "location", icon: .mapPin, label: "Location", disclosure: disclosure)
    }

    private static func ratingField(_ stats: ViewAsResponse.ViewAsVisibleProfile.Stats?) -> ViewAsField {
        let disclosure: ViewAsFieldDisclosure = if let reviews = stats?.reviews, reviews > 0 {
            .visible("\(reviews) review\(reviews == 1 ? "" : "s")")
        } else {
            .hidden
        }
        return ViewAsField(id: "rating", icon: .star, label: "Rating", disclosure: disclosure)
    }

    private static func mutualsField(_ context: ViewAsResponse.ViewAsContextDTO?, hidden: Set<String>) -> ViewAsField {
        let shared = (context?.isConnection == true || context?.isNeighbor == true)
            && !hidden.contains { $0.contains("mutual") || $0.contains("connection") }
        return ViewAsField(
            id: "mutuals",
            icon: .users,
            label: "Mutual connections",
            disclosure: shared ? .visible("Mutual neighbors in common") : .hidden
        )
    }

    private static func contactField(
        _ viewer: ViewAsResponse.ViewAsVisibleProfile.ViewerRelationship?,
        hidden: Set<String>
    ) -> ViewAsField {
        let canContact = viewer?.canMessage == true
            && !hidden.contains { $0.contains("contact") || $0.contains("phone") }
        return ViewAsField(
            id: "contact",
            icon: .phone,
            label: "Contact",
            disclosure: canContact ? .visible("Available on request") : .hidden
        )
    }

    // MARK: - Render helpers

    private static func badges(from keys: [String]) -> [ViewAsBadge] {
        let set = Set(keys)
        return [
            ViewAsBadge(
                id: "resident",
                icon: set.contains("verified_resident") ? .badgeCheck : .lock,
                label: "Verified neighbor",
                isOn: set.contains("verified_resident")
            ),
            ViewAsBadge(
                id: "id",
                icon: set.contains("id_verified") ? .badgeCheck : .lock,
                label: "ID verified",
                isOn: set.contains("id_verified")
            ),
            ViewAsBadge(
                id: "phone",
                icon: set.contains("phone_verified") ? .phone : .lock,
                label: "Phone verified",
                isOn: set.contains("phone_verified")
            )
        ]
    }

    private static func bannerIcon(for audience: ViewerAudience) -> PantopusIcon {
        switch audience {
        case .public: .globe
        case .personaAudience: .megaphone
        case .neighbor: .mapPin
        case .gigParticipant: .briefcase
        case .household: .home
        case .connection: .userCheck
        }
    }

    private static func noteText(tone: ViewAsTone, label: String) -> String {
        tone == .restricted
            ? "Most details stay private to \(label.lowercased())."
            : "\(label) sees your shared local profile and approximate area."
    }

    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first.map(String.init) }.joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }
}
