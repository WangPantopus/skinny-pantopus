@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.business_profile.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.business_profile.BusinessActionDock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.6 — the sticky bottom dock: a business-violet primary "Contact"
 * button beside a ghost secondary ("Book" when open, "Call" when
 * newly-claimed / closed), with an optional closed note above.
 *
 * Mirror of iOS `Features/BusinessProfile/Components/ActionBar.swift`.
 */
@Composable
fun ActionBar(
    dock: BusinessActionDock,
    onContact: () -> Unit,
    onBook: () -> Unit,
    onCall: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface),
    ) {
        HorizontalDivider(color = PantopusColors.appBorder)
        Column(
            modifier =
                Modifier
                    .padding(horizontal = 14.dp)
                    .padding(top = if (dock.note == null) 10.dp else 8.dp, bottom = Spacing.s2),
        ) {
            if (dock.note != null) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(bottom = 7.dp)
                            .semantics { contentDescription = dock.note },
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Clock,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.warning,
                    )
                    Text(
                        text = dock.note,
                        color = PantopusColors.appTextSecondary,
                        fontSize = 10.5.sp,
                        modifier = Modifier.padding(start = Spacing.s1),
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                SecondaryButton(
                    dock = dock,
                    onClick = if (dock.secondary == BusinessActionDock.Secondary.Book) onBook else onCall,
                    modifier = Modifier.weight(1f),
                )
                PrimaryButton(onClick = onContact, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun PrimaryButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.business)
                .clickable(onClick = onClick)
                .testTag("businessProfile.contact")
                .semantics { contentDescription = "Contact" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MessageCircle,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = "Contact",
            color = PantopusColors.appTextInverse,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.1).sp,
            modifier = Modifier.padding(start = Spacing.s1),
        )
    }
}

@Composable
private fun SecondaryButton(
    dock: BusinessActionDock,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val isBook = dock.secondary == BusinessActionDock.Secondary.Book
    val label = if (isBook) "Book" else "Call"
    Row(
        modifier =
            modifier
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .testTag("businessProfile.${if (isBook) "book" else "call"}")
                .semantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = if (isBook) PantopusIcon.CalendarPlus else PantopusIcon.Phone,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appText,
        )
        Text(
            text = label,
            color = PantopusColors.appText,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = (-0.1).sp,
            modifier = Modifier.padding(start = Spacing.s1),
        )
    }
}
