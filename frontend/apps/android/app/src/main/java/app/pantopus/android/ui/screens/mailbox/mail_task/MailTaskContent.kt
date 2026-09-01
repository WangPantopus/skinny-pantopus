@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.mail_task

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A17.12 — render-only models for the Mail-task detail screen. Mirrors
 * `Features/Mailbox/MailTask/MailTaskContent.swift`.
 *
 * The screen shows a task Pantopus auto-extracted from a piece of mail
 * and has two designed frames:
 *
 * - open — [TaskCard] (priority, progress, due) + AI elf + [DueSnoozeCard]
 *   + [SubtaskChecklist] + [SourceMailCard] + a delegate hint + the action
 *   dock (Mark done · Snooze · Delegate).
 * - done — the completed [TaskCard] + AI elf "Submitted — nice work" + a
 *   completion summary ("What got filed") + the all-checked checklist +
 *   [SourceMailCard] + a [NextUpCard] suggestion + the reopen / archive dock.
 */

/** Task priority flag rendered on the hero. */
enum class MailTaskPriority(
    val label: String,
    val background: Color,
    val foreground: Color,
) {
    High("High priority", PantopusColors.errorBg, PantopusColors.error),
    Medium("Medium priority", PantopusColors.warningBg, PantopusColors.warning),
    Low("Low priority", PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong),
}

/** One row in the [SubtaskChecklist]. Tapping flips [isDone] in local state. */
data class MailTaskSubtask(
    val id: String,
    val label: String,
    val hint: String,
    val isDone: Boolean,
)

/** Calendar-block + reminder payload for the [DueSnoozeCard]. */
data class MailTaskDue(
    val weekday: String,
    val day: String,
    val month: String,
    val label: String,
    val time: String,
    val left: String,
    val reminderLabel: String,
    val closesLabel: String,
)

/** One quick-snooze option in the [DueSnoozeCard] row. */
data class MailTaskSnoozeOption(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val whenLabel: String?,
)

/** One bullet in the task AI-elf strip. */
data class MailTaskElfBullet(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val text: String,
)

/** Sky-gradient elf strip payload (headline + summary + bullets). */
data class MailTaskElf(
    val headline: String,
    val summary: String,
    val bullets: List<MailTaskElfBullet>,
)

/** "Pulled from this mail" card payload. Tapping opens [mailId]. */
data class MailTaskSourceMail(
    val mailId: String,
    val categoryLabel: String,
    val sender: String,
    val title: String,
    val snippet: String,
    val time: String,
)

/** One row in the "What got filed" completion summary. */
data class MailTaskCompletionRow(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val value: String,
    val isMono: Boolean = false,
)

/** Done-frame completion stamp shown on the hero + summary rows. */
data class MailTaskCompletion(
    val stamp: String,
    val note: String,
    val rows: List<MailTaskCompletionRow>,
)

/** "Next up from your mail" suggestion card payload. */
data class MailTaskNextUp(
    val mailId: String,
    val categoryLabel: String,
    val title: String,
    val due: String,
    val from: String,
)

/**
 * Full projection backing the Mail-task screen. The view-model owns one
 * of these once loaded and mutates [subtasks] / [isDone] locally.
 */
data class MailTaskContent(
    val taskId: String,
    val timeLabel: String,
    val title: String,
    val reference: String,
    val priority: MailTaskPriority,
    val subtasks: List<MailTaskSubtask> = emptyList(),
    // The slots below have no backend source on the native task API today,
    // so the live path leaves them null/empty (the screen hides them)
    // while [MailTaskSampleData] fills them for previews + snapshots.
    val due: MailTaskDue? = null,
    val snoozeOptions: List<MailTaskSnoozeOption> = emptyList(),
    val source: MailTaskSourceMail? = null,
    val elfOpen: MailTaskElf? = null,
    val elfDone: MailTaskElf? = null,
    val completion: MailTaskCompletion? = null,
    val nextUp: MailTaskNextUp? = null,
    val isDone: Boolean = false,
) {
    /** Total subtasks. */
    val totalSteps: Int get() = subtasks.size

    /** Steps counted as finished — all when the task is done. */
    val finishedSteps: Int
        get() = if (isDone) totalSteps else subtasks.count { it.isDone }

    /** Progress fraction in `0..1`. */
    val progress: Float
        get() = if (totalSteps == 0) 0f else finishedSteps.toFloat() / totalSteps.toFloat()

    /** The elf payload for the current frame (null on the live path). */
    val elf: MailTaskElf? get() = if (isDone) elfDone else elfOpen
}

/** Lifecycle state for the Mail-task screen. */
sealed interface MailTaskUiState {
    data object Loading : MailTaskUiState

    data class Loaded(val content: MailTaskContent) : MailTaskUiState

    data class Error(val message: String) : MailTaskUiState
}

/** Initial seed for the screen — `active` (open) or `done`. */
enum class MailTaskSeed {
    Active,
    Done,
}
