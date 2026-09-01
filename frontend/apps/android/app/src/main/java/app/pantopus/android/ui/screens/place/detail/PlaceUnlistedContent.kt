// One cohesive section, deliberately built from many small composables:
// detekt caps a composable at 80 lines, and the honest render of this
// surface — three distinct state-program answers, the verbatim method
// note, a null-vs-empty progress line, and a broker card that carries
// its whole caveat — does not fit in fewer pieces. Splitting the file
// to satisfy a count would scatter one screen's copy across two.
@file:Suppress("TooManyFunctions")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.UnlistedBroker
import app.pantopus.android.data.api.models.place.UnlistedGroup
import app.pantopus.android.data.api.models.place.UnlistedProfile
import app.pantopus.android.data.api.models.place.UnlistedRemovalMethod
import app.pantopus.android.data.api.models.place.UnlistedRemovalStatus
import app.pantopus.android.data.api.models.place.UnlistedStateProgram
import app.pantopus.android.data.api.models.place.UnlistedStateProgramAnswer
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTextButton
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Unlisted (Wave 4) — "get your address off the internet", on the
 * Identity detail page. Parity twin of the iOS `PlaceUnlistedSection`.
 *
 * THIS SECTION HAS A READER, and the rules below are not stylistic.
 *
 *  1. THE STATE PROGRAM LEADS, above the broker list, always. Most
 *     states run an Address Confidentiality Program — a legal
 *     substitute address that fixes this at the SOURCE instead of
 *     chasing it across thirty sites forever. For someone here because
 *     of a specific person it is worth more than every opt-out link
 *     combined.
 *  2. THE THREE STATE ANSWERS READ DIFFERENTLY. `exists: true` is the
 *     program; `exists: false` is a verified absence that still says
 *     what the state DOES offer; a null program is "we have not
 *     confirmed one" — NEVER "your state has none". Collapsing the
 *     third into the second tells someone in danger that no help
 *     exists when we simply did not look.
 *  3. WE NEVER SAY OR IMPLY THE PERSON IS LISTED ANYWHERE. We do not
 *     query these sites — that would hand them the address — so
 *     `method_note` is rendered verbatim, unparaphrased, right above
 *     the list. Without it the page implies a scan it never performed.
 *  4. EVERY BROKER'S `note` IS RENDERED WHOLE. It holds the dead form,
 *     the half-verified flow, the site that relists you. It is not
 *     clutter to truncate.
 *  5. NO DARK PATTERNS. Nothing is gated behind signup, there is no
 *     countdown, and nothing here implies Pantopus removes anything on
 *     the resident's behalf — every removal happens on the broker's own
 *     site and we only track what they tell us they have done.
 *
 * (The web surface also carries a quick-exit control. That is a browser
 * affordance — `location.replace` so the page never enters history —
 * and has no honest Android equivalent, so it is deliberately absent.)
 */

private val STATUS_CHOICES =
    listOf(
        UnlistedRemovalStatus.TODO,
        UnlistedRemovalStatus.REQUESTED,
        UnlistedRemovalStatus.CONFIRMED,
        UnlistedRemovalStatus.RELISTED,
    )

@Composable
fun PlaceUnlistedSection(viewModel: PlaceDetailViewModel) {
    val state by viewModel.unlisted.collectAsStateWithLifecycle()
    val pending by viewModel.pendingRemovalBrokerId.collectAsStateWithLifecycle()

    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.testTag("place.unlisted"),
    ) {
        // A failed write reports here and the section below stays put.
        Column(modifier = Modifier.testTag("place.unlisted.toast")) { PlaceActionToastLine(viewModel) }
        when (val current = state) {
            UnlistedUiState.Loading -> UnlistedSkeleton()
            is UnlistedUiState.Error -> UnlistedErrorCard(current.message) { viewModel.loadUnlisted() }
            is UnlistedUiState.Loaded ->
                UnlistedBody(
                    profile = current.profile,
                    pendingBrokerId = pending,
                    onSetStatus = viewModel::setUnlistedRemoval,
                    onRetry = { viewModel.loadUnlisted() },
                )
        }
    }
}

@Composable
private fun UnlistedSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Shimmer(width = 360.dp, height = 96.dp, cornerRadius = Radii.xl)
        Shimmer(width = 360.dp, height = 64.dp, cornerRadius = Radii.xl)
        Shimmer(width = 360.dp, height = 120.dp, cornerRadius = Radii.xl)
    }
}

@Composable
private fun UnlistedErrorCard(
    message: String,
    onRetry: () -> Unit,
) {
    PlaceDetailCard(modifier = Modifier.testTag("place.unlisted.error")) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "We couldn't load your removal list",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(message, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
            PrimaryButton(
                title = "Try again",
                onClick = onRetry,
                modifier = Modifier.testTag("place.unlisted.retry"),
            )
        }
    }
}

@Composable
private fun UnlistedBody(
    profile: UnlistedProfile,
    pendingBrokerId: String?,
    onSetStatus: (String, UnlistedRemovalStatus) -> Unit,
    onRetry: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        UnlistedPreamble()
        // The escape hatch leads. It is above the broker list, always.
        UnlistedStateProgramCard(profile.state, profile.stateProgramAnswer)
        UnlistedMethodNote(profile.methodNote)
        UnlistedProgressLine(profile, onRetry)
        profile.groups.forEach { group ->
            UnlistedGroupBlock(
                group = group,
                profile = profile,
                pendingBrokerId = pendingBrokerId,
                onSetStatus = onSetStatus,
            )
        }
        UnlistedRegistryFooter(profile)
    }
}

@Composable
private fun UnlistedPreamble() {
    PlaceDetailCard {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            PlaceIconTile(PantopusIcon.EyeOff, PlaceTileTone.HOME, 34.dp)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "Getting your address off the internet",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(
                    // Describes the SITES, not the person. "republish it"
                    // asserted that the reader's address is on them — a
                    // finding we never made, stated one card above the
                    // note explaining that we never looked.
                    "Your county records are public, and a handful of sites republish county records. " +
                        "Each removal happens on that site's own form — we don't contact them for you, " +
                        "we just keep track of what you've done.",
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// ── The state's escape hatch — three distinct answers ────────

@Composable
private fun UnlistedStateProgramCard(
    state: String?,
    answer: UnlistedStateProgramAnswer,
) {
    when (answer) {
        // "We did not check" is not evidence of absence, and must never
        // be dressed as any. This covers BOTH a null `state_program`
        // and one whose `exists` we could not read — a defaulted
        // `false` would put the words "your state has none" on a fact
        // we never actually read.
        UnlistedStateProgramAnswer.Unconfirmed -> UnlistedProgramUnconfirmed(state)
        is UnlistedStateProgramAnswer.Program -> UnlistedProgramAvailable(answer.program)
        is UnlistedStateProgramAnswer.NoProgram -> UnlistedProgramAbsent(state, answer.program)
    }
}

@Composable
private fun UnlistedProgramAvailable(program: UnlistedStateProgram) {
    val uriHandler = LocalUriHandler.current
    PlaceDetailCard(modifier = Modifier.testTag("place.unlisted.stateProgram.available")) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            UnlistedProgramHeader(
                chip = PlaceChipModel(PlaceChipTone.SUCCESS, "Your state runs one", PantopusIcon.BadgeCheck),
                title = program.name.ifBlank { "Address Confidentiality Program" },
            )
            Text(
                "A legal substitute address. It keeps your real one out of public records at the source, " +
                    "instead of chasing it across every site that copies them.",
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = PantopusColors.appTextSecondary,
            )
            UnlistedLabelledText("Who qualifies", program.eligibility)
            if (program.hasOfficialLink) {
                PrimaryButton(
                    title = "Open the official page",
                    onClick = { openUrl(uriHandler, program.url) },
                    modifier = Modifier.fillMaxWidth().testTag("place.unlisted.stateProgram.link.official"),
                )
            }
            UnlistedSourceLine("Verified against the state's own page", program.verifiedAt)
        }
    }
}

@Composable
private fun UnlistedProgramAbsent(
    state: String?,
    program: UnlistedStateProgram,
) {
    val uriHandler = LocalUriHandler.current
    PlaceDetailCard(modifier = Modifier.testTag("place.unlisted.stateProgram.absent")) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            UnlistedProgramHeader(
                chip = PlaceChipModel(PlaceChipTone.NEUTRAL, "We checked"),
                title = "${stateName(state)} runs no substitute-address program",
            )
            // A verified absence still has to say what the state DOES
            // offer — that is what `eligibility` carries here.
            Text(
                program.eligibility,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = PantopusColors.appTextSecondary,
            )
            if (program.sourceUrl.startsWith("http")) {
                PlaceTextButton(
                    title = "Where we checked",
                    modifier =
                        Modifier
                            .clickable { openUrl(uriHandler, program.sourceUrl) }
                            .testTag("place.unlisted.stateProgram.link.source"),
                )
            }
            UnlistedSourceLine("Checked", program.verifiedAt)
        }
    }
}

@Composable
private fun UnlistedProgramUnconfirmed(state: String?) {
    PlaceDetailCard(modifier = Modifier.testTag("place.unlisted.stateProgram.unconfirmed")) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            UnlistedProgramHeader(
                chip = PlaceChipModel(PlaceChipTone.WARNING, "Not confirmed", PantopusIcon.Info),
                title = "We haven't confirmed a program for ${stateName(state)}",
            )
            Text(
                "Most states run an Address Confidentiality Program — a legal substitute address for people " +
                    "escaping domestic violence, sexual assault, stalking or trafficking. We have not verified " +
                    "one here yet, and that is not the same as there being none.",
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                "Your Secretary of State or Attorney General's office is the place to ask.",
                fontSize = 13.sp,
                lineHeight = 19.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun UnlistedProgramHeader(
    chip: PlaceChipModel,
    title: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            PlaceIconTile(PantopusIcon.Landmark, PlaceTileTone.HOME, 34.dp)
            PlaceChip(chip)
        }
        Text(
            title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 21.sp,
            color = PantopusColors.appText,
        )
    }
}

// ── The honesty line, verbatim, above the list ───────────────

@Composable
private fun UnlistedMethodNote(note: String) {
    if (note.isBlank()) return
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg))
                .padding(14.dp)
                .testTag("place.unlisted.methodNote"),
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        PantopusIconImage(
            PantopusIcon.Info,
            null,
            modifier = Modifier.padding(top = 1.dp),
            size = 15.dp,
            strokeWidth = 2.25f,
            tint = PantopusColors.appTextMuted,
        )
        // Rendered exactly as the API wrote it. Paraphrasing it, or
        // dropping it as clutter, makes the page imply a scan we never
        // ran — and running one would disclose the address to the very
        // companies the resident is leaving.
        Text(note, fontSize = 13.sp, lineHeight = 19.sp, color = PantopusColors.appTextSecondary)
    }
}

// ── Progress: null (read failed) is not empty (nothing yet) ──

@Composable
private fun UnlistedProgressLine(
    profile: UnlistedProfile,
    onRetry: () -> Unit,
) {
    val removals = profile.removals
    if (removals == null) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp).testTag("place.unlisted.progress.unavailable"),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            PantopusIconImage(
                PantopusIcon.AlertCircle,
                null,
                modifier = Modifier.padding(top = 1.dp),
                size = 15.dp,
                strokeWidth = 2.25f,
                tint = PantopusColors.warning,
            )
            // An empty checklist here would be a confident claim we
            // cannot make: we did not read the progress, so we do not
            // know that none exists.
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "We couldn't load which removals you've already recorded. The sites and the steps below are " +
                        "still correct — only your saved progress is missing.",
                    fontSize = 12.5.sp,
                    lineHeight = 18.sp,
                    color = PantopusColors.appTextSecondary,
                )
                // Without this the only recovery is leaving the screen
                // and coming back — the one unrecoverable state here.
                Text(
                    "Try again",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .testTag("place.unlisted.progress.retry")
                            .clickable { onRetry() },
                )
            }
        }
        return
    }
    val confirmed = removals.count { it.status == UnlistedRemovalStatus.CONFIRMED }
    val started = removals.count { it.status != UnlistedRemovalStatus.TODO }
    val summary =
        if (removals.isEmpty()) {
            "Nothing recorded yet — ${profile.brokerCount} sites to work through."
        } else {
            "$started of ${profile.brokerCount} started · $confirmed confirmed by the site."
        }
    Text(
        summary,
        fontSize = 12.5.sp,
        fontWeight = FontWeight.Medium,
        color = PantopusColors.appTextMuted,
        modifier = Modifier.padding(horizontal = 2.dp).testTag("place.unlisted.progress"),
    )
}

// ── The removal paths ────────────────────────────────────────

@Composable
private fun UnlistedGroupBlock(
    group: UnlistedGroup,
    profile: UnlistedProfile,
    pendingBrokerId: String?,
    onSetStatus: (String, UnlistedRemovalStatus) -> Unit,
) {
    if (group.brokers.isEmpty()) return
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.padding(top = 6.dp).testTag("place.unlisted.group.${group.category}"),
    ) {
        Text(
            group.label.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.88.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(horizontal = 2.dp),
        )
        group.brokers.forEach { broker ->
            UnlistedBrokerCard(
                broker = broker,
                profile = profile,
                isPending = pendingBrokerId == broker.id,
                onSetStatus = onSetStatus,
            )
        }
    }
}

@Composable
private fun UnlistedBrokerCard(
    broker: UnlistedBroker,
    profile: UnlistedProfile,
    isPending: Boolean,
    onSetStatus: (String, UnlistedRemovalStatus) -> Unit,
) {
    val uriHandler = LocalUriHandler.current
    // null removals means the read FAILED — not "nothing recorded".
    // Defaulting to TODO drew a selected "To do" pill on all 19 rows,
    // wiping a person's recorded progress off the screen directly under
    // a banner admitting we could not read it.
    val progressKnown = profile.removals != null
    val status = if (progressKnown) profile.removalFor(broker.id)?.status ?: UnlistedRemovalStatus.TODO else null
    PlaceDetailCard(modifier = Modifier.testTag("place.unlisted.broker.${broker.id}"), padding = 15.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    broker.name,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                status?.let { statusChip(it) }?.let { PlaceChip(it) }
            }
            UnlistedBrokerFacts(broker, profile)
            // The caveat the person actually needs — a dead form, a flow
            // only half-verified, a site that puts you back. Whole.
            if (broker.note.isNotBlank()) {
                // No maxLines, no overflow, no "read more": the caveat
                // is the payload, not decoration around it.
                Text(
                    broker.note,
                    fontSize = 12.5.sp,
                    lineHeight = 18.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("place.unlisted.broker.${broker.id}.note"),
                )
            }
            if (broker.optOutUrl.startsWith("http")) {
                PlaceTextButton(
                    title = "Open the opt-out page",
                    modifier =
                        Modifier
                            .clickable { openUrl(uriHandler, broker.optOutUrl) }
                            .testTag("place.unlisted.broker.${broker.id}.optOut"),
                )
            }
            UnlistedStatusPicker(broker.id, status, isPending, onSetStatus)
        }
    }
}

@Composable
private fun UnlistedBrokerFacts(
    broker: UnlistedBroker,
    profile: UnlistedProfile,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (broker.exposes.isNotEmpty()) {
            UnlistedLabelledText(
                "What it publishes",
                broker.exposes.joinToString(" · ") { profile.exposureLabel(it) },
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            PlaceChip(PlaceChipModel(PlaceChipTone.NEUTRAL, methodLabel(broker.method)))
            PlaceChip(PlaceChipModel(PlaceChipTone.NEUTRAL, processingLabel(broker)))
        }
        if (broker.requiresId || broker.requiresEmail) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                if (broker.requiresId) {
                    PlaceChip(PlaceChipModel(PlaceChipTone.WARNING, "Photo ID required", PantopusIcon.IdCard))
                }
                if (broker.requiresEmail) {
                    PlaceChip(PlaceChipModel(PlaceChipTone.NEUTRAL, "Email required", PantopusIcon.Mail))
                }
            }
        }
    }
}

@Composable
private fun UnlistedStatusPicker(
    brokerId: String,
    // NULL means we could not read this person's progress. No pill is
    // then selected and the picker says so, rather than drawing "To do"
    // and asserting they have started nothing.
    current: UnlistedRemovalStatus?,
    isPending: Boolean,
    onSetStatus: (String, UnlistedRemovalStatus) -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(5.dp),
        modifier = Modifier.testTag("place.unlisted.broker.$brokerId.status"),
    ) {
        Text(
            if (current == null) "We couldn't read your saved progress" else "Where you've got to",
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextMuted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            STATUS_CHOICES.forEach { choice ->
                UnlistedStatusPill(
                    label = statusLabel(choice),
                    isSelected = choice == current,
                    isEnabled = !isPending,
                    modifier =
                        Modifier
                            .weight(1f)
                            .testTag("place.unlisted.status.$brokerId.${choice.wire}"),
                    onClick = { onSetStatus(brokerId, choice) },
                )
            }
        }
    }
}

@Composable
private fun UnlistedStatusPill(
    label: String,
    isSelected: Boolean,
    isEnabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val background = if (isSelected) PantopusColors.homeBg else PantopusColors.appSurface
    val foreground =
        when {
            isSelected -> PantopusColors.home
            isEnabled -> PantopusColors.appTextSecondary
            else -> PantopusColors.appTextMuted
        }
    Text(
        label,
        fontSize = 11.5.sp,
        fontWeight = FontWeight.SemiBold,
        maxLines = 1,
        textAlign = TextAlign.Center,
        color = foreground,
        modifier =
            modifier
                .clip(RoundedCornerShape(9.dp))
                .background(background)
                .border(
                    1.dp,
                    if (isSelected) PantopusColors.home else PantopusColors.appBorder,
                    RoundedCornerShape(9.dp),
                ).clickable(enabled = isEnabled, onClick = onClick)
                .padding(vertical = Spacing.s2),
    )
}

@Composable
private fun UnlistedRegistryFooter(profile: UnlistedProfile) {
    val verified = profile.registryVerifiedAt
    val suffix = if (verified.isNullOrBlank()) "" else " · last checked $verified"
    Column(modifier = Modifier.testTag("place.unlisted.footer")) {
        PlaceSourceNote("${profile.brokerCount} sites we have verified a removal path for$suffix")
    }
}

// ── Small shared bits ────────────────────────────────────────

@Composable
private fun UnlistedLabelledText(
    label: String,
    value: String,
) {
    if (value.isBlank()) return
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextMuted)
        Text(value, fontSize = 13.sp, lineHeight = 19.sp, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun UnlistedSourceLine(
    label: String,
    verifiedAt: String?,
) {
    if (verifiedAt.isNullOrBlank()) return
    Text("$label · $verifiedAt", fontSize = 11.5.sp, color = PantopusColors.appTextMuted)
}

private fun openUrl(
    uriHandler: UriHandler,
    url: String,
) {
    runCatching { uriHandler.openUri(url) }
}

private fun stateName(state: String?): String = state?.trim()?.takeIf { it.isNotEmpty() }?.uppercase() ?: "your state"

private fun methodLabel(method: UnlistedRemovalMethod): String =
    when (method) {
        UnlistedRemovalMethod.WEB_FORM -> "Web form"
        UnlistedRemovalMethod.EMAIL -> "By email"
        UnlistedRemovalMethod.PHONE -> "By phone"
        UnlistedRemovalMethod.MAIL -> "By post"
        UnlistedRemovalMethod.ACCOUNT_REQUIRED -> "Account required"
        UnlistedRemovalMethod.UNKNOWN -> "Method not stated"
    }

/**
 * `typical_days == 0` means the site publishes NO processing time. It
 * is "not stated" — never "0 days", which would read as instant.
 */
private fun processingLabel(broker: UnlistedBroker): String =
    if (broker.statesProcessingTime) "About ${broker.typicalDays} days" else "No time stated"

private fun statusLabel(status: UnlistedRemovalStatus): String =
    when (status) {
        UnlistedRemovalStatus.TODO -> "To do"
        UnlistedRemovalStatus.REQUESTED -> "Requested"
        UnlistedRemovalStatus.CONFIRMED -> "Confirmed"
        UnlistedRemovalStatus.RELISTED -> "Relisted"
        UnlistedRemovalStatus.UNKNOWN -> "Not stated"
    }

/** The header pill. TODO carries none — an untouched site is the norm. */
private fun statusChip(status: UnlistedRemovalStatus): PlaceChipModel? =
    when (status) {
        UnlistedRemovalStatus.TODO -> null
        UnlistedRemovalStatus.REQUESTED -> PlaceChipModel(PlaceChipTone.SKY, "You've asked", PantopusIcon.Clock)
        UnlistedRemovalStatus.CONFIRMED -> PlaceChipModel(PlaceChipTone.SUCCESS, "Removed", PantopusIcon.Check)
        UnlistedRemovalStatus.RELISTED -> PlaceChipModel(PlaceChipTone.WARNING, "Back again", PantopusIcon.AlertCircle)
        UnlistedRemovalStatus.UNKNOWN -> null
    }
