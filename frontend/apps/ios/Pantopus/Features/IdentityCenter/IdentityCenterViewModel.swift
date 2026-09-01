//
//  IdentityCenterViewModel.swift
//  Pantopus
//
//  Backs the T3.2 Profiles & Privacy screen. Fetches
//  `GET /api/identity-center`, projects the backend payload into
//  the four identity cards + Profile-links toggles + privacy and
//  disclosure rows. Toggle taps PATCH
//  `/api/identity-center/bridges/:personaId` optimistically with
//  rollback.
//

import Foundation
import Observation

@Observable
@MainActor
public final class IdentityCenterViewModel {
    public private(set) var state: IdentityCenterState = .loading

    private let api: APIClient
    private var raw: IdentityCenterResponse?

    init(api: APIClient = .shared) {
        self.api = api
    }

    public func load() async {
        state = .loading
        do {
            let response: IdentityCenterResponse = try await api.request(IdentityCenterEndpoints.overview)
            raw = response
            rebuild()
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load Profiles & Privacy."
            state = .error(message: message)
        }
    }

    /// Toggle one of the "Profile links" rows. Mutation is
    /// optimistic; we PATCH the backend and roll back the local
    /// `bridges` snapshot on failure.
    public func setBridge(_ rowId: String, isOn: Bool) async {
        guard let raw, let personaId = raw.audienceProfile?.id else { return }
        let previous = raw.bridges
        // Backend `Joi` schema requires BOTH booleans on every PATCH —
        // seed with the current snapshot so the untouched row keeps
        // its server-canonical value.
        var body = UpdateBridgesBody(
            showPersonaOnLocal: previous?.showPersonaOnLocal ?? false,
            showLocalOnPersona: previous?.showLocalOnPersona ?? false
        )
        switch rowId {
        case "showPublicOnLocal":
            body.showPersonaOnLocal = isOn
        case "showLocalOnPublic":
            body.showLocalOnPersona = isOn
        default: return
        }
        // Apply optimistically.
        self.raw = raw.updatingBridges(isOn: isOn, rowId: rowId)
        rebuild()
        do {
            let _: BridgesEchoResponse = try await api.request(
                IdentityCenterEndpoints.updateBridges(personaId: personaId, body: body)
            )
            // Server-canonical bridges win on the next load; nothing
            // to do here.
        } catch {
            // Roll back.
            self.raw = raw.updatingBridges(snapshot: previous)
            rebuild()
        }
    }

    static func project(_ response: IdentityCenterResponse) -> IdentityCenterLoaded {
        let identities: [IdentityCardContent] = [
            localCard(response.localProfile),
            personalCard(response.privateAccount),
            publicProfileCard(response.audienceProfile, personaCount: response.personaCount ?? 0),
            professionalCard(response.businessProfiles ?? [])
        ]
        let hasAudience = response.audienceProfile != nil
        let bridges: [IdentityBridgeRow] =
            hasAudience
                ? [
                    IdentityBridgeRow(
                        id: "showPublicOnLocal",
                        label: "Show my Public profile on my Local Profile",
                        subtext: "Neighbors can find your Public profile from your Local Profile.",
                        isOn: response.bridges?.showPersonaOnLocal ?? false
                    ),
                    IdentityBridgeRow(
                        id: "showLocalOnPublic",
                        label: "Show my Local Profile on my Public profile",
                        subtext: "Followers can see your neighbor name and home if they tap through.",
                        isOn: response.bridges?.showLocalOnPersona ?? false
                    )
                ]
                : []
        let homes = response.homes ?? []
        let homesValue = homes.isEmpty ? "Not connected" : "\(homes.count) connected"
        let privacyRows = [
            IdentityRowContent(
                id: "blockedPersonal",
                icon: .shield,
                label: "Blocked accounts",
                trailing: "\(response.blockCounts?.personal ?? 0)"
            ),
            IdentityRowContent(
                id: "blockedAudience",
                icon: .shield,
                label: "Blocked followers",
                trailing: "\(response.blockCounts?.audience ?? 0)"
            ),
            IdentityRowContent(
                id: "privacyPreview",
                icon: .eye,
                label: "Privacy Preview",
                subtext: "Open the visitor's view of your profiles."
            )
        ]
        let disclosureRows = [
            IdentityRowContent(
                id: "homes",
                icon: .home,
                label: "Homes",
                trailing: homesValue
            ),
            IdentityRowContent(
                id: "businessProfiles",
                icon: .briefcase,
                label: "Business Profiles",
                trailing: "\((response.businessProfiles ?? []).count)"
            ),
            IdentityRowContent(
                id: "dataExport",
                icon: .file,
                label: "Data export",
                subtext: "Download everything we know about your identities."
            )
        ]
        let setupRemaining = identities.filter {
            if case .setupNeeded = $0.status { return true }
            return false
        }.count
        return IdentityCenterLoaded(
            identities: identities,
            bridges: bridges,
            privacyRows: privacyRows,
            disclosureRows: disclosureRows,
            setupRemainingCount: setupRemaining
        )
    }

    // MARK: - Per-card projection

    private static func localCard(_ dto: LocalProfileDTO?) -> IdentityCardContent {
        guard let dto else {
            return IdentityCardContent(
                id: "local",
                kind: .local,
                overline: "Local Profile",
                name: "Set up your neighbor identity",
                summary: "Local Profile lets verified neighbors find you in posts, gigs, and marketplace.",
                status: .setupNeeded(cta: "Set up")
            )
        }
        let posts = dto.postCount ?? 0
        let connections = dto.connectionCount ?? 0
        let verified = dto.verified ?? false
        let stats =
            "\(posts) \(posts == 1 ? "post" : "posts") · "
                + "\(connections) \(connections == 1 ? "connection" : "connections")"
                + (verified ? " · Verified neighbor" : "")
        return IdentityCardContent(
            id: dto.id,
            kind: .local,
            overline: "Local Profile",
            name: dto.displayName ?? "Local Profile",
            handle: dto.handle.map { "/" + $0 },
            stats: stats,
            summary: "For nearby posts, gigs, marketplace, and neighbors."
        )
    }

    private static func personalCard(_ dto: PrivateAccountDTO?) -> IdentityCardContent {
        let name = dto?.email ?? dto?.name ?? "Personal"
        return IdentityCardContent(
            id: dto?.id ?? "personal",
            kind: .personal,
            overline: "Personal",
            name: name,
            stats: "Visible only to verified connections",
            summary: "Account-level identity. Used for sign-in and direct correspondence."
        )
    }

    private static func publicProfileCard(_ dto: AudienceProfileDTO?, personaCount: Int) -> IdentityCardContent {
        guard let dto else {
            let cta = personaCount > 0 ? "Activate" : "Create"
            return IdentityCardContent(
                id: "publicProfile",
                kind: .publicProfile,
                overline: "Public profile",
                name: "Create your public face",
                summary: "Followers find your Public profile here. Update them when you ship work.",
                status: .setupNeeded(cta: cta)
            )
        }
        let followers = dto.followerCount ?? 0
        let stats =
            "\(followers) \(followers == 1 ? "follower" : "followers")"
                + (dto.postCadence.map { " · \($0)" } ?? "")
        let chip = dto.status?.lowercased() == "live"
            ? IdentityChip(label: "Live", tone: .success)
            : nil
        let rightLabel = followers >= 1000
            ? "\(followers / 1000).\(followers % 1000 / 100)k followers"
            : "\(followers) followers"
        return IdentityCardContent(
            id: dto.id,
            kind: .publicProfile,
            overline: "Public profile",
            name: dto.displayName ?? "Public profile",
            handle: dto.handle.map { "@" + $0 },
            stats: stats,
            summary: "Your public creator face. Followers stay with you here.",
            chip: chip ?? IdentityChip(label: rightLabel, tone: .neutral)
        )
    }

    private static func professionalCard(_ businesses: [BusinessIdentityDTO]) -> IdentityCardContent {
        guard let first = businesses.first else {
            return IdentityCardContent(
                id: "professional",
                kind: .professional,
                overline: "Professional",
                name: "Add your trade",
                summary: "Hireable identity. Surfaced in Gigs and Marketplace.",
                status: .setupNeeded(cta: "Add")
            )
        }
        return IdentityCardContent(
            id: first.id,
            kind: .professional,
            overline: "Professional",
            name: first.displayName ?? "Business",
            stats: businesses.count > 1 ? "+ \(businesses.count - 1) more" : "Available for hire",
            summary: "Hireable trade profile. Surfaced in Gigs and Marketplace."
        )
    }

    private func rebuild() {
        guard let raw else { return }
        state = .loaded(Self.project(raw))
    }
}

private extension IdentityCenterResponse {
    func updatingBridges(isOn: Bool, rowId: String) -> IdentityCenterResponse {
        let current = bridges ?? BridgesDTO(showPersonaOnLocal: false, showLocalOnPersona: false)
        let next: BridgesDTO = switch rowId {
        case "showPublicOnLocal":
            BridgesDTO(showPersonaOnLocal: isOn, showLocalOnPersona: current.showLocalOnPersona)
        case "showLocalOnPublic":
            BridgesDTO(showPersonaOnLocal: current.showPersonaOnLocal, showLocalOnPersona: isOn)
        default:
            current
        }
        return updatingBridges(snapshot: next)
    }

    func updatingBridges(snapshot: BridgesDTO?) -> IdentityCenterResponse {
        IdentityCenterResponse(
            privateAccount: privateAccount,
            localProfile: localProfile,
            audienceProfile: audienceProfile,
            bridges: snapshot,
            homes: homes,
            businessProfiles: businessProfiles,
            personaCount: personaCount,
            blockCounts: blockCounts
        )
    }
}

/// PATCH response — we ignore the body, just need the success signal.
/// Backend route emits `{ "bridge": {...} }` (singular).
struct BridgesEchoResponse: Decodable {
    let bridge: BridgesDTO?
}
