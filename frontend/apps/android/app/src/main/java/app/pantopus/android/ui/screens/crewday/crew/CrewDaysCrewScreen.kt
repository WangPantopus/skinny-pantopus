@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.crewday.crew

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.crewday.CrewDayListItemDto
import app.pantopus.android.data.api.models.crewday.CrewDayReadinessDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.crewday.components.CrewDayDayRow
import app.pantopus.android.ui.screens.crewday.components.CrewDayListPlaceholder
import app.pantopus.android.ui.screens.crewday.components.CrewDaySection
import app.pantopus.android.ui.screens.plans.components.PlanBanner
import app.pantopus.android.ui.screens.plans.components.PlanBannerTone
import app.pantopus.android.ui.screens.plans.components.PlanChoice
import app.pantopus.android.ui.screens.plans.components.PlanChoiceGroup
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.detail.PlanFooterCaption
import app.pantopus.android.ui.screens.plans.detail.PlanPlainScaffold
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle

/** Where the crew's list hands off. */
data class CrewDaysCrewActions(
    val onBack: () -> Unit,
    /** One of the business's street days (screen 15; the route on the day). */
    val onOpenDay: (crewDayId: String, businessId: String) -> Unit,
    /** New Crew Day (screen 14). */
    val onNewDay: (businessId: String) -> Unit,
    /** "Publish your business page": the business's own page. */
    val onOpenBusiness: (businessId: String) -> Unit,
    /** "Set up payouts": the existing Stripe onboarding. */
    val onOpenPayouts: (businessId: String) -> Unit,
    /** "Add your insurance and registration": the business's legal and verification page. */
    val onOpenLegal: (businessId: String) -> Unit,
)

/**
 * The crew's Crew Days (screen 13, board `CrewList`): Today, Upcoming, Waiting for Pantopus, Drafts and Past, the
 * readiness card while the business can't start one yet, and New Crew Day.
 */
@Composable
fun CrewDaysCrewScreen(
    actions: CrewDaysCrewActions,
    viewModel: CrewDaysCrewViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    val loaded = state as? CrewDaysCrewUiState.Loaded
    PlanPlainScaffold(
        onBack = actions.onBack,
        title = "Crew Days",
        modifier = Modifier.testTag("crewDaysCrew"),
        footer =
            loaded?.let { current ->
                {
                    PrimaryButton(
                        title = "New Crew Day",
                        onClick = { actions.onNewDay(current.businessId) },
                        isEnabled = current.isReady && current.data.canEdit,
                        modifier = Modifier.fillMaxWidth().testTag("crewDaysCrewNew"),
                    )
                    when {
                        !current.data.canEdit -> PlanFooterCaption("The business's owners and editors set up Crew Days.")
                        !current.isReady -> PlanFooterCaption("Publish your page and set up payouts first.")
                    }
                }
            },
    ) {
        when (val current = state) {
            CrewDaysCrewUiState.Loading -> CrewDayListPlaceholder(modifier = Modifier.testTag("crewDayLoading"))
            CrewDaysCrewUiState.NoBusiness ->
                EmptyState(
                    icon = PantopusIcon.Truck,
                    headline = "Crew Days are for business pages",
                    subcopy = "Start a business page, or ask its owner for a team seat, to run a Crew Day.",
                    modifier = Modifier.heightIn(min = 360.dp),
                    tint = PantopusColors.businessBg,
                    accent = PantopusColors.business,
                )
            is CrewDaysCrewUiState.Error ->
                ErrorState(
                    headline = "Couldn't load your Crew Days",
                    message = current.message,
                    onRetry = viewModel::refresh,
                    modifier = Modifier.heightIn(min = 360.dp).testTag("crewDayLoadError"),
                )
            is CrewDaysCrewUiState.Loaded -> CrewDaysCrewContent(current, actions, onSelect = viewModel::select)
        }
    }
}

@Composable
private fun CrewDaysCrewContent(
    state: CrewDaysCrewUiState.Loaded,
    actions: CrewDaysCrewActions,
    onSelect: (String) -> Unit,
) {
    val data = state.data
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        if (state.businesses.size > 1) {
            PlanChoiceGroup(
                choices = state.businesses.map { PlanChoice(it.id, it.name) },
                isSelected = { it.id == state.businessId },
                onSelect = { onSelect(it.id) },
                modifier = Modifier.testTag("crewDaysCrewPicker"),
            )
        }
        if (data.canEdit && (!state.isReady || !data.readiness.documentsVerified)) {
            ReadinessCard(data.readiness, state.businessId, actions)
        }
        val open: (CrewDayListItemDto) -> Unit = { actions.onOpenDay(it.id, state.businessId) }
        DaySection("Today", data.today, open)
        DaySection("Upcoming", data.upcoming, open)
        DaySection("Waiting for Pantopus", data.pending, open)
        DaySection("Drafts", data.drafts, open)
        DaySection("Past", data.past, open, past = true)
        if (state.isEmpty && state.isReady) {
            EmptyState(
                icon = PantopusIcon.Truck,
                headline = "No Crew Days yet",
                subcopy = "Pick a street and a date. Each home books and pays its own price, and Pantopus approves the day first.",
                modifier = Modifier.heightIn(min = 280.dp).testTag("crewDaysCrewEmpty"),
                tint = PantopusColors.businessBg,
                accent = PantopusColors.business,
            )
        }
    }
}

@Composable
private fun DaySection(
    title: String,
    items: List<CrewDayListItemDto>,
    onOpen: (CrewDayListItemDto) -> Unit,
    past: Boolean = false,
) {
    if (items.isEmpty()) return
    CrewDaySection(title) {
        items.forEachIndexed { index, item ->
            CrewDayDayRow(item = item, first = index == 0, onClick = { onOpen(item) }, past = past)
        }
    }
}

/** What the business still needs before its first street day; insurance and registration only earn the badge. */
@Composable
private fun ReadinessCard(
    readiness: CrewDayReadinessDto,
    businessId: String,
    actions: CrewDaysCrewActions,
) {
    val ready = readiness.published && readiness.payoutsEnabled
    Column(modifier = Modifier.fillMaxWidth().testTag("crewDaysCrewReadiness"), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (!ready) {
            PlanBanner(
                title = "Before your first Crew Day",
                subtitle = "Households pay by card in Pantopus, so your page and payouts come first.",
                icon = PantopusIcon.ClipboardList,
                tone = PlanBannerTone.Warning,
            )
        }
        PlanFormCard {
            var first = true
            if (!readiness.published) {
                ReadinessRow("Publish your business page", null, first, "crewDaysCrewReady_publish") { actions.onOpenBusiness(businessId) }
                first = false
            }
            if (!readiness.payoutsEnabled) {
                ReadinessRow("Set up payouts", "Money reaches your bank 48 hours after each charge.", first, "crewDaysCrewReady_payouts") {
                    actions.onOpenPayouts(businessId)
                }
                first = false
            }
            if (!readiness.documentsVerified) {
                ReadinessRow(
                    "Add your insurance and registration",
                    "Optional: it earns the \"Insured and registered\" badge.",
                    first,
                    "crewDaysCrewReady_documents",
                ) {
                    actions.onOpenLegal(businessId)
                }
            }
        }
    }
}

@Composable
private fun ReadinessRow(
    title: String,
    caption: String?,
    first: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    PlanOptionRow(first = first, onClick = onClick, modifier = Modifier.testTag(tag)) {
        Column(modifier = Modifier.weight(1f).padding(vertical = 2.dp)) {
            Text(text = title, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
            caption?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}
