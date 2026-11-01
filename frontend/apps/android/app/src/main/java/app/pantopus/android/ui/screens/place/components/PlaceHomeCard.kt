package app.pantopus.android.ui.screens.place.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionAccess
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.data.api.models.place.PlaceTier
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.screens.place.PlaceHomeShortcut
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.messaging.PlaceActionRowLabel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import java.time.ZoneId
import java.util.Locale

private const val MAX_FACTS = 4

/** What the home card says about where the viewer stands (TPR brief 6.3), with its icon. */
data class PlaceStanding(
    val words: String,
    val icon: PantopusIcon,
)

/** "Verified home", "Claimed · verify to see more", "Private setup · only you", "Claim in review · public view", "Guest access · public facts". */
fun placeStanding(
    intel: PlaceIntelligence,
    claimInReview: Boolean,
): PlaceStanding =
    when {
        claimInReview -> PlaceStanding("Claim in review · public view", PantopusIcon.Clock)
        intel.viewer?.role == "nonresident" -> PlaceStanding("Guest access · public facts", PantopusIcon.Users)
        intel.tier == PlaceTier.T4 -> PlaceStanding("Verified home", PantopusIcon.ShieldCheck)
        intel.tier == PlaceTier.T3 -> PlaceStanding("Claimed · verify to see more", PantopusIcon.Home)
        else -> PlaceStanding("Private setup · only you", PantopusIcon.Home)
    }

/** The home's known facts from the property record, never guessed: up to four, each a value over what it is. */
fun placeHomeFacts(env: PlaceSectionEnvelope?): List<Pair<String, String>> {
    val live = env?.status == PlaceSectionStatus.READY || env?.status == PlaceSectionStatus.STALE
    val data = env?.yourHome?.takeIf { live || env.status == PlaceSectionStatus.PARTIAL } ?: return emptyList()
    return buildList {
        data.yearBuilt?.let { add("$it" to "Year built") }
        data.sqft?.let { add(PlacePresentation.grouped(it) to "Square feet") }
        val beds = data.bedrooms?.let { "$it bd" }
        val baths = data.bathrooms?.let { b -> if (b % 1.0 == 0.0) "${b.toLong()} ba" else String.format(Locale.US, "%.1f ba", b) }
        listOfNotNull(beds, baths).takeIf { it.isNotEmpty() }?.let { add(it.joinToString(" · ") to "Beds and baths") }
        data.lotSqft?.let { add("${PlacePresentation.grouped(it)} sq ft" to "Lot size") }
    }.take(MAX_FACTS)
}

/**
 * Your Place's first card (TPR brief 6.3–6.4): where the viewer stands, the address, the home's known facts with the
 * record's source and month, the verify step while it applies, and the household's tools sized to how many there are.
 */
@Composable
@Suppress("LongParameterList", "LongMethod")
fun PlaceHomeCard(
    intel: PlaceIntelligence,
    claimInReview: Boolean,
    zone: ZoneId?,
    shortcuts: List<PlaceHomeShortcut>,
    showsTools: Boolean,
    onOpenHomeTools: () -> Unit,
    onOpenShortcut: (PlaceHomeShortcut) -> Unit,
    onVerify: (() -> Unit)?,
    onOpenHome: (() -> Unit)?,
    onRetry: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val standing = placeStanding(intel, claimInReview)
    val home = intel.groups.flatMap { it.sections }.firstOrNull { it.sectionId == PlaceSectionId.YOUR_HOME }
    val facts = placeHomeFacts(home)
    Column(modifier = modifier.fillMaxWidth().placeSurface().testTag("place.homeCard")) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                PantopusIconImage(standing.icon, null, size = 15.dp, strokeWidth = 2.25f, tint = PantopusColors.appTextSecondary)
                Text(standing.words, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
            }
            Text(
                intel.place.line1.ifBlank { intel.place.label },
                fontSize = 22.sp,
                lineHeight = 27.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.3).sp,
                color = PantopusColors.appText,
                modifier = Modifier.padding(top = 2.dp).semantics { heading() },
            )
            listOfNotNull(intel.place.city.takeIf { it.isNotBlank() }, intel.place.state.takeIf { it.isNotBlank() })
                .takeIf { it.isNotEmpty() }
                ?.let { Text(it.joinToString(", "), fontSize = 13.5.sp, color = PantopusColors.appTextSecondary) }
            if (facts.isNotEmpty()) {
                HomeFacts(facts)
                // One provenance line, source first (TPR brief 8): "County public records · Record Oct 2026".
                val record =
                    listOfNotNull(
                        home?.source?.takeIf { it.isNotBlank() },
                        PlacePresentation.fmtMonthYear(home?.asOf, zone)?.let { "Record $it" },
                    ).joinToString(" · ")
                if (record.isNotEmpty()) {
                    Text(
                        record,
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        color = PantopusColors.appTextMuted,
                        modifier =
                            Modifier
                                .padding(top = 6.dp)
                                .clickable(enabled = onOpenHome != null, role = Role.Button) { onOpenHome?.invoke() }
                                .testTag("place.homeCard.record"),
                    )
                }
            } else if (home != null) {
                // A locked record's verify step is the card's own "Verify address" below (the same sheet).
                HomeRecordLine(home, onRetry)
            }
            if (onVerify != null) {
                Text(
                    "Verify your address to message neighbors and get your badge.",
                    fontSize = 13.5.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.appTextStrong,
                    modifier = Modifier.padding(top = 10.dp),
                )
                GhostButton(
                    "Verify address",
                    onClick = onVerify,
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp).testTag("place.homeCard.verify"),
                )
            }
        }
        if (showsTools) {
            PlaceHairline()
            PlaceToolsRow(shortcuts, onOpenHomeTools, onOpenShortcut)
        }
    }
}

@Composable
private fun HomeFacts(facts: List<Pair<String, String>>) {
    Column(modifier = Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        facts.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                pair.forEach { (value, label) ->
                    Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
                        Text(value, fontSize = 18.sp, lineHeight = 23.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                        Text(label, fontSize = 12.sp, lineHeight = 16.sp, color = PantopusColors.appTextMuted)
                    }
                }
                if (pair.size == 1) Box(modifier = Modifier.weight(1f))
            }
        }
    }
}

/** The property record can't show: locked (its reason), unavailable (why) or failed (Try again). */
@Composable
private fun HomeRecordLine(
    env: PlaceSectionEnvelope,
    onRetry: (() -> Unit)?,
) {
    val locked = env.access == PlaceSectionAccess.LOCKED
    val failed = env.status == PlaceSectionStatus.ERROR
    Text(
        when {
            locked -> PlacePresentation.lockReason(env)
            failed -> "Couldn't load the property record."
            else -> env.unavailableReason?.takeIf { it.isNotBlank() } ?: "Property details aren't available for this address yet."
        },
        fontSize = 13.sp,
        lineHeight = 18.sp,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(top = 8.dp),
    )
    if (failed && onRetry != null) {
        PlaceTextButton("Try again", arrow = false, modifier = Modifier.clickable(role = Role.Button, onClick = onRetry))
    }
}

/**
 * The household's tools, sized to how many this person has (TPR brief 6.4): none = the "Home tools" row; one = that
 * tool's row and "All tools"; two to four = a strip ending in "All tools". Each opens what it opened before.
 */
@Composable
fun PlaceToolsRow(
    shortcuts: List<PlaceHomeShortcut>,
    onOpenHomeTools: () -> Unit,
    onOpenShortcut: (PlaceHomeShortcut) -> Unit,
) {
    when (shortcuts.size) {
        0 ->
            PlaceActionRowLabel(
                icon = PantopusIcon.Home,
                title = "Home tools",
                subtitle = "Tasks and tools for your household.",
                modifier = Modifier.clickable(role = Role.Button, onClick = onOpenHomeTools).testTag("place.homeTools"),
            )
        1 -> {
            val only = shortcuts.first()
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(
                    modifier =
                        Modifier
                            .weight(1f)
                            .heightIn(min = 56.dp)
                            .clickable(role = Role.Button) { onOpenShortcut(only) }
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                            .testTag("place.homeTools.${only.tag}"),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PlaceIconTile(icon = only.icon, tone = PlaceTileTone.MUTED, size = 30.dp)
                    Text(only.title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                }
                ToolChip(PantopusIcon.LayoutGrid, "All tools", onOpenHomeTools, "place.homeTools", Modifier.padding(end = 6.dp))
            }
        }
        else ->
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp), verticalAlignment = Alignment.Top) {
                shortcuts.forEach { shortcut ->
                    ToolChip(
                        icon = shortcut.icon,
                        title = shortcut.title,
                        onClick = { onOpenShortcut(shortcut) },
                        tag = "place.homeTools.${shortcut.tag}",
                        modifier = Modifier.weight(1f),
                    )
                }
                ToolChip(PantopusIcon.LayoutGrid, "All tools", onOpenHomeTools, "place.homeTools", Modifier.weight(1f))
            }
    }
}

@Composable
private fun ToolChip(
    icon: PantopusIcon,
    title: String,
    onClick: () -> Unit,
    tag: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .heightIn(min = 48.dp)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 4.dp, vertical = 10.dp)
                .testTag(tag),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PlaceIconTile(icon = icon, tone = PlaceTileTone.MUTED, size = 30.dp)
        Text(
            text = title,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
        )
    }
}
