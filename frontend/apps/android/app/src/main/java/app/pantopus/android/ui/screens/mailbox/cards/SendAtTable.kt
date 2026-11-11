package app.pantopus.android.ui.screens.mailbox.cards

import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.RectF
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.mailbox.cards.table.RoomLight
import app.pantopus.android.ui.screens.mailbox.cards.table.clothTint
import app.pantopus.android.ui.screens.mailbox.cards.table.drawCover
import app.pantopus.android.ui.screens.mailbox.cards.table.rememberCardTableArt
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * The send flow's steps lie on the chosen card's cloth (plan Part 9): cards' buttons and words read this to go glass and
 * cream. A cream slip on the cloth is paper again.
 */
internal val LocalOnCloth = staticCompositionLocalOf { false }

/** Words on the desk, or cream on the cloth (plan Part 9). */
internal object DeskInk {
    val strong: Color
        @Composable @ReadOnlyComposable
        get() = if (LocalOnCloth.current) PantopusColors.tableCream else PantopusColors.cardTextStrong

    val body: Color
        @Composable @ReadOnlyComposable
        get() = if (LocalOnCloth.current) PantopusColors.tableCream else PantopusColors.cardTextBody

    val quiet: Color
        @Composable @ReadOnlyComposable
        get() = if (LocalOnCloth.current) PantopusColors.tableCreamSoft else PantopusColors.cardTextQuiet

    val section: Color
        @Composable @ReadOnlyComposable
        get() = if (LocalOnCloth.current) PantopusColors.tableCreamSoft else PantopusColors.cardSectionInk

    /** Why something didn't work: wax red on the desk, a light red on the cloth. */
    val alert: Color
        @Composable @ReadOnlyComposable
        get() = if (LocalOnCloth.current) PantopusColors.tableAlert else PantopusColors.cardWax
}

/** The room the page keeps for the header and the step's line above the cloth. */
private const val ABOVE_THE_CLOTH_DP = 190

/**
 * From Write on the back onward, you are at the table (plan Part 9, launch key `card_table`): the steps lie on the chosen
 * card's cloth under the table's window light. Only the place changes; the steps, their order and their words are the
 * same. Off ([on] false), just the steps.
 */
@Composable
internal fun StepsAtTable(
    on: Boolean,
    table: String?,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (!on) {
        Column(content = content)
        return
    }
    val art = rememberCardTableArt()
    val tint = remember(table) { clothTint(table).toArgb() }
    val cloth =
        remember(tint) {
            Paint(Paint.FILTER_BITMAP_FLAG).apply { colorFilter = PorterDuffColorFilter(tint, PorterDuff.Mode.MULTIPLY) }
        }
    val tall = (LocalConfiguration.current.screenHeightDp - ABOVE_THE_CLOTH_DP).coerceAtLeast(0).dp
    Box(
        modifier =
            Modifier
                .padding(top = Spacing.s3)
                .fillMaxWidth()
                .heightIn(min = tall)
                .background(Color(tint))
                .drawBehind {
                    val sheet = art?.cloth ?: return@drawBehind
                    drawIntoCanvas { drawCover(it.nativeCanvas, sheet, RectF(0f, 0f, size.width, size.height), cloth) }
                }.testTag("sendAtTable"),
    ) {
        art?.let { RoomLight(it, Modifier.matchParentSize()) }
        CompositionLocalProvider(LocalOnCloth provides true) {
            Column(modifier = Modifier.padding(bottom = 28.dp), content = content)
        }
    }
}

/** "When should it arrive?" on a cream slip lying on the cloth, a little turned; plain on the desk. */
@Composable
internal fun Slip(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (!LocalOnCloth.current) {
        Column(modifier = modifier, content = content)
        return
    }
    val shape = RoundedCornerShape(3.dp)
    CompositionLocalProvider(LocalOnCloth provides false) {
        Column(
            modifier =
                modifier
                    .rotate(SLIP_TURN)
                    .shadow(14.dp, shape)
                    .background(PantopusColors.tableCream, shape)
                    .padding(Spacing.s4)
                    .testTag("sendCardSlip"),
            content = content,
        )
    }
}

private const val SLIP_TURN = -0.6f
