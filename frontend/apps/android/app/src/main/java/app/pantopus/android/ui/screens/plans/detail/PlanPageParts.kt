@file:Suppress("MagicNumber", "TooManyFunctions", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.plans.detail

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.ui.screens.plans.components.PlanDivider
import app.pantopus.android.ui.screens.plans.components.PlanScopeChip
import app.pantopus.android.ui.screens.plans.planGlass
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import java.time.ZoneId

/** One item of a plan page's "More" menu. */
data class PlanMenuItem(
    val label: String,
    val danger: Boolean = false,
    val onClick: () -> Unit,
)

/**
 * A plan page (boards J1 to J9, H9): the map on top with round glass buttons, the content on a panel that rises
 * over it with 22 dp corners, and a sticky footer for the one main action.
 */
@Composable
fun PlanPageScaffold(
    header: @Composable () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    scope: String? = null,
    onShare: (() -> Unit)? = null,
    menu: List<PlanMenuItem> = emptyList(),
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg)) {
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                Box(modifier = Modifier.fillMaxWidth().height(PLAN_MAP_HEIGHT)) {
                    header()
                    if (scope != null) {
                        PlanScopeChip(
                            text = scope,
                            modifier = Modifier.align(Alignment.BottomStart).padding(start = Spacing.s4, bottom = 34.dp),
                        )
                    }
                }
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .offset(y = (-22).dp)
                            .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                            .background(PantopusColors.appBg)
                            .padding(start = Spacing.s4, end = Spacing.s4, top = 18.dp, bottom = Spacing.s6),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s4),
                    content = content,
                )
            }
            PlanPageTopButtons(onBack = onBack, onShare = onShare, menu = menu)
        }
        if (footer != null) PlanFooter(content = footer)
    }
}

/** A plan page without a map (J8, J9): a plain bar with Back or Close and an optional title. */
@Composable
fun PlanPlainScaffold(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null,
    closeIcon: Boolean = false,
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlanRoundButton(
                icon = if (closeIcon) PantopusIcon.X else PantopusIcon.ChevronLeft,
                label = if (closeIcon) "Close" else "Back",
                onClick = onBack,
                glass = false,
            )
            Text(
                text = title.orEmpty(),
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).semantics { heading() },
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Spacer(modifier = Modifier.size(44.dp))
        }
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            content = content,
        )
        if (footer != null) PlanFooter(content = footer)
    }
}

@Composable
private fun PlanPageTopButtons(
    onBack: () -> Unit,
    onShare: (() -> Unit)?,
    menu: List<PlanMenuItem>,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlanRoundButton(icon = PantopusIcon.ChevronLeft, label = "Back", onClick = onBack)
        Spacer(modifier = Modifier.weight(1f))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (onShare != null) PlanRoundButton(icon = PantopusIcon.Share, label = "Share", onClick = onShare)
            if (menu.isNotEmpty()) PlanMoreMenu(menu)
        }
    }
}

@Composable
private fun PlanMoreMenu(items: List<PlanMenuItem>) {
    var open by remember { mutableStateOf(false) }
    Box {
        PlanRoundButton(icon = PantopusIcon.MoreHorizontal, label = "More: report or block", onClick = { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            items.forEach { item ->
                DropdownMenuItem(
                    text = { Text(item.label, color = if (item.danger) PantopusColors.error else PantopusColors.appText) },
                    onClick = {
                        open = false
                        item.onClick()
                    },
                )
            }
        }
    }
}

/** A 44 dp round button: glass over a map, sunken on a plain page. */
@Composable
fun PlanRoundButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    glass: Boolean = true,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .then(if (glass) Modifier.pantopusShadow(PantopusElevations.md, CircleShape) else Modifier)
                .clip(CircleShape)
                .background(if (glass) planGlass else PantopusColors.appSurfaceSunken)
                .clickable(role = Role.Button, onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = label
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = PantopusColors.appText)
    }
}

/** The sticky footer (board "footer"): surface, a hairline on top, the main action and a caption. */
@Composable
fun PlanFooter(content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        PlanDivider()
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            content = content,
        )
    }
}

/** The caption under a footer button. */
@Composable
fun PlanFooterCaption(text: String) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.fillMaxWidth(),
        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
    )
}

/** A line with a small glyph (board: calendar, pin, people, shield rows). */
@Composable
fun PlanInfoLine(
    icon: PantopusIcon,
    text: String,
    modifier: Modifier = Modifier,
    strong: Boolean = true,
    trailing: (@Composable RowScope.() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = Spacing.s4,
            tint = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = 2.dp),
        )
        Text(
            text = text,
            style = PantopusTextStyle.small,
            color = if (strong) PantopusColors.appTextStrong else PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        trailing?.invoke(this)
    }
}

/** Opens directions to the plan's exact place in the person's maps app. */
fun Context.openDirections(plan: PlanDto) {
    val place = plan.place ?: return
    val lat = place.latitude ?: return
    val lng = place.longitude ?: return
    val uri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng")
    runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

/** Adds the plan to the person's calendar through the system calendar app. */
fun Context.addToCalendar(plan: PlanDto) {
    val start = PlanFormat.instant(plan.startsAt) ?: return
    val end = PlanFormat.instant(plan.endsAt)
    val intent =
        Intent(Intent.ACTION_INSERT)
            .setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, plan.title)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start.toEpochMilli())
            .putExtra(CalendarContract.Events.EVENT_TIMEZONE, plan.timezone ?: ZoneId.systemDefault().id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    end?.let { intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, it.toEpochMilli()) }
    listOfNotNull(plan.place?.name, plan.place?.address).joinToString(", ").takeIf(String::isNotBlank)?.let {
        intent.putExtra(CalendarContract.Events.EVENT_LOCATION, it)
    }
    runCatching { startActivity(intent) }
}

/** The system share sheet with the plan's link (the web preview shows the area only). */
fun Context.sharePlan(plan: PlanDto) {
    val url = plan.shareUrl ?: return
    val text = "${plan.title}\n$url"
    val send =
        Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, text)
            .putExtra(Intent.EXTRA_TITLE, plan.title)
    runCatching { startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}
