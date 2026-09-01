@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "LongParameterList")

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Presentation handed to the bid sheet. `bidId` is `null` when placing
 * a new bid; non-null when editing an existing one.
 */
data class EditBidSheetTarget(
    val id: String,
    val gigId: String,
    val gigTitle: String,
    val bidId: String?,
    val initialAmount: Double? = null,
    val initialMessage: String? = null,
    val initialProposedTime: String? = null,
    val initialTerms: String? = null,
) {
    val isEditing: Boolean get() = bidId != null
}

/** Form draft pushed back to the host on submit. */
data class EditBidDraft(
    val amount: Double,
    val message: String?,
    val proposedTime: String?,
)

/**
 * P3.4 — Bid form sheet. Reused by:
 *
 *   • `GigDetailScreen`  → place a new bid
 *   • `MyBidsScreen`     → edit an existing bid
 *
 * Fields: amount (required), message (optional), ETA (optional), terms
 * (optional). Terms append to the message body at submission since the
 * backend doesn't carry a dedicated `terms` field.
 */
@Composable
fun EditBidSheetContent(
    target: EditBidSheetTarget,
    onSubmit: suspend (EditBidDraft) -> Boolean,
    onCancel: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    val initialAmountString =
        target.initialAmount?.let { value ->
            if (value % 1.0 == 0.0) {
                value.toInt().toString()
            } else {
                String.format(Locale.US, "%.2f", value)
            }
        } ?: ""
    var amount by rememberSaveable(target.id) { mutableStateOf(initialAmountString) }
    var message by rememberSaveable(target.id) { mutableStateOf(target.initialMessage.orEmpty()) }
    var eta by rememberSaveable(target.id) { mutableStateOf(target.initialProposedTime.orEmpty()) }
    var terms by rememberSaveable(target.id) { mutableStateOf(target.initialTerms.orEmpty()) }
    var submitting by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }

    val parsedAmount = amount.trim().toDoubleOrNull()?.takeIf { it > 0 }
    val canSubmit = parsedAmount != null && !submitting

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4)
                .testTag("edit-bid-sheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = if (target.isEditing) "Edit bid" else "Place a bid",
                style = PantopusTextStyle.h3,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.testTag("edit-bid-title"),
            )
            Text(
                text = headerCopy(target),
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }

        AmountField(
            value = amount,
            onValueChange = { amount = it },
        )

        TextAreaField(
            label = "Message",
            placeholder = "Tell the poster how you'd approach the job.",
            value = message,
            onValueChange = { message = it },
            testTag = "edit-bid-message",
            minLines = 2,
        )

        SingleLineField(
            label = "ETA (optional)",
            placeholder = "e.g. Saturday afternoon or 2026-05-22",
            value = eta,
            onValueChange = { eta = it },
            testTag = "edit-bid-eta",
        )

        TextAreaField(
            label = "Terms (optional)",
            placeholder = "Anything the poster should agree to up front (deposit, cancellation, …).",
            value = terms,
            onValueChange = { terms = it },
            testTag = "edit-bid-terms",
            minLines = 2,
        )

        if (!errorText.isNullOrEmpty()) {
            Text(
                text = errorText!!,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
                modifier = Modifier.testTag("edit-bid-error"),
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            OutlinedTextButton(
                text = "Cancel",
                enabled = !submitting,
                modifier = Modifier.weight(1f).testTag("edit-bid-cancel"),
                onClick = onCancel,
            )
            FilledPrimaryButton(
                text = if (target.isEditing) "Save bid" else "Submit bid",
                enabled = canSubmit,
                isLoading = submitting,
                modifier = Modifier.weight(1f).testTag("edit-bid-submit"),
                onClick = {
                    val value = parsedAmount
                    if (value != null) {
                        submitting = true
                        errorText = null
                        scope.launch {
                            try {
                                val composed = composeMessage(message.trim(), terms.trim())
                                val draft =
                                    EditBidDraft(
                                        amount = value,
                                        message = composed,
                                        proposedTime = eta.trim().ifEmpty { null },
                                    )
                                val ok = onSubmit(draft)
                                if (!ok) errorText = "Couldn't submit. Try again in a moment."
                            } finally {
                                submitting = false
                            }
                        }
                    }
                },
            )
        }
    }
}

private fun headerCopy(target: EditBidSheetTarget): String =
    if (target.isEditing) {
        "Update your offer on ${target.gigTitle}. The poster will see your latest amount and message."
    } else {
        "Tell the poster what you'd charge and add a short message about your approach."
    }

/**
 * Folds the optional terms field into the message body. The backend's
 * `UpdateBidBody` / `PlaceBidBody` don't carry a dedicated `terms`
 * column, so terms ride along under a "Terms:" prefix. Mirrors
 * `EditBidSheetView.composeMessage` on iOS.
 */
internal fun composeMessage(
    message: String,
    terms: String,
): String? {
    val m = message.trim()
    val t = terms.trim()
    return when {
        m.isEmpty() && t.isEmpty() -> null
        m.isNotEmpty() && t.isEmpty() -> m
        m.isEmpty() && t.isNotEmpty() -> "Terms: $t"
        else -> "$m\n\nTerms: $t"
    }
}

/**
 * Reverse of [composeMessage] — split a stored bid `message` back into
 * its `(message, terms)` halves so the edit sheet can pre-fill both
 * fields. Mirrors `MyBidsViewModel.splitMessageAndTerms` on iOS.
 */
internal fun splitMessageAndTerms(raw: String?): Pair<String?, String?> {
    val value = raw ?: return null to null
    if (value.isEmpty()) return null to null
    val marker = "\n\nTerms: "
    val index = value.indexOf(marker)
    if (index < 0) {
        return if (value.startsWith("Terms: ")) {
            val terms = value.removePrefix("Terms: ")
            null to terms.ifEmpty { null }
        } else {
            value to null
        }
    }
    val message = value.substring(0, index)
    val terms = value.substring(index + marker.length)
    return message.ifEmpty { null } to terms.ifEmpty { null }
}

@Composable
private fun AmountField(
    value: String,
    onValueChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Amount",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "$",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
            )
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f).testTag("edit-bid-amount"),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = "0",
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
private fun SingleLineField(
    label: String,
    placeholder: String,
    value: String,
    onValueChange: (String) -> Unit,
    testTag: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            contentAlignment = Alignment.CenterStart,
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag(testTag),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = placeholder,
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
private fun TextAreaField(
    label: String,
    placeholder: String,
    value: String,
    onValueChange: (String) -> Unit,
    testTag: String,
    minLines: Int = 2,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = (minLines * 24).dp + 16.dp)
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
                minLines = minLines,
                maxLines = 5,
                modifier = Modifier.fillMaxWidth().testTag(testTag),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = placeholder,
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
internal fun OutlinedTextButton(
    text: String,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.TextButton(
            onClick = onClick,
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = text,
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
internal fun FilledPrimaryButton(
    text: String,
    enabled: Boolean,
    isLoading: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (enabled) PantopusColors.primary600 else PantopusColors.appBorderStrong),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.TextButton(
            onClick = onClick,
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = PantopusColors.appTextInverse,
                    modifier = Modifier.heightIn(min = 20.dp, max = 20.dp),
                    strokeWidth = 2.dp,
                )
            } else {
                Text(
                    text = text,
                    style = PantopusTextStyle.body,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}
