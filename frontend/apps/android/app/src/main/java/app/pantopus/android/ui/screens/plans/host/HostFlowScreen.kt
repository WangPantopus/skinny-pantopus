@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.plans.host

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.plans.components.LARGE_TEXT_SCALE
import app.pantopus.android.ui.screens.plans.components.PlanLockLine
import app.pantopus.android.ui.screens.plans.components.PlanScopeLine
import app.pantopus.android.ui.screens.plans.components.PlanTile
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.PlanFooter
import app.pantopus.android.ui.screens.plans.detail.PlanRoundButton
import app.pantopus.android.ui.screens.plans.map.planH4
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.plans.components.PlanAvatar
import app.pantopus.android.ui.screens.plans.components.PlanBusinessShape
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * Host a plan: pick a type (H1), fill in its details (H2 to H5), choose a place (H6), preview (H7) and post. Posting
 * returns to the map, which drops the new pin and shows "Your plan is on the map" (H8).
 */
@Composable
fun HostFlowScreen(
    onClose: () -> Unit,
    onDoneToMap: () -> Unit,
    viewModel: HostFlowViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    // Anyone on Pantopus may host a playdate (founder decision, November 7).
    val choose: (PlanKind) -> Unit = { kind -> viewModel.choose(kind) }
    BackHandler { if (!viewModel.back()) onClose() }
    LaunchedEffect(ui.postedId) { ui.postedId?.let { onDoneToMap() } }
    Box(modifier = Modifier.fillMaxSize().testTag("plansHost")) {
        when (ui.step) {
            HostStep.Type -> HostTypeStep(ui, onClose = onClose, onChoose = choose, onHostAs = viewModel::chooseHostAs)
            HostStep.Details -> HostDetailsStep(ui, viewModel, onBack = { if (!viewModel.back()) onClose() })
            HostStep.Place -> PlacePickerStep(ui, viewModel)
            HostStep.Preview -> HostPreviewStep(ui, onBack = { viewModel.back() }, onPost = viewModel::post)
        }
    }
}

/** The host flow's bar (board "navbar"): a round button, a centered title, and "1 of 3". */
@Composable
internal fun HostBar(
    title: String,
    step: String?,
    leadingClose: Boolean,
    onLeading: () -> Unit,
    trailingClose: Boolean = false,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .heightIn(min = 52.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (trailingClose) {
            Spacer(modifier = Modifier.size(44.dp))
        } else {
            PlanRoundButton(
                icon = if (leadingClose) PantopusIcon.X else PantopusIcon.ChevronLeft,
                label = if (leadingClose) "Close" else "Back",
                onClick = onLeading,
                glass = false,
            )
        }
        Text(
            text = title,
            style = planH4,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        if (trailingClose) {
            PlanRoundButton(icon = PantopusIcon.X, label = "Close", onClick = onLeading, glass = false)
        } else {
            Text(
                text = step.orEmpty(),
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.End,
                modifier = Modifier.widthIn(min = 44.dp),
            )
        }
    }
}

/** A host step: the bar, the scrolling form and the sticky footer. */
@Composable
internal fun HostStepScaffold(
    title: String,
    step: String?,
    leadingClose: Boolean,
    onLeading: () -> Unit,
    footer: (@Composable ColumnScope.() -> Unit)?,
    trailingClose: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(0.dp)) {
        HostBar(title, step, leadingClose, onLeading, trailingClose)
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s2, bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s6),
            content = content,
        )
        if (footer != null) PlanFooter(content = footer)
    }
}

/** H1: what are you planning? */
@Composable
private fun HostTypeStep(
    ui: HostUi,
    onClose: () -> Unit,
    onChoose: (PlanKind) -> Unit,
    onHostAs: (String?) -> Unit,
) {
    val business = ui.chosenBusiness
    // A business posts the kinds the server lists for it (a kids' class only with its own switch).
    val kinds =
        if (business != null) {
            business.kinds.mapNotNull { PlanKind.from(it.kind) }
        } else {
            PlanKind.entries.filter { it != PlanKind.PLAYDATE || ui.playdatesOn }
        }
    val large = LocalDensity.current.fontScale >= LARGE_TEXT_SCALE
    HostStepScaffold(title = "Host a plan", step = "1 of 3", leadingClose = true, onLeading = onClose, footer = null) {
        if (ui.businesses.isNotEmpty()) HostAsSection(ui, onHostAs)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "What are you planning?",
                style = PantopusTextStyle.h1,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = "Pick one. You can change the details next.",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
            )
        }
        val rows = if (large) kinds.map { listOf(it) } else kinds.chunked(2)
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            rows.forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    row.forEach { kind ->
                        TypeCard(
                            kind = kind,
                            modifier = Modifier.weight(1f),
                            title = business?.kinds?.firstOrNull { it.kind == kind.wire }?.name?.takeIf(String::isNotBlank),
                            blurb = if (business != null) businessBlurb(kind) else null,
                        ) { onChoose(kind) }
                    }
                    if (row.size == 1 && !large) Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
        PlanScopeLine(
            text =
                if (business != null) {
                    "These are the five kinds of plan neighbors host. Yours keeps the same color and pin."
                } else {
                    "Plans are free and for adults. Kids come with a parent."
                },
            icon = null,
            centered = true,
        )
    }
}

/**
 * "Host as" (board B1): yourself or a business whose team you're on. Only people who may post for a verified business
 * see it; everyone else sees H1 as it always was.
 */
@Composable
private fun HostAsSection(
    ui: HostUi,
    onHostAs: (String?) -> Unit,
) {
    Column(modifier = Modifier.testTag("planHostAs"), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanOverline("Host as")
        PlanFormCard {
            HostAsRow(
                first = true,
                selected = ui.hostAsChoice == null,
                title = "You, ${ui.hostName}",
                caption = "A plan with neighbors. Always free.",
                leading = { PlanAvatar(name = ui.hostName, avatarUrl = ui.hostAvatar, size = 36.dp) },
                onClick = { onHostAs(null) },
                modifier = Modifier.testTag("planHostAsYou"),
            )
            ui.businesses.forEach { business ->
                HostAsRow(
                    first = false,
                    selected = ui.hostAsChoice == business.userId,
                    title = business.name,
                    caption = "A plan at your business.",
                    leading = { PlanBusinessShape(size = 36.dp, avatarUrl = business.avatarUrl) },
                    onClick = { onHostAs(business.userId) },
                    modifier = Modifier.testTag("planHostAsBusiness.${business.userId}"),
                )
            }
        }
        PlanLockLine("Only the team of a verified business sees this choice.")
    }
}

@Composable
private fun HostAsRow(
    first: Boolean,
    selected: Boolean,
    title: String,
    caption: String,
    leading: @Composable () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PlanOptionRow(
        first = first,
        onClick = onClick,
        modifier =
            modifier.semantics(mergeDescendants = true) {
                role = Role.RadioButton
                this.selected = selected
            },
    ) {
        leading()
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = planH4.copy(fontSize = 16.sp), color = PantopusColors.appText)
            Text(text = caption, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        // The chosen one is checked, as the app's other choice rows are (How people get in).
        if (selected) {
            PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 22.dp, tint = PantopusColors.primary600)
        } else {
            Spacer(modifier = Modifier.size(22.dp))
        }
    }
}

/** What each kind reads as for a business (board B1). */
private fun businessBlurb(kind: PlanKind): String =
    when (kind) {
        PlanKind.WATCH_PARTY -> "A game on your screens"
        PlanKind.PLAYDATE -> "A class, open play, story time"
        PlanKind.PICKUP_GAME -> "A clinic, open play, league night"
        PlanKind.WALK_COFFEE -> "A meetup, a tasting, a group walk"
        PlanKind.STUDY_GROUP -> "Tutoring, test prep, a workshop"
    }

private fun typeBlurb(kind: PlanKind): String =
    when (kind) {
        PlanKind.WATCH_PARTY -> "Watch a game together, at home or out"
        PlanKind.PLAYDATE -> "Kids play, parents meet"
        PlanKind.PICKUP_GAME -> "Need players, now or later"
        PlanKind.WALK_COFFEE -> "Walks, dog walks, coffee"
        PlanKind.STUDY_GROUP -> "Study together at a library or café"
    }

@Composable
private fun TypeCard(
    kind: PlanKind,
    modifier: Modifier,
    title: String? = null,
    blurb: String? = null,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            modifier
                .heightIn(min = 168.dp)
                .planCard()
                .clickable(role = Role.Button, onClick = onClick)
                .padding(Spacing.s4)
                .semantics(mergeDescendants = true) { role = Role.Button },
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PlanTile(kind, size = 52.dp, glyph = 28.dp, corner = 15.dp)
        Text(text = title ?: kind.label, style = planH4, color = PantopusColors.appText)
        Text(text = blurb ?: typeBlurb(kind), style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        if (kind == PlanKind.PLAYDATE && title == null) {
            PlanLockLine("You approve each family", icon = PantopusIcon.ShieldCheck)
        }
    }
}

/** The footer button that moves a host step on; greyed out while there is nothing to move on with. */
@Composable
internal fun HostFooterButton(
    title: String,
    onClick: () -> Unit,
    loading: Boolean = false,
    enabled: Boolean = true,
) {
    PrimaryButton(title = title, onClick = onClick, isLoading = loading, isEnabled = enabled, modifier = Modifier.height(50.dp))
}
