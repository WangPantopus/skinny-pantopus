@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.transaction_reviews

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch

/** The `review_context` buckets the backend validates against. */
enum class TransactionReviewContext(
    val wireValue: String,
    val shortLabel: String,
) {
    ListingSale("listing_sale", "Sale"),
    ListingTrade("listing_trade", "Trade"),
    Gig("gig", "Gig"),
    ;

    companion object {
        fun fromRaw(raw: String?): TransactionReviewContext? =
            when ((raw ?: "").lowercase()) {
                "listing_sale" -> ListingSale
                "listing_trade" -> ListingTrade
                "gig" -> Gig
                else -> null
            }
    }
}

/**
 * Presentation target for the transaction-review sheet. Carries the ids the
 * backend needs per context (`offerId` for a listing sale) plus the other
 * party + a title used in the header copy.
 */
data class TransactionReviewSheetTarget(
    val id: String,
    val context: TransactionReviewContext,
    val reviewedId: String,
    val reviewedName: String? = null,
    val transactionTitle: String,
    val listingId: String? = null,
    val offerId: String? = null,
    val tradeId: String? = null,
    val gigId: String? = null,
)

/** Draft pushed back to the host on submit. Sub-ratings are null when unset. */
data class TransactionReviewDraft(
    val rating: Int,
    val comment: String?,
    val communicationRating: Int?,
    val accuracyRating: Int?,
    val punctualityRating: Int?,
)

/** Outcome of the host's POST. */
sealed interface TransactionReviewSubmitResult {
    data object Submitted : TransactionReviewSubmitResult

    data object Duplicate : TransactionReviewSubmitResult

    data class Failed(val message: String) : TransactionReviewSubmitResult
}

/**
 * BLOCK 2D — Multi-criteria transaction-review sheet. Cloned from the gig
 * `LeaveReviewSheet` and extended with the three optional sub-ratings. POSTs
 * to `/api/transaction-reviews` via the host VM. The overall rating (1..5)
 * is required; the comment + sub-ratings are optional.
 */
@Composable
fun TransactionReviewSheetContent(
    target: TransactionReviewSheetTarget,
    onSubmit: suspend (TransactionReviewDraft) -> TransactionReviewSubmitResult,
    onClose: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    var rating by rememberSaveable(target.id) { mutableStateOf(0) }
    var comment by rememberSaveable(target.id) { mutableStateOf("") }
    var communication by rememberSaveable(target.id) { mutableStateOf(0) }
    var accuracy by rememberSaveable(target.id) { mutableStateOf(0) }
    var punctuality by rememberSaveable(target.id) { mutableStateOf(0) }
    var submitting by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }
    var duplicate by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }

    val canSubmit = rating in 1..5 && !duplicate && !submitting

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4)
                .testTag("txnReview.sheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        if (submitted) {
            SubmittedView(onClose = onClose)
            return@Column
        }

        Header(target)

        OverallRating(rating = rating, onChange = { rating = it })

        SubRatings(
            communication = communication,
            accuracy = accuracy,
            punctuality = punctuality,
            onCommunication = { communication = it },
            onAccuracy = { accuracy = it },
            onPunctuality = { punctuality = it },
        )

        CommentField(value = comment, onValueChange = { comment = it })

        if (duplicate) {
            DuplicateNotice()
        }

        if (!errorText.isNullOrEmpty()) {
            Text(
                text = errorText!!,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
                modifier = Modifier.testTag("txnReview.error"),
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetButton(
                label = "Cancel",
                tag = "txnReview.cancel",
                filled = false,
                enabled = !submitting,
                onClick = onClose,
            )
            SheetButton(
                label = "Submit review",
                tag = "txnReview.submit",
                filled = true,
                enabled = canSubmit,
                loading = submitting,
                onClick = {
                    if (rating !in 1..5) return@SheetButton
                    submitting = true
                    errorText = null
                    scope.launch {
                        try {
                            val draft =
                                TransactionReviewDraft(
                                    rating = rating,
                                    comment = comment.trim().ifEmpty { null },
                                    communicationRating = communication.takeIf { it in 1..5 },
                                    accuracyRating = accuracy.takeIf { it in 1..5 },
                                    punctualityRating = punctuality.takeIf { it in 1..5 },
                                )
                            when (val result = onSubmit(draft)) {
                                TransactionReviewSubmitResult.Submitted -> submitted = true
                                TransactionReviewSubmitResult.Duplicate -> duplicate = true
                                is TransactionReviewSubmitResult.Failed -> errorText = result.message
                            }
                        } finally {
                            submitting = false
                        }
                    }
                },
            )
        }
    }
}

@Composable
private fun Header(target: TransactionReviewSheetTarget) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Leave a review",
            style = PantopusTextStyle.h3,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.testTag("txnReview.title"),
        )
        Text(
            text = headerCopy(target),
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private fun headerCopy(target: TransactionReviewSheetTarget): String {
    val name = target.reviewedName
    return if (!name.isNullOrEmpty()) {
        "How did your ${target.context.shortLabel.lowercase()} with $name go on " +
            "${target.transactionTitle}? Your review helps the neighborhood."
    } else {
        "How did this go on ${target.transactionTitle}? Your review helps the neighborhood."
    }
}

@Composable
private fun OverallRating(
    rating: Int,
    onChange: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Overall rating",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        StarPickerRow(
            rating = rating,
            idPrefix = "txnReview.overallStars",
            starSize = 32.dp,
            modifier = Modifier.testTag("txnReview.overallStars"),
            onChange = onChange,
        )
        Text(
            text = ratingHint(rating),
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.testTag("txnReview.ratingHint"),
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
private fun SubRatings(
    communication: Int,
    accuracy: Int,
    punctuality: Int,
    onCommunication: (Int) -> Unit,
    onAccuracy: (Int) -> Unit,
    onPunctuality: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text(
            text = "Rate the details (optional)",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        SubRatingRow("Communication", communication, "txnReview.subRating.communication", onCommunication)
        SubRatingRow("Item accuracy", accuracy, "txnReview.subRating.accuracy", onAccuracy)
        SubRatingRow("Punctuality", punctuality, "txnReview.subRating.punctuality", onPunctuality)
    }
}

@Composable
private fun SubRatingRow(
    title: String,
    rating: Int,
    tag: String,
    onChange: (Int) -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier = Modifier.fillMaxWidth().testTag(tag),
    ) {
        Text(
            text = title,
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
        )
        StarPickerRow(rating = rating, idPrefix = tag, starSize = 24.dp, onChange = onChange)
    }
}

@Composable
private fun StarPickerRow(
    rating: Int,
    idPrefix: String,
    starSize: Dp,
    modifier: Modifier = Modifier,
    onChange: (Int) -> Unit,
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        for (value in 1..5) {
            val isSelected = value <= rating
            Surface(
                onClick = { onChange(value) },
                color = Color.Transparent,
                modifier =
                    Modifier
                        .size(44.dp)
                        .testTag("$idPrefix.star.$value")
                        .semantics {
                            contentDescription = "$value star" + if (value == 1) "" else "s"
                            selected = rating == value
                        },
            ) {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    PantopusIconImage(
                        icon = PantopusIcon.Star,
                        contentDescription = null,
                        size = starSize,
                        tint = if (isSelected) PantopusColors.warning else PantopusColors.appBorderStrong,
                    )
                }
            }
        }
    }
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
                modifier = Modifier.fillMaxWidth().testTag("txnReview.comment"),
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

@Composable
private fun DuplicateNotice() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3)
                .testTag("txnReview.duplicateNotice"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "You already reviewed this transaction.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun SubmittedView(onClose: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s5).testTag("txnReview.submittedView"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CheckCheck,
            contentDescription = null,
            size = 44.dp,
            tint = PantopusColors.success,
        )
        Text(
            text = "Review submitted",
            style = PantopusTextStyle.h3,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Thanks — your review helps neighbors trade with confidence.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
        Row(modifier = Modifier.fillMaxWidth()) {
            SheetButton(
                label = "Done",
                tag = "txnReview.done",
                filled = true,
                enabled = true,
                onClick = onClose,
            )
        }
    }
}

@Composable
private fun RowScope.SheetButton(
    label: String,
    tag: String,
    filled: Boolean,
    enabled: Boolean,
    loading: Boolean = false,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.md)
    val background =
        if (filled) {
            if (enabled) PantopusColors.primary600 else PantopusColors.appBorderStrong
        } else {
            null
        }
    val colorModifier =
        if (background == null) {
            Modifier.border(1.dp, PantopusColors.appBorder, shape)
        } else {
            Modifier.background(background)
        }
    Box(
        modifier =
            Modifier
                .weight(1f)
                .heightIn(min = 48.dp)
                .clip(shape)
                .then(colorModifier)
                .clickable(enabled = enabled && !loading, onClick = onClick)
                .padding(Spacing.s3)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (loading) "Submitting…" else label,
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.SemiBold,
            color = if (filled) PantopusColors.appTextInverse else PantopusColors.appText,
        )
    }
}
