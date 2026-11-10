@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.rememberReduceMotion

/**
 * "Read the verse" (plan 6.2): a cream bookmark with a red ribbon slides up over the table, with the whole verse printed
 * on a Christmas with Jesus Christ picture in the serif at 19 and its reference under it. A tap on the dimmed table,
 * Close or Back puts it away; a screen reader hears it as its own pane.
 */
@Composable
internal fun VerseBookmark(
    card: CardOnTable,
    bottom: Dp,
    onClose: () -> Unit,
) {
    val verse = card.verse ?: return
    val reduceMotion = rememberReduceMotion()
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val shade by animateFloatAsState(if (shown) 1f else 0f, tween(if (reduceMotion) 250 else 300), label = "verseShade")
    val rise by animateFloatAsState(
        if (shown || reduceMotion) 0f else 1f,
        tween(380, easing = CubicBezierEasing(0.2f, 0.8f, 0.2f, 1f)),
        label = "verseRise",
    )
    BoxWithConstraints(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .graphicsLayer { alpha = shade }
                    .background(PantopusColors.tableSheetScrim)
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClose)
                    .clearAndSetSemantics {},
        )
        Box(
            modifier =
                Modifier
                    .padding(horizontal = 10.dp)
                    .widthIn(max = 520.dp)
                    .fillMaxWidth()
                    .heightIn(max = maxHeight * 0.82f)
                    .graphicsLayer {
                        translationY = size.height * rise
                        if (reduceMotion) alpha = shade
                    }.shadow(24.dp, RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                    .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                    .background(PantopusColors.tableCream)
                    // Taps on the paper stay on it.
                    .pointerInput(Unit) { detectTapGestures { } }
                    .semantics { paneTitle = "The verse" }
                    .testTag("cardTableVerse"),
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(start = 28.dp, end = 28.dp, top = 62.dp, bottom = bottom + 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(verse, style = bookmarkVerseStyle, modifier = Modifier.fillMaxWidth())
                Text(card.caption, style = bookmarkReferenceStyle, modifier = Modifier.fillMaxWidth().padding(top = 14.dp))
                Box(
                    modifier =
                        Modifier
                            .padding(top = 18.dp)
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(22.dp))
                            .background(PantopusColors.tableNight)
                            .clickable(role = Role.Button, onClick = onClose)
                            .padding(horizontal = 24.dp, vertical = 10.dp)
                            .testTag("cardTableVerseClose"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Close", style = bookmarkCloseStyle)
                }
            }
            Ribbon(Modifier.align(Alignment.TopEnd).padding(end = 30.dp))
        }
    }
}

/** The bookmark's red ribbon, hanging from its top edge with a notch cut in its end. */
@Composable
private fun Ribbon(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.size(22.dp, 54.dp).clearAndSetSemantics {}) {
        val path =
            Path().apply {
                moveTo(0f, 0f)
                lineTo(size.width, 0f)
                lineTo(size.width, size.height)
                lineTo(size.width / 2f, size.height * 0.8f)
                lineTo(0f, size.height)
                close()
            }
        drawPath(path, PantopusColors.cardWax)
    }
}

private val bookmarkVerseStyle =
    TextStyle(
        fontFamily = FontFamily.Serif,
        fontSize = 19.sp,
        lineHeight = 1.55.em,
        color = PantopusColors.tableNight,
        textAlign = TextAlign.Center,
    )

private val bookmarkReferenceStyle =
    TextStyle(
        fontFamily = FontFamily.Serif,
        fontStyle = FontStyle.Italic,
        fontSize = 15.sp,
        lineHeight = 1.3.em,
        color = PantopusColors.cardTextQuiet,
        textAlign = TextAlign.Center,
    )

private val bookmarkCloseStyle =
    TextStyle(
        fontSize = 15.sp,
        lineHeight = 1.3.em,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.tableCream,
        textAlign = TextAlign.Center,
    )
