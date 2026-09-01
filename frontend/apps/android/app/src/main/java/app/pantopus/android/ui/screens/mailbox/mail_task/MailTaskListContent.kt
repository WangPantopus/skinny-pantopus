@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_task

import androidx.compose.runtime.Immutable

/**
 * A17.12 (list surface) — render models for the Mail-tasks screen: the
 * list of every mail-linked task plus the "create a task from this mail"
 * form. The designs folder carries a frame for the *detail*
 * (`tasks.jsx` → A17.12) but none for the list, so the list follows the
 * A17 chrome (nav row + section cards) and mirrors the RN behaviour in
 * `src/app/mailbox/tasks.tsx` one-for-one.
 *
 * Mirrors iOS `MailTaskListContent.swift`.
 */

/**
 * One mail-linked task row. Projected from `P3TaskDto`; only the fields
 * the backend actually returns are modelled (no faked subtasks / elf).
 */
@Immutable
data class MailTaskRow(
    val id: String,
    val title: String,
    /**
     * Backend `description` — used as the confirm-dialog body when the
     * user converts the task to a neighbor gig.
     */
    val detail: String,
    val priority: MailTaskPriority,
    /** Pre-formatted "Due tomorrow" / "Due Jun 3" label, null when unset. */
    val dueLabel: String?,
    /** Sender of the originating mail (server-enriched `mail_sender`). */
    val mailSender: String?,
    /** Subject of the originating mail (server-enriched `mail_preview`). */
    val mailPreview: String?,
    val isDone: Boolean,
    /**
     * True once `converted_to_gig_id` is set — the row shows a "Posted as
     * a neighbor task" badge and the convert action is withdrawn.
     */
    val isConvertedToGig: Boolean,
)

/** Four render states for the Mail-tasks list (Block 2F state rule). */
sealed interface MailTaskListUiState {
    data object Loading : MailTaskListUiState

    data object Empty : MailTaskListUiState

    data class Loaded(
        val active: List<MailTaskRow>,
        val completed: List<MailTaskRow>,
    ) : MailTaskListUiState

    data class Error(val message: String) : MailTaskListUiState
}

/**
 * Which frame the screen shows. `Create` is entered when the screen is
 * opened from a mail item (RN `tasks.tsx:28`).
 */
enum class MailTaskListMode { List, Create }

/**
 * Blocking alert payload — mirrors RN's `Alert.alert(title, message)`
 * error paths so the copy matches across platforms.
 */
@Immutable
data class MailTaskListAlert(
    val title: String,
    val message: String,
)
