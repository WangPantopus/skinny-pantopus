@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_detail

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A17.1 — the per-category action row RN renders on the mail detail.
 * `CATEGORY_ACTIONS` is ported verbatim from
 * `pantopus/frontend/apps/mobile/src/components/mailbox/constants.ts:25-33`;
 * each tile POSTs `/api/mailbox/v2/item/:id/action`
 * (`backend/routes/mailboxV2.js:459`).
 *
 * RN derives the wire key with `label.toLowerCase().replace(…, '_')`, which
 * produces four keys the backend's `validActions` allow-list rejects with a
 * 400 (`file_now`, `share_with_household`, `save_offer`, `dismiss`). Each
 * entry therefore carries an explicit [actionKey] mapped onto a key the
 * handler accepts — see the per-entry notes.
 *
 * Mirrors iOS `Features/Mailbox/MailDetail/MailCategoryActions.swift`.
 */
enum class MailCategoryAction(
    /** Stable id used in test tags — matches the iOS `rawValue`. */
    val id: String,
    /** Button copy — verbatim from RN `CATEGORY_ACTIONS`. */
    val label: String,
    /**
     * Wire value for `POST /item/:id/action`. The handler's allow-list is
     * `pay · sign · forward · file · shred · remind · split · acknowledge ·
     * share_household · create_task · dispute`
     * (`backend/routes/mailboxV2.js:464`).
     */
    val actionKey: String,
    val icon: PantopusIcon,
    /** Toast copy on success. */
    val successToast: String,
    /** Discards the item, so the screen confirms before firing. */
    val isDestructive: Boolean = false,
    /** RN suppresses Pay / Sign for unknown senders (`detail.tsx:69-72`). */
    val isSuppressedForUnknownSender: Boolean = false,
) {
    Pay("pay", "Pay", "pay", PantopusIcon.CreditCard, "Payment started", isSuppressedForUnknownSender = true),
    Sign(
        "sign",
        "Sign",
        "sign",
        PantopusIcon.FileSignature,
        "Signature requested",
        isSuppressedForUnknownSender = true,
    ),
    Remind("remind", "Remind", "remind", PantopusIcon.BellRing, "Reminder set"),
    File("file", "File", "file", PantopusIcon.FolderPlus, "Filed"),

    /** "File Now" is the legal-category label for the same write; RN's derived `file_now` is not allow-listed. */
    FileNow("fileNow", "File Now", "file", PantopusIcon.FolderPlus, "Filed"),
    Forward("forward", "Forward", "forward", PantopusIcon.Forward, "Forwarded"),
    Dispute("dispute", "Dispute", "dispute", PantopusIcon.Flag, "Dispute logged"),
    Acknowledge("acknowledge", "Acknowledge", "acknowledge", PantopusIcon.Check, "Acknowledged"),

    /** RN derives `share_with_household`; the backend key is `share_household`. */
    ShareWithHousehold(
        "shareWithHousehold",
        "Share with Household",
        "share_household",
        PantopusIcon.UsersRound,
        "Shared with your household",
    ),
    CreateTask("createTask", "Create Task", "create_task", PantopusIcon.ListChecks, "Task created"),

    /**
     * No offer-save key exists on this route (`/earn/save/:offerId` is keyed
     * by `EarnOffer`, not by mail id), so saving a promo files it.
     */
    SaveOffer("saveOffer", "Save Offer", "file", PantopusIcon.Bookmark, "Offer saved"),

    /**
     * `shred` is the route's discard verb — it flips `Mail.lifecycle` to
     * `shredded`. Confirmed before it fires.
     */
    Dismiss("dismiss", "Dismiss", "shred", PantopusIcon.XCircle, "Dismissed", isDestructive = true),
}

object MailCategoryActions {
    /**
     * RN's `CATEGORY_ACTIONS` (`src/components/mailbox/constants.ts:25-33`),
     * keyed on the backend's free-text `Mail.category` column, *not* on
     * `mail_type`. Only tiles that do what they say are offered: Pay, Sign,
     * Remind, Forward, Dispute, Share with Household and Acknowledge only
     * logged a click (`POST /item/:id/action`) while toasting a success, so
     * they stay out until they have real flows (a letter that asks for an
     * acknowledgement already shows the detail's own Acknowledge button).
     * Create Task runs the detail's create-task flow (`MailDetailScreen`).
     */
    val byCategory: Map<String, List<MailCategoryAction>> =
        mapOf(
            "bill" to listOf(MailCategoryAction.File),
            "legal" to listOf(MailCategoryAction.FileNow),
            "notice" to listOf(MailCategoryAction.CreateTask, MailCategoryAction.File),
            "receipt" to listOf(MailCategoryAction.File),
            "community" to listOf(MailCategoryAction.File),
            "promo" to listOf(MailCategoryAction.SaveOffer, MailCategoryAction.Dismiss),
            "other" to listOf(MailCategoryAction.File),
        )

    /** RN's `CATEGORY_ACTIONS[item.category] || CATEGORY_ACTIONS.other`. */
    val fallback: List<MailCategoryAction> = byCategory.getValue("other")

    /**
     * Actions for a raw `Mail.category`, with Pay / Sign filtered out for
     * unknown senders exactly as RN does.
     */
    fun actions(
        rawCategory: String?,
        isSenderUnknown: Boolean,
    ): List<MailCategoryAction> {
        val key = rawCategory?.trim()?.lowercase().orEmpty()
        val actions = byCategory[key] ?: fallback
        return if (isSenderUnknown) actions.filterNot { it.isSuppressedForUnknownSender } else actions
    }
}
