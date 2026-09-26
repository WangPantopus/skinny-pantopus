@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.ballot

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.BallotCoverage
import app.pantopus.android.data.api.models.place.BallotOfficialLink
import app.pantopus.android.data.api.models.place.BallotPhase
import app.pantopus.android.data.api.models.place.BallotSummary
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

// Place — "Your ballot" (Board: Place: Your ballot card, and the proposed
// P0 states board). Measured from the canvas: a white card, 1dp border,
// radius 20, padding 16, rows 14 apart (12 in the compact states); the
// 34dp home-green tile; 15 semibold title over a 12.5 subtitle; the
// "N days" pill; the deadline timeline; the 44dp primary button (radius
// 12); the sunken links well (radius 14); the 12sp source line. Every
// sentence comes from the server (`civic_election`, `ballot_p0`); these
// composables lay it out and draw nothing they weren't given. Parity twin
// of iOS `BallotCardView.swift`.

private val CardShape = RoundedCornerShape(Radii.xl2)

/** The links well's external-link glyph (an icon size, not a radius). */
private val LinkIconSize = 16.dp

/**
 * The card frame the Ballot cards share, as the canvas's CSS box: the
 * 1dp border sits inside the outer edge and the 16 padding inside it.
 */
fun Modifier.ballotCardFrame(): Modifier =
    this
        .fillMaxWidth()
        .pantopusShadow(PantopusElevations.sm, CardShape)
        .clip(CardShape)
        .background(PantopusColors.appSurface)
        .border(1.dp, PantopusColors.appBorder, CardShape)
        .padding(Spacing.s4 + 1.dp)

/** Text styles as the canvas sets them; a set line height centres the line box, like CSS. */
internal object BallotText {
    private val halfLeading = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)

    fun style(
        size: TextUnit,
        weight: FontWeight = FontWeight.Normal,
        lineHeight: TextUnit = TextUnit.Unspecified,
        letterSpacing: TextUnit = 0.sp,
    ): TextStyle =
        TextStyle(
            fontSize = size,
            fontWeight = weight,
            lineHeight = lineHeight,
            letterSpacing = letterSpacing,
            lineHeightStyle = if (lineHeight.isSpecified) halfLeading else null,
        )
}

/**
 * The "Your ballot" card. [asOf] is the section envelope's `as_of`;
 * [onOpenGovernments] opens the still governments view.
 */
@Composable
fun BallotCard(
    card: BallotSummary,
    modifier: Modifier = Modifier,
    asOf: String? = null,
    onOpenGovernments: (() -> Unit)? = null,
) {
    val supportedSeason = card.phase == BallotPhase.IN_SEASON && card.coverage == BallotCoverage.SUPPORTED
    val roomy = supportedSeason || card.phase == BallotPhase.ELECTION_DAY
    Column(
        modifier = modifier.ballotCardFrame().testTag("place.ballot.card"),
        verticalArrangement = Arrangement.spacedBy(if (roomy) 14.dp else Spacing.s3),
    ) {
        BallotCardHeader(title = card.title, subtitle = card.subtitle, chip = card.chip)
        card.line?.let {
            Text(it, style = BallotText.style(15.sp, FontWeight.Medium, 21.sp), color = PantopusColors.appText)
        }
        val today = card.today
        if (supportedSeason && today != null && card.deadlines.isNotEmpty()) {
            BallotTimeline(deadlines = card.deadlines, today = today)
        }
        card.electionDayNotice?.let { BallotNoticeWell(lead = it.lead, detail = it.detail) }
        card.howItWorks?.let { BallotBodyText(it) }
        card.note?.let { BallotBodyText(it) }
        val action = card.primaryAction
        if (action != null && action.kind == "governments" && onOpenGovernments != null) {
            BallotPrimaryButton(
                label = action.label,
                onClick = onOpenGovernments,
                modifier = Modifier.testTag("place.ballot.governments"),
            )
        }
        BallotLinksWell(card.officialLinks)
        BallotFormat.sourceText(card.sourceLine, asOf)?.let {
            Text(it, style = BallotText.style(12.sp, lineHeight = 16.sp), color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
fun BallotCardHeader(
    title: String,
    subtitle: String?,
    chip: String?,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BallotTile()
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = BallotText.style(15.sp, FontWeight.SemiBold), color = PantopusColors.appText)
            subtitle?.let { Text(it, style = BallotText.style(12.5.sp), color = PantopusColors.appTextSecondary) }
        }
        chip?.let {
            Text(
                it,
                style = BallotText.style(12.sp, FontWeight.SemiBold),
                color = PantopusColors.appTextStrong,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = 9.dp, vertical = 3.dp),
            )
        }
    }
}

@Composable
fun BallotBodyText(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(text, modifier = modifier, style = BallotText.style(13.5.sp, lineHeight = 19.sp), color = PantopusColors.appTextStrong)
}

@Composable
fun BallotPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 44.dp,
    fontSize: TextUnit = 15.sp,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary700)
                .clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = BallotText.style(fontSize, FontWeight.SemiBold), color = PantopusColors.appTextInverse)
    }
}

/** The needs-action well: warning ink on the warning background, radius 14. */
@Composable
fun BallotNoticeWell(
    lead: String,
    detail: String?,
    modifier: Modifier = Modifier,
    radius: Dp = 14.dp,
    padding: PaddingValues = PaddingValues(horizontal = Spacing.s3, vertical = 10.dp),
    onClick: (() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(radius)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.warningBg)
                .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(padding),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(PantopusIcon.Calendar, null, size = 18.dp, strokeWidth = 2f, tint = PantopusColors.warning)
        Text(
            BallotFormat.notice(lead, detail),
            style = BallotText.style(13.5.sp, lineHeight = 19.sp),
            color = PantopusColors.warning,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
fun BallotLinksWell(
    links: List<BallotOfficialLink>,
    modifier: Modifier = Modifier,
) {
    if (links.isEmpty()) return
    val uriHandler = LocalUriHandler.current
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurfaceSunken),
    ) {
        links.forEachIndexed { index, link ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(role = Role.Button, onClickLabel = "Opens the official site") { uriHandler.openQuietly(link.url) }
                        .padding(Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(link.label, style = BallotText.style(14.sp, FontWeight.Medium), color = PantopusColors.appText)
                    Text(link.owner, style = BallotText.style(12.sp), color = PantopusColors.appTextSecondary)
                }
                PantopusIconImage(
                    PantopusIcon.ExternalLink,
                    null,
                    size = LinkIconSize,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            if (index < links.lastIndex) {
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
            }
        }
    }
}

/** Opens an official site in the browser; with no browser to take it, nothing happens. */
internal fun UriHandler.openQuietly(url: String) {
    runCatching { openUri(url) }
}

object BallotFormat {
    /** "32 days left." / "1 day left." / "Last day." */
    fun daysLeft(n: Int): String =
        when {
            n <= 0 -> "Last day."
            n == 1 -> "1 day left."
            else -> "$n days left."
        }

    /** Reference data is dated, never timed: "Sep 24" from its `as_of`. */
    fun asOfDate(asOf: String?): String? {
        val day = asOf?.takeIf { it.length >= 10 }?.take(10) ?: return null
        return BallotTimelineLayout.monthDay(day).takeIf { it != day }
    }

    /** "<source> · as of <date>", or the source alone when undated. */
    fun sourceText(
        sourceLine: String?,
        asOf: String?,
    ): String? {
        val line = sourceLine ?: return null
        return asOfDate(asOf)?.let { "$line · as of $it" } ?: line
    }

    /** The bold lead, then the detail, as one run of text. */
    fun notice(
        lead: String,
        detail: String?,
    ): AnnotatedString =
        buildAnnotatedString {
            val rest = detail?.takeIf { it.isNotEmpty() }
            if (lead.isNotEmpty()) {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(lead) }
                if (rest != null) append(" ")
            }
            rest?.let { append(it) }
        }
}
