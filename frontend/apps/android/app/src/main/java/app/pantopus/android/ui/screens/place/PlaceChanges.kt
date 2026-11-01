package app.pantopus.android.ui.screens.place

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.HomeChangeItem
import app.pantopus.android.data.api.models.place.HomeChangesResponse
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.ui.screens.place.components.PlaceHairline
import app.pantopus.android.ui.screens.place.components.WorthItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** "Worth a look" shows at most this many changes; "See all N" opens the rest. */
internal const val CHANGES_SHOWN = 3

/**
 * When this account's Place dashboard last showed loaded data for a Home (TPR brief 7.3), kept on the phone: the
 * server's `until` from the last answer, sent as the next visit's `since`.
 */
class PlaceLastVisitStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences("place_last_visit", Context.MODE_PRIVATE)

        fun since(
            accountId: String,
            homeId: String,
        ): String? = prefs.getString(key(accountId, homeId), null)

        fun remember(
            accountId: String,
            homeId: String,
            until: String,
        ) = prefs.edit().putString(key(accountId, homeId), until).apply()

        private fun key(
            accountId: String,
            homeId: String,
        ) = "$accountId.$homeId"
    }

/** Where a change opens on this phone: this Home's Today page, a Place page, its documents or Home tools. */
internal class ChangeRoutes(
    val onOpenSection: (slug: String) -> Unit,
    val onOpenDocuments: () -> Unit,
    val onOpenHomeTools: () -> Unit,
)

/** The change's destination, or null when this phone has none for it (the row still shows). */
private fun changeOpen(
    item: HomeChangeItem,
    routes: ChangeRoutes,
): (() -> Unit)? {
    val route = item.route ?: return null
    return when (route.screen) {
        "today" -> ({ routes.onOpenSection(PlaceDetailGroup.TODAY.slug) })
        "place_detail" ->
            route.group?.let { PlaceDetailGroup.forGroup(app.pantopus.android.data.api.models.place.PlaceGroup.from(it)) }
                ?.let { group -> { routes.onOpenSection(group.slug) } }
        "documents" -> routes.onOpenDocuments
        "home_activity" -> routes.onOpenHomeTools
        else -> null
    }
}

/** "Nov 1, 1:20 AM": when, on the home's clock (as on iPhone). */
private fun changeWhen(
    item: HomeChangeItem,
    zone: ZoneId,
): String? = PlanFormat.instant(item.occurredAt)?.atZone(zone)?.format(DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US))

private fun changeIcon(kind: String): PantopusIcon =
    when (kind) {
        "weather_alert" -> PantopusIcon.TriangleAlert
        "pickup_schedule" -> PantopusIcon.Trash
        "systems_updated" -> PantopusIcon.Wrench
        "document_added" -> PantopusIcon.FileText
        else -> PantopusIcon.History
    }

/** "Worth a look" rows for the newest changes: the server's title, when and from whom, and where it opens. */
internal fun placeChangeItems(
    changes: HomeChangesResponse?,
    zone: ZoneId?,
    routes: ChangeRoutes,
): List<WorthItem> {
    val home = zone ?: ZoneId.systemDefault()
    return changes?.items.orEmpty().take(CHANGES_SHOWN).map { item ->
        WorthItem(
            key = "change.${item.id}",
            title = item.title,
            detail = listOfNotNull(changeWhen(item, home), item.origin?.takeIf { it.isNotBlank() }).joinToString(" · ").ifEmpty { null },
            icon = changeIcon(item.kind),
            onOpen = changeOpen(item, routes),
        )
    }
}

/** "See all N" under "Worth a look" when there are more changes than it shows (as on iPhone). */
@Composable
internal fun PlaceChangesFooter(
    total: Int,
    onOpen: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onOpen)
                .heightIn(min = 48.dp)
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .testTag("place.changes.seeAll"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "See all $total",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, tint = PantopusColors.primary600)
    }
}

/** Every change the server sent (up to 20), each with when, from whom and where it opens. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PlaceChangesSheet(
    changes: HomeChangesResponse,
    zone: ZoneId?,
    routes: ChangeRoutes,
    onDismiss: () -> Unit,
) {
    val home = zone ?: ZoneId.systemDefault()
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .navigationBarsPadding()
                    .testTag("place.changes.sheet"),
        ) {
            Text(
                "Changed since your last visit",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp).semantics { heading() },
            )
            if (changes.incomplete) {
                Text(
                    "Some sources couldn't be read, so this list may be missing changes.",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
                )
            }
            changes.items.forEachIndexed { index, item ->
                if (index > 0) PlaceHairline(Modifier.padding(start = 56.dp))
                val open = changeOpen(item, routes)
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable(enabled = open != null, role = Role.Button) {
                                onDismiss()
                                open?.invoke()
                            }.heightIn(min = 56.dp)
                            .padding(horizontal = 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(changeIcon(item.kind), null, size = 20.dp, tint = PantopusColors.appTextSecondary)
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(item.title, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                        val line = listOfNotNull(changeWhen(item, home), item.origin?.takeIf { it.isNotBlank() }).joinToString(" · ")
                        if (line.isNotEmpty()) Text(line, fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
                    }
                }
            }
        }
    }
}
