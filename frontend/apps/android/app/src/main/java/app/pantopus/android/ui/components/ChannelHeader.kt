@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * A14.5 Notifications — the tinted column-header band that opens each
 * category card. Three mono letters (P · E · S) right-aligned over the
 * [ChannelTriad] chips below, in an `appSurfaceMuted` strip with a
 * hairline bottom border. Mirror of the iOS `ChannelHeader`.
 *
 * The letters are decorative — the chips below carry the full
 * "Push / Email / SMS" content descriptions — so the band is cleared
 * from TalkBack to avoid a redundant announcement.
 */
@Composable
fun ChannelHeader(modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth().clearAndSetSemantics { }) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurfaceMuted)
                    .padding(start = Spacing.s4, end = Spacing.s4, top = 10.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                listOf(ChannelGlyph.P, ChannelGlyph.E, ChannelGlyph.S).forEach { glyph ->
                    Text(
                        text = glyph.letter,
                        style =
                            TextStyle(
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                letterSpacing = 0.6.sp,
                            ),
                        color = PantopusColors.appTextMuted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.width(22.dp),
                    )
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder.copy(alpha = 0.6f)),
        )
    }
}
