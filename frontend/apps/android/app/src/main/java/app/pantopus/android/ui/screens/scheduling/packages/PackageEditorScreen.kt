@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "UNUSED_PARAMETER",
)

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

object PackageEditorTags {
    const val ROOT = "scheduling.packageEditor"
    const val SAVE = "packageEditorSave"
}

@Composable
fun PackageEditorScreen(
    packageId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: PackageEditorViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.start() }

    Box(modifier = Modifier.fillMaxSize().testTag(PackageEditorTags.ROOT)) {
        PackageEditorContent(
            state = state,
            onBack = onBack,
            onSave = { viewModel.save(onDone = onBack) },
            onName = viewModel::onName,
            onDescription = viewModel::onDescription,
            onSessions = viewModel::onSessions,
            onPrice = viewModel::onPrice,
            onSelectEventType = viewModel::selectEventType,
            onExpiry = viewModel::onExpiry,
            onActive = viewModel::onActive,
            onRetry = viewModel::load,
        )
        toast?.let { message ->
            PkgToastCapsule(
                text = message,
                icon = PantopusIcon.Info,
                modifier = Modifier.align(Alignment.TopCenter).padding(top = Spacing.s3),
            )
            LaunchedEffect(message) {
                delay(TOAST_MS)
                viewModel.toastConsumed()
            }
        }
    }
}

private const val TOAST_MS = 2200L

@Composable
internal fun PackageEditorContent(
    state: PackageEditorUiState,
    onBack: () -> Unit,
    onSave: () -> Unit,
    onName: (String) -> Unit,
    onDescription: (String) -> Unit,
    onSessions: (Int) -> Unit,
    onPrice: (String) -> Unit,
    onSelectEventType: (String?) -> Unit,
    onExpiry: (PackageExpiry) -> Unit,
    onActive: (Boolean) -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        is PackageEditorUiState.Loading -> GatedChrome("New package", onBack) { EditorLoading() }
        is PackageEditorUiState.ComingSoon ->
            GatedChrome("Packages", onBack) {
                PkgComingSoon(title = "Packages")
            }
        is PackageEditorUiState.Error ->
            GatedChrome("Packages", onBack) {
                ErrorState(message = state.message, onRetry = onRetry)
            }
        is PackageEditorUiState.Content ->
            FormShell(
                title = if (state.isEditing) "Edit package" else "New package",
                isValid = state.isValid,
                isDirty = state.isDirty,
                rightActionLabel = null,
                bottomActionLabel = "Save package",
                isSaving = state.saving,
                leading = FormShellLeading.Back,
                onClose = onBack,
                onCommit = onSave,
            ) {
                EditorCards(
                    state = state,
                    onName = onName,
                    onDescription = onDescription,
                    onSessions = onSessions,
                    onPrice = onPrice,
                    onSelectEventType = onSelectEventType,
                    onExpiry = onExpiry,
                    onActive = onActive,
                )
            }
    }
}

@Composable
private fun GatedChrome(
    title: String,
    onBack: () -> Unit,
    body: @Composable () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PkgTopBar(title = title, onBack = onBack)
        body()
    }
}

@Composable
private fun EditorCards(
    state: PackageEditorUiState.Content,
    onName: (String) -> Unit,
    onDescription: (String) -> Unit,
    onSessions: (Int) -> Unit,
    onPrice: (String) -> Unit,
    onSelectEventType: (String?) -> Unit,
    onExpiry: (PackageExpiry) -> Unit,
    onActive: (Boolean) -> Unit,
) {
    val form = state.form
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (!state.isEditing) {
            Text(
                text = "Set a price and we'll do the per-session math.",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
            )
        }
        // Details
        PkgCard(overline = "Details") {
            PkgTextField(
                value = form.name,
                onValueChange = onName,
                label = "Name",
                placeholder = "5-session cleaning",
                error = form.nameError,
                helper = if (form.nameError) "Give your package a name" else null,
            )
            PkgMultilineField(
                value = form.description,
                onValueChange = onDescription,
                label = "Description",
                placeholder = "What's included",
            )
        }
        // Locked-state warning (design Frame 4 — has active buyers)
        if (state.locked) {
            PkgNote(
                tone = PkgNoteTone.Warning,
                icon = PantopusIcon.Lock,
                text = "Buyers own credits — you can't change sessions or eligibility while credits are active.",
            )
        }
        // Redeems against
        PkgCard(overline = "Redeems against") {
            RedeemTiles(
                state.eventTypes,
                form.selectedEventTypeId,
                state.pillar,
                onSelectEventType,
                locked = state.locked,
            )
        }
        // Sessions
        PkgCard(overline = "Sessions") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Number of sessions",
                    color = PantopusColors.appText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                PkgStepper(
                    value = form.sessionsCount,
                    onValueChange = onSessions,
                    enabled = !state.locked,
                )
            }
        }
        // Price
        PkgCard(overline = "Price") {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PkgTextField(
                    value = form.priceText,
                    onValueChange = onPrice,
                    placeholder = "$0.00",
                    keyboardType = KeyboardType.Decimal,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier =
                        Modifier
                            .height(40.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurfaceSunken)
                            .padding(horizontal = Spacing.s3),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "USD",
                        color = PantopusColors.appTextStrong,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Text(
                text = "${PackagesMoney.perSession(
                    PackagesMoney.parseCents(form.priceText),
                    form.sessionsCount,
                )} per session",
                color = state.pillar.accent,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        if (state.isEditing) {
            PkgNote(
                tone = PkgNoteTone.Info,
                icon = PantopusIcon.Info,
                text = "Changing the price creates a new Stripe price. Current buyers keep their terms.",
            )
        }
        // Expiry (view-only — functional sky, not the pillar accent)
        PkgCard(overline = "Expiry") {
            PkgSegmented(
                options = PackageExpiry.entries.map { it.label },
                selectedIndex = form.expiry.ordinal,
                onSelect = { onExpiry(PackageExpiry.entries[it]) },
                accent = PantopusColors.primary700,
            )
        }
        // Active (functional sky switch)
        PkgCard {
            PkgToggleRow(
                icon = PantopusIcon.Power,
                label = "Active",
                sub = "Buyers can purchase this package",
                checked = form.isActive,
                onCheckedChange = onActive,
                accent = PantopusColors.primary600,
            )
        }
        Box(modifier = Modifier.height(Spacing.s8))
    }
}

@Composable
private fun RedeemTiles(
    eventTypes: List<EventTypeOption>,
    selectedId: String?,
    pillar: SchedulingPillar,
    onSelect: (String?) -> Unit,
    locked: Boolean = false,
) {
    if (eventTypes.isEmpty()) {
        Text(
            text = "Credits apply to all of your services.",
            color = PantopusColors.appTextSecondary,
            fontSize = 11.5.sp,
        )
        return
    }
    // Two-column grid laid out as rows of two (avoids a nested-scroll LazyVGrid
    // inside the FormShell scroll).
    val tiles = listOf(EventTypeOption(ALL_SERVICES_ID, "All services", "Any event")) + eventTypes
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tiles.chunked(2).forEach { pair ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                pair.forEach { option ->
                    val isAll = option.id == ALL_SERVICES_ID
                    EventTile(
                        title = option.name,
                        duration = option.durationLabel,
                        icon = if (isAll) PantopusIcon.Package else PantopusIcon.Calendar,
                        selected = if (isAll) selectedId == null else selectedId == option.id,
                        accent = pillar.accent,
                        accentBg = pillar.accentBg,
                        onClick = { if (!locked) onSelect(if (isAll) null else option.id) },
                        enabled = !locked,
                        modifier = Modifier.weight(1f),
                    )
                }
                if (pair.size == 1) Box(modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun EventTile(
    title: String,
    duration: String,
    icon: PantopusIcon,
    selected: Boolean,
    accent: Color,
    accentBg: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) accentBg else PantopusColors.appSurface)
                .border(
                    if (selected) 1.5.dp else 1.dp,
                    if (selected) accent else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.lg),
                )
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = 11.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 15.dp,
                tint = if (selected) accent else PantopusColors.appTextSecondary,
            )
            Box(modifier = Modifier.weight(1f))
            if (selected) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 3f,
                    tint = accent,
                )
            }
        }
        Text(
            text = title,
            color = PantopusColors.appText,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (duration.isNotEmpty()) {
            Text(text = duration, color = PantopusColors.appTextSecondary, fontSize = 10.sp)
        }
    }
}

@Composable
private fun EditorLoading() {
    Column(
        modifier =
            Modifier.fillMaxSize().padding(
                horizontal = Spacing.s4,
            ).padding(top = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(4) {
            Shimmer(width = 80.dp, height = 9.dp)
            Shimmer(modifier = Modifier.fillMaxWidth(), height = 96.dp, cornerRadius = Radii.xl)
        }
    }
}

private const val ALL_SERVICES_ID = "__all__"
