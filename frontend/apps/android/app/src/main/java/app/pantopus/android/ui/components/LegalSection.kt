@file:Suppress("MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * A19 legal scaffold — a primary-tinted, numbered H2 section heading. The
 * mono section number sits in `primary600`; the title in `primary700`.
 *
 * `number` is the 1-based section index (matching the [LegalTOCCard] chip).
 * The heading carries a stable `testTag` ("legalSection_<number>") the host
 * screen + UI tests use as the scroll anchor when a TOC row is tapped.
 *
 * @param number 1-based section number (TOC `onJump` index + 1).
 * @param title Section title, mirrored word-for-word from the web copy.
 */
@Composable
fun LegalSection(
    number: Int,
    title: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = 28.dp, bottom = 10.dp)
                .semantics { heading() }
                .testTag("legalSection_$number"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            text = number.toString().padStart(2, '0'),
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary600,
            modifier = Modifier.padding(top = 2.dp),
        )
        Text(
            text = title,
            fontSize = 18.sp,
            lineHeight = 24.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary700,
            modifier = Modifier.weight(1f),
        )
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun LegalSectionPreview() {
    Column(modifier = Modifier.padding(horizontal = Spacing.s5)) {
        LegalSection(number = 1, title = "Overview")
        LegalSection(number = 2, title = "Information we collect")
        LegalSection(number = 10, title = "Changes to this policy")
    }
}
