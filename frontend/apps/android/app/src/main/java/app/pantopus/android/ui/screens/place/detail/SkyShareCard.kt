@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import app.pantopus.android.data.api.models.place.PlaceSunriseSunsetData
import app.pantopus.android.data.api.models.place.PlaceWeatherData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.SkyPalette
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/*
 * "Share today's sky": the Now card's living sky as a picture to send, with the temperature, the
 * condition, the city and the date. Only the city, never the street or the house; no bins or
 * neighbours' lights either. Drawn when someone shares, not before. Parity twin of iOS
 * `SkyShareCard.swift`.
 */

/** What the shared picture shows. */
class SkyShareCard(
    val weather: PlaceWeatherData,
    val sun: PlaceSunriseSunsetData?,
    val air: SkyAir?,
    val city: String,
    val now: ZonedDateTime,
) {
    /** 360 × 450 dp at 3× (1080 × 1350 pixels), the sky filling it. */
    fun render(): Bitmap {
        val scale = 3f
        val bitmap = ImageBitmap((WIDTH * scale).toInt(), (HEIGHT * scale).toInt())
        val moment = SkyMoment.at(now, sun?.sunrise, sun?.sunset)
        val painter =
            TodaySkyPainter(
                condition = weather.conditionCode,
                moment = moment,
                temperature = weather.currentTempF,
                note = null,
                season = SkySeason.at(now.toLocalDate()),
                still = true,
                details = SkyDetails(meteorShower = SkyNote.meteors(now, moment) != null, smoke = air?.smoke ?: 0.0),
            )
        val canvas = Canvas(bitmap)
        CanvasDrawScope().draw(Density(scale), LayoutDirection.Ltr, canvas, Size(WIDTH * scale, HEIGHT * scale)) {
            withTransform({ scale(scale, scale, pivot = Offset.Zero) }) {
                painter.paint(this, WIDTH, HEIGHT, 0.0)
            }
        }
        drawText(canvas.nativeCanvas, scale, kicker(moment))
        return bitmap.asAndroidBitmap()
    }

    /** A sky note when there is one worth sharing (not the household's pickup day), otherwise "TODAY". */
    private fun kicker(moment: SkyMoment): String = SkyNote.pick(now, moment, weather, emptyList(), air)?.kicker ?: "TODAY"

    private fun drawText(
        canvas: android.graphics.Canvas,
        scale: Float,
        kicker: String,
    ) {
        val white = SkyPalette.white.toArgb()
        val shadow = SkyPalette.black.copy(alpha = 0.35f).toArgb()

        fun paint(
            size: Float,
            weight: Int,
        ) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = white
            textSize = size * scale
            typeface = Typeface.create(Typeface.SANS_SERIF, weight, false)
            setShadowLayer(4 * scale, 0f, scale, shadow)
        }
        val left = 26 * scale
        // The kicker on the chips' dark glass.
        val kickerPaint = paint(17f, 700).apply { letterSpacing = 0.06f }
        val kickerWidth = kickerPaint.measureText(kicker)
        val glass = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = SkyPalette.scrim.copy(alpha = 0.45f).toArgb() }
        canvas.drawRoundRect(left - 10 * scale, 26 * scale, left + kickerWidth + 10 * scale, 54 * scale, 14 * scale, 14 * scale, glass)
        canvas.drawText(kicker, left, 46 * scale, kickerPaint)
        canvas.drawText("${weather.currentTempF.roundToInt()}°", left - 4 * scale, 160 * scale, paint(112f, 300))
        if (weather.conditionLabel.isNotEmpty()) canvas.drawText(weather.conditionLabel, left, 196 * scale, paint(26f, 600))
        val date = now.format(DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.getDefault()))
        canvas.drawText("$city · $date", left, (HEIGHT - 44) * scale, paint(17f, 600))
        canvas.drawText("Pantopus", left, (HEIGHT - 24) * scale, paint(13f, 700).apply { alpha = 217 })
    }

    /** Writes the picture to the app's cache and opens the share sheet. */
    suspend fun share(context: Context) {
        val file =
            withContext(Dispatchers.Default) {
                val dir = File(context.cacheDir, "share").apply { mkdirs() }
                File(dir, "todays-sky.png").also { out -> out.outputStream().use { render().compress(Bitmap.CompressFormat.PNG, 100, it) } }
            }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val send =
            Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        context.startActivity(Intent.createChooser(send, "Share today's sky"))
    }

    private companion object {
        const val WIDTH = 360f
        const val HEIGHT = 450f
    }
}

/** The Weather section's trailing link: shares the sky as a picture. */
@Composable
fun SkyShareLink(card: SkyShareCard) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    Row(
        modifier =
            Modifier
                .heightIn(min = 48.dp)
                .clickable { scope.launch { card.share(context) } }
                .semantics {
                    contentDescription = "Share today's sky"
                    role = Role.Button
                }.testTag("todaySkyShare"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PantopusIconImage(PantopusIcon.Share, null, size = 13.dp, strokeWidth = 2.2f, tint = PantopusColors.primary600)
        Text("Share", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
    }
}
