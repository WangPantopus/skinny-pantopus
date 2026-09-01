@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.my_bids

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch

/**
 * Presentation handed to the leave-review sheet. Reviewee is the gig
 * poster (the worker reviews the client they did the work for after
 * the gig is marked completed).
 */
data class LeaveReviewSheetTarget(
    val id: String,
    val gigId: String,
    val revieweeId: String,
    val gigTitle: String,
    val revieweeName: String? = null,
)

/** Draft pushed back to the host on submit. */
data class LeaveReviewDraft(
    val rating: Int,
    val comment: String?,
)

/**
 * P3.4 — Review form sheet. POSTs to `/api/reviews` via the host VM.
 * Rating (1..5) is required; the comment is optional.
 */
@Composable
fun LeaveReviewSheetContent(
    target: LeaveReviewSheetTarget,
    onSubmit: suspend (LeaveReviewDraft) -> Boolean,
    onCancel: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    var rating by rememberSaveable(target.id) { mutableStateOf(0) }
    var comment by rememberSaveable(target.id) { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }

    val canSubmit = rating in 1..5 && !submitting

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4)
                .testTag("leave-review-sheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = "Leave a review",
                style = PantopusTextStyle.h3,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.testTag("leave-review-title"),
            )
            Text(
                text = headerCopy(target),
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }

        RatingPicker(
            rating = rating,
            onChange = { rating = it },
        )

        CommentField(
            value = comment,
            onValueChange = { comment = it },
        )

        if (!errorText.isNullOrEmpty()) {
            Text(
                text = errorText!!,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
                modifier = Modifier.testTag("leave-review-error"),
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            OutlinedTextButton(
                text = "Cancel",
                enabled = !submitting,
                modifier = Modifier.weight(1f).testTag("leave-review-cancel"),
                onClick = onCancel,
            )
            FilledPrimaryButton(
                text = "Submit review",
                enabled = canSubmit,
                isLoading = submitting,
                modifier = Modifier.weight(1f).testTag("leave-review-submit"),
                onClick = {
                    if (rating !in 1..5) return@FilledPrimaryButton
                    submitting = true
                    errorText = null
                    scope.launch {
                        try {
                            val draft =
                                LeaveReviewDraft(
                                    rating = rating,
                                    comment = comment.trim().ifEmpty { null },
                                )
                            val ok = onSubmit(draft)
                            if (!ok) errorText = "Couldn't post your review. Try again in a moment."
                        } finally {
                            submitting = false
                        }
                    }
                },
            )
        }
    }
}

private fun headerCopy(target: LeaveReviewSheetTarget): String {
    val name = target.revieweeName
    return if (!name.isNullOrEmpty()) {
        "How did $name do on ${target.gigTitle}? Your review helps the neighborhood."
    } else {
        "How did this go on ${target.gigTitle}? Your review helps the neighborhood."
    }
}

@Composable
private fun RatingPicker(
    rating: Int,
    onChange: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Rating",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            for (value in 1..5) {
                val isSelected = value <= rating
                Surface(
                    onClick = { onChange(value) },
                    color = Color.Transparent,
                    modifier =
                        Modifier
                            .size(44.dp)
                            .testTag("leave-review-star-$value")
                            .semantics {
                                contentDescription = "$value star" + if (value == 1) "" else "s"
                                selected = rating == value
                            },
                ) {
                    Box(
                        modifier = Modifier.fillMaxWidth(),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Star,
                            contentDescription = null,
                            size = 32.dp,
                            tint = if (isSelected) PantopusColors.warning else PantopusColors.appBorderStrong,
                        )
                    }
                }
            }
        }
        Text(
            text = ratingHint(rating),
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.testTag("leave-review-rating-hint"),
        )
    }
}

private fun ratingHint(rating: Int): String =
    when (rating) {
        0 -> "Tap a star to rate"
        1 -> "Poor"
        2 -> "Below average"
        3 -> "Average"
        4 -> "Good"
        else -> "Excellent"
    }

@Composable
private fun CommentField(
    value: String,
    onValueChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Comment (optional)",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 88.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                minLines = 3,
                maxLines = 6,
                modifier = Modifier.fillMaxWidth().testTag("leave-review-comment"),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = "Anything the neighborhood should know?",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
    }
}
