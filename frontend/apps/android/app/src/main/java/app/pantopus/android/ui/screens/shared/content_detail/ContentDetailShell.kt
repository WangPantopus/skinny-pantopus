@file:Suppress("MagicNumber", "UnusedPrivateMember", "PackageNaming", "LongMethod", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.shared.content_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** Trailing top-bar action payload. */
data class ContentDetailTopBarAction(
    val icon: PantopusIcon,
    val contentDescription: String,
    val onClick: () -> Unit,
)

/** Test tag on the shell root. */
const val CONTENT_DETAIL_TAG = "contentDetail"

/**
 * Reusable content-detail scaffold. Concrete screens provide three slots
 * via `@Composable` parameters: `header`, `body`, and an optional `cta`.
 *
 * The shell handles the 44dp top bar (back chevron + centered title + optional
 * action) and the scroll container. No tab bar — this archetype always
 * sits on a nav stack.
 */
@Composable
fun ContentDetailShell(
    title: String?,
    onBack: (() -> Void)? = null,
    topBarAction: ContentDetailTopBarAction? = null,
    topBarSecondaryAction: ContentDetailTopBarAction? = null,
    cta: @Composable () -> Unit = {},
    header: @Composable () -> Unit,
    body: @Composable () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(CONTENT_DETAIL_TAG),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ContentDetailTopBar(
                title = title,
                onBack = onBack,
                action = topBarAction,
                secondaryAction = topBarSecondaryAction,
            )
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(vertical = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                header()
                body()
                Spacer(Modifier.height(Spacing.s10))
            }
        }
        Box(
            modifier = Modifier.align(Alignment.BottomEnd).padding(Spacing.s4),
        ) {
            cta()
        }
    }
}

/** 44dp top bar. */
@Composable
fun ContentDetailTopBar(
    title: String?,
    onBack: (() -> Void)? = null,
    action: ContentDetailTopBarAction? = null,
    secondaryAction: ContentDetailTopBarAction? = null,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .height(44.dp)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clickable(onClick = onBack)
                            .semantics { contentDescription = "Back" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronLeft,
                        contentDescription = null,
                        size = 22.dp,
                        tint = PantopusColors.appText,
                    )
                }
            } else {
                Spacer(Modifier.size(44.dp))
            }
            // Balance the trailing pair so the title stays centered.
            if (secondaryAction != null) {
                Spacer(Modifier.size(44.dp))
            }
            Spacer(Modifier.weight(1f))
            if (title != null) {
                Text(
                    text = title,
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    modifier = Modifier.semantics { heading() },
                )
            }
            Spacer(Modifier.weight(1f))
            if (secondaryAction != null) {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clickable(onClick = secondaryAction.onClick)
                            .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
                            .semantics { contentDescription = secondaryAction.contentDescription },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = secondaryAction.icon,
                        contentDescription = null,
                        size = 22.dp,
                        tint = PantopusColors.appText,
                    )
                }
            }
            if (action != null) {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clickable(onClick = action.onClick)
                            .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
                            .semantics { contentDescription = action.contentDescription },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = action.icon,
                        contentDescription = null,
                        size = 22.dp,
                        tint = PantopusColors.appText,
                    )
                }
            } else {
                Spacer(Modifier.size(44.dp))
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
    }
}

// Kotlin alias so the Swift-style `Void` closure type above reads cleanly.
private typealias Void = Unit
