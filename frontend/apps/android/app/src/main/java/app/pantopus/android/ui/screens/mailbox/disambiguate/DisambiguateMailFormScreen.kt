@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.disambiguate

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EnvelopeOcrBox
import app.pantopus.android.ui.components.EnvelopeOcrTone
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.mailbox.disambiguate.components.CandidateRow
import app.pantopus.android.ui.screens.mailbox.disambiguate.components.FallbackRow
import app.pantopus.android.ui.screens.mailbox.disambiguate.components.OcrStrip
import app.pantopus.android.ui.screens.mailbox.disambiguate.components.QuickActionChip
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * A13.15 Disambiguate — scanned-envelope hero with an [EnvelopeOcrBox] overlay,
 * an [OcrStrip] read-out, a ranked [CandidateRow] list with match badges,
 * quick-action chips, and (in the unclear frame) a fallback card. A sticky
 * Confirm CTA owns submit. ViewModel reads nav args via SavedStateHandle.
 */
@Composable
fun DisambiguateMailFormScreen(
    onClose: () -> Unit,
    viewModel: DisambiguateMailFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.toast) {
        if (state.toast != null) {
            delay(2_500)
            viewModel.dismissToast()
        }
    }
    LaunchedEffect(state.shouldDismiss) {
        if (state.shouldDismiss) {
            viewModel.acknowledgeDismiss()
            onClose()
        }
    }

    DisambiguateContent(
        state = state,
        onClose = onClose,
        onSelectCandidate = viewModel::selectCandidate,
        onThisIsMe = viewModel::selectThisIsMe,
        onRouteToOther = viewModel::routeToOther,
        onAddNewPerson = viewModel::addNewPerson,
        onFallback = viewModel::selectFallback,
        onConfirm = viewModel::submit,
    )
}

/**
 * Stateless screen body — split out so Paparazzi can snapshot it without the
 * Hilt graph (mirrors `EditProfileLoaded`).
 */
@Composable
internal fun DisambiguateContent(
    state: DisambiguateUiState,
    onClose: () -> Unit,
    onSelectCandidate: (String) -> Unit,
    onThisIsMe: () -> Unit,
    onRouteToOther: () -> Unit,
    onAddNewPerson: () -> Unit,
    onFallback: (FallbackAction) -> Unit,
    onConfirm: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                // Top-bar action is intentionally hidden; sticky CTA owns submit.
                FormShell(
                    title = "Disambiguate",
                    rightActionLabel = "",
                    isValid = false,
                    isDirty = state.isDirty,
                    isSaving = false,
                    onClose = onClose,
                    onCommit = {},
                ) {
                    ScannedEnvelopeSection(state = state)
                    CandidatesSection(
                        state = state,
                        onSelectCandidate = onSelectCandidate,
                        onThisIsMe = onThisIsMe,
                        onRouteToOther = onRouteToOther,
                        onAddNewPerson = onAddNewPerson,
                    )
                    if (state.isUnclear) {
                        FallbackSection(onFallback = onFallback)
                    }
                }
            }
            StickyConfirm(
                hint = state.confirmHint,
                isLoading = state.isSubmitting,
                isEnabled = state.canConfirm,
                onClick = onConfirm,
            )
        }

        state.toast?.let { toast ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 110.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (toast.isError) PantopusColors.error else PantopusColors.success)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            ) {
                Text(
                    text = toast.text,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

// MARK: - Sections

@Composable
private fun ScannedEnvelopeSection(state: DisambiguateUiState) {
    Section(overline = "Scanned envelope") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            EnvelopeArtwork(tone = state.ocrTone, boxLabel = state.ocrBoxLabel)
            OcrStrip(
                tone = state.ocrTone,
                detected = state.detectedText,
                confidence = state.confidencePercent,
                sub = state.ocrSubtext,
            )
        }
    }
}

@Composable
private fun CandidatesSection(
    state: DisambiguateUiState,
    onSelectCandidate: (String) -> Unit,
    onThisIsMe: () -> Unit,
    onRouteToOther: () -> Unit,
    onAddNewPerson: () -> Unit,
) {
    Section(overline = state.candidatesOverline) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (!state.isUnclear) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    QuickActionChip(
                        icon = PantopusIcon.UserCheck,
                        label = "This is me",
                        isPrimary = true,
                        onClick = onThisIsMe,
                        modifier = Modifier.weight(1f).testTag("disambiguateThisIsMe"),
                    )
                    QuickActionChip(
                        icon = PantopusIcon.Forward,
                        label = "Route to…",
                        isPrimary = false,
                        onClick = onRouteToOther,
                        modifier = Modifier.weight(1f).testTag("disambiguateRouteTo"),
                    )
                }
            }
            state.candidates.forEach { candidate ->
                CandidateRow(
                    candidate = candidate,
                    isSelected = state.isSelected(candidate.id),
                    isSelectable = !state.isUnclear,
                    onTap = { onSelectCandidate(candidate.id) },
                )
            }
            if (!state.isUnclear) {
                Row(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.sm))
                            .clickable(onClick = onAddNewPerson)
                            .padding(vertical = Spacing.s2)
                            .testTag("disambiguateAddNewPerson"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Plus,
                        contentDescription = null,
                        size = 13.dp,
                        tint = PantopusColors.primary600,
                    )
                    Text(
                        text = "None of these — add new person",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary600,
                    )
                }
            }
        }
    }
}

@Composable
private fun FallbackSection(onFallback: (FallbackAction) -> Unit) {
    Section(overline = "Or resolve another way") {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        ) {
            FallbackAction.entries.forEachIndexed { index, action ->
                FallbackRow(
                    icon = iconFor(action),
                    title = action.title,
                    subtitle = action.subtitle,
                    onClick = { onFallback(action) },
                    // Mirror the iOS rawValue keys (rescan / typeName / …) so the
                    // testTag strings match across platforms.
                    modifier =
                        Modifier.testTag(
                            "disambiguateFallback_${action.name.replaceFirstChar { it.lowercase() }}",
                        ),
                    isDestructive = action.isDestructive,
                    showsDivider = index < FallbackAction.entries.size - 1,
                )
            }
        }
    }
}

private fun iconFor(action: FallbackAction): PantopusIcon =
    when (action) {
        FallbackAction.Rescan -> PantopusIcon.ScanLine
        FallbackAction.TypeName -> PantopusIcon.Keyboard
        FallbackAction.ReturnToSender -> PantopusIcon.Undo2
        FallbackAction.MarkAsJunk -> PantopusIcon.Trash2
    }

// MARK: - Sticky CTA

@Composable
private fun StickyConfirm(
    hint: String?,
    isLoading: Boolean,
    isEnabled: Boolean,
    onClick: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        hint?.let {
            Text(
                text = it,
                fontSize = 11.sp,
                fontStyle = FontStyle.Italic,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(start = Spacing.s4, top = Spacing.s2, end = Spacing.s4),
            )
        }
        Box(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            contentAlignment = Alignment.Center,
        ) {
            PrimaryButton(
                title = "Confirm recipient",
                onClick = onClick,
                isEnabled = isEnabled,
                isLoading = isLoading,
                modifier = Modifier.fillMaxWidth().testTag("disambiguateConfirm"),
            )
        }
    }
}

// MARK: - Section helper

@Composable
private fun Section(
    overline: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = overline.uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        content()
    }
}

// MARK: - Envelope artwork

/**
 * Token-pure scanned-envelope artwork with an [EnvelopeOcrBox] overlay on the
 * name line. Sender / address are sample decoration (real OCR is out of scope);
 * the tone drives the box (clean = solid sky · unclear = dashed amber +
 * water-stain) and the name redaction.
 */
@Composable
private fun EnvelopeArtwork(
    tone: EnvelopeOcrTone,
    boxLabel: String,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(188.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.paperCream)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .semantics { contentDescription = "Scanned envelope" },
    ) {
        Column(modifier = Modifier.padding(Spacing.s4)) {
            Text(
                text = "GLOBAL BANK · RETURN SERVICE",
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(bottom = Spacing.s2),
            )
            Box(
                modifier =
                    Modifier
                        .width(84.dp)
                        .height(2.dp)
                        .background(PantopusColors.appBorderStrong),
            )
            Spacer(Modifier.height(Spacing.s3))
            Text(
                text = if (tone == EnvelopeOcrTone.Clean) "Maria K." else "M___ K___",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextStrong,
            )
            Spacer(Modifier.height(Spacing.s1))
            Text(
                text = "412 Elm St, Apt 3B",
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Elm Park, NY 10013",
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextSecondary,
            )
        }

        // Postage stamp placeholder (top-right).
        Column(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(Spacing.s3)
                    .size(width = 54.dp, height = 64.dp)
                    .border(
                        width = 1.5.dp,
                        color = PantopusColors.appBorderStrong,
                        shape = RoundedCornerShape(Radii.xs),
                    ),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "USA",
                fontSize = 7.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "68¢",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextSecondary,
            )
            Text("FOREVER", fontSize = 6.sp, fontFamily = FontFamily.Monospace, color = PantopusColors.appTextSecondary)
        }

        // OCR bounding box over the name line.
        EnvelopeOcrBox(
            rect =
                DpRect(
                    left = 14.dp,
                    top = 50.dp,
                    right = 146.dp,
                    bottom = 70.dp,
                ),
            tone = tone,
            label = boxLabel,
        )
    }
}
