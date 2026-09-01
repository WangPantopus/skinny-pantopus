@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.screens.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.AutofillNode
import androidx.compose.ui.autofill.AutofillType
import androidx.compose.ui.composed
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalAutofill
import androidx.compose.ui.platform.LocalAutofillTree

/** Field kinds the login / continue-as forms advertise to the Autofill framework. */
enum class AuthAutofillKind { EmailAddress, Username, Password }

/**
 * Persistent login (design §3 state **D**, §9 "fields carry autofill
 * `ContentType`"): tells the platform Autofill framework — and therefore
 * Google Password Manager / any credential provider — that this text field
 * is an email / username / password, so the saved-credential sheet appears
 * on focus and a chosen value lands in [onFill].
 *
 * Uses the `AutofillNode` API of Compose UI 1.7 (the `ContentType`
 * semantics arrived with 1.8); swap the body for
 * `semantics { contentType = … }` once the BOM moves. The node is keyed on
 * the focus of *this* field only, so it never hijacks another field's
 * autofill session.
 */
@OptIn(ExperimentalComposeUiApi::class)
fun Modifier.authAutofill(
    kinds: List<AuthAutofillKind>,
    onFill: (String) -> Unit,
): Modifier =
    composed {
        val autofill = LocalAutofill.current
        val autofillTree = LocalAutofillTree.current
        val latestOnFill by rememberUpdatedState(onFill)
        val types =
            remember(kinds) {
                kinds.map {
                    when (it) {
                        AuthAutofillKind.EmailAddress -> AutofillType.EmailAddress
                        AuthAutofillKind.Username -> AutofillType.Username
                        AuthAutofillKind.Password -> AutofillType.Password
                    }
                }
            }
        val node = remember(types) { AutofillNode(autofillTypes = types, onFill = { latestOnFill(it) }) }
        autofillTree += node
        this
            .onGloballyPositioned { node.boundingBox = it.boundsInWindow() }
            .onFocusChanged { focusState ->
                autofill?.run {
                    if (focusState.isFocused) requestAutofillForNode(node) else cancelAutofillForNode(node)
                }
            }
    }
