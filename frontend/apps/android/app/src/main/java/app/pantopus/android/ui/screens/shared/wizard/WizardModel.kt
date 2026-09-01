package app.pantopus.android.ui.screens.shared.wizard

/**
 * Contract a wizard view model must satisfy to plug into [WizardShell].
 * Concrete wizards (Add Home, etc.) own their state machine; the shell
 * only drives chrome.
 */
interface WizardModel {
    /** Snapshot of chrome state for the active step. */
    val chrome: WizardChrome

    /** Tap on the leading control (X or back chevron). */
    fun onLeading()

    /** User confirmed the discard sheet. */
    fun onDiscard()

    /**
     * P6c — user chose the optional "save draft" action on the discard
     * sheet (shown when [WizardChrome.saveDraftLabel] is set). Default:
     * no-op for wizards without a draft store.
     */
    fun onSaveDraft() {}

    /** Tap on the primary CTA in the sticky row. */
    fun onPrimary()

    /** Tap on the optional secondary CTA. Default: no-op. */
    fun onSecondary() {}
}
