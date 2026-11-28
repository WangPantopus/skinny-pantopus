@file:Suppress("MagicNumber")

package app.pantopus.android.data.moments.sound

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.MediaRecorder
import java.io.File
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/*
 * "Pulse, reinvented" phase 2, sound on the phone (PHASE-2 piece 10; CONTRACT 7e). The microphone is read as plain
 * samples with the system's own `AudioRecord`, kept on the phone, and written as AAC in an .m4a with the system's own
 * encoder: no service, no key. "Clean the wind" makes a copy with the wind's low rumble taken down (a high-pass filter at
 * 150 Hz and the low end 6 dB lower from 320 Hz), as the iPhone's cleaner does; the samples as heard stay until the
 * Moment is posted, so a second tap puts them back.
 */

/** Samples as recorded: 16-bit mono at [rate]. */
class MomentSoundSamples(
    val pcm: ShortArray,
    val rate: Int,
) {
    val durationMs: Long get() = pcm.size * 1_000L / rate
}

/** Reads the microphone into memory, up to [maxMs]; one recording at a time. */
class MomentSoundRecorder(
    private val maxMs: Long,
) {
    @Volatile private var stopped = false

    /** The samples heard until [stop] or [maxMs], or null when the microphone couldn't be opened. Blocking: call off the main thread. */
    @SuppressLint("MissingPermission") // The Studio asks for the microphone before it records.
    @Suppress("ReturnCount")
    fun record(onElapsed: (Long) -> Unit): MomentSoundSamples? {
        val min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        if (min <= 0) return null
        val recorder =
            runCatching {
                AudioRecord(MediaRecorder.AudioSource.MIC, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, min * 2)
            }.getOrNull() ?: return null
        if (recorder.state != AudioRecord.STATE_INITIALIZED) {
            recorder.release()
            return null
        }
        val most = (RATE * maxMs / 1_000L).toInt()
        val out = ShortArray(most)
        var read = 0
        val chunk = ShortArray(min / 2)
        try {
            recorder.startRecording()
            while (!stopped && read < most) {
                val n = recorder.read(chunk, 0, minOf(chunk.size, most - read))
                if (n < 0) break
                System.arraycopy(chunk, 0, out, read, n)
                read += n
                onElapsed(read * 1_000L / RATE)
            }
        } catch (_: IllegalStateException) {
            return null
        } finally {
            runCatching { recorder.stop() }
            recorder.release()
        }
        return if (read == 0) null else MomentSoundSamples(out.copyOf(read), RATE)
    }

    fun stop() {
        stopped = true
    }

    companion object {
        const val RATE = 44_100
    }
}

/** "Clean the wind": the same samples with the wind's rumble taken down (two biquads: high-pass, then a low shelf). */
object MomentSoundCleaner {
    fun clean(samples: MomentSoundSamples): MomentSoundSamples {
        val rate = samples.rate.toDouble()
        val highPass = Biquad.highPass(150.0, rate)
        val lowShelf = Biquad.lowShelf(320.0, -6.0, rate)
        val out = ShortArray(samples.pcm.size)
        for (i in samples.pcm.indices) {
            val y = lowShelf.next(highPass.next(samples.pcm[i].toDouble()))
            out[i] = y.roundToInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
        return MomentSoundSamples(out, samples.rate)
    }

    /** One second-order filter (the Audio EQ Cookbook's forms), run sample by sample. */
    private class Biquad(
        private val b0: Double,
        private val b1: Double,
        private val b2: Double,
        private val a1: Double,
        private val a2: Double,
    ) {
        private var x1 = 0.0
        private var x2 = 0.0
        private var y1 = 0.0
        private var y2 = 0.0

        fun next(x: Double): Double {
            val y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2 = x1
            x1 = x
            y2 = y1
            y1 = y
            return y
        }

        companion object {
            private const val Q = 0.7071

            fun highPass(
                frequency: Double,
                rate: Double,
            ): Biquad {
                val w = 2 * PI * frequency / rate
                val alpha = sin(w) / (2 * Q)
                val a0 = 1 + alpha
                return Biquad(
                    b0 = (1 + cos(w)) / 2 / a0,
                    b1 = -(1 + cos(w)) / a0,
                    b2 = (1 + cos(w)) / 2 / a0,
                    a1 = -2 * cos(w) / a0,
                    a2 = (1 - alpha) / a0,
                )
            }

            fun lowShelf(
                frequency: Double,
                gainDb: Double,
                rate: Double,
            ): Biquad {
                val a = 10.0.pow(gainDb / 40)
                val w = 2 * PI * frequency / rate
                val alpha = sin(w) / (2 * Q)
                val root = 2 * sqrt(a) * alpha
                val a0 = (a + 1) + (a - 1) * cos(w) + root
                return Biquad(
                    b0 = a * ((a + 1) - (a - 1) * cos(w) + root) / a0,
                    b1 = 2 * a * ((a - 1) - (a + 1) * cos(w)) / a0,
                    b2 = a * ((a + 1) - (a - 1) * cos(w) - root) / a0,
                    a1 = -2 * ((a - 1) + (a + 1) * cos(w)) / a0,
                    a2 = ((a + 1) + (a - 1) * cos(w) - root) / a0,
                )
            }
        }
    }
}

/** Writes samples as AAC-LC in an .m4a (`audio/mp4`, what the server takes), with the system's own encoder. */
object MomentSoundEncoder {
    private const val MIME = MediaFormat.MIMETYPE_AUDIO_AAC
    private const val BIT_RATE = 96_000
    private const val WAIT_US = 10_000L

    /** True when [out] holds the whole sound; false (and no file) when the phone couldn't encode it. */
    @Suppress("LongMethod", "CyclomaticComplexMethod", "NestedBlockDepth")
    fun write(
        samples: MomentSoundSamples,
        out: File,
    ): Boolean {
        val format =
            MediaFormat.createAudioFormat(MIME, samples.rate, 1).apply {
                setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
                setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
                setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16_384)
            }
        val codec = runCatching { MediaCodec.createEncoderByType(MIME) }.getOrNull() ?: return false
        var muxer: MediaMuxer? = null
        var ok = false
        try {
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            codec.start()
            muxer = MediaMuxer(out.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            val info = MediaCodec.BufferInfo()
            var track = -1
            var fed = 0
            var inputDone = false
            var outputDone = false
            while (!outputDone) {
                if (!inputDone) {
                    val index = codec.dequeueInputBuffer(WAIT_US)
                    if (index >= 0) {
                        val buffer = codec.getInputBuffer(index) ?: error("no input buffer")
                        buffer.clear()
                        buffer.order(ByteOrder.nativeOrder())
                        val count = minOf(buffer.remaining() / 2, samples.pcm.size - fed)
                        buffer.asShortBuffer().put(samples.pcm, fed, count)
                        val atUs = fed * 1_000_000L / samples.rate
                        fed += count
                        inputDone = fed >= samples.pcm.size
                        val flags = if (inputDone) MediaCodec.BUFFER_FLAG_END_OF_STREAM else 0
                        codec.queueInputBuffer(index, 0, count * 2, atUs, flags)
                    }
                }
                val index = codec.dequeueOutputBuffer(info, WAIT_US)
                when {
                    index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        track = muxer.addTrack(codec.outputFormat)
                        muxer.start()
                    }
                    index >= 0 -> {
                        val buffer = codec.getOutputBuffer(index) ?: error("no output buffer")
                        val config = info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
                        if (!config && info.size > 0 && track >= 0) {
                            buffer.position(info.offset)
                            buffer.limit(info.offset + info.size)
                            muxer.writeSampleData(track, buffer, info)
                        }
                        codec.releaseOutputBuffer(index, false)
                        outputDone = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                    }
                }
            }
            ok = track >= 0
        } catch (_: Exception) {
            ok = false
        } finally {
            runCatching { codec.stop() }
            codec.release()
            runCatching { muxer?.stop() }
            runCatching { muxer?.release() }
            if (!ok) out.delete()
        }
        return ok
    }
}
