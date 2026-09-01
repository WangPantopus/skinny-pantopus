//
//  MailCategoryActions.swift
//  Pantopus
//
//  A17.1 — the per-category action row RN renders on the mail detail.
//  `CATEGORY_ACTIONS` is ported verbatim from
//  `pantopus/frontend/apps/mobile/src/components/mailbox/constants.ts:25-33`;
//  each tile POSTs `/api/mailbox/v2/item/:id/action`
//  (`backend/routes/mailboxV2.js:459`).
//
//  RN derives the wire key with `label.toLowerCase().replace(/\s+/g, '_')`,
//  which produces four keys the backend's `validActions` allow-list rejects
//  with a 400 (`file_now`, `share_with_household`, `save_offer`, `dismiss`).
//  Each case therefore carries an explicit `actionKey` mapped onto a key the
//  handler actually accepts — see the per-case notes.
//
//  Mirrored on Android by
//  `ui/screens/mailbox/mail_detail/MailCategoryActions.kt`.
//

import Foundation

/// One tile in the detail's ACTIONS row.
public enum MailCategoryAction: String, Sendable, Hashable, Identifiable, CaseIterable {
    case pay
    case sign
    case remind
    case file
    case fileNow
    case forward
    case dispute
    case acknowledge
    case shareWithHousehold
    case createTask
    case saveOffer
    case dismiss

    public var id: String {
        rawValue
    }

    /// Button copy — verbatim from RN `CATEGORY_ACTIONS`.
    public var label: String {
        switch self {
        case .pay: "Pay"
        case .sign: "Sign"
        case .remind: "Remind"
        case .file: "File"
        case .fileNow: "File Now"
        case .forward: "Forward"
        case .dispute: "Dispute"
        case .acknowledge: "Acknowledge"
        case .shareWithHousehold: "Share with Household"
        case .createTask: "Create Task"
        case .saveOffer: "Save Offer"
        case .dismiss: "Dismiss"
        }
    }

    /// Wire value for `POST /item/:id/action`. The handler's allow-list is
    /// `pay · sign · forward · file · shred · remind · split · acknowledge ·
    /// share_household · create_task · dispute`
    /// (`backend/routes/mailboxV2.js:464`).
    public var actionKey: String {
        switch self {
        case .pay: "pay"
        case .sign: "sign"
        case .remind: "remind"
        case .file: "file"
        // "File Now" is the legal-category label for the same write; RN's
        // derived `file_now` is not in the allow-list.
        case .fileNow: "file"
        case .forward: "forward"
        case .dispute: "dispute"
        case .acknowledge: "acknowledge"
        // RN derives `share_with_household`; the backend key is `share_household`.
        case .shareWithHousehold: "share_household"
        // RN derives `create_task`, which the allow-list does accept.
        case .createTask: "create_task"
        // No offer-save key exists on this route (`/earn/save/:offerId` is
        // keyed by `EarnOffer`, not by mail id), so saving a promo files it.
        case .saveOffer: "file"
        // `shred` is the route's discard verb — it flips `Mail.lifecycle`
        // to `shredded`. Confirmed before it fires.
        case .dismiss: "shred"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .pay: .creditCard
        case .sign: .fileSignature
        case .remind: .bellRing
        case .file, .fileNow: .folderPlus
        case .forward: .forward
        case .dispute: .flag
        case .acknowledge: .check
        case .shareWithHousehold: .usersRound
        case .createTask: .listChecks
        case .saveOffer: .bookmark
        case .dismiss: .xCircle
        }
    }

    /// Toast copy on success.
    public var successToast: String {
        switch self {
        case .pay: "Payment started"
        case .sign: "Signature requested"
        case .remind: "Reminder set"
        case .file, .fileNow: "Filed"
        case .forward: "Forwarded"
        case .dispute: "Dispute logged"
        case .acknowledge: "Acknowledged"
        case .shareWithHousehold: "Shared with your household"
        case .createTask: "Task created"
        case .saveOffer: "Offer saved"
        case .dismiss: "Dismissed"
        }
    }

    /// `Dismiss` discards the item (`lifecycle → shredded`), so the view
    /// confirms before firing it.
    public var isDestructive: Bool {
        self == .dismiss
    }

    /// RN suppresses `Pay` / `Sign` when the sender can't be trusted
    /// (`detail.tsx:69-72`).
    public var isSuppressedForUnknownSender: Bool {
        self == .pay || self == .sign
    }
}

public enum MailCategoryActions {
    /// `CATEGORY_ACTIONS` — ported verbatim from
    /// `src/components/mailbox/constants.ts:25-33`. Keyed on the backend's
    /// free-text `Mail.category` column (`bill` / `legal` / `notice` /
    /// `receipt` / `community` / `promo` / `other`), *not* on `mail_type`.
    public static let byCategory: [String: [MailCategoryAction]] = [
        "bill": [.pay, .remind, .file, .forward, .dispute],
        "legal": [.fileNow, .forward, .remind],
        "notice": [.acknowledge, .shareWithHousehold, .createTask, .file],
        "receipt": [.file, .forward],
        "community": [.acknowledge, .shareWithHousehold, .file],
        "promo": [.saveOffer, .dismiss],
        "other": [.file, .forward]
    ]

    /// Fallback set for an unmapped / missing category — RN's
    /// `CATEGORY_ACTIONS[item.category] || CATEGORY_ACTIONS.other`.
    public static let fallback: [MailCategoryAction] = byCategory["other"] ?? []

    /// Actions for a raw `Mail.category`, with `Pay` / `Sign` filtered out
    /// for unknown senders exactly as RN does.
    public static func actions(
        forCategory rawCategory: String?,
        isSenderUnknown: Bool
    ) -> [MailCategoryAction] {
        let key = rawCategory?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let actions = byCategory[key] ?? fallback
        guard isSenderUnknown else { return actions }
        return actions.filter { !$0.isSuppressedForUnknownSender }
    }
}
