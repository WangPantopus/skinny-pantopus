package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.BlockInviteRecipient
import app.pantopus.android.data.api.models.place.BlockMeter
import app.pantopus.android.data.api.models.place.BlockStatus
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceTier
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

// ─── Block Founders (Wave 3) — Your block, T4 ────────────────
//
// The growth mechanic: a verified occupant's PERMANENT founding rank in
// their geohash-6 block, the cell's verified-home count, the three
// unlock meters, and real postcard invites to nearby addresses.
//
// The invite is template-only by construction — Pantopus writes and
// mails a fixed card, the sender is identified to the recipient only as
// a neighbor on their street (never a name, never an address), and
// every card carries a working opt-out. The copy below says all three,
// because a person about to spend a real postcard in their own name
// deserves to know exactly what leaves the building.
//
// Parity: the web `BlockDetail.tsx` FoundersSection.

private val METER_BAR_HEIGHT = 6.dp
private val METER_ICON_SIZE = 13.dp
private val FOUNDER_TILE_SIZE = 44.dp

/** Two letters, as the route's address validator demands. */
private const val STATE_CODE_CHARS = 2

/** "12345" or "12345-6789" — the route's own ZIP fence. */
private const val ZIP_MAX_CHARS = 10

@Composable
fun PlaceBlockFoundersSection(
    intel: PlaceIntelligence,
    viewModel: PlaceDetailViewModel,
) {
    if (intel.tier != PlaceTier.T4) {
        PlaceLockedCard(
            title = "Block founders",
            reason =
                "Verify your address to claim a permanent founding rank on your block — the earliest " +
                    "verified homes keep their number forever.",
            cta = "Verify address",
            icon = PantopusIcon.Ribbon,
            onTap = null,
        )
        return
    }
    LaunchedEffect(Unit) { viewModel.loadBlockFounders() }
    val state by viewModel.blockFounders.collectAsStateWithLifecycle()
    when (val current = state) {
        is BlockFoundersUiState.Loading ->
            PlaceDetailCard(padding = Spacing.s4) {
                Text("Loading your block…", fontSize = 13.5.sp, color = PantopusColors.appTextMuted)
            }
        is BlockFoundersUiState.Error -> BlockFoundersErrorCard(current.message, viewModel)
        is BlockFoundersUiState.Loaded ->
            if (current.block.available) {
                BlockFoundersCard(current.block, viewModel)
            } else {
                BlockFoundersUnavailableCard()
            }
    }
}

@Composable
private fun BlockFoundersErrorCard(
    message: String,
    viewModel: PlaceDetailViewModel,
) {
    PlaceDetailCard(padding = Spacing.s4) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(message, fontSize = 13.5.sp, color = PantopusColors.appTextMuted)
            Text(
                "Try again",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier = Modifier.clickable { viewModel.loadBlockFounders() },
            )
        }
    }
}

@Composable
private fun BlockFoundersUnavailableCard() {
    PlaceDetailCard(padding = Spacing.s4) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text("Block founders", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(
                "We couldn't place this home on a block — its map location is missing.",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun BlockFoundersCard(
    block: BlockStatus,
    viewModel: PlaceDetailViewModel,
) {
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            FounderRankRow(block)
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            // The two raw insider counts. `rent_reports` is deliberately
            // its own reading rather than only a meter fill: it is what
            // the Real Rent benchmark is waiting on, and a founder
            // deciding whether to spend an invite should be able to read
            // it directly. Both are block-level counts — never a
            // per-home figure, never a name.
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                BlockCountStat(
                    label = "VERIFIED HOMES ON YOUR BLOCK",
                    value = block.verifiedCount,
                    modifier = Modifier.weight(1f),
                )
                BlockCountStat(
                    label = "RENTS SHARED ON YOUR BLOCK",
                    value = block.rentReports,
                    modifier = Modifier.weight(1f),
                )
            }
            if (block.meters.isNotEmpty()) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    block.meters.forEach { BlockMeterRow(it) }
                }
            }
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            BlockInviteForm(block, viewModel)
            PlaceActionToastLine(viewModel)
        }
    }
}

/** One block-level count. Never a household, never a name. */
@Composable
private fun BlockCountStat(
    label: String,
    value: Int,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            lineHeight = 14.sp,
            color = PantopusColors.appTextMuted,
        )
        Text(
            PlacePresentation.grouped(value),
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun FounderRankRow(block: BlockStatus) {
    val established = PlacePresentation.fmtMonthYear(block.establishedAt)
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
        PlaceIconTile(PantopusIcon.Ribbon, PlaceTileTone.HOME, FOUNDER_TILE_SIZE)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                block.rank?.let { "Founder #$it of this block" } ?: "Block founder",
                fontSize = 15.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                established?.let { "Verified here since $it — this rank is permanent." }
                    ?: "Your founding rank on this block.",
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

/**
 * One unlock meter. `real_rent` counts RENT REPORTS, the other two
 * count verified homes — the server decides, and the label says which,
 * so a meter never promises progress the section then fails to honor.
 */
@Composable
private fun BlockMeterRow(meter: BlockMeter) {
    val fraction =
        if (meter.needed <= 0) 0f else (meter.current.toFloat() / meter.needed.toFloat()).coerceIn(0f, 1f)
    val tint = if (meter.unlocked) PantopusColors.success else PantopusColors.primary600
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            if (meter.unlocked) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = METER_ICON_SIZE,
                    strokeWidth = 2.5f,
                    tint = PantopusColors.success,
                )
            }
            Text(
                meter.label,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextStrong,
                modifier = Modifier.weight(1f),
            )
            Text(
                if (meter.unlocked) "Unlocked" else "${meter.current} of ${meter.needed}",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (meter.unlocked) PantopusColors.success else PantopusColors.appTextMuted,
            )
        }
        BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(METER_BAR_HEIGHT)) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(METER_BAR_HEIGHT)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken),
            )
            Box(
                modifier =
                    Modifier
                        .width(maxWidth * fraction)
                        .height(METER_BAR_HEIGHT)
                        .clip(CircleShape)
                        .background(tint),
            )
        }
    }
}

// ── The invite ───────────────────────────────────────────────

@Composable
private fun BlockInviteForm(
    block: BlockStatus,
    viewModel: PlaceDetailViewModel,
) {
    if (block.invitesRemaining <= 0) {
        Text(
            "You've used this week's ${block.invitesWeeklyCap} invitations. " +
                "The budget resets a week after your first send.",
            fontSize = 12.5.sp,
            lineHeight = 18.sp,
            color = PantopusColors.appTextMuted,
        )
        return
    }
    val draft = remember { BlockInviteDraft() }
    val isSending by viewModel.isSendingInvite.collectAsStateWithLifecycle()

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            "Invite a neighbor by mail — ${block.invitesRemaining} left this week",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
        BlockInviteFields(draft)
        PrimaryButton(
            title = if (isSending) "Mailing…" else "Mail the invitation",
            isLoading = isSending,
            isEnabled = draft.toRecipient().isComplete(),
            onClick = { viewModel.sendBlockInvite(draft.line1, draft.city, draft.state, draft.zip) },
        )
        BlockInviteDisclosure()
    }
}

/**
 * The four address fields as one holder — a bundle, not eight
 * parameters, so the fields composable stays readable and the
 * completeness check is the same one the view-model runs.
 */
@Stable
private class BlockInviteDraft {
    var line1 by mutableStateOf("")
    var city by mutableStateOf("")
    var state by mutableStateOf("")
    var zip by mutableStateOf("")

    fun toRecipient(): BlockInviteRecipient =
        BlockInviteRecipient(
            line1 = line1.trim(),
            city = city.trim(),
            state = state.trim().uppercase(),
            zip = zip.trim(),
        )
}

@Composable
private fun BlockInviteFields(draft: BlockInviteDraft) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        OutlinedTextField(
            value = draft.line1,
            onValueChange = { draft.line1 = it },
            placeholder = { Text("Street address") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            OutlinedTextField(
                value = draft.city,
                onValueChange = { draft.city = it },
                placeholder = { Text("City") },
                singleLine = true,
                modifier = Modifier.weight(2f),
            )
            OutlinedTextField(
                value = draft.state,
                // Letters only: the route's fence is `^[A-Za-z]{2}$`, and
                // a typed digit would otherwise sail past the local
                // completeness check straight into a 400.
                onValueChange = { draft.state = it.filter { c -> c.isLetter() }.uppercase().take(STATE_CODE_CHARS) },
                placeholder = { Text("ST") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            OutlinedTextField(
                value = draft.zip,
                // Digits and one hyphen: the route accepts ZIP+4
                // (`^\d{5}(-\d{4})?$`), so a bare digit filter would
                // silently make a valid ZIP+4 untypeable.
                onValueChange = { draft.zip = it.filter { c -> c.isDigit() || c == '-' }.take(ZIP_MAX_CHARS) },
                placeholder = { Text("ZIP") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f),
            )
        }
    }
}

/**
 * The three facts a sender must have before spending a real postcard in
 * their own name. Not decorative — they are the safeguards the server
 * enforces, stated plainly.
 */
@Composable
private fun BlockInviteDisclosure() {
    Text(
        "Pantopus writes and mails a fixed card — you can't write the message. The card names you only " +
            "as a neighbor on your street, never your name and never your address. Every card carries a " +
            "working opt-out, and an address that opts out is never written to again.",
        fontSize = 12.sp,
        lineHeight = 17.sp,
        color = PantopusColors.appTextMuted,
    )
}
