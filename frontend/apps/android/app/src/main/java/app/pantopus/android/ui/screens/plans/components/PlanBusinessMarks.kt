@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.plans.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.screens.plans.planBusinessColors
import app.pantopus.android.ui.screens.plans.planPinRing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

/*
 * Plans with businesses, board P1: the few parts a business's plan adds. Each says one thing: a business is hosting.
 * Everything else (the pin, the kind's colors, the rows) is the neighbor's plan's own.
 */

/** What TalkBack hears for the badge (the design's accessibility rule). */
const val PLAN_BUSINESS_SPOKEN = "a business"

/**
 * The business badge: a small solid square in the business color with a white ring and the store glyph, on a kind
 * tile's corner or a pin's shoulder. The kind keeps its soft tile; the badge is solid, so a kids' class (violet too)
 * still reads as two things.
 */
@Composable
fun PlanBusinessBadge(
    modifier: Modifier = Modifier,
    size: Dp = 18.dp,
) {
    val colors = planBusinessColors
    Box(
        modifier =
            modifier
                .size(size)
                .clip(RoundedCornerShape(size * 0.33f))
                .background(planPinRing)
                .padding(2.dp)
                .clip(RoundedCornerShape(size * 0.28f))
                .background(colors.accent)
                .testTag("planBusinessBadge")
                .semantics { contentDescription = PLAN_BUSINESS_SPOKEN },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.Store, contentDescription = null, size = size * 0.55f, tint = PantopusColors.appTextInverse)
    }
}

/** A plan row's kind tile with the business badge on its lower corner (board P1 "On a row"). */
@Composable
fun PlanBusinessTile(kind: PlanKind) {
    // The tile keeps its 44 dp; the badge hangs over its corner, as the board draws it.
    Box(modifier = Modifier.size(44.dp)) {
        PlanTile(kind)
        PlanBusinessBadge(modifier = Modifier.align(Alignment.BottomEnd).offset(x = 5.dp, y = 5.dp))
    }
}

/**
 * The business shape: a rounded square with the store glyph in the business color (a person stays a circle). The
 * business's own picture fills it when it has one.
 */
@Composable
fun PlanBusinessShape(
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    avatarUrl: String? = null,
) {
    val colors = planBusinessColors
    val shape = RoundedCornerShape(size * 0.28f)
    Box(
        modifier =
            modifier
                .size(size)
                .clip(shape)
                .background(colors.tint)
                .testTag("planBusinessShape")
                .clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.Store, contentDescription = null, size = size * 0.5f, tint = colors.accent)
        if (!avatarUrl.isNullOrBlank()) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(size).clip(shape),
            )
        }
    }
}

/** "Verified business": the shield of "Verified address", in the business color, so the two never read alike. */
@Composable
fun PlanVerifiedBusiness(modifier: Modifier = Modifier) {
    val colors = planBusinessColors
    Row(
        modifier = modifier.testTag("planVerifiedBusiness").semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.ShieldCheck, contentDescription = null, size = 14.dp, tint = colors.accent)
        Text(
            text = "Verified business",
            style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold),
            color = colors.accent,
        )
    }
}

/** The price chip: "Free" in plain weight (step 2 has no price). */
@Composable
fun PlanPriceChip(
    modifier: Modifier = Modifier,
    text: String = PLAN_FREE,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = 24.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 10.dp, vertical = 2.dp)
                .testTag("planPriceChip"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Normal),
            color = PantopusColors.appTextStrong,
            maxLines = 1,
        )
    }
}

/** "Free": what a business's plan with no price reads (the chip, and TalkBack). */
const val PLAN_FREE = "Free"
