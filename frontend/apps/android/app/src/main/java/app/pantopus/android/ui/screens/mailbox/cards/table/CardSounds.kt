package app.pantopus.android.ui.screens.mailbox.cards.table

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.SoundPool
import android.os.SystemClock
import androidx.annotation.RawRes
import app.pantopus.android.R
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.abs

/** The three quiet paper sounds on the card table (plan 8.3): the card sliding, the seal pressed or broken, set down. */
internal enum class TableSound(
    @RawRes val res: Int,
) {
    Slide(R.raw.card_table_card_slide),
    Seal(R.raw.card_table_seal),
    Down(R.raw.card_table_card_down),
}

/** Whether the card sounds are on, kept on this phone only (default on): "Card sounds" in the Mailbox's menu. */
internal object CardSoundsSetting {
    private const val FILE = "card_table"
    private const val KEY = "sounds"

    fun isOn(context: Context): Boolean = prefs(context).getBoolean(KEY, true)

    fun set(
        context: Context,
        on: Boolean,
    ) {
        prefs(context).edit().putBoolean(KEY, on).apply()
    }

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)
}

/**
 * Plays them low, only while the ringer is on (not on vibrate or silent) and the switch is on, each at most once in
 * 350 ms. Loaded ahead, so the first one isn't late; one that hasn't loaded yet is skipped, never queued.
 */
internal class CardSounds(
    context: Context,
) {
    private val app = context.applicationContext
    private val audio = app.getSystemService(AudioManager::class.java)
    private val pool =
        SoundPool
            .Builder()
            .setMaxStreams(TableSound.entries.size)
            .setAudioAttributes(
                AudioAttributes
                    .Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            ).build()
    private val loaded = ConcurrentHashMap.newKeySet<Int>()
    private val ids: Map<TableSound, Int>
    private val lastMs = LongArray(TableSound.entries.size) { -GAP_MS }

    init {
        pool.setOnLoadCompleteListener { _, id, status -> if (status == 0) loaded += id }
        ids = TableSound.entries.associateWith { pool.load(app, it.res, 1) }
    }

    fun play(sound: TableSound) {
        if (!CardSoundsSetting.isOn(app) || audio?.ringerMode != AudioManager.RINGER_MODE_NORMAL) return
        val now = SystemClock.uptimeMillis()
        if (now - lastMs[sound.ordinal] < GAP_MS) return
        lastMs[sound.ordinal] = now
        val id = ids[sound]?.takeIf { it in loaded } ?: return
        pool.play(id, VOLUME, VOLUME, 1, 0, 1f)
    }

    fun release() {
        pool.release()
    }

    private companion object {
        const val GAP_MS = 350L
        const val VOLUME = 0.85f
    }
}

/**
 * When the card's moves make a sound, read once a frame: it slides past the envelope's mouth (out, or back in) and it's
 * set down on the table. [out] is how far it is out of its envelope (0 in, 1 clear), [lay] how far it's laid down. The
 * first reading only sets where it is, and a jump (animations off, or opening straight onto the table) isn't a slide.
 */
internal class TableSoundCues(
    private val emit: (TableSound) -> Unit,
) {
    private var out = -1f
    private var lay = -1f

    fun reset() {
        out = -1f
        lay = -1f
    }

    fun listen(
        out: Float,
        lay: Float,
    ) {
        val wasOut = this.out
        val wasLay = this.lay
        this.out = out
        this.lay = lay
        if (wasOut < 0f) return
        val sliding = abs(out - wasOut) < JUMP
        val comingOut = wasOut < MOUTH && out >= MOUTH
        val goingIn = wasOut > 1f - MOUTH && out <= 1f - MOUTH
        if (sliding && (comingOut || goingIn)) emit(TableSound.Slide)
        if (wasLay < SET_DOWN && lay >= SET_DOWN) emit(TableSound.Down)
    }

    private companion object {
        const val MOUTH = 0.08f
        const val SET_DOWN = 0.9f
        const val JUMP = 0.5f
    }
}
