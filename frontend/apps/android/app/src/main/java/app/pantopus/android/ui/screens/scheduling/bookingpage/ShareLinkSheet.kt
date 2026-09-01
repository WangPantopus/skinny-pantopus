@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch

/**
 * C3 — the local "Share your link" bottom sheet. A rounded-top sheet over the
 * dimmed booking-link screen with the copyable URL, share targets, a QR
 * thumbnail (expanding to a fullscreen QR), profile/signature toggles, and a
 * destructive "Regenerate link" (with a confirm). When the page is still a
 * draft a warning banner sits on top. Context label + dot follow the pillar;
 * functional chrome stays sky.
 */
private const val COPIED_RESET_MS = 1600L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareLinkSheet(
    url: String,
    displayName: String,
    pillar: SchedulingPillar,
    isDraft: Boolean,
    sheetState: SheetState,
    onCopy: () -> Unit,
    onShare: () -> Unit,
    onMessages: () -> Unit,
    onEmail: () -> Unit,
    onRegenerate: () -> Unit,
    onTurnOn: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    startWithQr: Boolean = false,
) {
    var copied by remember { mutableStateOf(false) }
    var showQr by remember { mutableStateOf(startWithQr) }
    var showRegenConfirm by remember { mutableStateOf(false) }
    var showOnProfile by remember { mutableStateOf(true) }
    var addToSignature by remember { mutableStateOf(false) }

    LaunchedEffect(copied) {
        if (copied) {
            kotlinx.coroutines.delay(COPIED_RESET_MS)
            copied = false
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = modifier.testTag("shareLinkSheet"),
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s5),
                verticalArrangement = Arrangement.spacedBy(11.dp),
            ) {
                if (isDraft) DraftBanner(onTurnOn = onTurnOn)

                ContextLabel(pillar)
                UrlCard(url = url, copied = copied, onCopy = {
                    onCopy()
                    copied = true
                })
                Text("Anyone with this link can book you.", color = PantopusColors.appTextSecondary, fontSize = 11.sp)

                ShareTargetsRow(
                    onShare = onShare,
                    onQr = { showQr = true },
                    onMessages = onMessages,
                    onEmail = onEmail,
                )
                QrThumbCard(url = url, onShow = { showQr = true })
                ShareSettingsCard(
                    showOnProfile = showOnProfile,
                    addToSignature = addToSignature,
                    onToggleProfile = { showOnProfile = !showOnProfile },
                    onToggleSignature = { addToSignature = !addToSignature },
                )
                RegenerateButton(onClick = { showRegenConfirm = true })
            }
            if (copied) {
                CopiedToast(
                    message = "Link copied",
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.s12),
                )
            }
        }
    }

    if (showQr) {
        QrFullscreenDialog(url = url, displayName = displayName, pillar = pillar, onDone = { showQr = false })
    }
    if (showRegenConfirm) {
        RegenerateConfirmDialog(
            onCancel = { showRegenConfirm = false },
            onConfirm = {
                showRegenConfirm = false
                onRegenerate()
            },
        )
    }
}

@Composable
internal fun ContextLabel(pillar: SchedulingPillar) {
    val label =
        when (pillar) {
            SchedulingPillar.Home -> "Home booking link"
            SchedulingPillar.Business -> "Business booking link"
            SchedulingPillar.Personal -> "Personal booking link"
        }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(pillar.accent))
        Text(label.uppercase(java.util.Locale.US), color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 10.sp)
    }
}

@Composable
private fun UrlCard(
    url: String,
    copied: Boolean,
    onCopy: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(start = Spacing.s3, top = Spacing.s2, bottom = Spacing.s2, end = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        MonoUrlText(url = url, modifier = Modifier.weight(1f))
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (copied) PantopusColors.success else PantopusColors.primary600)
                    .clickable(onClick = onCopy)
                    .padding(horizontal = 14.dp, vertical = 9.dp)
                    .testTag("shareCopy"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = if (copied) PantopusIcon.Check else PantopusIcon.Copy,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(if (copied) "Copied" else "Copy", color = PantopusColors.appTextInverse, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        }
    }
}

@Composable
private fun ShareTargetsRow(
    onShare: () -> Unit,
    onQr: () -> Unit,
    onMessages: () -> Unit,
    onEmail: () -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ShareTargetButton(PantopusIcon.Share, "Share", Modifier.weight(1f), onClick = onShare)
        ShareTargetButton(PantopusIcon.QrCode, "QR code", Modifier.weight(1f), onClick = onQr)
        ShareTargetButton(PantopusIcon.MessageCircle, "Messages", Modifier.weight(1f), onClick = onMessages)
        ShareTargetButton(PantopusIcon.Mail, "Email", Modifier.weight(1f), onClick = onEmail)
    }
}

@Composable
internal fun ShareTargetButton(
    icon: PantopusIcon,
    label: String,
    modifier: Modifier = Modifier,
    maxTile: androidx.compose.ui.unit.Dp = 52.dp,
    onClick: () -> Unit,
) {
    Column(
        modifier = modifier.clickable(onClick = onClick).testTag("shareTarget_$label"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Spec: tile is width:100% capped at maxWidth (52/54) with aspectRatio 1/1,
        // centered in the column. Cap the square so it reads as a compact button.
        Box(
            modifier =
                Modifier
                    .size(maxTile)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 21.dp, tint = PantopusColors.primary600)
        }
        Text(
            label,
            color = PantopusColors.appTextStrong,
            fontWeight = FontWeight.SemiBold,
            fontSize = 10.5.sp,
            modifier = Modifier.padding(top = Spacing.s1),
        )
    }
}

@Composable
private fun QrThumbCard(
    url: String,
    onShow: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(4.dp),
        ) {
            QrCanvas(url = url, modifier = Modifier.fillMaxSize())
        }
        Column(Modifier.weight(1f)) {
            Text("Scan to book", color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
            Text(
                "Print it or show it at a desk.",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                modifier = Modifier.padding(top = 1.dp),
            )
        }
        Text(
            "Show QR",
            color = PantopusColors.primary700,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50)
                    .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.md))
                    .clickable(onClick = onShow)
                    .padding(horizontal = Spacing.s3, vertical = 7.dp)
                    .testTag("shareShowQr"),
        )
    }
}

@Composable
private fun ShareSettingsCard(
    showOnProfile: Boolean,
    addToSignature: Boolean,
    onToggleProfile: () -> Unit,
    onToggleSignature: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3),
    ) {
        BLToggleRow(
            label = "Show on my profile",
            sub = "Neighbors see a Book button on your page.",
            icon = PantopusIcon.UserRound,
            on = showOnProfile,
            onToggle = onToggleProfile,
        )
        BLToggleRow(
            label = "Add to email signature",
            sub = "Appends the link to outgoing mail.",
            icon = PantopusIcon.Mail,
            on = addToSignature,
            onToggle = onToggleSignature,
            last = true,
        )
    }
}

@Composable
private fun RegenerateButton(onClick: () -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1), contentAlignment = Alignment.Center) {
        Row(
            modifier =
                Modifier
                    .clickable(onClick = onClick)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .testTag("shareRegenerate"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.RefreshCw, contentDescription = null, size = 14.dp, tint = PantopusColors.error)
            Text("Regenerate link", color = PantopusColors.error, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
        }
    }
}

@Composable
private fun DraftBanner(onTurnOn: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 11.dp, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.TriangleAlert, contentDescription = null, size = 15.dp, tint = PantopusColors.warning)
        Column(Modifier.weight(1f)) {
            Text(
                "This page isn't live yet. People can't book until you turn it on.",
                color = PantopusColors.warning,
                fontWeight = FontWeight.SemiBold,
                fontSize = 11.5.sp,
                lineHeight = 15.sp,
            )
            Row(
                modifier = Modifier.clickable(onClick = onTurnOn).padding(top = Spacing.s1).testTag("shareTurnOn"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text("Turn on", color = PantopusColors.warning, fontWeight = FontWeight.Bold, fontSize = 11.5.sp)
                PantopusIconImage(icon = PantopusIcon.ArrowRight, contentDescription = null, size = 12.dp, tint = PantopusColors.warning)
            }
        }
    }
}

// ─── Fullscreen QR ──────────────────────────────────────────────────────────

@Composable
private fun QrFullscreenDialog(
    url: String,
    displayName: String,
    pillar: SchedulingPillar,
    onDone: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    Dialog(onDismissRequest = onDone) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl3))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s5),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Text(
                    "Done",
                    color = PantopusColors.primary600,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    modifier = Modifier.clickable(onClick = onDone).padding(Spacing.s1).testTag("qrDone"),
                )
            }
            ContextLabel(pillar)
            Box(
                modifier =
                    Modifier
                        .padding(top = Spacing.s4)
                        .clip(RoundedCornerShape(Radii.xl3))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl3))
                        .padding(Spacing.s5),
            ) {
                QrCanvas(url = url, modifier = Modifier.size(184.dp))
            }
            Text(
                displayName.ifBlank { "Your booking page" },
                color = PantopusColors.appText,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                modifier = Modifier.padding(top = Spacing.s5),
            )
            Text(
                url,
                color = PantopusColors.appTextSecondary,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.5.sp,
                modifier = Modifier.padding(top = Spacing.s1),
            )
            Text(
                "Point a camera here to open the booking page.",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.5.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = Spacing.s3),
            )
            SaveToPhotosButton(onSave = { scope.launch { saveQrToPhotos(context, url) } })
        }
    }
}

@Composable
private fun SaveToPhotosButton(onSave: () -> Unit) {
    Row(
        modifier =
            Modifier
                .padding(top = Spacing.s5)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onSave)
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .testTag("qrSaveToPhotos"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Download, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextStrong)
        Text("Save to Photos", color = PantopusColors.appTextStrong, fontWeight = FontWeight.Bold, fontSize = 13.sp)
    }
}

/** Renders the scannable QR plate to a bitmap and writes it to the device gallery (off-main). */
private suspend fun saveQrToPhotos(
    context: android.content.Context,
    url: String,
) {
    // NonCancellable: dismissing the dialog mid-save must not abandon a
    // half-written MediaStore row.
    kotlinx.coroutines.withContext(kotlinx.coroutines.NonCancellable) {
        val saved =
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                runCatching { writeQrPng(context, url) }.getOrDefault(false)
            }
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
            val message = if (saved) "Saved to Photos" else "Couldn't save the QR code"
            android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
        }
    }
}

/** Blocking render + MediaStore write; call on an IO dispatcher. Returns true on success. */
private fun writeQrPng(
    context: android.content.Context,
    url: String,
): Boolean {
    val matrix = qrMatrix(url)
    val n = matrix.width
    val px = 720
    val bitmap = android.graphics.Bitmap.createBitmap(px, px, android.graphics.Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    canvas.drawColor(android.graphics.Color.WHITE)
    val cell = px.toFloat() / n
    val paint = android.graphics.Paint().apply { color = android.graphics.Color.BLACK }
    for (r in 0 until n) {
        for (c in 0 until n) {
            if (matrix.get(c, r)) {
                canvas.drawRect(c * cell, r * cell, (c + 1) * cell, (r + 1) * cell, paint)
            }
        }
    }
    val name = "pantopus-booking-qr-${System.currentTimeMillis()}.png"
    val values =
        android.content.ContentValues().apply {
            put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, name)
            put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/png")
        }
    val resolver = context.contentResolver
    val uri = resolver.insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return false
    resolver.openOutputStream(uri)?.use { out ->
        bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out)
    } ?: return false
    return true
}

// ─── Regenerate confirm ─────────────────────────────────────────────────────

@Composable
private fun RegenerateConfirmDialog(
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    Dialog(onDismissRequest = onCancel) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl2))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s5),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier.size(44.dp).clip(CircleShape).background(PantopusColors.errorBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.RefreshCw, contentDescription = null, size = 20.dp, tint = PantopusColors.error)
            }
            Text(
                "Regenerate this link?",
                color = PantopusColors.appText,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                modifier = Modifier.padding(top = Spacing.s3),
            )
            Text(
                "The old link stops working. Anyone using it will need the new one.",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.5.sp,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp,
                modifier = Modifier.padding(top = Spacing.s2),
            )
            Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                ConfirmButton("Cancel", filled = false, modifier = Modifier.weight(1f), onClick = onCancel)
                ConfirmButton("Regenerate", filled = true, modifier = Modifier.weight(1f), onClick = onConfirm)
            }
        }
    }
}

@Composable
private fun ConfirmButton(
    label: String,
    filled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .height(42.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (filled) PantopusColors.error else PantopusColors.appSurface)
                .then(if (filled) Modifier else Modifier.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)))
                .clickable(onClick = onClick)
                .testTag("regen_$label"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (filled) PantopusColors.appTextInverse else PantopusColors.appText,
            fontWeight = FontWeight.Bold,
            fontSize = 13.5.sp,
        )
    }
}

// ─── Scannable QR ───────────────────────────────────────────────────────────

/** Quiet-zone modules around the code — the QR spec's 4-module margin. */
private const val QR_QUIET_ZONE = 4

/**
 * Encodes [url] as a real QR (ECC M, matching iOS ShareLinkSheet.swift's
 * CIFilter qrCodeGenerator) at the matrix's natural module size, quiet zone
 * included. Rendering scales the modules to the target canvas.
 */
private fun qrMatrix(url: String): com.google.zxing.common.BitMatrix {
    val hints =
        mapOf(
            com.google.zxing.EncodeHintType.ERROR_CORRECTION to
                com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.M,
            com.google.zxing.EncodeHintType.MARGIN to QR_QUIET_ZONE,
        )
    return com.google.zxing.qrcode.QRCodeWriter()
        .encode(url, com.google.zxing.BarcodeFormat.QR_CODE, 1, 1, hints)
}

/** Draws the encoded booking URL as square cells — same visual style as the mock. */
@Composable
internal fun QrCanvas(
    url: String,
    modifier: Modifier = Modifier,
    foreground: Color = PantopusColors.appText,
) {
    val matrix = remember(url) { qrMatrix(url) }
    Canvas(modifier = modifier) {
        val n = matrix.width
        val cell = size.minDimension / n
        for (r in 0 until n) {
            for (c in 0 until n) {
                if (matrix.get(c, r)) {
                    drawRect(
                        color = foreground,
                        topLeft = androidx.compose.ui.geometry.Offset(c * cell, r * cell),
                        size = androidx.compose.ui.geometry.Size(cell, cell),
                    )
                }
            }
        }
    }
}
