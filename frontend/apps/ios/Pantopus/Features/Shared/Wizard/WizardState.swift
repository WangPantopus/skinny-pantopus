//
//  WizardState.swift
//  Pantopus
//
//  Lightweight value types that describe the chrome of a wizard step.
//  `WizardShell` consumes these — feature view models build them.
//

import Foundation

/// Identifies a step within a wizard. Stable across config changes so the
/// view can diff state.
public typealias WizardStepID = String

/// What the leading top-bar control should do.
public enum WizardLeadingControl: Sendable, Equatable {
    /// Render an X. Tap dismisses immediately (clean step) or fires the
    /// discard confirm (dirty step, when `dirty == true`).
    case close
    /// Render a back chevron. Tap goes to the previous step.
    case back
}

/// Right-hand readout in the top bar. Disappears on the success step.
public enum WizardProgressLabel: Sendable, Equatable {
    case stepOf(current: Int, total: Int)
    case hidden
}

/// All wizard-shell-relevant state for the current step. Feature view
/// models map their internal state into this on every render.
public struct WizardChrome: Sendable, Equatable {
    public let title: String
    public let progressLabel: WizardProgressLabel
    public let progressFraction: Double?
    public let leading: WizardLeadingControl
    public let primaryCTALabel: String
    public let primaryCTAEnabled: Bool
    /// Accessibility identifier on the primary CTA. Defaults to the
    /// legacy shell-wide `wizardPrimaryCTA`; features override it when a
    /// design ships canonical per-step ids (e.g. A12.8's
    /// `gigCompose.cta.reviewPost`).
    public let primaryCTAIdentifier: String
    public let secondaryCTA: WizardSecondaryCTA?
    public let isSubmitting: Bool
    /// Optional caption rendered above the primary CTA in the sticky dock —
    /// e.g. the claim wizard's "Waiting for upload to finish" hint while a
    /// document is still streaming. `nil` renders nothing (legacy behaviour).
    public let footerHint: String?
    public let dirty: Bool
    public let showsProgressBar: Bool

    public init(
        title: String,
        progressLabel: WizardProgressLabel,
        progressFraction: Double?,
        leading: WizardLeadingControl,
        primaryCTALabel: String,
        primaryCTAEnabled: Bool,
        primaryCTAIdentifier: String = "wizardPrimaryCTA",
        secondaryCTA: WizardSecondaryCTA? = nil,
        isSubmitting: Bool = false,
        footerHint: String? = nil,
        dirty: Bool,
        showsProgressBar: Bool
    ) {
        self.title = title
        self.progressLabel = progressLabel
        self.progressFraction = progressFraction
        self.leading = leading
        self.primaryCTALabel = primaryCTALabel
        self.primaryCTAEnabled = primaryCTAEnabled
        self.primaryCTAIdentifier = primaryCTAIdentifier
        self.secondaryCTA = secondaryCTA
        self.isSubmitting = isSubmitting
        self.footerHint = footerHint
        self.dirty = dirty
        self.showsProgressBar = showsProgressBar
    }
}

/// Optional ghost / secondary CTA rendered alongside the primary in the
/// sticky bottom row. The success step uses this for "Back to home".
public struct WizardSecondaryCTA: Sendable, Equatable {
    public let label: String
    public let identifier: String
    /// Optional leading glyph (e.g. A12.8's `layout-grid` on the
    /// "Pick category" ghost). nil renders a plain text ghost.
    public let icon: PantopusIcon?

    public init(label: String, identifier: String, icon: PantopusIcon? = nil) {
        self.label = label
        self.identifier = identifier
        self.icon = icon
    }
}
