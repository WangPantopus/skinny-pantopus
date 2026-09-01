@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.add_home

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

/**
 * A12.2 — the Add-Home wizard's Wi-Fi QR scanner. Ports RN's
 * `src/components/homes/QrScannerModal.tsx`: a full-screen camera with a
 * hint strip that autofills the network name + password from a `WIFI:`
 * barcode, plus a "Scan again" affordance after a rejected code.
 *
 * Decoding runs fully on-device (ML Kit's bundled barcode model) and only
 * QR symbologies are requested, matching RN's
 * `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`.
 *
 * @param onScanned Receives the raw payload; returns true when it parsed
 *     as a Wi-Fi QR and was applied to the target row.
 */
@Composable
internal fun WifiQrScannerDialog(
    onScanned: (String) -> Boolean,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    // True after a scan has been consumed, so a code sitting in frame
    // can't fire repeatedly. Mirrors RN's `scannerLocked`.
    var isLocked by remember { mutableStateOf(false) }
    var invalidCodeMessage by remember { mutableStateOf<String?>(null) }

    val permissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            hasCameraPermission = granted
        }
    LaunchedEffect(Unit) {
        if (!hasCameraPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag("addHomeWifiQrScanner"),
        ) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(
                    onClick = onClose,
                    modifier = Modifier.testTag("addHome_closeScanner"),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = "Close scanner",
                        tint = PantopusColors.appText,
                    )
                }
                Text(
                    text = "Scan WiFi QR",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
                // Balances the leading icon so the title stays centred.
                Spacer(modifier = Modifier.size(Spacing.s10 + Spacing.s2))
            }

            Box(
                modifier = Modifier.weight(1f).fillMaxWidth().background(Color.Black),
            ) {
                if (hasCameraPermission) {
                    QrCameraPreview(isPaused = isLocked) { payload ->
                        if (!isLocked) {
                            isLocked = true
                            invalidCodeMessage =
                                if (onScanned(payload)) {
                                    null
                                } else {
                                    // RN's alert copy (`useHomeForm.ts:221`).
                                    "Invalid QR code — this does not look like a WiFi QR code."
                                }
                        }
                    }
                } else {
                    Column(
                        modifier = Modifier.fillMaxSize().padding(Spacing.s5),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Camera,
                            contentDescription = null,
                            tint = PantopusColors.appTextInverse,
                        )
                        Text(
                            text =
                                "Camera access is off — allow it to scan a WiFi QR code, or " +
                                    "enter the network name and password manually.",
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextInverse,
                            textAlign = TextAlign.Center,
                        )
                    }
                }

                Column(
                    modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    Text(
                        text =
                            invalidCodeMessage
                                ?: "Point your camera at a WiFi QR code to autofill network " +
                                "name and password.",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextInverse,
                        textAlign = TextAlign.Center,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .background(Color.Black.copy(alpha = SCRIM_ALPHA))
                                .padding(Spacing.s3)
                                .testTag("addHome_scannerHint"),
                    )
                    if (isLocked) {
                        Button(
                            onClick = {
                                invalidCodeMessage = null
                                isLocked = false
                            },
                            colors =
                                ButtonDefaults.buttonColors(
                                    containerColor = PantopusColors.primary600,
                                    contentColor = PantopusColors.appTextInverse,
                                ),
                            modifier =
                                Modifier
                                    .padding(bottom = Spacing.s5)
                                    .testTag("addHome_scanAgain"),
                        ) {
                            Text(text = "Scan again", style = PantopusTextStyle.body)
                        }
                    }
                }
            }
        }
    }
}

private const val SCRIM_ALPHA = 0.55f

/**
 * CameraX preview + `ImageAnalysis` pipeline that hands frames to ML
 * Kit's QR-only barcode scanner.
 */
@OptIn(ExperimentalGetImage::class)
@Composable
private fun QrCameraPreview(
    isPaused: Boolean,
    onPayload: (String) -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val analysisExecutor = remember { Executors.newSingleThreadExecutor() }
    val scanner =
        remember {
            BarcodeScanning.getClient(
                BarcodeScannerOptions
                    .Builder()
                    .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                    .build(),
            )
        }

    DisposableEffect(Unit) {
        onDispose {
            analysisExecutor.shutdown()
            scanner.close()
        }
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { viewContext ->
            val previewView = PreviewView(viewContext)
            val providerFuture = ProcessCameraProvider.getInstance(viewContext)
            providerFuture.addListener({
                val provider = providerFuture.get()
                val preview =
                    Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                val analysis =
                    ImageAnalysis
                        .Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                analysis.setAnalyzer(analysisExecutor) { proxy ->
                    val mediaImage = proxy.image
                    if (mediaImage == null) {
                        proxy.close()
                        return@setAnalyzer
                    }
                    val input =
                        InputImage.fromMediaImage(mediaImage, proxy.imageInfo.rotationDegrees)
                    scanner
                        .process(input)
                        .addOnSuccessListener { barcodes ->
                            barcodes.firstNotNullOfOrNull { it.rawValue }?.let(onPayload)
                        }.addOnCompleteListener { proxy.close() }
                }
                runCatching {
                    provider.unbindAll()
                    provider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        analysis,
                    )
                }
            }, ContextCompat.getMainExecutor(viewContext))
            previewView
        },
        update = {
            // `isPaused` is read so recomposition after a lock still
            // re-runs this block; the lock itself is enforced by the
            // caller before it consumes a payload.
            it.tag = isPaused
        },
    )
}
