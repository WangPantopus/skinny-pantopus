@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.drawable.BitmapDrawable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import app.pantopus.android.BuildConfig
import app.pantopus.android.R
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardArt
import app.pantopus.android.ui.screens.mailbox.components.MailStamp
import app.pantopus.android.ui.theme.PantopusColors
import coil.imageLoader
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.request.SuccessResult
import coil.size.Size
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import java.lang.ref.SoftReference
import kotlin.math.min

/**
 * The table's art (launch key `card_table`), final as the design has it, from `res/drawable-nodpi`: the envelope's
 * layers, the wax seal whole and broken, the shared grey cloth, the window's light and the film grain. Read together,
 * away from the main thread, before the envelope arrives. Kept softly, so opening a second card is at once and the
 * phone can have the memory back when it needs it.
 */
internal class CardTableArt private constructor(
    val front: Bitmap,
    val pocket: Bitmap,
    val inside: Bitmap,
    val flapOut: Bitmap,
    val flapIn: Bitmap,
    val flapGold: Bitmap,
    val pocketShadow: Bitmap,
    val flapShadow: Bitmap,
    val wax: Bitmap,
    val waxCracked: Bitmap,
    val postmark: Bitmap,
    val light: Bitmap,
    val grain: Bitmap,
    val cloth: Bitmap,
    val stamps: Map<MailStamp, Bitmap>,
    /** The Christmas with Jesus Christ stamp (plan Part 7). */
    val star: Bitmap,
) {
    companion object {
        private var kept = SoftReference<CardTableArt>(null)

        suspend fun load(context: Context): CardTableArt {
            synchronized(this) { kept.get() }?.let { return it }
            val resources = context.applicationContext.resources
            val art =
                withContext(Dispatchers.IO) {
                    coroutineScope {
                        val ids =
                            listOf(
                                R.drawable.card_table_env_front,
                                R.drawable.card_table_env_pocket,
                                R.drawable.card_table_env_inside,
                                R.drawable.card_table_flap_out,
                                R.drawable.card_table_flap_in,
                                R.drawable.card_table_flap_gold,
                                R.drawable.card_table_pocket_shadow,
                                R.drawable.card_table_flap_shadow,
                                R.drawable.card_table_wax,
                                R.drawable.card_table_wax_cracked,
                                R.drawable.card_table_postmark,
                                R.drawable.card_table_light,
                                R.drawable.card_table_grain,
                                R.drawable.card_table_cloth,
                                R.drawable.card_table_stamp_fir,
                                R.drawable.card_table_stamp_peak,
                                R.drawable.card_table_stamp_river,
                                R.drawable.card_table_stamp_star,
                            )
                        val read =
                            ids
                                .map { id ->
                                    async {
                                        BitmapFactory.decodeResource(resources, id).also { it.prepareToDraw() }
                                    }
                                }.awaitAll()
                        CardTableArt(
                            front = read[0],
                            pocket = read[1],
                            inside = read[2],
                            flapOut = read[3],
                            flapIn = read[4],
                            flapGold = read[5],
                            pocketShadow = read[6],
                            flapShadow = read[7],
                            wax = read[8],
                            waxCracked = read[9],
                            postmark = read[10],
                            light = read[11],
                            grain = read[12],
                            cloth = read[13],
                            stamps = mapOf(MailStamp.Fir to read[14], MailStamp.Peak to read[15], MailStamp.River to read[16]),
                            star = read[17],
                        )
                    }
                }
            synchronized(this) { kept = SoftReference(art) }
            return art
        }

        private var keptLetter = SoftReference<CardTableArt>(null)

        /** A letter's set (plan Part 10): the same envelope made in cream with the red seal; the rest is the card's. */
        suspend fun loadLetter(context: Context): CardTableArt {
            synchronized(this) { keptLetter.get() }?.let { return it }
            val base = load(context)
            val resources = context.applicationContext.resources
            val read =
                withContext(Dispatchers.IO) {
                    coroutineScope {
                        listOf(
                            R.drawable.card_table_cream_env_front,
                            R.drawable.card_table_cream_env_pocket,
                            R.drawable.card_table_cream_env_inside,
                            R.drawable.card_table_cream_flap_out,
                            R.drawable.card_table_cream_flap_in,
                            R.drawable.card_table_wax_red,
                            R.drawable.card_table_wax_red_cracked,
                        ).map { id -> async { BitmapFactory.decodeResource(resources, id).also { it.prepareToDraw() } } }
                            .awaitAll()
                    }
                }
            val art =
                CardTableArt(
                    front = read[0],
                    pocket = read[1],
                    inside = read[2],
                    flapOut = read[3],
                    flapIn = read[4],
                    flapGold = base.flapGold,
                    pocketShadow = base.pocketShadow,
                    flapShadow = base.flapShadow,
                    wax = read[5],
                    waxCracked = read[6],
                    postmark = base.postmark,
                    light = base.light,
                    grain = base.grain,
                    cloth = base.cloth,
                    stamps = base.stamps,
                    star = base.star,
                )
            synchronized(this) { keptLetter = SoftReference(art) }
            return art
        }
    }
}

/** The table's art once it's read; null until then, and only the table's colour shows. */
@Composable
internal fun rememberCardTableArt(letter: Boolean = false): CardTableArt? {
    val context = LocalContext.current
    val art by produceState(initialValue = null as CardTableArt?, context, letter) {
        value = if (letter) CardTableArt.loadLetter(context) else CardTableArt.load(context)
    }
    return art
}

/** Where a card's picture stands: on its way, here, or not coming for now (it keeps trying while the screen shows). */
internal sealed interface CardPictureState {
    data object Loading : CardPictureState

    data class Loaded(
        val picture: CardPicture,
    ) : CardPictureState

    data object Failed : CardPictureState
}

/** A card's picture for the table and the pictures it shares; a sealed card's picture is never asked for. */
@Composable
internal fun rememberCardPicture(
    design: String,
    wanted: Boolean = true,
): CardPictureState {
    val context = LocalContext.current
    val state by produceState<CardPictureState>(CardPictureState.Loading, design, wanted) {
        if (!wanted) return@produceState
        value = CardPictureState.Loading
        var tries = 0
        while (isActive) {
            val picture = CardPictures.read(context, design, useOlderCopy = tries >= NEW_COPY_TRIES && tries % 2 == 1)
            if (picture != null) {
                value = CardPictureState.Loaded(picture)
                return@produceState
            }
            tries += 1
            if (tries >= NEW_COPY_TRIES + 1) value = CardPictureState.Failed
            delay(min(400L * tries, 6_000L))
        }
    }
    return state
}

private const val NEW_COPY_TRIES = 3

/** The trimmed copies the website keeps for the table, or today's copy with its baked border left out. */
internal object CardPictures {
    /** Baked border on an older copy, about 2% of its width. */
    private const val OLDER_COPY_INSET = 0.022f

    private val designId = Regex("^[a-z0-9-]{1,64}$")

    /** `{web}/holiday-cards/card/<id>.jpg`, kept on the phone once loaded. */
    private fun trimmedUrl(design: String): String? =
        if (designId.matches(design)) {
            BuildConfig.PANTOPUS_WEB_BASE_URL.trimEnd('/') + "/holiday-cards/card/$design.jpg"
        } else {
            null
        }

    suspend fun read(
        context: Context,
        design: String,
        useOlderCopy: Boolean,
    ): CardPicture? {
        val data = if (useOlderCopy) HolidayCardArt.olderCopy(design) else trimmedUrl(design)
        data ?: return null
        val request =
            ImageRequest
                .Builder(context)
                .data(data)
                .size(Size.ORIGINAL)
                // Drawn on a plain canvas too, when a picture is shared.
                .allowHardware(false)
                .diskCachePolicy(CachePolicy.ENABLED)
                .build()
        val result = context.imageLoader.execute(request) as? SuccessResult ?: return null
        val bitmap = (result.drawable as? BitmapDrawable)?.bitmap ?: return null
        return CardPicture(bitmap, inset = if (useOlderCopy) OLDER_COPY_INSET else 0f)
    }
}

/**
 * A soft shadow drawn once, small, and stretched as it moves (the same way the art's own shadows are). Its [bitmap]
 * covers the box plus [pad] on every side, in the box's own pixels.
 */
internal class SoftShadow(
    val bitmap: Bitmap,
    val pad: Float,
) {
    companion object {
        /** A black box with a CSS-style box shadow around it: [blur] and [spread] in pixels, the shadow at [alpha]. */
        fun of(
            width: Float,
            height: Float,
            blur: Float,
            spread: Float,
            alpha: Float,
        ): SoftShadow {
            val scale = 0.25f
            val pad = spread + blur * 1.5f
            val bitmap =
                Bitmap.createBitmap(
                    ((width + pad * 2f) * scale).toInt().coerceAtLeast(1),
                    ((height + pad * 2f) * scale).toInt().coerceAtLeast(1),
                    Bitmap.Config.ARGB_8888,
                )
            val canvas = Canvas(bitmap)
            canvas.scale(scale, scale)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG)
            paint.color = Color.Black.copy(alpha = alpha).toArgb()
            // A CSS blur radius is twice its sigma; Android's mask radius makes a sigma of .57735 times itself, plus .5.
            val radius = ((blur / 2f - 0.5f) / 0.57735f).coerceAtLeast(0.1f)
            paint.maskFilter = BlurMaskFilter(radius, BlurMaskFilter.Blur.NORMAL)
            canvas.drawRect(RectF(pad - spread, pad - spread, pad + width + spread, pad + height + spread), paint)
            paint.maskFilter = null
            paint.color = Color.Black.toArgb()
            canvas.drawRect(RectF(pad, pad, pad + width, pad + height), paint)
            return SoftShadow(bitmap, pad)
        }
    }
}

/**
 * The colour a table's grey cloth is multiplied by, from the picture's `table` colour (the shared cloth's own formula):
 * the table is the picture's colour, a little richer, brought to the cloth's own darkness.
 */
internal fun clothTint(table: String?): Color {
    val named =
        table
            ?.takeIf { it.length == 7 && it.startsWith("#") }
            ?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() }
            ?: PantopusColors.tableSlate
    val lum = 0.299f * named.red + 0.587f * named.green + 0.114f * named.blue
    val gain = 0.135f / lum.coerceAtLeast(0.01f) * 1.7f

    fun channel(value: Float) = ((lum + (value - lum) * 1.12f) * gain).coerceIn(0f, 1f)
    return Color(channel(named.red), channel(named.green), channel(named.blue))
}
