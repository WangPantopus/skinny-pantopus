@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.contentdetail

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * §1B-4 — Proof-of-delivery / completion sheet a hired worker uses to
 * mark a V2 task delivered. Presented over the A09.1 Task-V2 detail
 * (`GigDetailScreen`). Design: docs/design/new/Delivery Proof Sheet.html
 * + delivery-proof-frames.jsx. One sheet · two states (Entry · Submitted).
 *
 * Submit roundtrip is owned by the host (`GigDetailViewModel`): each
 * photo is uploaded via `POST /api/files/upload`, then the resulting URLs
 * ride `POST /api/gigs/:gigId/mark-completed` alongside the note. No new
 * endpoints.
 */

/** Presentation target for the Delivery Proof sheet. */
data class DeliveryProofTarget(
    val id: String,
    val gigId: String,
    val gigTitle: String,
)

/**
 * One picked proof photo. Not a data class — [bytes] is an array, so
 * structural equality would be misleading; the grid keys on [id].
 */
class DeliveryProofPhoto(
    val id: String,
    val bytes: ByteArray,
    val filename: String,
    val mimeType: String,
)

/** Backend caps `completion_photos` at 10; we surface a tidier grid. */
private const val MAX_PHOTOS = 6

/**
 * Stateful Delivery Proof sheet. Owns the photo list, note, submit
 * lifecycle, and the image-picker launcher (which can't run under
 * Paparazzi) so [DeliveryProofSheetContent] stays a pure, snapshot-able
 * function. On submit success it flips to the SUBMITTED confirmation;
 * [onDismiss] tears the sheet down (the host has refreshed the task by
 * then).
 */
@Composable
fun DeliveryProofSheet(
    target: DeliveryProofTarget,
    onSubmit: suspend (List<DeliveryProofPhoto>, String?) -> Boolean,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val photos = remember(target.id) { mutableStateListOf<DeliveryProofPhoto>() }
    var note by rememberSaveable(target.id) { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }

    val picker =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.PickVisualMedia(),
        ) { uri: Uri? ->
            if (uri == null) return@rememberLauncherForActivityResult
            scope.launch {
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                if (bytes != null && photos.size < MAX_PHOTOS) {
                    photos.add(
                        DeliveryProofPhoto(
                            id = UUID.randomUUID().toString(),
                            bytes = bytes,
                            filename = "proof-${UUID.randomUUID().toString().take(6)}.jpg",
                            mimeType = "image/jpeg",
                        ),
                    )
                }
            }
        }

    DeliveryProofSheetContent(
        photos = photos,
        note = note,
        submitting = submitting,
        submitted = submitted,
        errorText = errorText,
        canAddMore = photos.size < MAX_PHOTOS,
        onAddPhoto = {
            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        },
        onRemovePhoto = { photo -> photos.removeAll { it.id == photo.id } },
        onNoteChange = { note = it },
        onSubmit = {
            if (photos.isNotEmpty() && !submitting) {
                submitting = true
                errorText = null
                scope.launch {
                    val ok = onSubmit(photos.toList(), note.trim().ifEmpty { null })
                    submitting = false
                    if (ok) {
                        submitted = true
                    } else {
                        errorText = "Couldn't send your proof. Check your connection and try again."
                    }
                }
            }
        },
        onDismiss = onDismiss,
    )
}

/** Pure, snapshot-able body. All state is hoisted by [DeliveryProofSheet]. */
@Composable
fun DeliveryProofSheetContent(
    photos: List<DeliveryProofPhoto>,
    note: String,
    submitting: Boolean,
    submitted: Boolean,
    errorText: String?,
    canAddMore: Boolean,
    onAddPhoto: () -> Unit,
    onRemovePhoto: (DeliveryProofPhoto) -> Unit,
    onNoteChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("deliveryProofSheet"),
    ) {
        if (submitted) {
            SubmittedBody(photos = photos, note = note, onDismiss = onDismiss)
        } else {
            EntryBody(
                photos = photos,
                note = note,
                submitting = submitting,
                errorText = errorText,
                canAddMore = canAddMore,
                onAddPhoto = onAddPhoto,
                onRemovePhoto = onRemovePhoto,
                onNoteChange = onNoteChange,
                onSubmit = onSubmit,
                onDismiss = onDismiss,
            )
        }
    }
}

// ── State 1: ENTRY ──────────────────────────────────────────────────

@Composable
private fun EntryBody(
    photos: List<DeliveryProofPhoto>,
    note: String,
    submitting: Boolean,
    errorText: String?,
    canAddMore: Boolean,
    onAddPhoto: () -> Unit,
    onRemovePhoto: (DeliveryProofPhoto) -> Unit,
    onNoteChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .padding(top = Spacing.s3, bottom = Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Confirm delivery",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = "Add a photo so the poster can release your payment.",
                    fontSize = 12.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(30.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable { onDismiss() }
                        .semantics { contentDescription = "Close" }
                        .testTag("deliveryProof.close"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 17.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Overline("Photo proof *")
            PhotoGrid(
                photos = photos,
                canAddMore = canAddMore,
                onAddPhoto = onAddPhoto,
                onRemovePhoto = onRemovePhoto,
            )
            HelperText("Show the completed work or the drop-off spot. At least one photo.")
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Overline("Note (optional)")
            NoteField(value = note, onValueChange = onNoteChange)
            HelperText("The poster sees this with your proof.")
        }

        TrustLine()

        if (!errorText.isNullOrEmpty()) {
            Text(
                text = errorText,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
                modifier = Modifier.testTag("deliveryProof.error"),
            )
        }

        PrimaryActionButton(
            label = "Mark as delivered",
            icon = PantopusIcon.CheckCheck,
            enabled = photos.isNotEmpty() && !submitting,
            loading = submitting,
            modifier = Modifier.fillMaxWidth().testTag("deliveryProof.submit"),
            onClick = onSubmit,
        )
    }
}

@Composable
private fun PhotoGrid(
    photos: List<DeliveryProofPhoto>,
    canAddMore: Boolean,
    onAddPhoto: () -> Unit,
    onRemovePhoto: (DeliveryProofPhoto) -> Unit,
) {
    val totalCells = photos.size + if (canAddMore) 1 else 0
    val rowCount = (totalCells + 2) / 3
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        for (row in 0 until rowCount) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                for (col in 0 until 3) {
                    val index = row * 3 + col
                    Box(modifier = Modifier.weight(1f)) {
                        when {
                            index < photos.size -> PhotoThumb(photos[index], onRemovePhoto)
                            index == photos.size && canAddMore -> AddTile(onAddPhoto)
                            else -> Spacer(modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PhotoThumb(
    photo: DeliveryProofPhoto,
    onRemove: (DeliveryProofPhoto) -> Unit,
) {
    val bitmap =
        remember(photo.id) {
            runCatching {
                BitmapFactory.decodeByteArray(photo.bytes, 0, photo.bytes.size)?.asImageBitmap()
            }.getOrNull()
        }
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(96.dp)
                .clip(RoundedCornerShape(Radii.md)),
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(
                            Brush.linearGradient(
                                listOf(PantopusColors.appBorderStrong, PantopusColors.appTextSecondary),
                            ),
                        ),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Image,
                    contentDescription = null,
                    size = 26.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(Spacing.s1)
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.success)
                    .border(2.dp, PantopusColors.appTextInverse, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 10.dp,
                strokeWidth = 4f,
                tint = PantopusColors.appTextInverse,
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(Spacing.s1)
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.6f))
                    .clickable { onRemove(photo) }
                    .semantics { contentDescription = "Remove photo" }
                    .testTag("deliveryProof.removePhoto"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = 12.dp,
                strokeWidth = 2.6f,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun AddTile(onAdd: () -> Unit) {
    val shape = RoundedCornerShape(Radii.md)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(96.dp)
                .clip(shape)
                .background(PantopusColors.appSurfaceMuted)
                .drawBehind {
                    val radius = Radii.md.toPx()
                    drawRoundRect(
                        color = PantopusColors.appBorderStrong,
                        cornerRadius = CornerRadius(radius, radius),
                        style =
                            Stroke(
                                width = 1.5.dp.toPx(),
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()), 0f),
                            ),
                    )
                }
                .clickable { onAdd() }
                .semantics { contentDescription = "Add photo" }
                .testTag("deliveryProof.photoUpload"),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Camera,
                contentDescription = null,
                size = 22.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Add",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun NoteField(
    value: String,
    onValueChange: (String) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 74.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.sm))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            minLines = 3,
            maxLines = 6,
            modifier = Modifier.fillMaxWidth().testTag("deliveryProof.note"),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(
                        text = "e.g. Left it by the side door as we agreed — thanks!",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextMuted,
                    )
                }
                inner()
            },
        )
    }
}

@Composable
private fun TrustLine() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary50)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary700,
        )
        Text(
            text = "Payment is released once the poster confirms — usually within a few hours.",
            style = PantopusTextStyle.small,
            color = PantopusColors.primary700,
        )
    }
}

// ── State 2: SUBMITTED ──────────────────────────────────────────────

@Composable
private fun SubmittedBody(
    photos: List<DeliveryProofPhoto>,
    note: String,
    onDismiss: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .padding(top = Spacing.s4, bottom = Spacing.s5)
                .testTag("deliveryProof.submittedView"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Box(
            modifier =
                Modifier
                    .size(78.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 36.dp,
                strokeWidth = 3f,
                tint = PantopusColors.success,
            )
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "Delivery confirmed",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text =
                    "We’ve let the poster know. Payment releases once they confirm — " +
                        "usually within a few hours.",
                fontSize = 13.5.sp,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
            )
        }
        RecapCard(photos = photos, note = note)
        PrimaryActionButton(
            label = "Back to task",
            icon = PantopusIcon.ArrowRight,
            enabled = true,
            loading = false,
            modifier = Modifier.fillMaxWidth().testTag("deliveryProof.backToTask"),
            onClick = onDismiss,
        )
    }
}

@Composable
private fun RecapCard(
    photos: List<DeliveryProofPhoto>,
    note: String,
) {
    val timestamp = remember { "Today at " + SimpleDateFormat("h:mm a", Locale.US).format(Date()) }
    val count = photos.size
    val photoLabel = "$count photo" + if (count == 1) "" else "s"
    val title = if (note.trim().isEmpty()) "Proof sent · $photoLabel" else "Proof sent · $photoLabel, note"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(
                        Brush.linearGradient(
                            listOf(PantopusColors.appBorderStrong, PantopusColors.appTextSecondary),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Image,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = timestamp,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.CheckCheck,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.success,
        )
    }
}

// ── Shared primitives ───────────────────────────────────────────────

@Composable
private fun Overline(label: String) {
    Text(
        text = label.uppercase(Locale.US),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.8.sp,
        color = PantopusColors.appTextMuted,
    )
}

@Composable
private fun HelperText(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        fontStyle = FontStyle.Italic,
        color = PantopusColors.appTextSecondary,
    )
}

@Composable
private fun PrimaryActionButton(
    label: String,
    icon: PantopusIcon,
    enabled: Boolean,
    loading: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .height(50.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (enabled) PantopusColors.primary600 else PantopusColors.primary200)
                .then(if (enabled && !loading) Modifier.clickable { onClick() } else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = PantopusColors.appTextInverse,
                strokeWidth = 2.dp,
                modifier = Modifier.size(22.dp),
            )
        } else {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = label,
                    fontSize = 15.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 18.dp,
                    strokeWidth = 2.6f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}
