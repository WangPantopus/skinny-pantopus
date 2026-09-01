@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.identity_center

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.identity.IdentitySwitcherCard
import app.pantopus.android.ui.screens.shared.identity.IdentitySwitcherSheet
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch

/**
 * T3.2 Profiles & Privacy screen. Bespoke `identity_present` header
 * (4 cards) sits above grouped lists for Profile links / Privacy
 * rows / Disclosure items. The identity-switcher bottom sheet
 * surfaces via the trailing "Switch" button.
 */
@Composable
fun IdentityCenterScreen(
    onBack: () -> Unit = {},
    onOpenIdentity: (IdentityCardContent) -> Unit = {},
    onOpenPlaceholder: (String) -> Unit = {},
    onOpenViewAs: () -> Unit = {},
    viewModel: IdentityCenterViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    var switcherVisible by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()
    val scope = rememberCoroutineScope()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("identityCenter"),
    ) {
        TopBar(
            onBack = onBack,
            onOpenSwitcher = { switcherVisible = true },
        )
        when (val current = state) {
            is IdentityCenterUiState.Loading -> LoadingFrame()
            is IdentityCenterUiState.Loaded ->
                LoadedFrame(
                    loaded = current.content,
                    onOpenIdentity = onOpenIdentity,
                    onBridgeToggle = viewModel::setBridge,
                    onRowTap = { row ->
                        // A18.5 — the "Privacy Preview" row opens the "View
                        // as" identity preview; other rows stay placeholders.
                        if (row.id == "privacyPreview") onOpenViewAs() else onOpenPlaceholder(row.label)
                    },
                )
            is IdentityCenterUiState.Error ->
                ErrorFrame(
                    message = current.message,
                    onRetry = viewModel::load,
                )
        }
    }

    if (switcherVisible && state is IdentityCenterUiState.Loaded) {
        val loaded = (state as IdentityCenterUiState.Loaded).content
        IdentitySwitcherSheet(
            cards = loaded.identities.map { it.toSwitcherCard() },
            sheetState = sheetState,
            onSelect = {
                scope.launch {
                    sheetState.hide()
                }.invokeOnCompletion { switcherVisible = false }
            },
            onDismiss = { switcherVisible = false },
        )
    }
}

@Composable
private fun TopBar(
    onBack: () -> Unit,
    onOpenSwitcher: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("identityCenterBackButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appText,
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "Profiles & Privacy",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(modifier = Modifier.weight(1f))
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onOpenSwitcher)
                        .testTag("identityCenterSwitcherButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Menu,
                    contentDescription = "Open identity switcher",
                    size = Radii.xl2,
                    strokeWidth = 2f,
                    tint = PantopusColors.appText,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

@Composable
internal fun LoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(vertical = Spacing.s4)
                .testTag("identityCenterLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(4) {
            Shimmer(
                width = 360.dp,
                height = 110.dp,
                cornerRadius = Radii.xl,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
    }
}

@Composable
internal fun LoadedFrame(
    loaded: IdentityCenterLoaded,
    onOpenIdentity: (IdentityCardContent) -> Unit,
    onBridgeToggle: (String, Boolean) -> Unit,
    onRowTap: (IdentityRowContent) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .testTag("identityCenterContent"),
    ) {
        IdentityCards(cards = loaded.identities, onTap = onOpenIdentity)
        SectionOverline("Profile links")
        if (loaded.bridges.isEmpty()) {
            EmptyBridgesCard()
        } else {
            BridgesCard(rows = loaded.bridges, onToggle = onBridgeToggle)
        }
        if (loaded.setupRemainingCount > 0) {
            FirstRunHintCard(remaining = loaded.setupRemainingCount)
        }
        SectionOverline("Privacy")
        RowsCard(rows = loaded.privacyRows, idPrefix = "privacy", onRowTap = onRowTap)
        SectionOverline("Identities")
        RowsCard(rows = loaded.disclosureRows, idPrefix = "disclosure", onRowTap = onRowTap)
        Spacer(modifier = Modifier.height(Spacing.s6))
    }
}

@Composable
private fun EmptyBridgesCard() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("identityCenterEmptyBridges"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Link,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appTextMuted,
        )
        Column {
            Text(
                text = "Nothing to link yet",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextMuted,
            )
            Text(
                text = "Set up Persona or Professional to connect profile links.",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun FirstRunHintCard(remaining: Int) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("identityCenterFirstRunHint"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = if (remaining == 1) "One more profile to go" else "$remaining more profiles to go",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun IdentityCards(
    cards: List<IdentityCardContent>,
    onTap: (IdentityCardContent) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s3, vertical = Spacing.s0)
                .padding(top = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        cards.forEach { card -> IdentityCardRow(card = card, onTap = { onTap(card) }) }
    }
}

@Composable
private fun IdentityCardRow(
    card: IdentityCardContent,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(card.kind.accentBg.copy(alpha = 0.5f), PantopusColors.appSurface),
                    ),
                )
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable(onClick = onTap)
                .padding(14.dp)
                .testTag("identityCard_${card.kind.key}"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(card.kind.accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = card.kind.icon,
                contentDescription = null,
                size = 22.dp,
                strokeWidth = 2f,
                tint = card.kind.accent,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = card.overline.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = card.kind.accent,
                    letterSpacing = 0.8.sp,
                )
                val setupCta = (card.status as? IdentityStatus.SetupNeeded)?.cta
                if (setupCta != null) {
                    SetupPill(label = setupCta, accent = card.kind.accent)
                }
                card.chip?.let { ChipPill(chip = it) }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = card.name,
                    fontSize = 15.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                )
                card.handle?.let {
                    Text(
                        text = it,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 1,
                    )
                }
            }
            card.stats?.let {
                Text(
                    text = it,
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 2,
                )
            }
            card.summary?.let {
                Text(
                    text = it,
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextMuted,
                    maxLines = 2,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2f,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun SetupPill(
    label: String,
    accent: Color,
) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(accent)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            text = label.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun ChipPill(chip: IdentityChip) {
    val (bg, fg) =
        when (chip.tone) {
            IdentityChip.Tone.Info -> PantopusColors.primary50 to PantopusColors.primary700
            IdentityChip.Tone.Success -> PantopusColors.successBg to PantopusColors.success
            IdentityChip.Tone.Warning -> PantopusColors.warningBg to PantopusColors.warning
            IdentityChip.Tone.Business -> PantopusColors.businessBg to PantopusColors.business
            IdentityChip.Tone.Neutral -> PantopusColors.appSurfaceSunken to PantopusColors.appTextStrong
        }
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            text = chip.label,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = fg,
        )
    }
}

@Composable
private fun BridgesCard(
    rows: List<IdentityBridgeRow>,
    onToggle: (String, Boolean) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        rows.forEachIndexed { index, row ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(Spacing.s4),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = row.label,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appText,
                    )
                    row.subtext?.let {
                        Text(
                            text = it,
                            fontSize = 12.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
                Switch(
                    checked = row.isOn,
                    onCheckedChange = { onToggle(row.id, it) },
                    colors =
                        SwitchDefaults.colors(
                            checkedTrackColor = PantopusColors.primary600,
                            checkedThumbColor = PantopusColors.appTextInverse,
                        ),
                    modifier = Modifier.testTag("identityCenterBridge_${row.id}"),
                )
            }
            if (index < rows.lastIndex) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(start = Spacing.s4)
                            .height(1.dp)
                            .background(PantopusColors.appBorder.copy(alpha = 0.6f)),
                )
            }
        }
    }
}

@Composable
private fun RowsCard(
    rows: List<IdentityRowContent>,
    idPrefix: String,
    onRowTap: (IdentityRowContent) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        rows.forEachIndexed { index, row ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable { onRowTap(row) }
                        .padding(horizontal = Spacing.s4, vertical = 14.dp)
                        .testTag("${idPrefix}Row_${row.id}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier = Modifier.size(24.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = row.icon,
                        contentDescription = null,
                        size = 18.dp,
                        strokeWidth = 2f,
                        tint = PantopusColors.primary600,
                    )
                }
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = row.label,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appText,
                    )
                    row.subtext?.let {
                        Text(
                            text = it,
                            fontSize = 12.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
                row.trailing?.let {
                    Text(
                        text = it,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = Radii.xl,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            if (index < rows.lastIndex) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(start = Spacing.s4)
                            .height(1.dp)
                            .background(PantopusColors.appBorder.copy(alpha = 0.6f)),
                )
            }
        }
    }
}

@Composable
private fun SectionOverline(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appTextSecondary,
        letterSpacing = 0.9.sp,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(top = 18.dp, bottom = Spacing.s2),
    )
}

@Composable
internal fun ErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag("identityCenterError"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            strokeWidth = 2f,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.height(Spacing.s3))
        Text(
            text = "Couldn't load Profiles & Privacy",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(Spacing.s4))
        PrimaryButton(
            title = "Try again",
            onClick = onRetry,
            modifier = Modifier.testTag("identityCenterRetry"),
        )
    }
}

internal fun IdentityCardContent.toSwitcherCard(): IdentitySwitcherCard =
    IdentitySwitcherCard(
        id = id,
        kind = kind,
        overline = overline,
        name = name,
        stats = stats,
        isActive = kind == IdentityKind.Local,
    )
