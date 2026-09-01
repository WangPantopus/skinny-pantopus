@file:Suppress("LongParameterList", "PackageNaming")
@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package app.pantopus.android.ui.screens.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextDecoration
import app.pantopus.android.ui.screens.settings.legal.LegalDocument
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle

/**
 * Signed-out legal affordances. RN renders "Terms of Service" and
 * "Privacy Policy" as *individually tappable* runs inside the consent
 * sentence; tapping either pushes the matching legal screen and
 * deliberately does **not** toggle the acceptance checkbox
 * (`pantopus/frontend/apps/mobile/src/app/(auth)/register.tsx:303-341`,
 * `login.tsx:277-293`). Natively the sentence was flat text, so the
 * documents were unreachable before sign-in.
 *
 * The sentence is laid out as a [FlowRow] of runs so each link keeps its
 * own hit target while the paragraph still wraps. Mirrors iOS
 * `AuthLegalLinks.swift`.
 */
@Composable
fun AuthLegalSentence(
    lead: String,
    termsLabel: String,
    privacyLabel: String,
    onOpenLegal: (LegalDocument) -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
    style: TextStyle = PantopusTextStyle.caption,
    plainColor: Color = PantopusColors.appTextSecondary,
) {
    FlowRow(
        modifier = modifier.testTag(testTag),
        horizontalArrangement = Arrangement.Start,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = lead, style = style, color = plainColor)
        LegalRun(
            label = termsLabel,
            document = LegalDocument.Terms,
            onOpenLegal = onOpenLegal,
            style = style,
            runTestTag = "${testTag}_terms",
        )
        Text(text = " and ", style = style, color = plainColor)
        LegalRun(
            label = privacyLabel,
            document = LegalDocument.Privacy,
            onOpenLegal = onOpenLegal,
            style = style,
            runTestTag = "${testTag}_privacy",
        )
        Text(text = ".", style = style, color = plainColor)
    }
}

/**
 * "By continuing with Google or Apple, you agree to our Terms of Service
 * and Privacy Policy." — RN's `oauthTermsText` (`login.tsx:277-293`),
 * rendered under the Google / Apple buttons on Login and Sign-up.
 */
@Composable
fun AuthOAuthTermsLine(
    testTag: String,
    onOpenLegal: (LegalDocument) -> Unit,
    modifier: Modifier = Modifier,
) {
    AuthLegalSentence(
        lead = "By continuing with Google or Apple, you agree to our ",
        termsLabel = "Terms of Service",
        privacyLabel = "Privacy Policy",
        onOpenLegal = onOpenLegal,
        testTag = testTag,
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
private fun LegalRun(
    label: String,
    document: LegalDocument,
    onOpenLegal: (LegalDocument) -> Unit,
    style: TextStyle,
    runTestTag: String,
) {
    Text(
        text = label,
        style = style,
        color = PantopusColors.primary600,
        textDecoration = TextDecoration.Underline,
        modifier =
            Modifier
                .clickable { onOpenLegal(document) }
                .testTag(runTestTag)
                .semantics { contentDescription = label },
    )
}
