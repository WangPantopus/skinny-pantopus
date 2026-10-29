package app.pantopus.android.ui.components

import android.view.View
import android.view.inputmethod.InputMethodManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.toComposeRect
import androidx.compose.ui.input.pointer.PointerEvent
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.changedToDown
import androidx.compose.ui.input.pointer.changedToDownIgnoreConsumed
import androidx.compose.ui.node.CompositionLocalConsumerModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.PointerInputModifierNode
import androidx.compose.ui.node.TraversableNode
import androidx.compose.ui.node.currentValueOf
import androidx.compose.ui.node.findNearestAncestor
import androidx.compose.ui.node.requireLayoutCoordinates
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.unit.IntSize
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.navigation.NavController

/**
 * The app's keyboard rules (founder, 2026-10-29) for one window: the activity's, and each sheet or dialog that holds a
 * text field (pass it as the sheet's or dialog's `modifier`). While a text box has focus:
 * - a tap anywhere outside it puts the keyboard away, and the tap still does what it does, so Save or Log in work on
 *   the first tap; a tap on another text box moves the keyboard there;
 * - a drag that starts outside it, scrolling a list or the page, puts the keyboard away too.
 *
 * Composers mark the controls used while typing with [keepsKeyboard] (chat's Send), lists that move the keyboard
 * themselves with [keepsKeyboardWhileScrolling] (the chat thread), and the results under a search box with
 * [firstTapClosesKeyboard].
 */
fun Modifier.closesKeyboardOnTapOrScroll(): Modifier = this then KeyboardRulesElement

/** A tap or a drag that starts here never puts the keyboard away: the controls of a composer, a code's boxes. */
fun Modifier.keepsKeyboard(): Modifier = this then KeepsKeyboardElement(whileScrollingOnly = false)

/** Scrolling here leaves the keyboard alone (a list that moves it itself, the chat thread); a tap still closes it. */
fun Modifier.keepsKeyboardWhileScrolling(): Modifier = this then KeepsKeyboardElement(whileScrollingOnly = true)

/**
 * The results under a search box: while the keyboard is up, the first tap here only puts it away, so a person who
 * wants their results back in view doesn't open one by mistake; the next tap opens it. Dragging still scrolls, and
 * puts the keyboard away. Works under [closesKeyboardOnTapOrScroll]; don't put it around a composer.
 */
fun Modifier.firstTapClosesKeyboard(): Modifier = this then FirstTapClosesKeyboardElement

/**
 * Leaving a screen puts the keyboard away however it was left (a tap, the keyboard's own Go key, Back, a link), so it
 * doesn't stay up over the next screen or come back on the way back.
 */
@Composable
fun ClosesKeyboardOnNavigation(navController: NavController) {
    val focusManager = LocalFocusManager.current
    val view = LocalView.current
    DisposableEffect(navController, focusManager, view) {
        val listener =
            NavController.OnDestinationChangedListener { _, _, _ ->
                focusManager.clearFocus()
                view.hideKeyboard()
            }
        navController.addOnDestinationChangedListener(listener)
        onDispose { navController.removeOnDestinationChangedListener(listener) }
    }
}

private object KeyboardRulesKey

private data object KeyboardRulesElement : ModifierNodeElement<KeyboardRulesNode>() {
    override fun create() = KeyboardRulesNode()

    override fun update(node: KeyboardRulesNode) = Unit
}

private class KeyboardRulesNode :
    Modifier.Node(),
    PointerInputModifierNode,
    CompositionLocalConsumerModifierNode,
    TraversableNode {
    override val traverseKey: Any = KeyboardRulesKey

    /** The finger followed from down to up; none between gestures. */
    private var finger: PointerId? = null
    private var downAt = Offset.Zero

    /** The text box that had focus when the finger went down (root coordinates); null when none had. */
    private var textBox: Rect? = null
    private var startedInTextBox = false
    private var dragged = false
    private var otherFingers = false
    private var keepsOnTap = false
    private var keepsOnDrag = false

    /** Set by a [keepsKeyboard] region the finger went down in, before this node sees the down. */
    private var keptFinger: PointerId? = null
    private var keptOnlyWhileScrolling = false

    fun keep(
        finger: PointerId,
        whileScrollingOnly: Boolean,
    ) {
        // Regions inside each other: one that keeps the keyboard for taps too wins.
        if (keptFinger == finger && !keptOnlyWhileScrolling) return
        keptFinger = finger
        keptOnlyWhileScrolling = whileScrollingOnly
    }

    // A sheet places its content below the top of the modifier it is given: hear the sheet's touches too.
    override fun interceptOutOfBoundsChildEvents() = true

    override fun onPointerEvent(
        pointerEvent: PointerEvent,
        pass: PointerEventPass,
        bounds: IntSize,
    ) {
        // The main pass reaches this node after everything under the finger, so a tap's own action has already run.
        if (pass != PointerEventPass.Main) return
        val followed = finger
        if (followed == null) {
            pointerEvent.changes.singleOrNull()?.takeIf { it.changedToDownIgnoreConsumed() }?.let(::start)
            return
        }
        if (pointerEvent.changes.size > 1) otherFingers = true
        val change = pointerEvent.changes.firstOrNull { it.id == followed }
        if (change == null || !change.pressed) {
            if (change != null && !dragged && !otherFingers) tapped()
            finger = null
        } else if (!dragged && (change.position - downAt).getDistance() > currentValueOf(LocalViewConfiguration).touchSlop) {
            dragged = true
            draggedOff()
        }
    }

    override fun onCancelPointerInput() {
        finger = null
    }

    private fun start(down: PointerInputChange) {
        finger = down.id
        downAt = down.position
        dragged = false
        otherFingers = false
        textBox = focusedTextBox()
        startedInTextBox = textBox?.contains(requireLayoutCoordinates().localToRoot(down.position)) == true
        keepsOnDrag = keptFinger == down.id
        keepsOnTap = keepsOnDrag && !keptOnlyWhileScrolling
    }

    private fun tapped() {
        val before = textBox ?: return
        // Still the same text box: the tap didn't move focus to another one (or to one a button focuses).
        if (startedInTextBox || keepsOnTap || focusedTextBox() != before) return
        closeKeyboard()
    }

    private fun draggedOff() {
        val fromOutside = textBox != null && !startedInTextBox
        if (fromOutside && !keepsOnDrag && focusedTextBox() != null) closeKeyboard()
    }

    private fun focusedTextBox(): Rect? = currentValueOf(LocalView).focusedTextBox()

    private fun closeKeyboard() {
        currentValueOf(LocalFocusManager).clearFocus()
        currentValueOf(LocalView).hideKeyboard()
    }
}

private data class KeepsKeyboardElement(
    val whileScrollingOnly: Boolean,
) : ModifierNodeElement<KeepsKeyboardNode>() {
    override fun create() = KeepsKeyboardNode(whileScrollingOnly)

    override fun update(node: KeepsKeyboardNode) {
        node.whileScrollingOnly = whileScrollingOnly
    }
}

private class KeepsKeyboardNode(
    var whileScrollingOnly: Boolean,
) : Modifier.Node(),
    PointerInputModifierNode {
    override fun onPointerEvent(
        pointerEvent: PointerEvent,
        pass: PointerEventPass,
        bounds: IntSize,
    ) {
        // The initial pass runs before the window's rules read the down in their main pass.
        if (pass != PointerEventPass.Initial) return
        val rules = findNearestAncestor(KeyboardRulesKey) as? KeyboardRulesNode ?: return
        pointerEvent.changes.forEach { change ->
            if (change.changedToDownIgnoreConsumed()) rules.keep(change.id, whileScrollingOnly)
        }
    }

    override fun onCancelPointerInput() = Unit
}

private data object FirstTapClosesKeyboardElement : ModifierNodeElement<FirstTapClosesKeyboardNode>() {
    override fun create() = FirstTapClosesKeyboardNode()

    override fun update(node: FirstTapClosesKeyboardNode) = Unit
}

private class FirstTapClosesKeyboardNode :
    Modifier.Node(),
    PointerInputModifierNode,
    CompositionLocalConsumerModifierNode {
    override fun onPointerEvent(
        pointerEvent: PointerEvent,
        pass: PointerEventPass,
        bounds: IntSize,
    ) {
        // Before the rows see the press: a row that never sees it opens nothing. Lists still scroll on a used press,
        // and the window's rules put the keyboard away when the finger lifts or drags.
        if (pass != PointerEventPass.Initial) return
        val press = pointerEvent.changes.singleOrNull()?.takeIf { it.changedToDown() } ?: return
        if (findNearestAncestor(KeyboardRulesKey) != null && onlyClosesKeyboard(press)) press.consume()
    }

    /** The keyboard is up for a text box elsewhere: this press is for putting it away. */
    private fun onlyClosesKeyboard(press: PointerInputChange): Boolean {
        val view = currentValueOf(LocalView)
        val textBox = view.focusedTextBox() ?: return false
        return view.keyboardIsUp() && !textBox.contains(requireLayoutCoordinates().localToRoot(press.position))
    }

    override fun onCancelPointerInput() = Unit
}

/** The text box that has focus in this window's content, in root coordinates; null when none has. */
private fun View.focusedTextBox(): Rect? {
    if (!onCheckIsTextEditor()) return null
    val rect = android.graphics.Rect()
    getFocusedRect(rect)
    return rect.toComposeRect()
}

private fun View.keyboardIsUp(): Boolean = ViewCompat.getRootWindowInsets(this)?.isVisible(WindowInsetsCompat.Type.ime()) ?: true

private fun View.hideKeyboard() {
    ContextCompat.getSystemService(context, InputMethodManager::class.java)?.hideSoftInputFromWindow(windowToken, 0)
}
