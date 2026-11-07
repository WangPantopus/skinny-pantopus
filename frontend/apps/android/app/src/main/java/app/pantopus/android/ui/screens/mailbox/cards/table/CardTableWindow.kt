@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.view.Window
import android.view.WindowManager
import androidx.activity.ComponentDialog
import androidx.activity.OnBackPressedCallback
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCompositionContext
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.LocalSaveableStateRegistry
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.core.view.WindowCompat
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.findViewTreeViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.findViewTreeSavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import java.util.UUID

/**
 * A window over the app that truly fills the screen, under the status and navigation bars and the camera's cut-out, with
 * no fade or dim of its own. Compose's own Dialog sizes its window to the screen less the bars, so it can't be this.
 * What's composed inside keeps its place with the screen under the window: going to a profile and back, the phone
 * turning and the system closing the app all find it where it was.
 */
@Composable
internal fun FullScreenWindow(
    onDismissRequest: () -> Unit,
    content: @Composable () -> Unit,
) {
    val parentView = LocalView.current
    val composition = rememberCompositionContext()
    val latestContent by rememberUpdatedState(content)
    val latestDismiss by rememberUpdatedState(onDismissRequest)
    val saveId = rememberSaveable { UUID.randomUUID().toString() }
    val screenState = LocalSaveableStateRegistry.current
    val dialog =
        remember(parentView) {
            ComponentDialog(parentView.context, android.R.style.Theme_Translucent_NoTitleBar).apply {
                window?.let(::fillTheScreen)
                val composeView =
                    ComposeView(context).apply {
                        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
                        // Its lifecycle and view models are the screen's under it, not this window's.
                        setViewTreeLifecycleOwner(parentView.findViewTreeLifecycleOwner())
                        setViewTreeViewModelStoreOwner(parentView.findViewTreeViewModelStoreOwner())
                        setViewTreeSavedStateRegistryOwner(parentView.findViewTreeSavedStateRegistryOwner())
                        setTag(androidx.compose.ui.R.id.compose_view_saveable_id_tag, "CardTableWindow:$saveId")
                        setParentCompositionContext(composition)
                        setContent {
                            CompositionLocalProvider(LocalSaveableStateRegistry provides screenState) { latestContent() }
                        }
                    }
                setContentView(composeView)
                // The table is always dark, in light mode and dark mode, so the bars' icons over it are light.
                window?.let { WindowCompat.getInsetsController(it, composeView) }?.apply {
                    isAppearanceLightStatusBars = false
                    isAppearanceLightNavigationBars = false
                }
                onBackPressedDispatcher.addCallback(
                    this,
                    object : OnBackPressedCallback(true) {
                        override fun handleOnBackPressed() = latestDismiss()
                    },
                )
            }
        }
    DisposableEffect(dialog) {
        dialog.show()
        onDispose { dialog.dismiss() }
    }
}

private fun fillTheScreen(window: Window) {
    window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
    window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT)
    window.setDimAmount(0f)
    window.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
    window.setWindowAnimations(0)
    // Draws under the bars itself; without this the old-style theme keeps black bands behind them.
    window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    @Suppress("DEPRECATION")
    window.statusBarColor = Color.TRANSPARENT
    @Suppress("DEPRECATION")
    window.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        window.attributes =
            window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
    }
}
