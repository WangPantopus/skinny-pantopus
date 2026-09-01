@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.homes.claim_ownership.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.roundToInt

/**
 * Lightweight display model for the file shown in a populated slot. Decoupled
 * from `ClaimPickedFile` (which carries raw bytes) so the slot renders in
 * Paparazzi snapshots without fabricating data.
 */
data class UploadSlotFile(
    val name: String,
    /** Pre-formatted size, e.g. "1.4 MB" / "820 KB". */
    val sizeLabel: String,
    /** Page count for multi-page docs, e.g. 8 → "8 pages". `null` omits it. */
    val pageCount: Int?,
    val kind: Kind,
) {
    enum class Kind { Pdf, Image }
}

/**
 * Render-state for one claim upload slot. Mirrors the A12.4 design's slot
 * state vocabulary: empty · uploading · done · warn.
 */
sealed interface UploadSlotState {
    data object Empty : UploadSlotState

    data class Uploading(val file: UploadSlotFile, val progress: Float) : UploadSlotState

    data class Done(val file: UploadSlotFile, val detail: String) : UploadSlotState

    data class Warn(val file: UploadSlotFile, val detail: String) : UploadSlotState

    /** Whether the slot holds a confirmed (uploaded + checked) document. */
    val isAttached: Boolean
        get() = this is Done || this is Warn

    companion object {
        /** Bold lead rendered before the OCR detail in the `Done` state. */
        const val MATCH_LEAD = "Address matches."

        /** Bold lead rendered before the OCR detail in the `Warn` state. */
        const val DIFFER_LEAD = "Address differs from your profile."
    }
}

/**
 * A single evidence upload slot. Tapping the empty tile fires [onPick]; the
 * trailing control (X while uploading, trash once populated) fires [onRemove].
 */
@Composable
fun UploadSlot(
    id: String,
    label: String,
    hint: String,
    state: UploadSlotState,
    required: Boolean = false,
    onPick: () -> Unit = {},
    onRemove: () -> Unit = {},
) {
    val rooted = Modifier.fillMaxWidth().testTag("uploadSlot_$id")
    when (state) {
        UploadSlotState.Empty -> EmptyTile(rooted, label, required, hint, onPick)
        is UploadSlotState.Uploading -> UploadingTile(rooted, id, label, state.file, state.progress, onRemove)
        is UploadSlotState.Done -> UploadedTile(rooted, id, label, state.file, state.detail, isWarn = false, onRemove)
        is UploadSlotState.Warn -> UploadedTile(rooted, id, label, state.file, state.detail, isWarn = true, onRemove)
    }
}

@Composable
private fun EmptyTile(
    modifier: Modifier,
    label: String,
    required: Boolean,
    hint: String,
    onPick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Box(
        modifier =
            modifier
                .clip(shape)
                .background(PantopusColors.appSurface)
                .clickable(role = Role.Button, onClick = onPick)
                .semantics { contentDescription = "$label. Tap to upload. $hint" },
    ) {
        Canvas(modifier = Modifier.matchParentSize()) {
            drawRoundRect(
                color = PantopusColors.appBorderStrong,
                style =
                    Stroke(
                        width = 1.5.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx()), 0f),
                    ),
                cornerRadius = CornerRadius(Radii.lg.toPx(), Radii.lg.toPx()),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconDisc(PantopusIcon.Upload)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text =
                        buildAnnotatedString {
                            append(label)
                            if (required) {
                                withStyle(SpanStyle(color = PantopusColors.error, fontWeight = FontWeight.Bold)) {
                                    append("  *")
                                }
                            }
                        },
                    color = PantopusColors.appText,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(text = hint, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
            }
            PantopusIconImage(
                icon = PantopusIcon.Plus,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun UploadingTile(
    modifier: Modifier,
    id: String,
    label: String,
    file: UploadSlotFile,
    progress: Float,
    onRemove: () -> Unit,
) {
    val percent = (progress.coerceIn(0f, 1f) * 100).roundToInt()
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .semantics { contentDescription = "$label. Uploading ${file.name}, $percent percent." },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconDisc(PantopusIcon.Image)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = file.name,
                    color = PantopusColors.appText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text =
                        buildAnnotatedString {
                            append("Uploading · ${file.sizeLabel} · ")
                            withStyle(SpanStyle(color = PantopusColors.primary600, fontWeight = FontWeight.SemiBold)) {
                                append("$percent%")
                            }
                        },
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                )
            }
            RemoveButton(id, label, PantopusIcon.X, background = PantopusColors.appSurfaceSunken, onRemove = onRemove)
        }
        ProgressBar(progress)
    }
}

@Composable
private fun UploadedTile(
    modifier: Modifier,
    id: String,
    label: String,
    file: UploadSlotFile,
    detail: String,
    isWarn: Boolean,
    onRemove: () -> Unit,
) {
    val lead = if (isWarn) UploadSlotState.DIFFER_LEAD else UploadSlotState.MATCH_LEAD
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(
                    1.dp,
                    if (isWarn) PantopusColors.warningLight else PantopusColors.successLight,
                    RoundedCornerShape(Radii.lg),
                ).padding(Spacing.s3)
                .semantics { contentDescription = "$label. ${file.name} uploaded. $lead $detail" },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Thumbnail(file)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = file.name,
                    color = PantopusColors.appText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = file.pageCount?.let { "${file.sizeLabel} · $it pages" } ?: file.sizeLabel,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                )
            }
            RemoveButton(id, label, PantopusIcon.Trash2, background = Color.Transparent, onRemove = onRemove)
        }
        OcrRow(lead = lead, detail = detail, isWarn = isWarn)
    }
}

@Composable
private fun OcrRow(
    lead: String,
    detail: String,
    isWarn: Boolean,
) {
    val tone = if (isWarn) PantopusColors.warning else PantopusColors.success
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(if (isWarn) PantopusColors.warningBg else PantopusColors.successBg)
                .padding(Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier = Modifier.size(18.dp).clip(CircleShape).background(tone),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = if (isWarn) PantopusIcon.AlertTriangle else PantopusIcon.Check,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 3f,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text =
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(lead) }
                    append(" ")
                    append(detail)
                },
            color = tone,
            fontSize = 11.5.sp,
            lineHeight = 15.sp,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun IconDisc(icon: PantopusIcon) {
    Box(
        modifier = Modifier.size(40.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.primary50),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, strokeWidth = 2.2f, tint = PantopusColors.primary600)
    }
}

@Composable
private fun Thumbnail(file: UploadSlotFile) {
    Box(
        modifier =
            Modifier
                .size(width = 40.dp, height = 48.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(if (file.kind == UploadSlotFile.Kind.Pdf) PantopusColors.errorBg else PantopusColors.primary50),
        contentAlignment = Alignment.Center,
    ) {
        if (file.kind == UploadSlotFile.Kind.Pdf) {
            Text(text = "PDF", color = PantopusColors.error, fontSize = 9.sp, fontWeight = FontWeight.Black)
        } else {
            PantopusIconImage(
                icon = PantopusIcon.Image,
                contentDescription = null,
                size = Radii.xl2,
                strokeWidth = 1.8f,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun RemoveButton(
    id: String,
    label: String,
    icon: PantopusIcon,
    background: Color,
    onRemove: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .clickable(role = Role.Button, onClick = onRemove)
                .testTag("uploadSlot_remove_$id")
                .semantics { contentDescription = "Remove $label" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun ProgressBar(progress: Float) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth(progress.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .clip(CircleShape)
                    .background(PantopusColors.primary600),
        )
    }
}
