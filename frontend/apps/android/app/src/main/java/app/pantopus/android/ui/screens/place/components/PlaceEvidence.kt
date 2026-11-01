package app.pantopus.android.ui.screens.place.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceGroup
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionAccess
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.theme.PantopusColors
import java.time.ZoneId

/** The topics in the order the risk and environment list reads (TPR brief 7.5); other sections in those groups follow. */
private val EVIDENCE_ORDER =
    listOf(
        PlaceSectionId.FLOOD,
        PlaceSectionId.HEAT_COLD,
        PlaceSectionId.SEISMIC,
        PlaceSectionId.WILDFIRE,
        PlaceSectionId.LEAD_RADON,
        PlaceSectionId.DRINKING_WATER,
        PlaceSectionId.ENVIRONMENTAL_HAZARDS,
    )

/** Every section in the risk and health groups, in the list's order. */
fun placeEvidenceSections(intel: PlaceIntelligence): List<PlaceSectionEnvelope> {
    val sections =
        intel.groups
            .filter { it.groupId == PlaceGroup.RISK_READINESS || it.groupId == PlaceGroup.HEALTH_ENVIRONMENT }
            .flatMap { it.sections }
    return sections.sortedBy { env -> EVIDENCE_ORDER.indexOf(env.sectionId).takeIf { it >= 0 } ?: EVIDENCE_ORDER.size }
}

/** A topic's result in words: the existing reading, or its state ("Locked", "Not available here yet", "Couldn't load"). */
fun placeEvidenceResult(
    env: PlaceSectionEnvelope,
    zone: ZoneId?,
): String {
    if (env.access == PlaceSectionAccess.LOCKED) return "Locked: ${PlacePresentation.lockReason(env)}"
    return when (PlacePresentation.cardState(env)) {
        PlaceSectionCardState.LOADED, PlaceSectionCardState.STALE -> {
            val reading = PlacePresentation.reading(env, zone)
            env.blockDensity?.label ?: reading.chip?.text ?: reading.value ?: reading.caption ?: "On file"
        }
        PlaceSectionCardState.ERROR -> "Couldn't load this"
        PlaceSectionCardState.LOADING -> "Loading"
        PlaceSectionCardState.EMPTY -> "No findings"
        PlaceSectionCardState.UNAVAILABLE -> env.unavailableReason?.takeIf { it.isNotBlank() } ?: "Not available here yet"
    }
}

/**
 * "This address's map point · Map classification · FEMA National Flood Hazard Layer · Oct 2026": the area the reading
 * covers and what kind of evidence it is (from the server, TPR contract §4), then its source and date. Null without any.
 */
fun placeEvidenceLine(
    env: PlaceSectionEnvelope,
    zone: ZoneId?,
): String? =
    listOfNotNull(
        env.scope?.label?.takeIf { it.isNotBlank() },
        env.evidence?.label?.takeIf { it.isNotBlank() },
        env.source?.takeIf { it.isNotBlank() },
        PlacePresentation.fmtMonthYear(env.asOf, zone),
    ).takeIf { env.scope != null || env.evidence != null }?.joinToString(" · ")

/** The evidence line under a topic's row in "Risk and environment" (nothing from an older server without `scope`). */
@Composable
fun PlaceEvidenceLine(
    env: PlaceSectionEnvelope,
    zone: ZoneId?,
    modifier: Modifier = Modifier,
) {
    val line = placeEvidenceLine(env, zone) ?: return
    Text(
        line,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        color = PantopusColors.appTextMuted,
        modifier = modifier.fillMaxWidth().testTag("place.evidence.${env.id}"),
    )
}

/**
 * The risk and environment list on the Risk page (TPR brief 7.5): one row per topic, result first, then the area, the
 * kind of evidence, source and date. No overall score; the cards below keep every caveat, source and next step.
 */
@Composable
fun PlaceEvidenceList(
    intel: PlaceIntelligence,
    modifier: Modifier = Modifier,
) {
    val sections = placeEvidenceSections(intel)
    if (sections.isEmpty()) return
    val zone = intel.homeZone
    Column(modifier = modifier.fillMaxWidth().placeSurface().testTag("placeRisk.atAGlance")) {
        sections.forEachIndexed { index, env ->
            if (index > 0) PlaceHairline()
            val title = PlacePresentation.config(env.sectionId).title
            val result = placeEvidenceResult(env, zone)
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp).semantics(mergeDescendants = true) {},
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(
                    buildAnnotatedString {
                        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)) { append(title) }
                        append(": ")
                        append(result)
                    },
                    fontSize = 14.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.appTextStrong,
                )
                placeEvidenceLine(env, zone)?.let { Text(it, fontSize = 12.sp, lineHeight = 16.sp, color = PantopusColors.appTextMuted) }
            }
        }
        PlaceHairline()
        Text(
            "No overall score: each topic stands on its own evidence. The details below keep every source and limit.",
            fontSize = 12.5.sp,
            lineHeight = 17.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}
