package app.pantopus.android.ui.screens.shared.wizard

/**
 * What the leading top-bar control should do. The shell branches close vs.
 * back glyph and discard-confirm behaviour off this.
 */
enum class WizardLeadingControl {
    /** Render an X. Tap dismisses immediately, or fires the discard
     * confirm when the wizard is dirty. */
    Close,

    /** Render a back chevron. Tap goes to the previous step. */
    Back,
}

/** Right-hand top-bar readout. Disappears on the success step. */
sealed interface WizardProgressLabel {
    data class StepOf(
        val current: Int,
        val total: Int,
    ) : WizardProgressLabel

    data object Hidden : WizardProgressLabel
}

/**
 * Optional ghost CTA rendered alongside the primary in the sticky bottom
 * row. Used by the success step's "Back to Hub".
 */
data class WizardSecondaryCta(
    val label: String,
    val testTag: String,
)

/**
 * All wizard-shell-relevant state for the current step. Feature view
 * models map their internal state into this on every render.
 */
data class WizardChrome(
    val title: String,
    val progressLabel: WizardProgressLabel,
    val progressFraction: Float?,
    val leading: WizardLeadingControl,
    val primaryCtaLabel: String,
    val primaryCtaEnabled: Boolean,
    val secondaryCta: WizardSecondaryCta? = null,
    val isSubmitting: Boolean = false,
    /**
     * Optional caption rendered above the primary CTA in the sticky dock —
     * e.g. the claim wizard's "Waiting for upload to finish" hint while a
     * document is still streaming. `null` renders nothing (legacy behaviour).
     */
    val footerHint: String? = null,
    val dirty: Boolean,
    val showsProgressBar: Boolean,
    /**
     * A12.8 — optional override for the primary CTA's test tag so a
     * wizard can expose a canonical cross-platform identifier (e.g.
     * `gigCompose.cta.reviewPost`). `null` keeps the shared
     * [WizardShellTags.PRIMARY_CTA] tag.
     */
    val primaryCtaTestTag: String? = null,
    /**
     * P6c — when non-null, the dirty-close confirm offers a third
     * "save draft" action (label = this value) that routes to
     * [WizardModel.onSaveDraft]. `null` keeps the two-button dialog.
     */
    val saveDraftLabel: String? = null,
)
