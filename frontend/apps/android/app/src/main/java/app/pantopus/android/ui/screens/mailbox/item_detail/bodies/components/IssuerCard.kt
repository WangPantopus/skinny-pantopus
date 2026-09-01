@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.RecordsIssuer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.10 — IssuerCard. Records mail's bespoke sender card: institution
 * avatar with a slate gradient + corner landmark badge, two-line name +
 * department, a regulated identifier in mono, and a DKIM-verified trust
 * note in a slate-tinted strip below. Compose mirror of iOS
 * `Variants/Components/IssuerCard.swift`.
 */
@Composable
fun IssuerCard(
    issuer: RecordsIssuer,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("mailDetail_records_issuerCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "ISSUER",
            modifier = Modifier.semantics { heading() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Avatar(initials = issuer.initials)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = issuer.name,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = issuer.dept,
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    text = issuer.identifier,
                    modifier = Modifier.padding(top = 2.dp),
                    fontSize = 10.5.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.categoryRecordsDeep,
                )
            }
        }
        TrustNote(note = issuer.trustNote)
    }
}

@Composable
private fun Avatar(initials: String) {
    Box(
        modifier = Modifier.size(46.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(
                        Brush.linearGradient(
                            listOf(
                                PantopusColors.categoryRecordsDeep,
                                PantopusColors.categoryRecordsDeep.copy(alpha = 0.85f),
                            ),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.6.sp,
                color = PantopusColors.appTextInverse,
            )
        }
        // Corner landmark badge — signals "institution" beyond the gradient.
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = 4.dp, y = 4.dp)
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .border(1.5.dp, PantopusColors.categoryRecordsDeep, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Landmark,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.categoryRecordsDeep,
            )
        }
    }
}

@Composable
private fun TrustNote(note: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.categoryRecordsBg)
                .border(1.dp, PantopusColors.categoryRecordsBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.categoryRecordsDeep,
        )
        Text(
            text = note,
            fontSize = 11.sp,
            color = PantopusColors.categoryRecordsDeep,
        )
    }
}
