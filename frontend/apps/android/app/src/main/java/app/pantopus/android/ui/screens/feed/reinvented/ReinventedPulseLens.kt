@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.feed.living.LivingSearchBox
import app.pantopus.android.ui.screens.feed.living.LivingSearchLook
import app.pantopus.android.ui.screens.feed.living.LivingSearchMode
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/*
 * PHASE-6 A1: the search lens in the top line is one field for both jobs. Typed words, then the first suggestion is
 * "Ask the map: …" (the pins that match light up, the rest dim: CONTRACT 9a), the second searches the person's Atlas
 * (CONTRACT 9b, shown in My Atlas). The keyboard's Search key asks the map. The Ask bar that sat under the header is gone,
 * so nothing asks twice.
 */

/** The lens: open or not, and its words. The top line draws the field; the suggestions hang under it. */
@Stable
internal class ReinventedLens(
    open: Boolean = false,
    text: String = "",
) {
    var open by mutableStateOf(open)
    var text by mutableStateOf(text)

    fun close() {
        open = false
        text = ""
    }

    companion object {
        val Saver: Saver<ReinventedLens, Any> =
            Saver(
                save = { listOf(it.open, it.text) },
                restore = { (it as List<*>).let { v -> ReinventedLens(v[0] == true, v[1] as? String ?: "") } },
            )
    }
}

@Composable
internal fun rememberReinventedLens(): ReinventedLens = rememberSaveable(saver = ReinventedLens.Saver) { ReinventedLens() }

/** What the lens's two suggestions do with its words. */
internal class ReinventedLensActions(
    val onAsk: (String) -> Unit,
    val onSearchAtlas: (String) -> Unit,
)

private val LENS_LOOK =
    LivingSearchLook(
        hint = "Ask the map or search",
        fieldTag = "reinventedPulse.lens.field",
        clearTag = "reinventedPulse.lens.clear",
        clearWords = "Clear the words",
        pill = true,
    )

/** The lens's round button in the top line. */
@Composable
internal fun ReinventedLensButton(
    lens: ReinventedLens,
    floating: Boolean,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .then(if (floating) Modifier.background(PantopusColors.appSurface) else Modifier)
                .clickable(role = Role.Button) { lens.open = true }
                .semantics { contentDescription = "Ask the map or search" }
                .testTag("reinventedPulse.lens"),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appText,
        )
    }
}

/** The open lens in the top line: back, and the field (focused as it opens). The keyboard's Search asks the map. */
@Composable
internal fun RowScope.ReinventedLensField(
    lens: ReinventedLens,
    actions: ReinventedLensActions,
) {
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    BackHandler(enabled = lens.open) { lens.close() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurface)
                .clickable(role = Role.Button) { lens.close() }
                .semantics { contentDescription = "Close the search" }
                .testTag("reinventedPulse.lens.close"),
    ) {
        PantopusIconImage(icon = PantopusIcon.ArrowLeft, contentDescription = null, size = 18.dp, tint = PantopusColors.appText)
    }
    LivingSearchBox(
        text = lens.text,
        look = LENS_LOOK,
        mode = if (lens.text.isNotEmpty()) LivingSearchMode.CLEARABLE else LivingSearchMode.PLAIN,
        onText = { lens.text = it },
        onSearch = {
            val words = lens.text.trim()
            if (words.length >= MIN_WORDS) {
                focusManager.clearFocus()
                actions.onAsk(words)
                lens.close()
            }
        },
        onClear = { lens.text = "" },
        modifier = Modifier.weight(1f).focusRequester(focus),
    )
}

/** Under the open lens, once it holds words: "Ask the map: …" first, then the person's Atlas. */
@Composable
internal fun ReinventedLensSuggestions(
    lens: ReinventedLens,
    actions: ReinventedLensActions,
    modifier: Modifier = Modifier,
) {
    val words = lens.text.trim()
    if (!lens.open || words.length < MIN_WORDS) return
    val focusManager = LocalFocusManager.current
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier =
            modifier
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(vertical = 4.dp)
                .testTag("reinventedPulse.lens.suggestions"),
    ) {
        Suggestion(PantopusIcon.MapPin, "Ask the map: “$words”", "reinventedPulse.lens.ask") {
            focusManager.clearFocus()
            actions.onAsk(words)
            lens.close()
        }
        Suggestion(PantopusIcon.Layers, "Search your Atlas for “$words”", "reinventedPulse.lens.atlas") {
            focusManager.clearFocus()
            actions.onSearchAtlas(words)
            lens.close()
        }
    }
}

@Composable
private fun Suggestion(
    icon: PantopusIcon,
    words: String,
    tag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 14.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = PantopusColors.primary600)
        Text(
            words,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** Ask the map and Atlas search take two letters or more, as their own fields do. */
private const val MIN_WORDS = 2
