@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.gigs.GigQuestionDto
import app.pantopus.android.data.api.models.gigs.GigQuestionUser
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Duration
import java.time.Instant

@Composable
fun GigQuestionsSection(
    viewModel: GigDetailViewModel,
    onError: (String) -> Unit = {},
) {
    val questions by viewModel.questions.collectAsStateWithLifecycle()
    val loading by viewModel.questionsLoading.collectAsStateWithLifecycle()
    val newQuestion by viewModel.newQuestionText.collectAsStateWithLifecycle()
    val answeringId by viewModel.answeringQuestionId.collectAsStateWithLifecycle()
    val answerDraft by viewModel.answerDraftText.collectAsStateWithLifecycle()
    val questionSubmitting by viewModel.questionSubmitting.collectAsStateWithLifecycle()
    val answerSubmitting by viewModel.answerSubmitting.collectAsStateWithLifecycle()
    val actionInFlight by viewModel.questionActionInFlight.collectAsStateWithLifecycle()
    val canAsk = viewModel.canAskQuestion()
    val viewerIsOwner = viewModel.viewerIsOwner()
    var pendingDelete by remember { mutableStateOf<GigQuestionDto?>(null) }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .padding(top = 22.dp)
                .testTag("gigQuestionsSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Questions (${questions.size})",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.testTag("gigQuestionsHeader"),
            )
            QuestionStatusChips(questions = questions)
        }
        if (canAsk) {
            AskQuestionForm(
                text = newQuestion,
                submitting = questionSubmitting,
                onTextChange = viewModel::setNewQuestionText,
                onSubmit = { viewModel.submitQuestion(onError) },
            )
        }
        when {
            loading ->
                Text(
                    text = "Loading questions...",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s4),
                )
            questions.isEmpty() ->
                Text(
                    text = "No questions yet. Be the first to ask!",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = Spacing.s4)
                            .testTag("gigQuestionsEmpty"),
                )
            else ->
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    viewModel.pinnedQuestions(questions).forEach { question ->
                        PinnedQuestionCard(
                            question = question,
                            canUnpin = viewModel.canPinQuestion(question),
                            actionsEnabled = actionInFlight == null,
                            onTogglePin = { viewModel.toggleQuestionPin(question.id, onError) },
                        )
                    }
                    viewModel.unpinnedQuestions(questions).forEach { question ->
                        QuestionRow(
                            question = question,
                            viewerIsOwner = viewerIsOwner,
                            answeringId = answeringId,
                            answerDraft = answerDraft,
                            answerSubmitting = answerSubmitting,
                            canUpvote = viewModel.canUpvoteQuestion(),
                            canPin = viewModel.canPinQuestion(question),
                            canDelete = viewModel.canDeleteQuestion(question),
                            actionsEnabled = actionInFlight == null,
                            onBeginAnswer = viewModel::beginAnswering,
                            onCancelAnswer = viewModel::cancelAnswering,
                            onAnswerDraftChange = viewModel::setAnswerDraftText,
                            onSubmitAnswer = { viewModel.submitAnswer(question.id, onError) },
                            onUpvote = { viewModel.toggleQuestionUpvote(question.id, onError) },
                            onTogglePin = { viewModel.toggleQuestionPin(question.id, onError) },
                            onDelete = { pendingDelete = question },
                        )
                    }
                }
        }
    }

    // Destructive confirm — names the question being removed, mirroring
    // RN's `confirm({ title: 'Delete Question' })`.
    pendingDelete?.let { target ->
        val preview = target.question.trim().let { if (it.length > 60) it.take(60) + "…" else it }
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Delete question") },
            text = { Text("“$preview” will be removed for everyone. This can't be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        pendingDelete = null
                        viewModel.deleteQuestion(target.id, onError)
                    },
                    modifier = Modifier.testTag("gigQuestionsDeleteConfirm"),
                ) {
                    Text("Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun QuestionStatusChips(questions: List<GigQuestionDto>) {
    val answered = questions.count { it.isAnswered }
    val open = questions.size - answered
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        if (answered > 0) {
            StatusChip(text = "$answered answered", color = PantopusColors.success)
        }
        if (open > 0) {
            StatusChip(text = "$open awaiting", color = PantopusColors.warning)
        }
    }
}

@Composable
private fun StatusChip(
    text: String,
    color: androidx.compose.ui.graphics.Color,
) {
    Text(
        text = text,
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
        color = color,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(color.copy(alpha = 0.12f))
                .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

@Composable
private fun AskQuestionForm(
    text: String,
    submitting: Boolean,
    onTextChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    val canSubmit = text.trim().length >= 5 && !submitting
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        BasicTextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier.fillMaxWidth().testTag("gigQuestionsAskInput"),
            textStyle =
                androidx.compose.ui.text.TextStyle(
                    color = PantopusColors.appText,
                    fontSize = 13.5.sp,
                ),
            cursorBrush = SolidColor(PantopusColors.primary600),
            decorationBox = { inner ->
                if (text.isEmpty()) {
                    Text(
                        text = "Ask a question about this gig...",
                        fontSize = 13.5.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
                inner()
            },
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "${text.length}/1000",
                fontSize = 11.sp,
                color = PantopusColors.appTextMuted,
            )
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(if (canSubmit) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                        .clickable(enabled = canSubmit, onClick = onSubmit)
                        .padding(horizontal = 14.dp, vertical = 8.dp)
                        .testTag("gigQuestionsAskButton"),
            ) {
                Text(
                    text = if (submitting) "Posting…" else "Ask Question",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (canSubmit) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                )
            }
        }
    }
}

/**
 * Pinned answers get their own highlighted card above the thread —
 * mirrors RN `QASection`'s `pinnedQuestions` block.
 */
@Composable
private fun PinnedQuestionCard(
    question: GigQuestionDto,
    canUnpin: Boolean,
    actionsEnabled: Boolean,
    onTogglePin: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.personalBg)
                .border(1.dp, PantopusColors.primary600, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("gigQuestionPinned.${question.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PantopusIconImage(
                    icon = PantopusIcon.Pin,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Pinned answer",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
            if (canUnpin) {
                QuestionActionLink(
                    label = "Unpin",
                    tint = PantopusColors.primary600,
                    enabled = actionsEnabled,
                    testTag = "gigQuestion.${question.id}.unpin",
                    onClick = onTogglePin,
                )
            }
        }
        Text(
            text = "Q: ${question.question}",
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        question.answer?.takeIf { it.isNotEmpty() }?.let { answer ->
            Text(text = "A: $answer", fontSize = 13.5.sp, color = PantopusColors.appTextStrong)
        }
    }
}

@Composable
private fun QuestionRow(
    question: GigQuestionDto,
    viewerIsOwner: Boolean,
    answeringId: String?,
    answerDraft: String,
    answerSubmitting: Boolean,
    canUpvote: Boolean,
    canPin: Boolean,
    canDelete: Boolean,
    actionsEnabled: Boolean,
    onBeginAnswer: (String) -> Unit,
    onCancelAnswer: () -> Unit,
    onAnswerDraftChange: (String) -> Unit,
    onSubmitAnswer: () -> Unit,
    onUpvote: () -> Unit,
    onTogglePin: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("gigQuestion.${question.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        // Chevron + count column — tapping toggles the viewer's upvote.
        Column(
            modifier =
                Modifier
                    .width(28.dp)
                    .clickable(enabled = canUpvote && actionsEnabled, onClick = onUpvote)
                    .testTag("gigQuestion.${question.id}.upvote"),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronUp,
                contentDescription = "Upvote question",
                size = 18.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "${question.upvoteCount ?: 0}",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = question.question,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            QuestionMeta(question)
            question.answer?.takeIf { it.isNotEmpty() }?.let { answer ->
                AnswerBlock(question = question, answer = answer)
            }
            if (viewerIsOwner && !question.isAnswered) {
                OwnerAnswerControls(
                    questionId = question.id,
                    answeringId = answeringId,
                    answerDraft = answerDraft,
                    answerSubmitting = answerSubmitting,
                    onBeginAnswer = onBeginAnswer,
                    onCancelAnswer = onCancelAnswer,
                    onAnswerDraftChange = onAnswerDraftChange,
                    onSubmitAnswer = onSubmitAnswer,
                )
            }
            if (canPin || canDelete) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                    if (canPin) {
                        QuestionActionLink(
                            label = if (question.isPinned == true) "Unpin" else "Pin",
                            tint = PantopusColors.primary600,
                            enabled = actionsEnabled,
                            testTag = "gigQuestion.${question.id}.pin",
                            onClick = onTogglePin,
                        )
                    }
                    if (canDelete) {
                        QuestionActionLink(
                            label = "Delete",
                            tint = PantopusColors.error,
                            enabled = actionsEnabled,
                            testTag = "gigQuestion.${question.id}.delete",
                            onClick = onDelete,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QuestionActionLink(
    label: String,
    tint: androidx.compose.ui.graphics.Color,
    enabled: Boolean,
    testTag: String,
    onClick: () -> Unit,
) {
    Text(
        text = label,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = if (enabled) tint else PantopusColors.appTextMuted,
        modifier =
            Modifier
                .clickable(enabled = enabled, onClick = onClick)
                .testTag(testTag),
    )
}

@Composable
private fun QuestionMeta(question: GigQuestionDto) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = askerDisplayName(question.asker),
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
        )
        relativeTime(question.createdAt)?.let {
            Text(text = "·", color = PantopusColors.appTextMuted, fontSize = 11.5.sp)
            Text(text = it, fontSize = 11.5.sp, color = PantopusColors.appTextMuted)
        }
        Text(text = "·", color = PantopusColors.appTextMuted, fontSize = 11.5.sp)
        Text(
            text = if (question.isAnswered) "Answered" else "Awaiting answer",
            fontSize = 11.5.sp,
            fontWeight = if (question.isAnswered) FontWeight.SemiBold else FontWeight.Medium,
            color = if (question.isAnswered) PantopusColors.success else PantopusColors.warning,
        )
    }
}

@Composable
private fun AnswerBlock(
    question: GigQuestionDto,
    answer: String,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.success.copy(alpha = 0.08f))
                .padding(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = "${answererDisplayName(question)} answered:",
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.success,
        )
        Text(text = answer, fontSize = 13.5.sp, color = PantopusColors.appTextStrong)
    }
}

@Composable
private fun OwnerAnswerControls(
    questionId: String,
    answeringId: String?,
    answerDraft: String,
    answerSubmitting: Boolean,
    onBeginAnswer: (String) -> Unit,
    onCancelAnswer: () -> Unit,
    onAnswerDraftChange: (String) -> Unit,
    onSubmitAnswer: () -> Unit,
) {
    if (answeringId == questionId) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            BasicTextField(
                value = answerDraft,
                onValueChange = onAnswerDraftChange,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s2)
                        .testTag("gigQuestionsAnswerInput"),
                textStyle =
                    androidx.compose.ui.text.TextStyle(
                        color = PantopusColors.appText,
                        fontSize = 13.5.sp,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                decorationBox = { inner ->
                    if (answerDraft.isEmpty()) {
                        Text(
                            text = "Write your answer...",
                            fontSize = 13.5.sp,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Cancel",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.clickable(onClick = onCancelAnswer),
                )
                val canSubmit = answerDraft.trim().isNotEmpty() && !answerSubmitting
                Box(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.md))
                            .background(if (canSubmit) PantopusColors.success else PantopusColors.appSurfaceSunken)
                            .clickable(enabled = canSubmit, onClick = onSubmitAnswer)
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                            .testTag("gigQuestionsAnswerSubmit"),
                ) {
                    Text(
                        text = if (answerSubmitting) "Posting…" else "Post Answer",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (canSubmit) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                    )
                }
            }
        }
    } else {
        Text(
            text = "Answer",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier =
                Modifier
                    .clickable { onBeginAnswer(questionId) }
                    .testTag("gigQuestionsAnswerButton"),
        )
    }
}

private fun askerDisplayName(user: GigQuestionUser?): String {
    if (user == null) return "Neighbor"
    user.name?.takeIf { it.isNotEmpty() }?.let { return it }
    val parts = listOfNotNull(user.firstName, user.lastName).filter { it.isNotEmpty() }
    if (parts.isNotEmpty()) return parts.joinToString(" ")
    return user.username ?: "Neighbor"
}

private fun answererDisplayName(question: GigQuestionDto): String {
    question.answererDisplayName?.takeIf { it.isNotEmpty() }?.let { return it }
    question.answerer?.name?.takeIf { it.isNotEmpty() }?.let { return it }
    question.answerer?.username?.takeIf { it.isNotEmpty() }?.let { return it }
    return "Poster"
}

private fun relativeTime(iso: String?): String? {
    if (iso.isNullOrEmpty()) return null
    return runCatching {
        val seconds = Duration.between(Instant.parse(iso), Instant.now()).seconds
        when {
            seconds < 60 -> "now"
            seconds < 3_600 -> "${seconds / 60}m ago"
            seconds < 86_400 -> "${seconds / 3_600}h ago"
            seconds < 604_800 -> "${seconds / 86_400}d ago"
            else -> "${seconds / 604_800}w ago"
        }
    }.getOrNull()
}
