@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.settings.help

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P8 / T6.2c — Settings → Help.
 *
 * Static FAQ + contact CTA, per Q7. Content is bundled in-source —
 * lift into the backend if it grows.
 */
@Composable
fun HelpCenterScreen(
    onBack: () -> Unit = {},
    onEmailSupport: () -> Unit = {},
) {
    ContentDetailShell(
        title = "Help",
        onBack = onBack,
        header = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = "How can we help?",
                    style = PantopusTextStyle.h2,
                    color = PantopusColors.appText,
                )
                Text(
                    text =
                        "Most questions about messages, mail, and gigs have answers below. " +
                            "If you don't see yours, reach out — we read every message.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
        },
        body = {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("helpCenter"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s5),
            ) {
                Sections.forEach { section ->
                    Column(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = Spacing.s4),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                    ) {
                        Text(
                            text = section.heading,
                            style = PantopusTextStyle.h3,
                            color = PantopusColors.appText,
                        )
                        section.items.forEach { item ->
                            Column(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(Radii.lg))
                                        .background(PantopusColors.appSurface)
                                        .padding(Spacing.s4),
                                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                            ) {
                                Text(
                                    text = item.question,
                                    style = PantopusTextStyle.body,
                                    color = PantopusColors.appText,
                                )
                                Text(
                                    text = item.answer,
                                    style = PantopusTextStyle.small,
                                    color = PantopusColors.appTextSecondary,
                                )
                            }
                        }
                    }
                }
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Text(
                        text = "Still stuck?",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                    PrimaryButton(
                        title = "Email support",
                        onClick = onEmailSupport,
                        modifier = Modifier.testTag("helpCenterContactCTA"),
                    )
                }
            }
        },
    )
}

private data class Section(val heading: String, val items: List<Item>)

private data class Item(val question: String, val answer: String)

private val Sections =
    listOf(
        Section(
            heading = "Getting started",
            items =
                listOf(
                    Item(
                        question = "Why do I need to verify my email?",
                        answer =
                            "Verifying your email unlocks posting, messaging, and trust signals other neighbors look for. " +
                                "It also lets us send you a Magic Link if you forget your password.",
                    ),
                    Item(
                        question = "Who can see my address?",
                        answer =
                            "Only verified connections — and only at the precision you set under " +
                                "Settings → Privacy → Address sharing. The default is street-level.",
                    ),
                ),
        ),
        Section(
            heading = "Mail & messages",
            items =
                listOf(
                    Item(
                        question = "What's the difference between mail and a chat?",
                        answer =
                            "Mail is asynchronous and ceremonial — it lands in your mailbox, can carry " +
                                "attachments and trust signals, and you reply when you're ready. " +
                                "Chats are real-time and live in the inbox tab.",
                    ),
                    Item(
                        question = "Why didn't my message send?",
                        answer =
                            "If the other person has blocked you, or if their privacy settings prevent " +
                                "unsolicited messages, the send fails. We surface this with a clear error in the chat thread.",
                    ),
                ),
        ),
        Section(
            heading = "Account & safety",
            items =
                listOf(
                    Item(
                        question = "How do I block someone?",
                        answer =
                            "Open their profile, tap the kebab menu (•••), and choose Block. " +
                                "You can unblock them later from Settings → Blocked users.",
                    ),
                    Item(
                        question = "How do I delete my account?",
                        answer =
                            "Go to Settings → Privacy → Delete account. " +
                                "You'll confirm in the app and verify your identity, then your account and its " +
                                "data are removed. Finish or cancel any gigs in progress and resolve pending " +
                                "payments first — those block deletion.",
                    ),
                ),
        ),
    )
