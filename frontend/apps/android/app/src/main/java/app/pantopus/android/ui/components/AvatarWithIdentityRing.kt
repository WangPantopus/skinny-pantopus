@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongMethod", "LongParameterList", "VariableNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage

/** Identity pillar tint for the progress ring. */
enum class IdentityPillar(
    val color: Color,
    val backgroundColor: Color,
) {
    Personal(PantopusColors.personal, PantopusColors.personalBg),
    Home(PantopusColors.home, PantopusColors.homeBg),
    Business(PantopusColors.business, PantopusColors.businessBg),
}

/**
 * Avatar with an identity-tinted progress ring.
 *
 * @param name Display name — initials are shown when [imageUrl] is null
 *     or while the image is loading / failed.
 * @param imageUrl Optional avatar URL. Rendered via Coil
 *     [SubcomposeAsyncImage]; falls back to initials on null / loading
 *     / error to mirror iOS `AsyncImage` phase handling
 *     (`Core/Design/Components/AvatarWithIdentityRing.swift:80-91`).
 * @param identity Ring tint (personal / home / business).
 * @param ringProgress 0..1 — clamped.
 * @param size Outer diameter; defaults to 40dp.
 */
@Composable
fun AvatarWithIdentityRing(
    name: String,
    identity: IdentityPillar,
    ringProgress: Float,
    modifier: Modifier = Modifier,
    imageUrl: String? = null,
    size: Dp = 40.dp,
) {
    val progress = ringProgress.coerceIn(0f, 1f)
    Box(
        modifier =
            modifier
                .size(size)
                .semantics {
                    contentDescription = "$name, ${(progress * 100).toInt()}% profile complete"
                },
        contentAlignment = Alignment.Center,
    ) {
        val ringWidth: Dp = 2.5.dp
        Box(
            modifier =
                Modifier
                    .size(size)
                    .drawBehind {
                        val strokePx = ringWidth.toPx()
                        val diameter = size.toPx() - strokePx
                        val topLeft = Offset(strokePx / 2, strokePx / 2)
                        val dims = Size(diameter, diameter)
                        drawArc(
                            color = PantopusColors.appBorder,
                            startAngle = 0f,
                            sweepAngle = 360f,
                            useCenter = false,
                            topLeft = topLeft,
                            size = dims,
                            style = Stroke(width = strokePx),
                        )
                        drawArc(
                            color = identity.color,
                            startAngle = -90f,
                            sweepAngle = progress * 360f,
                            useCenter = false,
                            topLeft = topLeft,
                            size = dims,
                            style = Stroke(width = strokePx, cap = androidx.compose.ui.graphics.StrokeCap.Round),
                        )
                    },
        )
        Box(
            modifier =
                Modifier
                    .size(size - 6.dp)
                    .clip(CircleShape)
                    .background(identity.backgroundColor),
            contentAlignment = Alignment.Center,
        ) {
            if (imageUrl.isNullOrBlank()) {
                AvatarInitials(name = name, identity = identity)
            } else {
                SubcomposeAsyncImage(
                    model = imageUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    loading = { AvatarInitials(name = name, identity = identity) },
                    error = { AvatarInitials(name = name, identity = identity) },
                )
            }
        }
    }
}

@Composable
private fun AvatarInitials(
    name: String,
    identity: IdentityPillar,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(identity.backgroundColor),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initials(name),
            style = PantopusTextStyle.small,
            color = identity.color,
        )
    }
}

private fun initials(name: String): String =
    name
        .split(' ')
        .take(2)
        .mapNotNull { part -> part.firstOrNull()?.uppercaseChar() }
        .joinToString(separator = "")

@Preview(showBackground = true, widthDp = 360, heightDp = 120)
@Composable
private fun AvatarPreview() {
    Row(
        modifier = Modifier.background(Color.White),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        AvatarWithIdentityRing(name = "Alice Doe", identity = IdentityPillar.Personal, ringProgress = 0.25f)
        AvatarWithIdentityRing(name = "Bob Roy", identity = IdentityPillar.Home, ringProgress = 0.65f)
        AvatarWithIdentityRing(
            name = "Carmen Lee",
            identity = IdentityPillar.Business,
            ringProgress = 1.0f,
            size = 56.dp,
        )
    }
}
