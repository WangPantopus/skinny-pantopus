//
//  HomeSettingsViewModel.swift
//  Pantopus
//
//  P5.1 / A14.1 — `GroupedListDataSource` for the per-home Settings
//  index. This is a NAVIGATION index (chevron rows that route to the
//  Address / Photos / People / … sub-screens), not a settings form —
//  there is no settings `PATCH` here.
//
//  Block 2A wiring: the live path (no explicit `frame`) fetches the
//  real home so the identity card shows `home.name` + address, and the
//  People row's subtext reflects the real member / pending counts from
//  the same `GET /:id/occupants` the Members screen uses. Rows whose
//  subtext has no backend source are left bare rather than faked. An
//  explicit `frame` keeps the view-model local (the preview / snapshot
//  seam) and reproduces the original sample frames verbatim.
//
//  The one mutation this screen owns is the inline rename on the
//  identity card — RN's nickname editor
//  (`src/app/homes/[id]/settings/index.tsx:89-108`) — which PATCHes
//  `/api/homes/:id`. Everything else is still navigation.
//

import Foundation
import Observation

/// Sentinel routes the per-home Settings index can ask its host to
/// push. Mirrors the global `SettingsRoute` shape but scoped to a
/// single home.
public enum HomeSettingsRoute: Sendable, Hashable {
    case address
    case propertyDetails
    case photos
    case documents
    case accessCodes
    case trustedNeighbors
    case security
    /// A14.2 (policy variant) — per-home ownership security policy
    /// (`/api/homes/:id/security`). Distinct from `.security`, which is
    /// the 9-toggle privacy screen on `/api/homes/:id/privacy`.
    case ownershipSecurity
    case people
    case inviteLink
    case homeNotifications
    case leaveHome
    case cancelClaim
}

@Observable
@MainActor
public final class HomeSettingsViewModel: GroupedListDataSource {
    public var title: String {
        "Home settings"
    }

    public private(set) var footerCaption: String?

    public private(set) var state: GroupedListState = .loading

    public let homeId: String
    /// Identity strip above the first group. Seeded from sample for
    /// previews; replaced with real `home.name` + verification chip once
    /// the live fetch resolves.
    public private(set) var identity: HomeSettingsSampleData.Identity

    /// Established vs newly-claimed shape. Seeded for previews; derived
    /// from `isPendingOwner` / `pendingClaimId` on the live path.
    private var frame: HomeSettingsSampleData.Frame

    // MARK: - Inline rename (RN nickname editor)

    /// True when the viewer may rename this home. Mirrors RN's `canEdit`
    /// (`settings/index.tsx:47`): owner, or an IAM role/permission that
    /// carries `home.edit`. The backend enforces the same gate on
    /// `PATCH /api/homes/:id` (`home.js:3110`).
    public private(set) var canEditHome = false
    /// True while the identity card renders the text field instead of
    /// the home name.
    public private(set) var isRenaming = false
    /// Draft the text field binds to.
    public var renameDraft = ""
    public private(set) var isSavingName = false
    /// Inline error under the field when the PATCH fails.
    public private(set) var renameError: String?

    /// Non-nil → preview / test seam (project the sample frame, no fetch).
    private let sampleFrame: HomeSettingsSampleData.Frame?
    private let client: APIClient

    /// Row subtexts resolved for the active frame. The seeded path fills
    /// every slot from the sample fixture; the live path fills only the
    /// slots a real endpoint backs and leaves the rest `nil`.
    private struct RowSubtexts {
        var address: String?
        var propertyDetails: String?
        var photos: String?
        var documents: String?
        var accessCodes: String?
        var trustedNeighbors: String?
        var privacy: String?
        var people: String?
        var inviteLink: String?
        var notifications: String?
    }

    private var subtexts: RowSubtexts

    private static let routeByRowId: [String: HomeSettingsRoute] = [
        "address": .address,
        "propertyDetails": .propertyDetails,
        "photos": .photos,
        "documents": .documents,
        "accessCodes": .accessCodes,
        "trustedNeighbors": .trustedNeighbors,
        "privacy": .security,
        "ownershipSecurity": .ownershipSecurity,
        "people": .people,
        "inviteLink": .inviteLink,
        "homeNotifications": .homeNotifications,
        "leaveHome": .leaveHome,
        "cancelClaim": .cancelClaim
    ]

    private let onNavigate: @MainActor (HomeSettingsRoute) -> Void

    init(
        homeId: String,
        frame: HomeSettingsSampleData.Frame? = nil,
        client: APIClient = .shared,
        onNavigate: @escaping @MainActor (HomeSettingsRoute) -> Void = { _ in }
    ) {
        self.homeId = homeId
        sampleFrame = frame
        self.client = client
        self.onNavigate = onNavigate
        let resolved = frame ?? HomeSettingsSampleData.frame(forHomeId: homeId)
        self.frame = resolved
        identity = HomeSettingsSampleData.identity(for: resolved)
        footerCaption = HomeSettingsSampleData.footer(for: resolved)
        subtexts = Self.sampleSubtexts(for: resolved)
    }

    public func load() async {
        // Preview / test seam: an explicit sample frame keeps the
        // view-model purely local so snapshots reproduce verbatim.
        if let sampleFrame {
            frame = sampleFrame
            identity = HomeSettingsSampleData.identity(for: sampleFrame)
            footerCaption = HomeSettingsSampleData.footer(for: sampleFrame)
            subtexts = Self.sampleSubtexts(for: sampleFrame)
            state = .loaded(groups())
            return
        }

        state = .loading
        do {
            // Member counts + viewer access are best-effort — a failure on
            // either still lets the identity card + navigation render.
            async let detailRequest = client.request(
                HomesEndpoints.detail(homeId: homeId),
                as: HomeDetailResponse.self
            )
            async let occupantsResult = client.perform(
                HomesEndpoints.listOccupants(homeId: homeId),
                as: OccupantsResponse.self
            )
            async let accessResult = client.perform(
                HomeAdminEndpoints.myAccess(homeId: homeId),
                as: HomeAccessDTO.self
            )
            let detail = try await detailRequest
            let occupants = try? await (occupantsResult).get()
            let access = try? await (accessResult).get()
            apply(detail: detail.home, occupants: occupants, access: access)
            state = .loaded(groups())
        } catch {
            state = .error(message: "We couldn't load this home's settings. Check your connection and try again.")
        }
    }

    // MARK: - Inline rename

    /// Swap the identity card's name for the text field. No-op when the
    /// viewer can't edit — RN disables the row the same way.
    public func beginRenaming() {
        guard canEditHome, !isSavingName else { return }
        renameDraft = identity.homeName
        renameError = nil
        isRenaming = true
    }

    /// Discard the draft and drop back to the read-only name — RN's
    /// close button (`settings/index.tsx:103`).
    public func cancelRenaming() {
        isRenaming = false
        renameDraft = identity.homeName
        renameError = nil
    }

    /// `PATCH /api/homes/:id` with the trimmed draft, then re-read the
    /// home so every derived caption follows the new name.
    public func saveRenaming() async {
        let trimmed = renameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canEditHome, !isSavingName else { return }
        guard !trimmed.isEmpty else {
            renameError = "Enter a name for this home."
            return
        }
        guard trimmed.count <= Self.nameMaxLength else {
            renameError = "Keep the name under \(Self.nameMaxLength) characters."
            return
        }
        isSavingName = true
        renameError = nil
        defer { isSavingName = false }
        do {
            _ = try await client.request(
                HomeSettingsEndpoints.updateHome(
                    homeId: homeId,
                    request: UpdateHomeRequest(name: trimmed)
                ),
                as: UpdateHomeResponse.self
            )
            isRenaming = false
            await load()
        } catch {
            renameError = (error as? APIError)?.errorDescription
                ?? "Couldn't rename this home. Try again."
        }
    }

    /// `updateHomeSchema`'s `name: Joi.string().max(120)`
    /// (`backend/routes/home.js:143`).
    static let nameMaxLength = 120

    public func tapRow(_ rowId: String) async {
        guard let route = Self.routeByRowId[rowId] else { return }
        onNavigate(route)
    }

    public func toggleRow(_: String, isOn _: Bool) async {}
    public func selectRadio(_: String) async {}
    public func setSlider(_: String, index _: Int) async {}

    // MARK: - Live mapping

    private func apply(detail: HomeDetail, occupants: OccupantsResponse?, access: HomeAccessDTO?) {
        let isPending = detail.isPendingOwner || detail.pendingClaimId != nil
        frame = isPending ? .pending : .populated
        canEditHome = Self.canEdit(detail: detail, access: access)

        let homeName = detail.base.name?.nonEmpty
            ?? detail.base.address?.nonEmpty
            ?? "This home"
        identity = HomeSettingsSampleData.Identity(
            homeName: homeName,
            addressChipLabel: isPending ? "Verifying" : "Verified",
            addressChipTone: isPending ? .warning : .success
        )
        footerCaption = "\(homeName) · \(isPending ? "Claim pending" : "Owner")"

        var resolved = RowSubtexts()
        resolved.address = Self.addressLine(for: detail.base)
        resolved.propertyDetails = Self.humanizedHomeType(detail.base.homeType)
        resolved.people = Self.peopleSubtext(occupants: occupants)
        subtexts = resolved
        if !isRenaming { renameDraft = identity.homeName }
    }

    /// RN's `canEdit` (`settings/index.tsx:47`): owner, an explicit
    /// `home.edit` permission, or an owner/admin base role. `GET /:id/me`
    /// is best-effort, so fall back to the detail payload's `isOwner`.
    private static func canEdit(detail: HomeDetail, access: HomeAccessDTO?) -> Bool {
        guard let access else { return detail.isOwner }
        if access.isOwner || detail.isOwner { return true }
        if access.permissions.contains("home.edit") { return true }
        return access.roleBase == "owner" || access.roleBase == "admin"
    }

    private static func addressLine(for home: HomeDTO) -> String? {
        guard let street = home.address?.nonEmpty else { return nil }
        if let city = home.city?.nonEmpty {
            return "\(street), \(city)"
        }
        return street
    }

    private static func humanizedHomeType(_ raw: String?) -> String? {
        guard let raw = raw?.nonEmpty else { return nil }
        return raw
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .capitalized
    }

    private static func peopleSubtext(occupants: OccupantsResponse?) -> String? {
        guard let occupants else { return nil }
        let members = occupants.occupants.count
        let pending = occupants.pendingInvites.count
        let memberLabel = members == 1 ? "1 member" : "\(members) members"
        guard pending > 0 else { return memberLabel }
        let pendingLabel = pending == 1 ? "1 pending" : "\(pending) pending"
        return "\(memberLabel) · \(pendingLabel)"
    }

    // MARK: - Sample seam

    private static func sampleSubtexts(for frame: HomeSettingsSampleData.Frame) -> RowSubtexts {
        switch frame {
        case .populated:
            RowSubtexts(
                address: "14 Elm Park Lane",
                propertyDetails: "3 bed · 2 bath · Built 1998",
                photos: "Front porch · added Mar 2024",
                documents: "Lease, HOA, Tax",
                accessCodes: "2 active codes",
                trustedNeighbors: "3 approved",
                privacy: "Verified neighbors only",
                people: "4 members · 1 pending",
                inviteLink: "Active · expires in 12 days",
                notifications: "Push, email digest"
            )
        case .pending:
            RowSubtexts(
                address: "42 Magnolia Court",
                propertyDetails: "Not set",
                photos: "Add a photo",
                documents: "Available after verification",
                accessCodes: "Not set",
                trustedNeighbors: "Available after verification",
                privacy: "Available after verification",
                people: "Just you",
                inviteLink: "Available after verification",
                notifications: "Default"
            )
        }
    }

    // MARK: - Group projection

    private func groups() -> [GroupedListGroup] {
        [
            homeIdentityGroup(),
            accessGroup(),
            membersGroup(),
            notificationsGroup(),
            windDownGroup()
        ]
    }

    private func homeIdentityGroup() -> GroupedListGroup {
        let addressControl: RowControl = .chipStatus(
            label: identity.addressChipLabel,
            tone: identity.addressChipTone,
            includesChevron: true
        )
        let rows: [GroupedListRow] = [
            GroupedListRow(id: "address", label: "Address", subtext: subtexts.address, control: addressControl),
            GroupedListRow(id: "propertyDetails", label: "Property details", subtext: subtexts.propertyDetails, control: .chevron),
            GroupedListRow(id: "photos", label: "Photos", subtext: subtexts.photos, control: .chevron),
            GroupedListRow(id: "documents", label: "Documents", subtext: subtexts.documents, control: .chevron)
        ]
        return GroupedListGroup(id: "homeIdentity", overline: "Home identity", rows: rows)
    }

    private func accessGroup() -> GroupedListGroup {
        let rows: [GroupedListRow] = [
            GroupedListRow(id: "accessCodes", label: "Access codes", subtext: subtexts.accessCodes, control: .chevron),
            GroupedListRow(id: "trustedNeighbors", label: "Trusted neighbors", subtext: subtexts.trustedNeighbors, control: .chevron),
            GroupedListRow(id: "privacy", label: "Privacy", subtext: subtexts.privacy, control: .chevron),
            GroupedListRow(
                id: "ownershipSecurity",
                label: "Ownership & Security",
                subtext: "Discoverability, owner claims, member policy",
                control: .chevron
            )
        ]
        return GroupedListGroup(id: "access", overline: "Access", rows: rows)
    }

    private func membersGroup() -> GroupedListGroup {
        let rows: [GroupedListRow] = [
            GroupedListRow(id: "people", label: "People", subtext: subtexts.people, control: .chevron),
            GroupedListRow(id: "inviteLink", label: "Invite link", subtext: subtexts.inviteLink, control: .chevron)
        ]
        return GroupedListGroup(id: "members", overline: "Members", rows: rows)
    }

    private func notificationsGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: "notifications",
            overline: "Notifications",
            rows: [
                GroupedListRow(id: "homeNotifications", label: "Home notifications", subtext: subtexts.notifications, control: .chevron)
            ]
        )
    }

    private func windDownGroup() -> GroupedListGroup {
        let row = switch frame {
        case .populated:
            GroupedListRow(id: "leaveHome", label: "Leave this home", control: .chevron, destructive: true)
        case .pending:
            GroupedListRow(id: "cancelClaim", label: "Cancel claim", control: .chevron, destructive: true)
        }
        return GroupedListGroup(id: "windDown", overline: "Wind down", rows: [row])
    }
}

private extension String {
    /// Trimmed value, or `nil` when empty — so blank server strings fall
    /// back to the next source instead of rendering an empty line.
    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
