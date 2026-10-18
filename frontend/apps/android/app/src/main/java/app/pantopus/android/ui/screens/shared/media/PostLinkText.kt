@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.media

import android.util.Patterns
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextDecoration
import app.pantopus.android.ui.theme.PantopusColors

/** Link detection, shared by Pulse cards and detail. No HTML/Markdown interpretation. */
fun postLinkedText(text: String): AnnotatedString =
    buildAnnotatedString {
        append(text)
        val matches = Patterns.WEB_URL.matcher(text)
        while (matches.find()) {
            var raw = matches.group().trimEnd('.', ',', ';', ':', '!', '?')
            for ((open, close) in listOf('(' to ')', '[' to ']', '{' to '}')) {
                while (raw.endsWith(close) && raw.count { it == close } > raw.count { it == open }) {
                    raw = raw.dropLast(1)
                }
            }
            val url = if (raw.startsWith("https://", true) || raw.startsWith("http://", true)) raw else "https://$raw"
            val scheme = android.net.Uri.parse(url).scheme?.lowercase()
            if (raw.isNotBlank() && scheme in setOf("http", "https")) {
                addLink(
                    LinkAnnotation.Url(
                        url,
                        TextLinkStyles(SpanStyle(color = PantopusColors.primary600, textDecoration = TextDecoration.Underline)),
                    ),
                    matches.start(),
                    matches.start() + raw.length,
                )
            }
        }
    }
