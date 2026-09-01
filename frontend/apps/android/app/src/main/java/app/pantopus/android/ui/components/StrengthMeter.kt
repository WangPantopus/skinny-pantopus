@file:Suppress("MagicNumber", "LongMethod", "MatchingDeclarationName")
@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * Pure value type describing whether a candidate password satisfies the
 * four strength rules + the breach-data flag passed in by the caller.
 * Compute via [PasswordStrength.evaluate] — no side effects.
 */
data class PasswordStrength(
    val hasMinLength: Boolean,
    val hasMixedCase: Boolean,
    val hasNumber: Boolean,
    val hasSymbol: Boolean,
    val breached: Boolean = false,
) {
    /**
     * Number of rules satisfied (0..4). The breach flag does not change this
     * count; the visual bar handles breach as a separate "force-red" overlay
     * so the underlying rule status stays inspectable.
     */
    val rulesMet: Int =
        listOf(hasMinLength, hasMixedCase, hasNumber, hasSymbol).count { it }

    val isStrong: Boolean
        get() = rulesMet == 4 && !breached

    companion object {
        fun evaluate(
            password: String,
            breached: Boolean = false,
        ): PasswordStrength {
            val hasUpper = password.any { it.isUpperCase() }
            val hasLower = password.any { it.isLowerCase() }
            val hasNum = password.any { it.isDigit() }
            val hasSym =
                password.any { c ->
                    !c.isLetterOrDigit() && !c.isWhitespace()
                }
            return PasswordStrength(
                hasMinLength = password.length >= 12,
                hasMixedCase = hasUpper && hasLower,
                hasNumber = hasNum,
                hasSymbol = hasSym,
                breached = breached,
            )
        }
    }
}

/**
 * 4-segment strength bar + per-rule pill row. Mirrors A13.14's `StrengthMeter`
 * in `change-password-frames.jsx`. When [strength.breached][PasswordStrength.breached]
 * is true the bar paints fully red and a "Found in breach data" pill is
 * prepended to the rule row.
 */
@Composable
fun StrengthMeter(
    strength: PasswordStrength,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .semantics { contentDescription = accessibilityLabel(strength) },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        SegmentBar(strength)
        RuleRow(strength)
    }
}

@Composable
private fun SegmentBar(strength: PasswordStrength) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        for (i in 0 until 4) {
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(6.dp)
                        .clip(CircleShape)
                        .background(segmentFill(strength, i)),
            )
        }
    }
}

@Composable
private fun RuleRow(strength: PasswordStrength) {
    FlowRow(
        modifier = Modifier.fillMaxWidth().wrapContentHeight(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (strength.breached) {
            BreachPill()
        }
        RulePill("12+ characters", strength.hasMinLength)
        RulePill("Mixed case", strength.hasMixedCase)
        RulePill("Number", strength.hasNumber)
        RulePill("Symbol", strength.hasSymbol)
    }
}

@Composable
private fun RulePill(
    label: String,
    met: Boolean,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .clip(CircleShape)
                .background(
                    if (met) PantopusColors.successBg else PantopusColors.errorLight.copy(alpha = 0.4f),
                ).padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "$label, ${if (met) "met" else "not met"}" },
    ) {
        PantopusIconImage(
            icon = if (met) PantopusIcon.Check else PantopusIcon.X,
            contentDescription = null,
            size = 11.dp,
            tint = if (met) PantopusColors.success else PantopusColors.appTextSecondary,
        )
        Text(
            text = label,
            style =
                TextStyle(
                    fontSize = 11.sp,
                    fontWeight = if (met) FontWeight.SemiBold else FontWeight.Medium,
                ),
            color = if (met) PantopusColors.success else PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun BreachPill() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .clip(CircleShape)
                .background(PantopusColors.errorBg)
                .border(width = 1.dp, color = PantopusColors.errorLight, shape = CircleShape)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "Found in breach data" },
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldAlert,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = "Found in breach data",
            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.error,
        )
    }
}

private fun segmentFill(
    strength: PasswordStrength,
    index: Int,
): Color {
    if (strength.breached) return PantopusColors.error
    if (index >= strength.rulesMet) return PantopusColors.appSurfaceSunken
    return when (strength.rulesMet) {
        4 -> PantopusColors.success
        3 -> PantopusColors.success.copy(alpha = 0.85f)
        2 -> PantopusColors.warning
        1 -> PantopusColors.error.copy(alpha = 0.85f)
        else -> PantopusColors.appSurfaceSunken
    }
}

private fun accessibilityLabel(strength: PasswordStrength): String {
    if (strength.breached) {
        return "Password strength: found in breach data, must be changed"
    }
    val labels = listOf("Add a password", "Weak", "Fair", "Good", "Strong")
    val label = labels[minOf(strength.rulesMet, labels.lastIndex)]
    return "Password strength: $label, ${strength.rulesMet} of 4 rules met"
}
