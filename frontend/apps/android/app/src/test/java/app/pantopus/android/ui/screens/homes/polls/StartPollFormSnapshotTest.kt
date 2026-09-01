@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.polls

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test
import java.time.LocalDateTime

/**
 * Paparazzi baselines for P2.5 — Start-a-Poll form. Locks the visual
 * contract for each of the 5 client kinds:
 *
 *  - Single choice — default 2 empty rows.
 *  - Multi-choice — 3 user-typed rows (showing the dynamic add UI).
 *  - Ranked — 4 user-typed rows.
 *  - Yes/No — auto-filled locked Yes + No.
 *  - Approval — 3 user-typed rows.
 *
 * Plus a "loading members" pose so the audience picker shimmer is
 * captured. The composable under test is the stateless
 * [StartPollFormContent] so the snapshot doesn't need Hilt + repos.
 */
class StartPollFormSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2_800,
                    softButtons = false,
                ),
        )

    @Test
    fun start_poll_single_choice_empty() {
        paparazzi.snapshot {
            Frame {
                StartPollFormContent(
                    state = baseState(kind = StartPollKind.SingleChoice),
                    isValid = false,
                    isDirty = false,
                    onClose = {},
                    onCommit = {},
                    onQuestionChange = {},
                    onKindChange = {},
                    onAddOption = {},
                    onRemoveOption = {},
                    onOptionChange = { _, _ -> },
                    onSelectAllMembers = {},
                    onToggleMember = {},
                    onCloseDateChange = {},
                    onAnonymityChange = {},
                )
            }
        }
    }

    @Test
    fun start_poll_multi_choice_populated() {
        paparazzi.snapshot {
            Frame {
                StartPollFormContent(
                    state =
                        baseState(
                            kind = StartPollKind.MultiChoice,
                            question = "Which weeknight chores does each of us own?",
                            options =
                                listOf(
                                    StartPollOption(id = "opt-1", label = "Cooking"),
                                    StartPollOption(id = "opt-2", label = "Dishes"),
                                    StartPollOption(id = "opt-3", label = "Laundry"),
                                ),
                            closesAt = SAMPLE_CLOSE_DATE,
                        ),
                    isValid = true,
                    isDirty = true,
                    onClose = {},
                    onCommit = {},
                    onQuestionChange = {},
                    onKindChange = {},
                    onAddOption = {},
                    onRemoveOption = {},
                    onOptionChange = { _, _ -> },
                    onSelectAllMembers = {},
                    onToggleMember = {},
                    onCloseDateChange = {},
                    onAnonymityChange = {},
                )
            }
        }
    }

    @Test
    fun start_poll_ranked_populated() {
        paparazzi.snapshot {
            Frame {
                StartPollFormContent(
                    state =
                        baseState(
                            kind = StartPollKind.Ranked,
                            question = "Rank the paint samples top-to-bottom.",
                            options =
                                listOf(
                                    StartPollOption(id = "opt-1", label = "Sage"),
                                    StartPollOption(id = "opt-2", label = "Navy"),
                                    StartPollOption(id = "opt-3", label = "Eggshell"),
                                    StartPollOption(id = "opt-4", label = "Clay"),
                                ),
                            closesAt = SAMPLE_CLOSE_DATE,
                        ),
                    isValid = true,
                    isDirty = true,
                    onClose = {},
                    onCommit = {},
                    onQuestionChange = {},
                    onKindChange = {},
                    onAddOption = {},
                    onRemoveOption = {},
                    onOptionChange = { _, _ -> },
                    onSelectAllMembers = {},
                    onToggleMember = {},
                    onCloseDateChange = {},
                    onAnonymityChange = {},
                )
            }
        }
    }

    @Test
    fun start_poll_yes_no_auto_locked() {
        paparazzi.snapshot {
            Frame {
                StartPollFormContent(
                    state =
                        baseState(
                            kind = StartPollKind.YesNo,
                            question = "Replace the dishwasher this month?",
                            options =
                                listOf(
                                    StartPollOption(id = "opt-1", label = "Yes", isLocked = true),
                                    StartPollOption(id = "opt-2", label = "No", isLocked = true),
                                ),
                            closesAt = SAMPLE_CLOSE_DATE,
                        ),
                    isValid = true,
                    isDirty = true,
                    onClose = {},
                    onCommit = {},
                    onQuestionChange = {},
                    onKindChange = {},
                    onAddOption = {},
                    onRemoveOption = {},
                    onOptionChange = { _, _ -> },
                    onSelectAllMembers = {},
                    onToggleMember = {},
                    onCloseDateChange = {},
                    onAnonymityChange = {},
                )
            }
        }
    }

    @Test
    fun start_poll_approval_populated() {
        paparazzi.snapshot {
            Frame {
                StartPollFormContent(
                    state =
                        baseState(
                            kind = StartPollKind.Approval,
                            question = "Which vendors are acceptable for the bathroom remodel?",
                            options =
                                listOf(
                                    StartPollOption(id = "opt-1", label = "Vendor A"),
                                    StartPollOption(id = "opt-2", label = "Vendor B"),
                                    StartPollOption(id = "opt-3", label = "Vendor C"),
                                ),
                            closesAt = SAMPLE_CLOSE_DATE,
                            isAnonymous = true,
                        ),
                    isValid = true,
                    isDirty = true,
                    onClose = {},
                    onCommit = {},
                    onQuestionChange = {},
                    onKindChange = {},
                    onAddOption = {},
                    onRemoveOption = {},
                    onOptionChange = { _, _ -> },
                    onSelectAllMembers = {},
                    onToggleMember = {},
                    onCloseDateChange = {},
                    onAnonymityChange = {},
                )
            }
        }
    }

    @Test
    fun start_poll_loading_members() {
        paparazzi.snapshot {
            Frame {
                StartPollFormContent(
                    state =
                        baseState(
                            kind = StartPollKind.SingleChoice,
                            isLoadingMembers = true,
                            members = emptyList(),
                        ),
                    isValid = false,
                    isDirty = false,
                    onClose = {},
                    onCommit = {},
                    onQuestionChange = {},
                    onKindChange = {},
                    onAddOption = {},
                    onRemoveOption = {},
                    onOptionChange = { _, _ -> },
                    onSelectAllMembers = {},
                    onToggleMember = {},
                    onCloseDateChange = {},
                    onAnonymityChange = {},
                )
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }

    private fun baseState(
        kind: StartPollKind,
        question: String = "",
        options: List<StartPollOption> = defaultOptions(kind),
        closesAt: LocalDateTime? = null,
        isAnonymous: Boolean = false,
        members: List<StartPollMember> = sampleMembers,
        isLoadingMembers: Boolean = false,
    ): StartPollUiState =
        StartPollUiState(
            kind = kind,
            question = question,
            questionError = null,
            questionTouched = question.isNotEmpty(),
            options = options,
            audience = StartPollAudience.AllMembers,
            closesAt = closesAt,
            isAnonymous = isAnonymous,
            members = members,
            isLoadingMembers = isLoadingMembers,
        )

    private fun defaultOptions(kind: StartPollKind): List<StartPollOption> =
        if (kind == StartPollKind.YesNo) {
            listOf(
                StartPollOption(id = "opt-1", label = "Yes", isLocked = true),
                StartPollOption(id = "opt-2", label = "No", isLocked = true),
            )
        } else {
            listOf(
                StartPollOption(id = "opt-1", label = ""),
                StartPollOption(id = "opt-2", label = ""),
            )
        }

    private val sampleMembers =
        listOf(
            StartPollMember(id = "user-1", name = "Alice Chen"),
            StartPollMember(id = "user-2", name = "Bob Diaz"),
            StartPollMember(id = "user-3", name = "Carmen Lee"),
        )

    private companion object {
        // Snapshot-stable close date — pinned so the rendered "MMM d, yyyy"
        // label doesn't drift with the system clock between runs.
        val SAMPLE_CLOSE_DATE: LocalDateTime = LocalDateTime.of(2026, 6, 1, 17, 0)
    }
}
