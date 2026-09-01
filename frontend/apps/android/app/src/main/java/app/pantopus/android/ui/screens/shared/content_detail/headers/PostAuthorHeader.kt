@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "MatchingDeclarationName", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.shared.content_detail.headers

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.components.VerifiedBadge
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * One of the six intent buckets the design draws for a Pulse post.
 * Backend `Post.purpose` is wider; the view-model collapses those onto
 * these intents for display.
 */
enum class PostIntent(
    val label: String,
    val chipVariant: StatusChipVariant,
    val icon: PantopusIcon,
) {
    LostFound("Lost & Found", StatusChipVariant.ErrorVariant, PantopusIcon.Search),
    Ask("Ask", StatusChipVariant.Info, PantopusIcon.HelpCircle),
    Offer("Offer", StatusChipVariant.Success, PantopusIcon.Hand),
    Event("Event", StatusChipVariant.Personal, PantopusIcon.Calendar),
    Share("Share", StatusChipVariant.Home, PantopusIcon.MessageCircle),
    Alert("Alert", StatusChipVariant.Warning, PantopusIcon.AlertCircle),
    ;

    companion object {
        /**
         * Map a backend `Post.purpose` / `Post.post_type` token onto the
         * nearest UI intent. Unknown values fall back to [Share].
         */
        fun from(
            purpose: String?,
            postType: String?,
        ): PostIntent =
            when ((purpose ?: postType ?: "").lowercase()) {
                "lost_found", "lost", "found" -> LostFound
                "ask" -> Ask
                "offer" -> Offer
                "event" -> Event
                "alert", "safety", "heads_up" -> Alert
                "deal", "recommend", "share", "showcase", "story",
                "neighborhood_win", "visitor_guide", "local_update", "learn",
                -> Share
                else -> Share
            }
    }
}

/**
 * Pulse post header. Avatar (with optional verified badge) + two-line
 * identity stack + right-aligned intent chip.
 */
@Composable
fun PostAuthorHeader(
    displayName: String,
    avatarUrl: String?,
    isVerified: Boolean,
    identity: IdentityPillar,
    timeAndLocality: String,
    intent: PostIntent,
    onAvatarTap: (() -> Unit)? = null,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
                    .then(
                        if (onAvatarTap != null) {
                            Modifier
                                .testTag("pulsePostDetail-authorAvatar")
                                .clickable(onClick = onAvatarTap)
                                .semantics {
                                    contentDescription = "Open $displayName's profile"
                                }
                        } else {
                            Modifier
                        },
                    ),
            contentAlignment = Alignment.TopStart,
        ) {
            AvatarWithIdentityRing(
                name = displayName,
                imageUrl = avatarUrl,
                identity = identity,
                ringProgress = 1f,
                size = 44.dp,
            )
            if (isVerified) {
                Box(
                    modifier = Modifier.size(20.dp).offset(x = 28.dp, y = 28.dp),
                ) {
                    VerifiedBadge(size = Radii.xl)
                }
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = displayName,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Spacer(Modifier.size(2.dp))
            Text(
                text = timeAndLocality,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        StatusChip(text = intent.label.uppercase(), variant = intent.chipVariant, icon = intent.icon)
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun PostAuthorHeaderPreview() {
    PostAuthorHeader(
        displayName = "Alex Rivera",
        avatarUrl = null,
        isVerified = true,
        identity = IdentityPillar.Personal,
        timeAndLocality = "12m ago · Cambridge, MA",
        intent = PostIntent.Ask,
    )
}
