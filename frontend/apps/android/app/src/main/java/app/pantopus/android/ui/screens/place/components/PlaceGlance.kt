package app.pantopus.android.ui.screens.place.components

import android.content.Context
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/** A folded summary shows two lines; the open group shows all of it. */
private const val SUMMARY_LINES = 2

/**
 * Which "Your home at a glance" groups are open on this device, per home (TPR brief 8: remember open groups), so
 * coming back or relaunching shows the page as it was left.
 */
class PlaceGlanceMemory(
    context: Context,
    private val homeId: String,
) {
    private val prefs = context.applicationContext.getSharedPreferences("place_glance", Context.MODE_PRIVATE)

    fun open(): Set<String> = prefs.getStringSet("open.$homeId", emptySet()).orEmpty()

    fun save(open: Set<String>) = prefs.edit().putStringSet("open.$homeId", open).apply()
}

/** The open groups for [homeId] and a toggle; remembered on the device (not for a blank id: previews, snapshots). */
@Composable
fun rememberGlanceOpen(homeId: String): Pair<Set<String>, (String) -> Unit> {
    val context = LocalContext.current
    val memory = remember(homeId) { homeId.takeIf { it.isNotBlank() }?.let { PlaceGlanceMemory(context, it) } }
    var open by remember(homeId) { mutableStateOf(memory?.open().orEmpty()) }
    return open to { key: String ->
        open = if (key in open) open - key else open + key
        memory?.save(open)
    }
}

/** "Your home at a glance", the section title over the folded groups. */
@Composable
fun PlaceGlanceHeading(modifier: Modifier = Modifier) {
    Text(
        "Your home at a glance",
        fontSize = 18.sp,
        lineHeight = 23.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = (-0.2).sp,
        color = PantopusColors.appText,
        modifier = modifier.padding(start = 2.dp).semantics { heading() },
    )
}

/**
 * One folded group of "Your home at a glance" (TPR brief 6.6): a neutral icon, the title, a one-line summary from real
 * values, and, open, its rows on the group's surface (flat: no card of their own) with "Open <page>" at the end.
 */
@Composable
@Suppress("LongParameterList", "LongMethod")
fun PlaceGlanceGroupRow(
    icon: PantopusIcon,
    title: String,
    summary: String,
    open: Boolean,
    onToggle: () -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(modifier = modifier.fillMaxWidth().animateContentSize().testTag(testTag)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button, onClickLabel = if (open) "Fold $title" else "Open $title", onClick = onToggle)
                    .semantics(mergeDescendants = true) { stateDescription = if (open) "Expanded" else "Collapsed" }
                    .heightIn(min = 56.dp)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            PantopusIconImage(icon, null, size = 19.dp, strokeWidth = 2f, tint = PantopusColors.appTextSecondary)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(
                    summary,
                    fontSize = 12.5.sp,
                    lineHeight = 17.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = if (open) Int.MAX_VALUE else SUMMARY_LINES,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            PantopusIconImage(if (open) PantopusIcon.Minus else PantopusIcon.Plus, null, size = 18.dp, tint = PantopusColors.appTextMuted)
        }
        if (open) {
            // The group's existing rows, lighter: on this surface they draw no card, border or shadow of their own.
            CompositionLocalProvider(LocalPlaceFlatRows provides true) {
                Column(modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)) { content() }
            }
        }
    }
}

/** "Open <page>": the group's existing detail page, at the end of an open group. */
@Composable
fun PlaceGlanceOpenLink(
    title: String,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onOpen)
                .heightIn(min = 48.dp)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            title,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, tint = PantopusColors.primary600)
    }
}

/** A thin line between rows of one surface. */
@Composable
fun PlaceHairline(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
}
