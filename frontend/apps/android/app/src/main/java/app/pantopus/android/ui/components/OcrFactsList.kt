@file:Suppress("MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Tone for the header status chip and per-row tag pill.
 *
 * - [Neutral] — muted surface + secondary text (e.g. an editable
 *   "Tap to edit" hint).
 * - [Success] — green tint (e.g. a locked "Saved" state, or a "2-yr"
 *   warranty tag).
 */
enum class OcrFactsTone { Neutral, Success }

/**
 * The header accessory on an [OcrFactsList] — an icon + short label that
 * doubles as the editable/saved status and the optional confidence chip.
 */
data class OcrFactsStatus(
    val icon: PantopusIcon,
    val text: String,
    val tone: OcrFactsTone = OcrFactsTone.Neutral,
)

/** A trailing pill on a fact row (e.g. the `2-yr` warranty length). */
data class OcrFactTag(
    val text: String,
    val tone: OcrFactsTone = OcrFactsTone.Success,
)

/** One fact "read off" the scan. */
data class OcrFact(
    val icon: PantopusIcon,
    val label: String,
    val value: String,
    /** When true the value renders monospaced (serials, tracking numbers). */
    val isCode: Boolean = false,
    /** Optional dimmer second line under the value (model number, store…). */
    val note: String? = null,
    /** Optional trailing pill (e.g. `2-yr`). */
    val tag: OcrFactTag? = null,
)

/**
 * White card of OCR-extracted facts — the `ExtractedFacts` ("Read from your
 * scans") slot in the A17.14 Unboxing flow. Header title + optional status
 * chip, then one hairline-separated row per fact. Pure presentation: the
 * consuming screen owns the OCR data. Mirrors `OcrFactsList` on iOS.
 */
@Composable
fun OcrFactsList(
    title: String,
    facts: List<OcrFact>,
    modifier: Modifier = Modifier,
    status: OcrFactsStatus? = null,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        OcrFactsHeader(title = title, status = status)
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        facts.forEachIndexed { index, fact ->
            OcrFactRow(fact)
            if (index < facts.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            }
        }
    }
}

@Composable
private fun OcrFactsHeader(
    title: String,
    status: OcrFactsStatus?,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title.uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
        )
        Box(modifier = Modifier.weight(1f))
        if (status != null) {
            val tint = statusColor(status.tone)
            Row(
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(icon = status.icon, contentDescription = null, size = 11.dp, tint = tint)
                Text(text = status.text, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = tint)
            }
        }
    }
}

@Composable
private fun OcrFactRow(fact: OcrFact) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { contentDescription = rowDescription(fact) },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = fact.icon,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextStrong,
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = fact.label,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = fact.value,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = if (fact.isCode) FontFamily.Monospace else FontFamily.Default,
                color = PantopusColors.appText,
            )
            if (fact.note != null) {
                Text(text = fact.note, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
            }
        }

        if (fact.tag != null) {
            Text(
                text = fact.tag.text,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = tagForeground(fact.tag.tone),
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(tagBackground(fact.tag.tone))
                        .padding(horizontal = Spacing.s2, vertical = 3.dp),
            )
        }
    }
}

private fun rowDescription(fact: OcrFact): String =
    buildString {
        append("${fact.label}: ${fact.value}")
        fact.note?.let { append(", $it") }
        fact.tag?.let { append(", ${it.text}") }
    }

private fun statusColor(tone: OcrFactsTone): Color =
    when (tone) {
        OcrFactsTone.Neutral -> PantopusColors.appTextSecondary
        OcrFactsTone.Success -> PantopusColors.success
    }

private fun tagForeground(tone: OcrFactsTone): Color =
    when (tone) {
        OcrFactsTone.Neutral -> PantopusColors.appTextSecondary
        OcrFactsTone.Success -> PantopusColors.success
    }

private fun tagBackground(tone: OcrFactsTone): Color =
    when (tone) {
        OcrFactsTone.Neutral -> PantopusColors.appSurfaceSunken
        OcrFactsTone.Success -> PantopusColors.successBg
    }

internal val sampleOcrFacts: List<OcrFact> =
    listOf(
        OcrFact(PantopusIcon.Package, "Product", "Breville Barista Express", note = "BES870XL · Stainless"),
        OcrFact(PantopusIcon.Hash, "Serial", "BES870-22F-091473", isCode = true),
        OcrFact(
            PantopusIcon.Receipt,
            "Purchased",
            "May 28, 2026 · \$699.95",
            note = "Williams Sonoma · card ••4417",
        ),
        OcrFact(
            PantopusIcon.ShieldCheck,
            "Warranty until",
            "May 28, 2028",
            tag = OcrFactTag("2-yr", OcrFactsTone.Success),
        ),
    )

@Suppress("UnusedPrivateMember")
@Preview(showBackground = true, widthDp = 360)
@Composable
private fun OcrFactsListPreview() {
    Column(
        modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        OcrFactsList(
            title = "Read from your scans",
            status = OcrFactsStatus(PantopusIcon.ScanLine, "Tap to edit", OcrFactsTone.Neutral),
            facts = sampleOcrFacts,
        )
        OcrFactsList(
            title = "Read from your scans",
            status = OcrFactsStatus(PantopusIcon.Lock, "Saved", OcrFactsTone.Success),
            facts = sampleOcrFacts,
        )
    }
}
