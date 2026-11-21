@file:Suppress("TooGenericExceptionCaught")

package app.pantopus.android.ui.screens.moments.compose.marks

import android.content.Context
import android.graphics.Bitmap
import app.pantopus.android.data.moments.MomentMarksFlatten
import app.pantopus.android.data.moments.MomentMedia
import app.pantopus.android.data.moments.MomentMediaFile
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * What Text and Draw keep for the photo on the Post sheet, held by the composer's view model (the phone can turn): the
 * photo as it came, which marks are always drawn on afresh; the editor's copy of it; and the work of drawing the marks
 * into the file that posts. Post waits for that work ([awaitDrawn]), so what uploads carries the marks.
 */
internal class MomentMarksKeeper(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    /** The photo as taken or picked, while the sheet shows a copy with marks drawn in; null otherwise. */
    private var original: File? = null

    /** The marks drawn into the photo on the sheet, and where Resize placed it: what a failed drawing goes back to. */
    private var drawnMarks = MomentMarks()
    private var drawnPlacement: MomentPlacement? = null

    private val _picture = MutableStateFlow<Bitmap?>(null)

    /** The editor's copy of the photo (upright, 2048 px at most on its long side), once read. */
    val picture: StateFlow<Bitmap?> = _picture.asStateFlow()

    private var pictureOf: File? = null
    private var reading: Job? = null
    private var drawing: Job? = null
    private var drawnOk = true

    /** The ink, line width and label style picked last, for the editor's next visit. */
    private var ink = MomentInk.Yellow
    private var width = MomentLineWidth.Medium
    private var textInk = MomentInk.White
    private var style = MomentLabelStyle.Label

    /** The marks are still being drawn into the photo: Post waits. */
    val busy: Boolean get() = drawing?.isActive == true

    /** The editor opening with [tool] on [marks] and [placement], with what was picked last; Text adds a label to type. */
    fun editing(
        tool: MomentMarksTool,
        marks: MomentMarks,
        placement: MomentPlacement?,
    ): MomentMarksEditing =
        MomentMarksEditing(
            tool,
            marks,
            marks,
            ink,
            width,
            textInk,
            style,
            addsLabel = tool == MomentMarksTool.Text,
            placement = placement,
            placementAtOpen = placement,
        )

    /** The editor closed (Done or the X): its ink, width and style stay picked. */
    fun closed(editing: MomentMarksEditing) {
        ink = editing.ink
        width = editing.width
        textInk = editing.textInk
        style = editing.style
    }

    /**
     * Reads the editor's copy of what's on the sheet: the photo (its original when marks are drawn into it), or a
     * video's first frame, which gives the editor the video's shape and shows until it plays.
     */
    fun read(
        shown: MomentMediaFile,
        onUnreadable: () -> Unit,
    ) {
        val video = shown is MomentMediaFile.Video
        val source = if (video) shown.file else original ?: shown.file
        if (pictureOf == source) return
        reading?.cancel()
        pictureOf = source
        _picture.value = null
        reading =
            scope.launch {
                val read =
                    withContext(Dispatchers.Default) {
                        if (video) MomentMedia.videoStill(source) else MomentMarksFlatten.picture(source)
                    }
                if (read != null) {
                    _picture.value = read
                } else {
                    pictureOf = null
                    onUnreadable()
                }
            }
    }

    /**
     * Done: [marks] drawn into a new copy of the photo [shown] on the sheet, on the canvas at [placement] when Resize
     * placed it. [onDrawn] gets the file that now posts (the photo as it came when there are no marks and it's as
     * taken), and the copy it replaces goes; [onFailed] gets the marks and placement still drawn in.
     */
    fun draw(
        marks: MomentMarks,
        placement: MomentPlacement?,
        shown: File,
        onDrawn: (File) -> Unit,
        onFailed: (MomentMarks, MomentPlacement?) -> Unit,
    ) {
        val source = original ?: shown
        drawing?.cancel()
        drawing =
            scope.launch {
                var made: File? = null
                val file =
                    try {
                        if (marks.isEmpty && placement == null) source else drawn(source, marks, placement) { made = it }
                    } catch (cancelled: CancellationException) {
                        made?.delete()
                        throw cancelled
                    } catch (failure: Exception) {
                        timber.log.Timber.tag("Moments").w(failure, "couldn't draw the marks in")
                        made?.delete()
                        drawnOk = false
                        onFailed(drawnMarks, drawnPlacement)
                        return@launch
                    }
                if (shown != source && shown != file) shown.delete()
                original = source.takeIf { file != source }
                drawnMarks = marks
                drawnPlacement = placement
                drawnOk = true
                onDrawn(file)
            }
    }

    private suspend fun drawn(
        source: File,
        marks: MomentMarks,
        placement: MomentPlacement?,
        made: (File) -> Unit,
    ): File {
        reading?.join()
        val picture =
            _picture.value?.takeIf { pictureOf == source }
                ?: withContext(Dispatchers.Default) { MomentMarksFlatten.picture(source) }
                ?: error("Couldn't read the photo.")
        return withContext(Dispatchers.Default) { MomentMarksFlatten.flatten(context, picture, marks, placement).also(made) }
    }

    /** Post waiting for the marks to be drawn in: false when that failed or was called off (Retake, closing). */
    suspend fun awaitDrawn(): Boolean {
        val job = drawing ?: return drawnOk
        job.join()
        return !job.isCancelled && drawnOk
    }

    /**
     * Retake, the next picture, closing, or the photo handed to its upload: nothing kept here stays on the phone. The
     * photo on the sheet is never deleted here.
     */
    fun drop() {
        reading?.cancel()
        reading = null
        drawing?.cancel()
        drawing = null
        original?.let { runCatching { it.delete() } }
        original = null
        _picture.value = null
        pictureOf = null
        drawnMarks = MomentMarks()
        drawnPlacement = null
        drawnOk = true
    }
}
