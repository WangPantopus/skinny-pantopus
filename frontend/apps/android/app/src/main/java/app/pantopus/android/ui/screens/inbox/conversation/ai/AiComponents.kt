@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation.ai

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.inbox.conversation.ChatEstimate
import app.pantopus.android.ui.screens.inbox.conversation.ChatPromptChip
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The Pantopus AI mark — A15.3 `.ai-grad`: a primary-blue gradient circle
 * with a white sparkles glyph.
 */
@Composable
internal fun ChatAiAvatar(size: Dp) {
    Box(
        modifier =
            Modifier
                .size(size)
                .clip(CircleShape)
                .background(
                    Brush.linearGradient(
                        listOf(PantopusColors.primary600, PantopusColors.primary800),
                    ),
                )
                .semantics { contentDescription = "Pantopus AI" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Sparkles,
            contentDescription = null,
            size = size * 0.5f,
            tint = PantopusColors.appTextInverse,
        )
    }
}

/**
 * A tappable capability chip ("Price a task", "Summarize mail", …) shown
 * in the AI welcome card. The whole chip is one ≥48dp tap target; tapping
 * sends the capability as the thread's first message.
 */
@Composable
internal fun AiCapabilityChip(
    chip: ChatPromptChip,
    onTap: (ChatPromptChip) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(10.dp))
                .clickable { onTap(chip) }
                .heightIn(min = 48.dp)
                .padding(horizontal = 10.dp)
                .testTag("chatAIWelcomeCapability_${chip.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = chip.icon, contentDescription = null, size = 13.dp, tint = PantopusColors.primary600)
        Text(
            text = chip.label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * Inline estimate card rendered inside an AI reply bubble: a headline
 * amount + basis on the left, a hairline separator, and a confidence
 * readout on the right. Magic-violet tinted.
 */
@Composable
internal fun AiEstimateCard(
    estimate: ChatEstimate,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.magicBg)
                .border(1.dp, PantopusColors.magicBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 10.dp, vertical = Spacing.s2)
                .semantics {
                    contentDescription =
                        "Estimate ${estimate.amount}, ${estimate.basis}, confidence ${estimate.confidence}"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column {
            Text(
                text = estimate.amount,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.magic,
            )
            Text(
                text = estimate.basis,
                fontSize = 10.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Box(modifier = Modifier.width(1.dp).height(28.dp).background(PantopusColors.magicBorder))
        Column {
            Text(
                text = "Confidence",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = estimate.confidence,
                fontSize = 10.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}
