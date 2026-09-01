@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.accesscodes

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.MotionTokens
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion

/**
 * T6.4a — Access codes screen. Thin wrapper around [ListOfRowsScreen]
 * that adds the transient "Code copied" toast. Reuses the Discover-hub
 * chrome pattern: chip-strip filter + card-style sections + secondary-
 * create FAB tinted home-green.
 */
@Composable
fun AccessCodesScreen(
    onAddCode: (AccessCategory?) -> Unit,
    onEditCode: (String) -> Unit,
    onSearch: () -> Unit,
    onBack: () -> Unit,
    viewModel: AccessCodesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val chipStrip by viewModel.chipStrip.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    val context = LocalContext.current
    val clipboard =
        remember {
            context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        }

    LaunchedEffect(Unit) {
        viewModel.bindClipboard { value ->
            clipboard?.setPrimaryClip(ClipData.newPlainText("Access code", value))
        }
        viewModel.onSelect = { target ->
            when (target) {
                is AccessCodesTarget.AddCode -> onAddCode(target.category)
                is AccessCodesTarget.EditCode -> onEditCode(target.secretId)
                is AccessCodesTarget.Search -> onSearch()
            }
        }
        viewModel.load()
    }

    val topBarAction =
        TopBarAction(
            icon = PantopusIcon.Search,
            contentDescription = "Search access codes",
            onClick = { viewModel.startSearch() },
        )

    val fab =
        FabAction(
            icon = PantopusIcon.Plus,
            contentDescription = "Add access code",
            variant = FabVariant.SecondaryCreate,
            tint = FabTint.Home,
            onClick = { viewModel.startAddCode(category = null) },
        )

    SecureScreenEffect()

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag(AccessCodesA11y.SCREEN),
    ) {
        ListOfRowsScreen(
            title = "Access codes",
            subtitle = viewModel.homeName,
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { },
            topBarAction = topBarAction,
            fab = fab,
            onBack = onBack,
            chipStrip = chipStrip,
        )

        val reduceMotion = rememberReduceMotion()
        AnimatedVisibility(
            visible = toast != null,
            enter = fadeIn(animationSpec = MotionTokens.componentState(reduceMotion)),
            exit = fadeOut(animationSpec = MotionTokens.componentState(reduceMotion)),
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = Spacing.s12)
                    .testTag(AccessCodesA11y.TOAST),
        ) {
            toast?.let { message ->
                AccessCodesToast(message = message)
            }
        }
    }
}

@Composable
private fun AccessCodesToast(message: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appTextStrong)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Check,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appSurface,
        )
        Text(
            text = message,
            style = PantopusTextStyle.small,
            color = PantopusColors.appSurface,
        )
    }
}
