@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

@Composable
internal fun ChatLocationCardView(
    card: ChatLocationCard,
    isOutgoing: Boolean,
    onOpen: () -> Unit,
) {
    val shape =
        RoundedCornerShape(
            topStart = Radii.xl,
            topEnd = Radii.xl,
            bottomStart = if (isOutgoing) Radii.xl else 4.dp,
            bottomEnd = if (isOutgoing) 4.dp else Radii.xl,
        )
    Column(
        modifier =
            Modifier
                .widthIn(max = 260.dp)
                .clip(shape)
                .border(1.dp, if (isOutgoing) PantopusColors.primary500 else PantopusColors.appBorder, shape)
                .background(if (isOutgoing) PantopusColors.primary600 else PantopusColors.appSurface)
                .clickable(onClick = onOpen),
    ) {
        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
                Text("📍", fontSize = 18.sp)
                Text(
                    text = "Location",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isOutgoing) PantopusColors.appTextInverse else PantopusColors.appText,
                )
            }
            Text(
                text = card.address,
                fontSize = 14.sp,
                color = if (isOutgoing) PantopusColors.appTextInverse.copy(alpha = 0.85f) else PantopusColors.appTextSecondary,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
        HorizontalDivider(color = if (isOutgoing) PantopusColors.primary500.copy(alpha = 0.5f) else PantopusColors.appBorder)
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("🧭", fontSize = 12.sp)
            Text(
                text = "Open in Maps",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = if (isOutgoing) PantopusColors.appTextInverse else PantopusColors.primary600,
            )
        }
    }
}

@Composable
internal fun ChatGigOfferCardView(
    card: ChatGigOfferCard,
    isOutgoing: Boolean,
    onOpen: () -> Unit,
) {
    val shape =
        RoundedCornerShape(
            topStart = Radii.xl,
            topEnd = Radii.xl,
            bottomStart = if (isOutgoing) Radii.xl else 4.dp,
            bottomEnd = if (isOutgoing) 4.dp else Radii.xl,
        )
    Column(
        modifier =
            Modifier
                .widthIn(max = 260.dp)
                .clip(shape)
                .border(1.dp, if (isOutgoing) PantopusColors.primary500 else PantopusColors.appBorder, shape)
                .background(if (isOutgoing) PantopusColors.primary600 else PantopusColors.appSurface)
                .clickable(onClick = onOpen),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            Text("💼", fontSize = 18.sp)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = card.title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isOutgoing) PantopusColors.appTextInverse else PantopusColors.appText,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    card.category?.takeIf { it.isNotBlank() }?.let {
                        Text(it, fontSize = 11.sp, color = secondaryText(isOutgoing))
                    }
                    card.status?.takeIf { it.isNotBlank() }?.let {
                        Text(it.replace('_', ' '), fontSize = 11.sp, color = secondaryText(isOutgoing))
                    }
                }
            }
            card.priceLabel?.let {
                Text(
                    text = it,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isOutgoing) PantopusColors.appTextInverse else PantopusColors.appText,
                )
            }
        }
        HorizontalDivider(color = if (isOutgoing) PantopusColors.primary500.copy(alpha = 0.5f) else PantopusColors.appBorder)
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("🔗", fontSize = 12.sp)
            Text(
                text = "View Task",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = if (isOutgoing) PantopusColors.appTextInverse else PantopusColors.primary600,
            )
        }
    }
}

@Composable
internal fun ChatListingOfferCardView(
    card: ChatListingOfferCard,
    isOutgoing: Boolean,
    onOpen: () -> Unit,
) {
    val shape =
        RoundedCornerShape(
            topStart = Radii.xl,
            topEnd = Radii.xl,
            bottomStart = if (isOutgoing) Radii.xl else 4.dp,
            bottomEnd = if (isOutgoing) 4.dp else Radii.xl,
        )
    Column(
        modifier =
            Modifier
                .widthIn(max = 260.dp)
                .clip(shape)
                .border(1.dp, if (isOutgoing) PantopusColors.primary500 else PantopusColors.appBorder, shape)
                .background(if (isOutgoing) PantopusColors.primary600 else PantopusColors.appSurface)
                .clickable(onClick = onOpen),
    ) {
        card.imageUrl?.let { imageUrl ->
            Box(modifier = Modifier.fillMaxWidth().height(128.dp)) {
                AsyncImage(
                    model = imageUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().height(128.dp),
                )
                Text(
                    text = card.priceLabel,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (card.priceLabel == "FREE") PantopusColors.success else PantopusColors.appSurface)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
        }
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            if (card.imageUrl == null) {
                Text("🏷️", fontSize = 18.sp)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = card.title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isOutgoing) PantopusColors.appTextInverse else PantopusColors.appText,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    card.category?.takeIf { it.isNotBlank() }?.let {
                        Text(it, fontSize = 11.sp, color = secondaryText(isOutgoing))
                    }
                    card.condition?.takeIf { it.isNotBlank() }?.let {
                        Text(conditionLabel(it), fontSize = 11.sp, color = secondaryText(isOutgoing))
                    }
                }
            }
            if (card.imageUrl == null) {
                Text(
                    text = card.priceLabel,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isOutgoing) PantopusColors.appTextInverse else PantopusColors.appText,
                )
            }
        }
        HorizontalDivider(color = if (isOutgoing) PantopusColors.primary500.copy(alpha = 0.5f) else PantopusColors.appBorder)
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("🔗", fontSize = 12.sp)
            Text(
                text = "View Listing",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = if (isOutgoing) PantopusColors.appTextInverse else PantopusColors.primary600,
            )
        }
    }
}

private fun secondaryText(isOutgoing: Boolean) =
    if (isOutgoing) {
        PantopusColors.appTextInverse.copy(alpha = 0.75f)
    } else {
        PantopusColors.appTextSecondary
    }

private fun conditionLabel(raw: String): String =
    when (raw) {
        "new" -> "New"
        "like_new" -> "Like New"
        "good" -> "Good"
        "fair" -> "Fair"
        "poor" -> "Poor"
        else -> raw.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
