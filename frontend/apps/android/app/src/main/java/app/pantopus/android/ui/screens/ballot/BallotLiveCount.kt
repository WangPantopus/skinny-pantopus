@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.ballot

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.BallotCountFold
import app.pantopus.android.data.api.models.place.BallotCountGroup
import app.pantopus.android.data.api.models.place.BallotCountOption
import app.pantopus.android.data.api.models.place.BallotCountRace
import app.pantopus.android.data.api.models.place.BallotLiveCount
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

// Place — "Your ballot", the live count drawn while ballots are counted
// (the November 3, 2026 results design): a status line, then each race
// with a bar per choice, or one Yes/No bar for a measure. A candidate's
// party, as the state words it, sits under the name; the two major parties'
// bars are blue and red, and everything else is neutral slate. Nothing marks
// a leader. Statewide races can start folded behind one row. Every word and
// number comes from the server (`civic_election.live_count`); these
// composables only lay them out. Parity twin of iOS
// `BallotLiveCountView.swift`.

/** Digits all one width, so the percentages line up race to race. */
private fun TextStyle.tabular(): TextStyle = copy(fontFeatureSettings = "tnum")

@Composable
fun BallotLiveCount(
    count: BallotLiveCount,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().testTag("place.ballot.count"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)) { append(count.status) }
                append(" · ${count.posted}")
            },
            style = BallotText.style(13.sp, lineHeight = 18.sp),
            color = PantopusColors.appTextSecondary,
        )
        count.groups.forEach { group -> key(group.key) { CountGroup(group) } }
    }
}

@Composable
private fun CountGroup(group: BallotCountGroup) {
    var open by rememberSaveable(group.key) { mutableStateOf(group.fold == null) }
    val fold = group.fold
    if (fold != null && !open) {
        FoldRow(fold, onClick = { open = true })
        return
    }
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            group.title.uppercase(),
            style = BallotText.style(11.sp, FontWeight.SemiBold, letterSpacing = 0.66.sp),
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(bottom = 2.dp).semantics { heading() },
        )
        group.races.forEachIndexed { index, race -> key(race.key) { CountRace(race, first = index == 0) } }
        if (fold != null) {
            Text(
                "Show fewer",
                style = BallotText.style(13.5.sp),
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(role = Role.Button) { open = false }
                        .padding(top = Spacing.s1)
                        .testTag("place.ballot.count.fold"),
            )
        }
    }
}

@Composable
private fun FoldRow(
    fold: BallotCountFold,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(role = Role.Button, onClickLabel = "Show these races", onClick = onClick)
                .padding(Spacing.s3)
                .testTag("place.ballot.count.show"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(fold.label, style = BallotText.style(14.sp, FontWeight.Medium), color = PantopusColors.appText)
            Text(fold.detail, style = BallotText.style(12.sp), color = PantopusColors.appTextSecondary)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), verticalAlignment = Alignment.CenterVertically) {
            Text("Show", style = BallotText.style(13.5.sp), color = PantopusColors.appTextSecondary)
            PantopusIconImage(PantopusIcon.ChevronDown, null, size = 16.dp, strokeWidth = 2f, tint = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun CountRace(
    race: BallotCountRace,
    first: Boolean,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        if (!first) Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = if (first) 6.dp else Spacing.s3, bottom = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)) { append(race.title) }
                    race.qualifier?.let { append(" · $it") }
                },
                style = BallotText.style(14.sp, lineHeight = 18.sp),
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.semantics { heading() },
            )
            if (race.kind == "measure" && race.options.size == 2) {
                MeasureBar(yes = race.options[0], no = race.options[1])
            } else {
                race.options.forEach { CandidateRow(it) }
            }
        }
    }
}

@Composable
private fun CandidateRow(option: BallotCountOption) {
    val fill = partyFill(option.partyTone)
    val party = option.partyLabel?.let { ", $it" }.orEmpty()
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clearAndSetSemantics {
                    contentDescription = "${option.name}$party, ${option.percentLabel}, ${option.votesLabel} votes"
                },
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                option.name,
                style = BallotText.style(14.sp),
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).alignByBaseline(),
            )
            Text(
                option.votesLabel,
                style = BallotText.style(12.5.sp).tabular(),
                color = PantopusColors.appTextMuted,
                modifier = Modifier.alignByBaseline(),
            )
            Text(
                option.percentLabel,
                style = BallotText.style(14.sp, FontWeight.SemiBold).tabular(),
                color = PantopusColors.appText,
                textAlign = TextAlign.End,
                modifier = Modifier.widthIn(min = 46.dp).alignByBaseline(),
            )
        }
        option.partyLabel?.let { label ->
            Row(
                modifier = Modifier.padding(bottom = 1.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(fill))
                Text(label, style = BallotText.style(12.sp, lineHeight = 15.sp), color = PantopusColors.appTextSecondary)
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(PantopusColors.appBorder),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(option.share.toFloat().coerceIn(0f, 1f))
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(3.dp))
                        .background(fill),
            )
        }
    }
}

/** The bar and the party dot: blue and red for the two major parties, the neutral slate for everyone else. */
private fun partyFill(tone: String?): Color =
    when (tone) {
        "democratic" -> PantopusColors.ballotCountDemocratic
        "republican" -> PantopusColors.ballotCountRepublican
        else -> PantopusColors.ballotCountFill
    }

@Composable
private fun MeasureBar(
    yes: BallotCountOption,
    no: BallotCountOption,
) {
    // The two sides split the whole bar between them.
    val both = yes.share + no.share
    val yesFraction = if (both > 0) (yes.share / both).toFloat() else 0.5f
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clearAndSetSemantics { contentDescription = "${yes.name} ${yes.percentLabel}, ${no.name} ${no.percentLabel}" },
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(side(yes, nameFirst = true), style = BallotText.style(14.sp).tabular(), color = PantopusColors.appTextSecondary)
            Text(side(no, nameFirst = false), style = BallotText.style(14.sp).tabular(), color = PantopusColors.appTextSecondary)
        }
        Row(modifier = Modifier.fillMaxWidth().height(8.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Box(
                modifier =
                    Modifier
                        .weight(yesFraction.coerceAtLeast(MIN_WEIGHT))
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(topStart = 4.dp, bottomStart = 4.dp))
                        .background(PantopusColors.ballotCountYes),
            )
            Box(
                modifier =
                    Modifier
                        .weight((1f - yesFraction).coerceAtLeast(MIN_WEIGHT))
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(topEnd = 4.dp, bottomEnd = 4.dp))
                        .background(PantopusColors.ballotCountNo),
            )
        }
    }
}

/** A weight must be positive; a side with no votes keeps a sliver. */
private const val MIN_WEIGHT = 0.001f

/** "Yes 41.9%" on the left, "58.1% No" on the right: the name quiet, the share bold. */
private fun side(
    option: BallotCountOption,
    nameFirst: Boolean,
): AnnotatedString =
    buildAnnotatedString {
        val percent: () -> Unit = {
            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)) { append(option.percentLabel) }
        }
        if (nameFirst) {
            append(option.name)
            append(" ")
            percent()
        } else {
            percent()
            append(" ")
            append(option.name)
        }
    }
