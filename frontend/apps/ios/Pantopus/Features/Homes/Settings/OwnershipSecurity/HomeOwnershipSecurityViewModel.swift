//
//  HomeOwnershipSecurityViewModel.swift
//  Pantopus
//
//  A14.2 (policy variant) — "Ownership & Security". Three radio groups
//  backed by the per-home security policy:
//
//    * Privacy & discoverability → `privacy_mask_level`
//    * Owner claims             → `owner_claim_policy`
//    * Member attach policy     → `member_attach_policy`
//
//  Reads `GET /api/homes/:id/security` and PATCHes a single key per
//  selection. A multi-owner home answers the owner-claim-policy PATCH
//  with `{ pending: true, message }` instead of applying it — that
//  "change requires owner approval" state is surfaced as a banner rather
//  than being swallowed (the RN screen alerts; we keep it on-screen).
//
//  Distinct from `HomeSecurityViewModel`, which drives the 9 privacy
//  toggles on `/api/homes/:id/privacy`.
//

import Foundation
import Observation

@Observable
@MainActor
public final class HomeOwnershipSecurityViewModel: GroupedListDataSource {
    public var title: String {
        "Ownership & Security"
    }

    public private(set) var footerCaption: String?

    public private(set) var state: GroupedListState = .loading

    public private(set) var banner: GroupedListBanner?

    public let homeId: String

    /// Last loaded policy block. `nil` until the first successful fetch.
    public private(set) var policy: HomeOwnershipSecurityDTO?

    /// Set while a PATCH is in flight so the radios stop accepting taps.
    public private(set) var isSaving = false

    /// Inline failure surfaced under the group the user just touched.
    public private(set) var saveError: String?

    /// Server copy from the quorum branch of the PATCH handler, e.g.
    /// "This change will auto-approve in 7 days unless rejected".
    private var pendingApprovalMessage: String?

    private let api: APIClient

    public convenience init(homeId: String) {
        self.init(homeId: homeId, api: .shared)
    }

    init(homeId: String, api: APIClient) {
        self.homeId = homeId
        self.api = api
    }

    // MARK: - Row ids (mirrored in Android)

    public enum Row {
        public static let maskPrefix = "privacyMask."
        public static let claimPrefix = "ownerClaim."
        public static let attachPrefix = "memberAttach."
    }

    // MARK: - GroupedListDataSource

    public func load() async {
        state = .loading
        saveError = nil
        do {
            let response: HomeOwnershipSecurityResponse = try await api.request(
                HomeOwnershipSecurityEndpoints.get(homeId: homeId)
            )
            policy = response.security
            refreshBanner()
            footerCaption = Self.footer(for: response.security)
            state = .loaded(groups(response.security))
        } catch {
            policy = nil
            banner = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "We couldn't load this home's security policy. Check your connection and try again."
            )
        }
    }

    public func refresh() async {
        await load()
    }

    public func tapRow(_: String) async {}
    public func toggleRow(_: String, isOn _: Bool) async {}
    public func setSlider(_: String, index _: Int) async {}

    /// Dismiss the "requires owner approval" banner.
    public func tapBanner() async {
        pendingApprovalMessage = nil
        refreshBanner()
    }

    public func selectRadio(_ rowId: String) async {
        guard let current = policy, !isSaving else { return }

        let request: UpdateHomeOwnershipSecurityRequest
        if let raw = rowId.dropRowPrefix(Row.maskPrefix), let value = HomePrivacyMaskLevel(rawValue: raw) {
            guard value != current.privacyMaskLevel else { return }
            lastTouchedGroupId = "privacyMask"
            request = UpdateHomeOwnershipSecurityRequest(privacyMaskLevel: value)
        } else if let raw = rowId.dropRowPrefix(Row.claimPrefix), let value = HomeOwnerClaimPolicy(rawValue: raw) {
            guard value != current.ownerClaimPolicy else { return }
            lastTouchedGroupId = "ownerClaim"
            // The backend refuses to tighten claims mid-window
            // (`homeSecurityPolicy.js:283`); block it client-side too so
            // the row never appears to take.
            guard !(claimWindowActive && value == .reviewRequired) else {
                saveError = "You can't restrict owner claims during the claim window."
                state = .loaded(groups(current))
                return
            }
            request = UpdateHomeOwnershipSecurityRequest(ownerClaimPolicy: value)
        } else if let raw = rowId.dropRowPrefix(Row.attachPrefix), let value = HomeMemberAttachPolicy(rawValue: raw) {
            guard value != current.memberAttachPolicy else { return }
            lastTouchedGroupId = "memberAttach"
            request = UpdateHomeOwnershipSecurityRequest(memberAttachPolicy: value)
        } else {
            return
        }

        isSaving = true
        saveError = nil
        state = .loaded(groups(current))
        defer {
            isSaving = false
            state = .loaded(groups(policy ?? current))
        }
        do {
            let response: UpdateHomeOwnershipSecurityResponse = try await api.request(
                HomeOwnershipSecurityEndpoints.update(homeId: homeId, request: request)
            )
            if response.requiresOwnerApproval {
                // Quorum path — nothing changed yet. Keep the previous
                // selection rendered and explain why.
                pendingApprovalMessage = response.message
                    ?? "This change needs approval from the other verified owners."
            } else if let updated = response.security {
                // The PATCH echo re-selects the raw columns only, so carry
                // the GET-only fields (`claim_window_active`, `owner_count`)
                // forward instead of blanking them.
                let merged = HomeOwnershipSecurityDTO(
                    securityState: updated.securityState,
                    claimWindowEndsAt: updated.claimWindowEndsAt,
                    ownerClaimPolicy: updated.ownerClaimPolicy,
                    memberAttachPolicy: updated.memberAttachPolicy,
                    privacyMaskLevel: updated.privacyMaskLevel,
                    tenureMode: updated.tenureMode ?? current.tenureMode,
                    claimWindowActive: updated.claimWindowActive ?? current.claimWindowActive,
                    ownerCount: updated.ownerCount ?? current.ownerCount
                )
                policy = merged
                footerCaption = Self.footer(for: merged)
            }
            refreshBanner()
        } catch {
            saveError = (error as? APIError)?.errorDescription
                ?? "Couldn't update that setting. Try again."
        }
    }

    // MARK: - Derived

    /// The claim window locks the owner-claim radios (RN
    /// `security.tsx:112`).
    public var claimWindowActive: Bool {
        policy?.claimWindowActive ?? (policy?.securityState == .claimWindow)
    }

    private func refreshBanner() {
        if let pendingApprovalMessage {
            banner = GroupedListBanner(
                icon: .clock,
                title: "Owner approval requested",
                subtitle: pendingApprovalMessage,
                actionLabel: "Dismiss",
                style: .pause
            )
            return
        }
        guard let policy, let content = Self.statusBanner(for: policy) else {
            banner = nil
            return
        }
        banner = content
    }

    // MARK: - Status banner copy (parity contract — mirrored in Android)

    static func statusBanner(for policy: HomeOwnershipSecurityDTO) -> GroupedListBanner? {
        switch policy.securityState {
        case .normal, .frozenSilent:
            return nil
        case .claimWindow:
            let date = formattedDate(policy.claimWindowEndsAt)
            return GroupedListBanner(
                icon: .clock,
                title: "Claim Window Active",
                subtitle: date.map { "Co-owners can verify ownership until \($0)." }
                    ?? "Co-owners can verify ownership while the window is open.",
                style: .stealth
            )
        case .reviewRequired:
            return GroupedListBanner(
                icon: .shield,
                title: "Review Required",
                subtitle: "New owner claims require manual review.",
                style: .stealth
            )
        case .disputed:
            return GroupedListBanner(
                icon: .alertTriangle,
                title: "Verification dispute active",
                subtitle: "Some sensitive actions are temporarily restricted.",
                style: .stealth
            )
        case .frozen:
            return GroupedListBanner(
                icon: .lock,
                title: "Home protections enabled",
                subtitle: "Some actions require support.",
                style: .stealth
            )
        }
    }

    static func formattedDate(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? {
            let fallback = ISO8601DateFormatter()
            fallback.formatOptions = [.withInternetDateTime]
            return fallback.date(from: iso)
        }()
        guard let date else { return nil }
        let out = DateFormatter()
        out.dateFormat = "MMMM d, yyyy"
        return out.string(from: date)
    }

    private static func footer(for policy: HomeOwnershipSecurityDTO) -> String? {
        guard let count = policy.ownerCount else { return nil }
        return count == 1 ? "1 verified owner" : "\(count) verified owners"
    }

    // MARK: - Group projection

    private func groups(_ policy: HomeOwnershipSecurityDTO) -> [GroupedListGroup] {
        [
            GroupedListGroup(
                id: "privacyMask",
                overline: "Privacy & Discoverability",
                helper: helper(
                    for: "privacyMask",
                    fallback: "Controls whether this home can be found by search. "
                        + "High and Invite-only reduce risk of unwanted discovery."
                ),
                rows: HomePrivacyMaskLevel.allCases.map { option in
                    GroupedListRow(
                        id: Row.maskPrefix + option.rawValue,
                        label: option.label,
                        control: .radio(isSelected: option == policy.privacyMaskLevel)
                    )
                }
            ),
            GroupedListGroup(
                id: "ownerClaim",
                overline: "Owner claims",
                helper: helper(
                    for: "ownerClaim",
                    fallback: claimWindowActive
                        ? "You can't restrict owner claims during the claim window."
                        : nil
                ),
                rows: HomeOwnerClaimPolicy.allCases.map { option in
                    GroupedListRow(
                        id: Row.claimPrefix + option.rawValue,
                        label: option.label,
                        control: .radio(isSelected: option == policy.ownerClaimPolicy)
                    )
                }
            ),
            GroupedListGroup(
                id: "memberAttach",
                overline: "Member attach policy",
                helper: helper(for: "memberAttach", fallback: nil),
                rows: HomeMemberAttachPolicy.allCases.map { option in
                    GroupedListRow(
                        id: Row.attachPrefix + option.rawValue,
                        label: option.label,
                        control: .radio(isSelected: option == policy.memberAttachPolicy)
                    )
                }
            )
        ]
    }

    /// The inline save error replaces the helper caption of whichever
    /// group is showing it — there's exactly one PATCH in flight so the
    /// last-touched group owns the message.
    private func helper(for groupId: String, fallback: String?) -> String? {
        if let saveError, groupId == lastTouchedGroupId { return saveError }
        if isSaving, groupId == lastTouchedGroupId { return "Saving…" }
        return fallback
    }

    /// Which group the in-flight (or last-failed) PATCH belongs to, so
    /// the helper line lands under the right card.
    private var lastTouchedGroupId: String?
}

private extension String {
    /// `"privacyMask.high"` → `"high"` when the prefix matches.
    func dropRowPrefix(_ prefix: String) -> String? {
        guard hasPrefix(prefix) else { return nil }
        return String(dropFirst(prefix.count))
    }
}
