@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.mail_task.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskNextUp
import app.pantopus.android.ui.screens.mailbox.mail_task.MailTaskSampleData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.12 — "Next up from your mail" suggestion card (done frame). A
 * section overline over a card with a green credit-card disc, the
 * suggested item's title + due/from line, and an "Open" pill. The whole
 * card taps through to that mail item.
 */
@Composable
fun NextUpCard(
    nextUp: MailTaskNextUp,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "NEXT UP FROM YOUR MAIL",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(start = Spacing.s1),
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                    .clickable { onOpen() }
                    .testTag("mailTask_nextUp"),
        ) {
            Box(modifier = Modifier.width(4.dp).matchParentSize().background(PantopusColors.home))
            Row(
                modifier = Modifier.padding(start = 18.dp, top = Spacing.s3, end = Spacing.s3, bottom = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.homeBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.CreditCard,
                        contentDescription = null,
                        size = 18.dp,
                        tint = PantopusColors.home,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = nextUp.title,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Text(
                            text = nextUp.due,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.warmAmber,
                        )
                        Text(text = "· ${nextUp.from}", fontSize = 11.5.sp, color = PantopusColors.appTextSecondary)
                    }
                }
                Text(
                    text = "Open",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                    modifier =
                        Modifier
                            .clip(CircleShape)
                            .background(PantopusColors.categoryTask)
                            .padding(horizontal = 14.dp, vertical = 7.dp),
                )
            }
        }
    }
}

@androidx.compose.ui.tooling.preview.Preview(showBackground = true, widthDp = 390)
@Composable
private fun NextUpCardPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        NextUpCard(nextUp = requireNotNull(MailTaskSampleData.task(done = true).nextUp), onOpen = {})
    }
}
