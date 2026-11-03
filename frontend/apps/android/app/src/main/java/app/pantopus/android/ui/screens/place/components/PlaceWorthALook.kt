@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.screens.place.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/** One real thing worth a look at this home, with where it opens. */
data class WorthItem(
    val key: String,
    val title: String,
    val detail: String?,
    val icon: PantopusIcon,
    val onOpen: (() -> Unit)?,
)

/**
 * "Worth a look" (TPR brief 6.5): at most three real items, most consequential first (what changed since the last
 * visit, systems beyond or near a typical range, tasks due or overdue that this viewer can read, what the county
 * record or the bill comparison flags), then the first-week card. Nothing shows when there is nothing: never "all good".
 */
@Composable
fun PlaceWorthALook(
    items: List<WorthItem>,
    modifier: Modifier = Modifier,
    footer: (@Composable () -> Unit)? = null,
    justMoved: (@Composable () -> Unit)? = null,
) {
    if (items.isEmpty() && justMoved == null) return
    Column(modifier = modifier.fillMaxWidth().testTag("place.worthALook")) {
        if (items.isNotEmpty()) {
            Text(
                "Worth a look",
                fontSize = 18.sp,
                lineHeight = 23.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.2).sp,
                color = PantopusColors.appText,
                modifier = Modifier.padding(bottom = 8.dp, start = 2.dp).semantics { heading() },
            )
            Column(modifier = Modifier.fillMaxWidth().placeSurface()) {
                items.forEachIndexed { index, item ->
                    if (index > 0) PlaceHairline(Modifier.padding(start = 48.dp))
                    WorthRow(item)
                }
                footer?.let {
                    PlaceHairline()
                    it()
                }
            }
        }
        justMoved?.let { Column(modifier = Modifier.padding(top = if (items.isEmpty()) 0.dp else 12.dp)) { it() } }
    }
}

@Composable
private fun WorthRow(item: WorthItem) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = item.onOpen != null, role = Role.Button) { item.onOpen?.invoke() }
                .heightIn(min = 56.dp)
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .testTag("place.worth.${item.key}"),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(item.icon, null, size = 20.dp, strokeWidth = 2f, tint = PantopusColors.appTextSecondary)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(item.title, fontSize = 14.5.sp, lineHeight = 19.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            item.detail?.let { Text(it, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary) }
        }
        if (item.onOpen != null) PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}
