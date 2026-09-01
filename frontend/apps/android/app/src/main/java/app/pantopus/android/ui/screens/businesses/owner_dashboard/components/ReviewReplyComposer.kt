@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.owner_dashboard.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.business_profile.components.BizStarGlyph
import app.pantopus.android.ui.screens.businesses.owner_dashboard.OwnerReviewItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.7 — a recent-review card in the owner frame with an inline reply
 * affordance. An answered review renders the published reply (violet
 * left-border); an unanswered one shows a "Reply" button that expands into a
 * composer. Submitting stubs to local state in B3.2 via [onSubmit].
 * Mirrors iOS `ReviewReplyComposer.swift`.
 */
@Composable
fun ReviewReplyComposer(
    review: OwnerReviewItem,
    businessName: String,
    onSubmit: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var composing by remember(review.id) { mutableStateOf(false) }
    var draft by remember(review.id) { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(composing) {
        if (composing) runCatching { focusRequester.requestFocus() }
    }

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(horizontal = 14.dp)
                .padding(top = 12.dp, bottom = 13.dp)
                .testTag("businessOwner.review.${review.id}"),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        HeaderRow(review)
        if (review.body.isNotEmpty()) {
            Text(text = review.body, color = PantopusColors.appTextStrong, fontSize = 12.5.sp)
        }
        when {
            review.reply != null -> RepliedBox(businessName = businessName, reply = review.reply)
            composing ->
                Composer(
                    businessName = businessName,
                    draft = draft,
                    onDraftChange = { draft = it },
                    focusRequester = focusRequester,
                    onCancel = {
                        composing = false
                        draft = ""
                    },
                    onSend = {
                        val text = draft.trim()
                        if (text.isNotEmpty()) {
                            composing = false
                            onSubmit(text)
                        }
                    },
                    reviewId = review.id,
                )
            else ->
                ReplyButton(reviewerName = review.reviewerName, reviewId = review.id) {
                    composing = true
                }
        }
    }
}

@Composable
private fun HeaderRow(review: OwnerReviewItem) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(modifier = Modifier.size(36.dp), contentAlignment = Alignment.Center) {
            AvatarWithIdentityRing(
                name = review.reviewerName,
                identity = IdentityPillar.Personal,
                ringProgress = 1f,
                imageUrl = review.reviewerAvatarUrl,
                size = 32.dp,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = review.reviewerName,
                color = PantopusColors.appText,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.1).sp,
            )
            Text(text = review.meta, color = PantopusColors.appTextSecondary, fontSize = 10.5.sp)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
            repeat(5) { index ->
                BizStarGlyph(
                    color = if (index < review.rating) PantopusColors.star else PantopusColors.appBorder,
                    size = 12.dp,
                )
            }
        }
    }
}

@Composable
private fun RepliedBox(
    businessName: String,
    reply: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = 3.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .height(IntrinsicSize.Min),
    ) {
        Box(modifier = Modifier.width(2.dp).fillMaxHeight().background(PantopusColors.business))
        Column(
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 9.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                PantopusIconImage(
                    icon = PantopusIcon.Reply,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.businessDark,
                )
                Text(
                    text = "$businessName replied",
                    color = PantopusColors.businessDark,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Text(text = reply, color = PantopusColors.appTextStrong, fontSize = 12.sp)
        }
    }
}

@Composable
private fun ReplyButton(
    reviewerName: String,
    reviewId: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .padding(top = 3.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onClick)
                .padding(horizontal = 11.dp, vertical = 6.dp)
                .semantics { contentDescription = "Reply to $reviewerName" }
                .testTag("businessOwner.review.$reviewId.reply"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Reply, contentDescription = null, size = 12.dp, tint = PantopusColors.appText)
        Text(text = "Reply", color = PantopusColors.appText, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun Composer(
    businessName: String,
    draft: String,
    onDraftChange: (String) -> Unit,
    focusRequester: FocusRequester,
    onCancel: () -> Unit,
    onSend: () -> Unit,
    reviewId: String,
) {
    val canSend = draft.trim().isNotEmpty()
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 3.dp),
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = 11.dp, vertical = 9.dp),
        ) {
            BasicTextField(
                value = draft,
                onValueChange = onDraftChange,
                textStyle = TextStyle(color = PantopusColors.appText, fontSize = 12.5.sp),
                cursorBrush = SolidColor(PantopusColors.business),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 36.dp)
                        .focusRequester(focusRequester)
                        .testTag("businessOwner.review.$reviewId.field"),
                decorationBox = { inner ->
                    Box {
                        if (draft.isEmpty()) {
                            Text(
                                text = "Reply as $businessName…",
                                color = PantopusColors.appTextMuted,
                                fontSize = 12.5.sp,
                            )
                        }
                        inner()
                    }
                },
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = "Cancel",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable(onClick = onCancel).padding(horizontal = Spacing.s1, vertical = 6.dp),
            )
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(if (canSend) PantopusColors.business else PantopusColors.appTextMuted)
                        .clickable(enabled = canSend, onClick = onSend)
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                        .testTag("businessOwner.review.$reviewId.send"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.Send, contentDescription = null, size = 12.dp, tint = PantopusColors.appTextInverse)
                Text(text = "Send", color = PantopusColors.appTextInverse, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
