//
//  MailDetailViewModel.swift
//  Pantopus
//
//  T6.5b (P20) — Drives the **generic A17.1 mail item detail** screen.
//  Sits on the shared `MailItemDetailShell` (P19) and projects the
//  `GET /api/mailbox/:id` payload into the shell's typed slots:
//
//    - top bar: back / eyebrow trust dot / overflow (Forward, Archive,
//      Mark unread, Delete, Report)
//    - hero: category accent + sender overline + title + excerpt
//    - aiElf: when the DTO carries an `ai_summary` (V2 surface — falls
//      back to nil for V1 items so the shell skips the strip)
//    - keyFacts: derived from `created_at`, `expires_at`, mail type,
//      and the sender's business name when present
//    - body: rich-text `mail.content` rendered as paragraphs
//    - attachments: when `mail.attachments` is non-empty
//    - sender card: always
//    - actions: Acknowledge (when `ack_required` and not yet acked) +
//      Forward / Archive / Reply secondary tiles
//
//  P21-P23 will replace the body / actions for the package / coupon /
//  booklet / certified variants by composing the same shell with their
//  variant-specific slot views. The generic VM here owns the
//  "everything else" rendering.
//

// swiftlint:disable file_length type_body_length

import Foundation
import Observation

@Observable
@MainActor
public final class MailDetailViewModel {
    public private(set) var state: MailDetailState = .loading
    /// Transient banner; the view clears it after display.
    public var toast: String?
    public private(set) var ackInFlight: Bool = false
    /// Community RSVP mutation is in-flight; disables the chip row.
    public private(set) var rsvpInFlight: Bool = false
    /// Coupon redeem mutation is in-flight; disables the redeem CTA.
    public private(set) var couponRedeemInFlight: Bool = false
    /// Gig accept-bid mutation is in-flight; disables the action row.
    public private(set) var gigBidInFlight: Bool = false
    /// Party RSVP mutation is in-flight; disables the three-way cluster.
    public private(set) var partyRsvpInFlight: Bool = false
    /// A17.10 — Records file-to-vault mutation in-flight; disables the
    /// "File in vault" CTA while the optimistic flip is rolling.
    public private(set) var recordsFileInFlight: Bool = false
    /// A17.8 — a package dashboard write (share ETA / report issue) is in
    /// flight; keeps the overflow entries from double-firing.
    public private(set) var packageActionInFlight: Bool = false
    /// T6.5e — Save-to-vault picker visibility. The view binds a
    /// confirmation dialog to this flag; tapping a folder calls
    /// `saveToVault(folderId:)`.
    public var showsSaveToVaultPicker: Bool = false
    /// Vault folders fetched lazily the first time the overflow item
    /// is tapped, then cached for the lifetime of the screen.
    public private(set) var saveToVaultFolders: [VaultFolderDTO] = []
    /// Save mutation in-flight.
    public private(set) var saveToVaultInFlight: Bool = false
    /// A17.2 — booklet PDF download in flight; disables the "PDF" tile.
    public private(set) var bookletDownloadInFlight: Bool = false
    /// A17.3 — certified legal-proof fetch in flight; disables the
    /// "Proof" tile.
    public private(set) var certifiedProofInFlight: Bool = false
    /// A17.3 — `true` once the legal delivery proof has been fetched, so
    /// the tile flips to "Saved" (RN's `✓ Saved`, `certified.tsx:205`).
    public private(set) var certifiedProofSaved: Bool = false
    /// A17.1 — per-category action currently POSTing to
    /// `/item/:id/action`; disables the ACTIONS row while it runs.
    public private(set) var categoryActionInFlight: MailCategoryAction?
    /// A17.1 — destructive category action awaiting confirmation
    /// (today only `Dismiss`, which shreds the item).
    public var pendingDestructiveAction: MailCategoryAction?
    /// Set to this mail's id when the loaded item carries a stationery
    /// theme — i.e. it came out of the Ceremonial Mail compose flow and
    /// belongs in the ceremonial open experience (envelope tap-to-open,
    /// voice postscript, ceremonial CTAs) rather than the plain detail.
    /// The host observes this and *replaces* the current route, mirroring
    /// RN's `router.replace('/mailbox/open?id=…')`
    /// (`src/app/mailbox/detail.tsx:43-49`).
    public private(set) var ceremonialRedirectMailId: String?

    private let mailId: String
    private let api: APIClient
    private let checkout: CheckoutCoordinator
    private let now: @Sendable () -> Date

    init(
        mailId: String,
        api: APIClient = .shared,
        checkout: CheckoutCoordinator = CheckoutCoordinator(),
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.mailId = mailId
        self.api = api
        self.checkout = checkout
        self.now = now
    }

    // MARK: - Lifecycle

    public func load() async {
        if case .loaded = state {} else { state = .loading }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    /// Clear the ceremonial redirect once the host has navigated, so a
    /// later `refresh()` can raise it again if needed.
    public func acknowledgeCeremonialRedirect() {
        ceremonialRedirectMailId = nil
    }

    private func fetch() async {
        do {
            let response: MailDetailResponse = try await api.request(
                MailboxEndpoints.detail(mailId: mailId)
            )
            // Ceremonial mail never lands on the generic detail — hand it
            // straight to the open experience and hold the loading frame
            // so the plain layout never flashes (RN does the same by
            // short-circuiting before `setLoading(false)`).
            if response.mail.stationeryTheme != nil {
                ceremonialRedirectMailId = mailId
                return
            }
            state = .loaded(Self.project(detail: response.mail, now: now()))
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription ?? "Couldn't load this item."
            )
        }
    }

    // MARK: - Mutations

    /// Acknowledge the mail item. Optimistic — flips the local
    /// `isAcknowledged` state then rolls back on transport failure.
    public func acknowledge() async {
        guard case let .loaded(content) = state, !ackInFlight else { return }
        ackInFlight = true
        defer { ackInFlight = false }
        let previous = content
        let optimistic = MailDetailContent.replacingAck(content, with: true)
        state = .loaded(optimistic)
        do {
            let _: AckResponse = try await api.request(
                MailboxEndpoints.acknowledge(mailId: mailId)
            )
            toast = "Acknowledged"
        } catch {
            state = .loaded(previous)
            toast = (error as? APIError)?.errorDescription ?? "Couldn't acknowledge"
        }
    }

    /// Set the user's RSVP status on a Community mail item.
    /// Optimistic — flips the local state and rolls back on transport
    /// failure. "Going" wires to the existing `POST /community/rsvp`
    /// route (backend stores it as a `will_attend` reaction); other
    /// states are stored locally until the backend exposes a typed
    /// per-status route (P22 scope note in the parity audit).
    public func setRsvp(_ status: CommunityRsvpStatus) async {
        guard case let .loaded(content) = state,
              let community = content.communityDetail,
              !rsvpInFlight else { return }
        rsvpInFlight = true
        defer { rsvpInFlight = false }
        let previous = content
        let optimistic = MailDetailContent.replacingRsvp(content, with: status)
        state = .loaded(optimistic)
        // Local-only states don't currently round-trip; just toast.
        guard status == .going else {
            toast = Self.rsvpToast(for: status)
            return
        }
        do {
            let _: CommunityRsvpResponse = try await api.request(
                MailboxV2Endpoints.communityRsvp(communityItemId: community.communityItemId)
            )
            toast = "You're going"
        } catch {
            state = .loaded(previous)
            toast = (error as? APIError)?.errorDescription ?? "Couldn't update RSVP"
        }
    }

    private static func rsvpToast(for status: CommunityRsvpStatus) -> String {
        switch status {
        case .going: "You're going"
        case .maybe: "Saved as maybe"
        case .notGoing: "Marked as can't make it"
        case .undecided: "RSVP cleared"
        }
    }

    // MARK: - Ceremonial variant mutations (A17.5–A17.8)

    /// A17.5 — Mark a coupon redeemed. Backend redemption is not yet
    /// wired; the projection flips locally so the barcode card collapses
    /// and the redeemed ribbon takes its place. Mirrors the acknowledge
    /// shape so subsequent backend wiring can drop in without a UI churn.
    public func redeemCoupon() async {
        guard case let .loaded(content) = state,
              content.category == .coupon,
              content.couponDetail != nil,
              !couponRedeemInFlight else { return }
        couponRedeemInFlight = true
        defer { couponRedeemInFlight = false }
        // Treat redemption as a one-way acknowledgement until backend
        // exposes a typed coupon redemption endpoint. The optimistic
        // ack flips both `isAcknowledged` and the read-status label.
        let optimistic = MailDetailContent.replacingAck(content, with: true)
        state = .loaded(optimistic)
        toast = "Redeemed"
    }

    /// A17.6 — Accept the incoming bid on a gig through the backend
    /// accept → PaymentSheet → finalize/abort flow.
    public func acceptGigBid() async {
        guard case let .loaded(content) = state,
              content.category == .gig,
              let gig = content.gigDetail,
              !gigBidInFlight else { return }
        guard let gigId = gig.gigId, let bidId = gig.bidId else {
            toast = "Couldn't accept this bid from mail."
            return
        }
        gigBidInFlight = true
        defer { gigBidInFlight = false }
        do {
            let response: GigBidAcceptResponse = try await api.request(
                GigsEndpoints.acceptBid(gigId: gigId, bidId: bidId)
            )
            let requiresPayment = response.requiresPaymentSetup == true || response.sheetParams.clientSecret != nil
            guard requiresPayment else {
                state = .loaded(MailDetailContent.replacingGigAccepted(content, with: gig.accepted()))
                toast = "Bid accepted"
                return
            }

            let outcome = await checkout.present(response.sheetParams)
            switch outcome {
            case .paid:
                let _: GigBidAcceptResponse = try await api.request(
                    GigsEndpoints.finalizeAcceptBid(gigId: gigId, bidId: bidId)
                )
                state = .loaded(MailDetailContent.replacingGigAccepted(content, with: gig.accepted()))
                toast = "Bid accepted"
            case .canceled:
                _ = try? await api.request(
                    GigsEndpoints.abortAcceptBid(gigId: gigId, bidId: bidId),
                    as: GigBidAcceptResponse.self
                )
                state = .loaded(content)
                toast = "Payment canceled"
            case let .declined(message), let .failed(message):
                _ = try? await api.request(
                    GigsEndpoints.abortAcceptBid(gigId: gigId, bidId: bidId),
                    as: GigBidAcceptResponse.self
                )
                state = .loaded(content)
                toast = message
            }
        } catch {
            state = .loaded(content)
            toast = (error as? APIError)?.errorDescription ?? "Couldn't accept this bid."
        }
    }

    /// A17.9 — Set the user's RSVP on a Party mail item. Backend wiring
    /// is not yet exposed for personal invites; the projection flips
    /// locally so the variant swaps into the going-state hero / elf /
    /// potluck-claim affordances. Mirrors the community RSVP shape so a
    /// future personal-invite endpoint slots in without a UI churn.
    public func setPartyRsvp(_ status: PartyRsvpStatus) async {
        guard case let .loaded(content) = state,
              content.category == .party,
              content.partyDetail != nil,
              !partyRsvpInFlight else { return }
        partyRsvpInFlight = true
        defer { partyRsvpInFlight = false }
        let confirmedAtLabel = status == .going ? Self.partyRsvpStamp(now: now()) : nil
        let optimistic = MailDetailContent.replacingPartyRsvp(
            content,
            with: status,
            confirmedAtLabel: confirmedAtLabel
        )
        state = .loaded(optimistic)
        toast = Self.partyRsvpToast(for: status)
    }

    /// A17.9 — Adjust the plus-one stepper. Clamped to `0...4` so the
    /// stepper can't underflow or pile on unbounded headcount in local
    /// state. Only meaningful in the `going` RSVP state.
    public func setPartyPlusOneCount(_ count: Int) async {
        guard case let .loaded(content) = state,
              content.category == .party,
              content.partyDetail != nil else { return }
        let clamped = max(0, min(count, 4))
        let optimistic = MailDetailContent.replacingPartyPlusOneCount(content, with: clamped)
        state = .loaded(optimistic)
    }

    /// A17.9 — Claim (or release) a potluck bring-item. Passing `name == nil`
    /// releases the claim — the design uses this to flip the "I'll bring it"
    /// pill back to the unclaimed style.
    public func togglePartyBringClaim(at index: Int, byName name: String?) async {
        guard case let .loaded(content) = state,
              content.category == .party,
              content.partyDetail != nil else { return }
        let optimistic = MailDetailContent.replacingPartyBringClaim(content, at: index, by: name)
        state = .loaded(optimistic)
        toast = name == nil ? "Released" : "Claimed"
    }

    private static func partyRsvpToast(for status: PartyRsvpStatus) -> String {
        switch status {
        case .going: "You're in"
        case .maybe: "Saved as maybe"
        case .notGoing: "Sent regrets"
        case .undecided: "RSVP cleared"
        }
    }

    private static func partyRsvpStamp(now: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "h:mm a"
        return "Today \(formatter.string(from: now))"
    }

    /// A17.7 — Save the memory keepsake straight to the user's default
    /// memories vault folder, bypassing the picker. If we have no
    /// cached folders yet, fall through to the picker so the user can
    /// choose; once they're cached we prefer the "Memories" folder when
    /// one exists, falling back to the first folder.
    public func saveMemoryToVault() async {
        guard case let .loaded(content) = state,
              content.category == .memory,
              let memory = content.memoryDetail,
              !memory.isSaved,
              !saveToVaultInFlight else { return }
        // Optimistic flip so the saved banner + vault card take over the
        // body without waiting for the network round-trip.
        let optimistic = MailDetailContent.replacingMemorySaved(content, with: true)
        state = .loaded(optimistic)
        if saveToVaultFolders.isEmpty {
            await openSaveToVaultPicker()
            return
        }
        let memoryFolder = saveToVaultFolders.first { $0.label.lowercased().contains("memor") }
        let folderId = (memoryFolder ?? saveToVaultFolders.first)?.id
        guard let folderId else {
            await openSaveToVaultPicker()
            return
        }
        await saveToVault(folderId: folderId)
    }

    /// A17.10 — File the archival record straight to its suggested vault
    /// folder via the same `POST …/vault/file` route as Save to vault.
    public func fileRecordToVault() async {
        guard case let .loaded(content) = state,
              content.category == .records,
              let records = content.recordsDetail,
              !records.isFiled,
              !recordsFileInFlight else { return }
        recordsFileInFlight = true
        defer { recordsFileInFlight = false }

        if saveToVaultFolders.isEmpty {
            do {
                let response: VaultFoldersResponse = try await api.request(
                    MailboxVaultEndpoints.folders(drawer: "personal")
                )
                saveToVaultFolders = response.folders
            } catch {
                toast = (error as? APIError)?.errorDescription
                    ?? "Couldn't load your vault folders."
                return
            }
        }
        guard let folderId = Self.suggestedVaultFolderId(for: records, in: saveToVaultFolders) else {
            // No vault folder matches the record's suggested trail — let the
            // user pick rather than filing it somewhere arbitrary.
            await openSaveToVaultPicker()
            return
        }

        let filedLabel = Self.formatFiledAtNow()
        let previous = content
        let optimistic = MailDetailContent.replacingRecordsFiled(
            content,
            with: true,
            filedAtLabel: filedLabel
        )
        state = .loaded(optimistic)

        do {
            let _: FileToVaultResponse = try await api.request(
                MailboxVaultEndpoints.file(
                    body: FileToVaultBody(mailId: mailId, folderId: folderId)
                )
            )
            let folderLabel = saveToVaultFolders.first { $0.id == folderId }?.label
            toast = folderLabel.map { "Filed in \($0)" } ?? "Filed in Vault"
        } catch {
            state = .loaded(previous)
            toast = (error as? APIError)?.errorDescription
                ?? "Couldn't file to vault. Try again."
        }
    }

    /// Resolve the vault folder the record should be filed in by matching the
    /// payload's `vault_trail` crumbs against the user's real folders,
    /// most-specific crumb first. The `Mailbox` / `Vault` crumbs are chrome,
    /// not folders. Returns nil when nothing matches — the caller opens the
    /// picker instead of guessing (no system folder is named "Records" or
    /// "Archive", so a label-contains heuristic silently filed every record
    /// into whichever folder happened to sort first).
    static func suggestedVaultFolderId(
        for records: RecordsDetailDTO,
        in folders: [VaultFolderDTO]
    ) -> String? {
        guard !folders.isEmpty else { return nil }
        let crumbs = records.vaultTrail
            .map { $0.label.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { label in
                !label.isEmpty
                    && label.caseInsensitiveCompare("Mailbox") != .orderedSame
                    && label.caseInsensitiveCompare("Vault") != .orderedSame
            }
        for crumb in crumbs.reversed() {
            if let match = folders.first(where: { $0.label.caseInsensitiveCompare(crumb) == .orderedSame }) {
                return match.id
            }
        }
        return nil
    }

    /// Format the "filed at" stamp for the optimistic local flip.
    /// "Today 2:14 PM · retention 7y" — matches the design's stamp copy.
    private static func formatFiledAtNow() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "h:mm a"
        return "Today \(formatter.string(from: Date())) · retention 7y"
    }

    // MARK: - Per-category actions (A17.1)

    /// The ACTIONS row for the loaded item — RN's
    /// `CATEGORY_ACTIONS[item.category] || CATEGORY_ACTIONS.other`, minus
    /// `Pay` / `Sign` for unknown senders (`detail.tsx:56-72`).
    public var categoryActions: [MailCategoryAction] {
        guard case let .loaded(content) = state else { return [] }
        return MailCategoryActions.actions(
            forCategory: content.mailCategoryKey,
            isSenderUnknown: content.isSenderUnknown
        )
    }

    /// Route a tile tap. Destructive tiles park in
    /// `pendingDestructiveAction` for the view's confirm dialog; the rest
    /// fire straight away.
    public func tapCategoryAction(_ action: MailCategoryAction) async {
        guard action.isDestructive else {
            await performCategoryAction(action)
            return
        }
        pendingDestructiveAction = action
    }

    /// `POST /api/mailbox/v2/item/:id/action` — route
    /// `backend/routes/mailboxV2.js:459`. The handler records a
    /// `mail_action_clicked` event itself, so (unlike RN, which posts a
    /// second `/event` write) one call is enough.
    public func performCategoryAction(_ action: MailCategoryAction) async {
        guard case .loaded = state, categoryActionInFlight == nil else { return }
        pendingDestructiveAction = nil
        categoryActionInFlight = action
        defer { categoryActionInFlight = nil }
        do {
            let _: MailboxItemActionResponse = try await api.request(
                MailboxV2Endpoints.itemAction(mailId: mailId, action: action.actionKey)
            )
            // RN only toasts (`detail.tsx:56-66`) — the generic detail
            // renders nothing derived from `lifecycle`, so a refetch would
            // buy a loading flash and nothing else.
            toast = action.successToast
        } catch {
            toast = (error as? APIError)?.errorDescription ?? "Action failed"
        }
    }

    // MARK: - Package dashboard actions (A17.8)

    /// A17.8 — "Share ETA with household". Drops a package-arriving notice
    /// into every other resident's Home drawer via
    /// `POST /api/mailbox/v2/package/:mailId/share-eta`
    /// (`backend/routes/mailboxV2.js:727`) and toasts how many people were
    /// notified. Mirrors RN `src/app/mailbox/package.tsx:40-48`.
    public func sharePackageEta() async {
        guard case let .loaded(content) = state,
              content.category == .package,
              !packageActionInFlight else { return }
        packageActionInFlight = true
        defer { packageActionInFlight = false }
        do {
            let response: SharePackageEtaResponse = try await api.request(
                MailboxPackageEndpoints.shareEta(mailId: mailId)
            )
            let notified = response.notified ?? 0
            toast = "ETA shared with \(notified) household member\(notified == 1 ? "" : "s")"
        } catch {
            toast = (error as? APIError)?.errorDescription ?? "Failed to share"
        }
    }

    /// A17.8 — "Report issue". RN logs a `package_issue_reported` event
    /// against the mail item (`src/app/mailbox/package.tsx:60-64`); the
    /// native overflow entry used to be a no-op.
    public func reportPackageIssue() async {
        guard case let .loaded(content) = state,
              content.category == .package,
              !packageActionInFlight else { return }
        packageActionInFlight = true
        defer { packageActionInFlight = false }
        do {
            let _: MailboxLogEventResponse = try await api.request(
                MailboxPackageEndpoints.logEvent(
                    eventType: "package_issue_reported",
                    mailId: mailId
                )
            )
            toast = "Package issue has been reported"
        } catch {
            toast = (error as? APIError)?.errorDescription ?? "Couldn't report this issue"
        }
    }

    // MARK: - Save to vault (T6.5e / P19.5)

    /// Open the save-to-vault picker. Fetches folders on the first
    /// call; cached after.
    public func openSaveToVaultPicker() async {
        if saveToVaultFolders.isEmpty {
            do {
                let response: VaultFoldersResponse = try await api.request(
                    MailboxVaultEndpoints.folders(drawer: "personal")
                )
                saveToVaultFolders = response.folders
            } catch {
                toast = (error as? APIError)?.errorDescription
                    ?? "Couldn't load your vault folders."
                return
            }
        }
        guard !saveToVaultFolders.isEmpty else {
            toast = "Add a folder in your Vault first."
            return
        }
        showsSaveToVaultPicker = true
    }

    /// POST the current mail to the supplied vault folder. Optimistic
    /// toast on success; surfaces a readable error on failure.
    public func saveToVault(folderId: String) async {
        guard !saveToVaultInFlight else { return }
        saveToVaultInFlight = true
        defer { saveToVaultInFlight = false }
        do {
            let _: FileToVaultResponse = try await api.request(
                MailboxVaultEndpoints.file(
                    body: FileToVaultBody(mailId: mailId, folderId: folderId)
                )
            )
            let folderLabel = saveToVaultFolders.first { $0.id == folderId }?.label
            toast = folderLabel.map { "Saved to \($0)" } ?? "Saved to vault"
        } catch {
            toast = (error as? APIError)?.errorDescription
                ?? "Couldn't save to vault. Try again."
        }
        showsSaveToVaultPicker = false
    }

    // MARK: - Document artefacts (A17.2 booklet PDF / A17.3 proof)

    /// A17.2 — `POST /api/mailbox/v2/p2/booklet/:mailId/download`
    /// (`backend/routes/mailboxV2Phase2.js:447`). Mirrors RN's
    /// "Download Started · Downloading X.X MB" confirmation
    /// (`src/app/mailbox/booklet.tsx:43`). The backend answers 404 when
    /// the booklet has no rendered PDF, which surfaces as RN's
    /// "Download not available".
    public func downloadBookletPDF() async {
        guard !bookletDownloadInFlight else { return }
        bookletDownloadInFlight = true
        defer { bookletDownloadInFlight = false }
        do {
            let response: BookletDownloadResponse = try await api.request(
                MailboxDocumentEndpoints.bookletDownload(mailId: mailId)
            )
            toast = response.megabytesLabel.map { "Download started · \($0)" }
                ?? "Download started"
        } catch {
            toast = "Download not available"
        }
    }

    /// A17.3 — `GET /api/mailbox/v2/p2/certified/:mailId/proof`
    /// (`backend/routes/mailboxV2Phase2.js:705`). The route rejects with
    /// 400 until the item is acknowledged, which is exactly when RN
    /// surfaces the button (`src/app/mailbox/certified.tsx:200`), so the
    /// failure copy matches RN's "Proof not available yet".
    public func downloadCertifiedProof() async {
        guard !certifiedProofInFlight, !certifiedProofSaved else { return }
        certifiedProofInFlight = true
        defer { certifiedProofInFlight = false }
        do {
            let response: CertifiedProofResponse = try await api.request(
                MailboxDocumentEndpoints.certifiedProof(mailId: mailId)
            )
            guard response.proof != nil else {
                toast = "Proof not available yet"
                return
            }
            certifiedProofSaved = true
            toast = "Delivery proof saved"
        } catch {
            toast = "Proof not available yet"
        }
    }
}
