package app.pantopus.android.ui.screens.business_profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.ui.screens.plans.components.PLAN_FREE
import app.pantopus.android.ui.screens.plans.components.PlanKindLeading
import app.pantopus.android.ui.screens.plans.components.PlanRow
import app.pantopus.android.ui.screens.plans.components.PlanRowEnd
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/** How many upcoming plans the section lists before "See all". */
private const val PLANS_SHOWN = 3

/**
 * "Upcoming plans" on a business's page (Plans with businesses, board B6): its plans, soonest first, each opening the
 * plan. Drawn only when the server sends some, so a page whose business has none, or a person without the switch,
 * sees the page exactly as before. "See all 7" lists the rest in place.
 */
@Composable
internal fun BusinessUpcomingPlans(
    plans: List<PlanDto>,
    onOpenPlan: (String) -> Unit,
) {
    if (plans.isEmpty()) return
    var all by rememberSaveable { mutableStateOf(false) }
    val shown = if (all) plans else plans.take(PLANS_SHOWN)
    Column(modifier = Modifier.fillMaxWidth().testTag("businessPlans")) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "UPCOMING PLANS",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(modifier = Modifier.weight(1f))
            if (!all && plans.size > PLANS_SHOWN) {
                Text(
                    text = "See all ${plans.size}",
                    color = PantopusColors.business,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier =
                        Modifier
                            .heightIn(min = 44.dp)
                            .clickable(role = Role.Button) { all = true }
                            .padding(start = Spacing.s2, top = 14.dp, bottom = 14.dp)
                            .testTag("businessPlansSeeAll"),
                )
            }
        }
        Column(modifier = Modifier.fillMaxWidth().planCard().padding(horizontal = Spacing.s4)) {
            shown.forEachIndexed { index, plan ->
                val subtitle = businessPlanLine(plan)
                PlanRow(
                    title = plan.title,
                    subtitle = subtitle,
                    end = PlanRowEnd.Price(PLAN_FREE).takeIf { plan.price == null } ?: PlanRowEnd.None,
                    first = index == 0,
                    leading = { PlanKindLeading(plan.planKind) },
                    spoken = listOfNotNull(plan.labelText, plan.title, subtitle, PLAN_FREE.takeIf { plan.price == null }).joinToString(", "),
                    onClick = { onOpenPlan(plan.id) },
                    modifier = Modifier.testTag("businessPlansRow.${plan.id}"),
                )
            }
        }
    }
}

/** "Sat 10:00 AM · 3 spots left" (board B6), "Full" when it is. */
private fun businessPlanLine(plan: PlanDto): String {
    val left =
        when {
            plan.isFull -> "Full"
            plan.spotsLeft == 1 -> "1 spot left"
            else -> "${plan.spotsLeft} spots left"
        }
    return listOfNotNull(PlanFormat.rowWhen(plan), left).joinToString(" · ")
}
