@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.businesses.page_editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P4.2 — A13.10 Edit Business Page. Published-mode identity band —
 * violet bg + store glyph + business name + "Published · N days ago"
 * trailing meta. Mirrors iOS `EditBusinessIdentityStrip`.
 */
@Composable
fun EditBusinessIdentityStrip(
    name: String,
    lastPublishedLabel: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.businessBg)
                .testTag("editBusinessPage.identityStrip")
                .semantics { contentDescription = "$name, $lastPublishedLabel" },
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(18.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(PantopusColors.business),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Building2,
                    contentDescription = null,
                    size = 10.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Text(
                text = name,
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.businessDark,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = lastPublishedLabel,
                style = TextStyle(fontSize = 11.sp),
                color = PantopusColors.businessDark.copy(alpha = 0.7f),
                maxLines = 1,
            )
        }
        HorizontalDivider(
            color = PantopusColors.business.copy(alpha = 0.18f),
            thickness = 1.dp,
            modifier = Modifier.fillMaxWidth().height(1.dp).align(Alignment.BottomCenter),
        )
    }
}
