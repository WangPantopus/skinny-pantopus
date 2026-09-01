@file:Suppress("MagicNumber", "PackageNaming", "UnusedPrivateMember", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.shared.content_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Visual tone for quick-action icon discs and count badges. */
enum class QuickActionTone(
    val color: Color,
    val backgroundColor: Color,
) {
    Personal(PantopusColors.personal, PantopusColors.personalBg),
    Home(PantopusColors.home, PantopusColors.homeBg),
    Business(PantopusColors.business, PantopusColors.businessBg),
    Warning(PantopusColors.warning, PantopusColors.warningBg),
    Error(PantopusColors.error, PantopusColors.errorBg),
    ;

    companion object {
        fun from(pillar: IdentityPillar): QuickActionTone =
            when (pillar) {
                IdentityPillar.Personal -> Personal
                IdentityPillar.Home -> Home
                IdentityPillar.Business -> Business
            }
    }
}

/** A quick-action tile in the 4-across grid. */
data class QuickActionTile(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val tone: QuickActionTone,
    val badge: String? = null,
    val isMuted: Boolean = false,
) {
    constructor(
        id: String,
        label: String,
        icon: PantopusIcon,
        tint: IdentityPillar,
        badge: String? = null,
        isMuted: Boolean = false,
    ) : this(id, label, icon, QuickActionTone.from(tint), badge, isMuted)
}

/** A tab in the [GridTabsBody] strip. */
data class GridTabsTab(
    val id: String,
    val label: String,
)

/**
 * 4-across quick-action grid + scrollable tab strip with Overview content
 * for the first tab and a NotYetAvailable empty-state for the rest.
 */
@Composable
fun GridTabsBody(
    quickActions: List<QuickActionTile>,
    tabs: List<GridTabsTab>,
    selectedTab: String,
    onSelectTab: (String) -> Unit,
    onQuickAction: (String) -> Unit,
    overview: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            quickActions.forEach { action -> QuickActionTileView(action, onQuickAction, modifier = Modifier.weight(1f)) }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            tabs.forEach { tab ->
                Column(
                    modifier =
                        Modifier
                            .clickable { onSelectTab(tab.id) }
                            .sizeIn(minHeight = 44.dp)
                            .padding(vertical = Spacing.s2)
                            .testTag("gridTabs_tab_${tab.id}")
                            .semantics { contentDescription = tab.label },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    val active = tab.id == selectedTab
                    Text(
                        text = tab.label,
                        style = PantopusTextStyle.small,
                        color = if (active) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                    )
                    Spacer(Modifier.height(Spacing.s1))
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(if (active) PantopusColors.primary600 else Color.Transparent),
                    )
                }
            }
        }
        Box(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4)) {
            if (selectedTab == tabs.firstOrNull()?.id) {
                overview()
            } else {
                val selected = tabs.firstOrNull { it.id == selectedTab }
                Box(modifier = Modifier.fillMaxWidth().height(320.dp)) {
                    EmptyState(
                        icon = PantopusIcon.Info,
                        headline = "${selected?.label ?: "This tab"} isn't here yet",
                        subcopy = "We're still designing this section.",
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickActionTileView(
    action: QuickActionTile,
    onTap: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .sizeIn(minHeight = 72.dp)
                .clickable { onTap(action.id) }
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(vertical = Spacing.s2, horizontal = Spacing.s1)
                .testTag("gridTabs_quickAction_${action.id}")
                .semantics { contentDescription = action.label },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(contentAlignment = Alignment.TopEnd) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(if (action.isMuted) PantopusColors.appSurfaceSunken else action.tone.backgroundColor),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = action.icon,
                    contentDescription = null,
                    size = Radii.xl2,
                    tint = if (action.isMuted) PantopusColors.appTextMuted else action.tone.color,
                )
            }
            action.badge?.let { badge ->
                Box(
                    modifier =
                        Modifier
                            .sizeIn(minWidth = 18.dp, minHeight = 18.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.error)
                            .padding(horizontal = Spacing.s1),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = badge, style = PantopusTextStyle.caption, color = PantopusColors.appTextInverse)
                }
            }
        }
        Text(
            text = action.label,
            style = PantopusTextStyle.caption,
            color = if (action.isMuted) PantopusColors.appTextSecondary else PantopusColors.appText,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
    }
}

// Stubs

@Composable
fun LongFormBodyStub() {
    StubBody(icon = PantopusIcon.File, label = "Article body")
}

@Composable
fun KeyValueBodyStub() {
    StubBody(icon = PantopusIcon.Info, label = "Key/value body")
}

@Composable
fun SegmentedMediaBodyStub() {
    StubBody(icon = PantopusIcon.Camera, label = "Media body")
}

@Composable
private fun StubBody(
    icon: PantopusIcon,
    label: String,
) {
    Box(
        modifier = Modifier.fillMaxWidth().height(320.dp).padding(horizontal = Spacing.s4),
    ) {
        EmptyState(
            icon = icon,
            headline = "$label isn't here yet",
            subcopy = "This section ships in a later tier.",
        )
    }
}
