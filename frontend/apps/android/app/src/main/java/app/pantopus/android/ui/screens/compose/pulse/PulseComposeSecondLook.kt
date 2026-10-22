package app.pantopus.android.ui.screens.compose.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.posts.EarlierPostDto
import app.pantopus.android.data.api.models.posts.PostPrecheckFinding
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * "Before you ask" (AI phase 2 contract §6.5): what neighbors already said about the question being
 * written, up to 3 earlier questions and recommendations nearby with their best replies. A tap opens
 * that post; nothing is shown when nothing matches.
 */
@Composable
internal fun BeforeYouAskSection(
    posts: List<EarlierPostDto>,
    onOpenPost: (String) -> Unit,
) {
    if (posts.isEmpty()) return
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary50)
                .padding(Spacing.s3)
                .testTag("composePulseBeforeYouAsk"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.semantics { heading() },
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Lightbulb,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Before you ask, neighbors already said",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
        posts.forEach { post -> EarlierAnswerRow(post = post, onOpen = { onOpenPost(post.postId) }) }
    }
}

@Composable
private fun EarlierAnswerRow(
    post: EarlierPostDto,
    onOpen: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.appSurface)
                .clickable(role = Role.Button, onClick = onOpen)
                .padding(Spacing.s3)
                .testTag("composePulseEarlierAnswer"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = post.title.orEmpty(),
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        val reply = post.bestReply?.text
        if (reply != null) {
            Text(text = reply, fontSize = 13.sp, color = PantopusColors.appText, maxLines = 3, overflow = TextOverflow.Ellipsis)
        } else {
            post.body?.let { body ->
                Text(text = body, fontSize = 13.sp, color = PantopusColors.appTextSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        Text(
            text = earlierAnswerMeta(post),
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/** "Solved · 3 replies", "Recommendation", "1 reply". */
private fun earlierAnswerMeta(post: EarlierPostDto): String =
    buildList {
        if (post.type == "recommendation") add("Recommendation")
        if (post.solved == true) add("Solved")
        val count = post.replyCount ?: 0
        if (count > 0) add(if (count == 1) "1 reply" else "$count replies")
    }.joinToString(" · ")

/**
 * The kindness and safety check before posting (AI phase 2 contract §6.6): what it found, with Edit
 * (back to the composer, the words kept) and Post anyway. Advice only; it never blocks.
 */
@Composable
internal fun PostCheckDialog(
    findings: List<PostPrecheckFinding>,
    onEdit: () -> Unit,
    onPostAnyway: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onEdit,
        title = { Text("Before you post") },
        text = {
            Text(
                text = findings.joinToString("\n\n") { it.message },
                modifier = Modifier.verticalScroll(rememberScrollState()),
            )
        },
        confirmButton = {
            TextButton(onClick = onEdit, modifier = Modifier.testTag("composePulsePostCheckEdit")) { Text("Edit") }
        },
        dismissButton = {
            TextButton(onClick = onPostAnyway, modifier = Modifier.testTag("composePulsePostCheckPostAnyway")) {
                Text("Post anyway")
            }
        },
        modifier = Modifier.testTag("composePulsePostCheck"),
    )
}
