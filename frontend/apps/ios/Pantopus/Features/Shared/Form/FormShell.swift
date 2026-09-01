//
//  FormShell.swift
//  Pantopus
//
//  Top-bar (X + title + right action) + scrolling body. Owns the
//  dirty-close confirm sheet so feature screens don't reimplement it.
//

import SwiftUI

/// Leading top-bar control style. Sheet-style forms dismiss with an `X`
/// (`.close`); pushed forms that own a `NavigationStack` entry use a back
/// chevron (`.back`).
public enum FormShellLeading: Sendable {
    case close
    case back
}

/// Scaffold for every Form screen.
///
/// Per the P10 Form archetype: a 44pt top bar with leading X, centered
/// title, and a right-aligned text action button (`Save` / `Send` / `Post`
/// / `Done`). The action button renders in `primary600` when enabled and
/// `fg4` (`appTextMuted`) when disabled.
///
/// Two bottom-slot options exist for create / verification flows where a
/// top-right action would scroll out of view: pass `bottomActionLabel` for
/// the standard full-width primary CTA, or `stickyBottom` to inject a
/// bespoke sticky bar (e.g. the verification-aware Professional-profile
/// `Save & submit` bar). When `stickyBottom` is supplied it takes
/// precedence and the top-right action is hidden.
@MainActor
public struct FormShell<Content: View>: View {
    private let title: String
    private let subtitle: String?
    private let leading: FormShellLeading
    private let rightActionLabel: String?
    private let bottomActionLabel: String?
    private let stickyBottom: (() -> AnyView)?
    private let bottomActionIcon: PantopusIcon?
    private let showsTopActionWithBottom: Bool
    private let isValid: Bool
    private let isDirty: Bool
    private let isSaving: Bool
    private let onClose: () -> Void
    private let onCommit: () -> Void
    private let content: Content

    @State private var showsDiscardConfirm = false

    /// - Parameters:
    ///   - title: Centered top-bar title.
    ///   - subtitle: Optional second line under the title (e.g. an
    ///     `@handle`). Rendered small + secondary; `nil` keeps the single-
    ///     line title used by every other consumer.
    ///   - rightActionLabel: Text for the trailing top-bar action (`Save`,
    ///     `Send`, `Post`, `Done`). Defaults to `"Save"`. Pass `nil` to hide
    ///     the top-right action entirely — typically paired with a
    ///     `bottomActionLabel` for create-style flows.
    ///   - bottomActionLabel: When non-nil, renders a sticky full-width
    ///     primary CTA at the bottom of the scroll area (auth signup, etc.).
    ///     The label also drives whether the top-right action is hidden.
    ///     Enabled when `isValid && !isSaving` — does not gate on `isDirty`
    ///     so create flows (where every field is "new") work cleanly.
    ///   - bottomActionIcon: Optional leading icon rendered before the
    ///     bottom CTA label (e.g. `key-round` for "Send pass"). Ignored
    ///     when `bottomActionLabel` is nil.
    ///   - showsTopActionWithBottom: Opt in to keeping the trailing top-bar
    ///     text action visible even though a bottom CTA / sticky bar is
    ///     present. Off by default; the Calendarly availability frames are
    ///     the exception — their top bar carries `Save` / `Saving…` above a
    ///     full-width save bar. Callers drive the "saving" wording through
    ///     `rightActionLabel` (the action greys out via `isSaving`).
    ///   - isValid: Drives whether the right action is enabled.
    ///   - isDirty: Drives whether the top-right action is enabled and
    ///     whether close prompts the discard confirm. Ignored by the
    ///     bottom CTA (which is meant for create flows where the whole
    ///     form starts empty).
    ///   - isSaving: Render a spinner in place of the right-action label
    ///     while a commit is in flight.
    ///   - onClose: Invoked when the user taps X on a clean form, or
    ///     confirms discard on a dirty one.
    ///   - onCommit: Invoked when the user taps the top-right action or
    ///     the bottom CTA.
    ///   - leading: Leading top-bar control — `.close` (X, default) for
    ///     sheet-style forms or `.back` (chevron) for pushed forms.
    ///   - stickyBottom: Optional bespoke sticky bar pinned below the
    ///     scroll area. Takes precedence over `bottomActionLabel` and hides
    ///     the top-right action when supplied.
    ///   - content: Body view builder — typically a stack of
    ///     `FormFieldGroup`s.
    public init(
        title: String,
        subtitle: String? = nil,
        leading: FormShellLeading = .close,
        rightActionLabel: String? = "Save",
        bottomActionLabel: String? = nil,
        bottomActionIcon: PantopusIcon? = nil,
        showsTopActionWithBottom: Bool = false,
        isValid: Bool,
        isDirty: Bool,
        isSaving: Bool = false,
        onClose: @escaping () -> Void,
        onCommit: @escaping () -> Void,
        @ViewBuilder content: () -> Content,
        stickyBottom: (() -> AnyView)? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.leading = leading
        self.rightActionLabel = rightActionLabel
        self.bottomActionLabel = bottomActionLabel
        self.stickyBottom = stickyBottom
        self.bottomActionIcon = bottomActionIcon
        self.showsTopActionWithBottom = showsTopActionWithBottom
        self.isValid = isValid
        self.isDirty = isDirty
        self.isSaving = isSaving
        self.onClose = onClose
        self.onCommit = onCommit
        self.content = content()
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            FormTopBar(
                title: title,
                subtitle: subtitle,
                leading: leading,
                rightActionLabel: showsTopRightAction ? rightActionLabel : nil,
                rightActionEnabled: isValid && isDirty && !isSaving,
                isSaving: isSaving && bottomActionLabel == nil && stickyBottom == nil,
                onClose: handleClose
            ) {
                dismissKeyboard()
                onCommit()
            }
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    content
                }
                .padding(.vertical, Spacing.s4)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.Color.appBg)
            if let stickyBottom {
                stickyBottom()
            } else if let bottomActionLabel {
                FormBottomCTA(
                    label: bottomActionLabel,
                    icon: bottomActionIcon,
                    isEnabled: isValid && !isSaving,
                    isSaving: isSaving,
                    onCommit: onCommit
                )
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("formShell")
        .confirmationDialog(
            "Discard changes?",
            isPresented: $showsDiscardConfirm,
            titleVisibility: .visible
        ) {
            Button("Discard", role: .destructive) { onClose() }
            Button("Keep editing", role: .cancel) {}
        } message: {
            Text("You'll lose any unsaved edits.")
        }
    }

    private var showsTopRightAction: Bool {
        guard rightActionLabel != nil else { return false }
        return showsTopActionWithBottom || (bottomActionLabel == nil && stickyBottom == nil)
    }

    private func handleClose() {
        dismissKeyboard()
        if isDirty {
            showsDiscardConfirm = true
        } else {
            onClose()
        }
    }

    private func dismissKeyboard() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil,
            from: nil,
            for: nil
        )
    }
}

/// 44pt top bar: leading X, centered title, optional trailing action label.
private struct FormTopBar: View {
    let title: String
    let subtitle: String?
    let leading: FormShellLeading
    let rightActionLabel: String?
    let rightActionEnabled: Bool
    let isSaving: Bool
    let onClose: () -> Void
    let onCommit: () -> Void

    var body: some View {
        ZStack {
            VStack(spacing: 1) {
                Text(title)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            HStack {
                Button(action: onClose) {
                    Icon(leading == .back ? .chevronLeft : .x, size: 22, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel(leading == .back ? "Back" : "Close")
                .accessibilityIdentifier(leading == .back ? "formBackButton" : "formCloseButton")
                Spacer()
                if let rightActionLabel {
                    Button(action: onCommit) {
                        if isSaving {
                            ProgressView()
                                .frame(width: 60, height: 44)
                        } else {
                            Text(rightActionLabel)
                                .pantopusTextStyle(.body)
                                .foregroundStyle(
                                    rightActionEnabled ? Theme.Color.primary600 : Theme.Color.appTextMuted
                                )
                                .frame(minWidth: 60, minHeight: 44)
                        }
                    }
                    .disabled(!rightActionEnabled)
                    .accessibilityLabel(rightActionLabel)
                    .accessibilityIdentifier("formCommitButton")
                } else {
                    // Reserve 60pt so the centered title stays optically
                    // centered against the leading X button.
                    Color.clear.frame(width: 60, height: 44)
                }
            }
            .padding(.horizontal, Spacing.s2)
        }
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

/// Sticky primary CTA pinned below the scrollable form body. Used by
/// `FormShell(bottomActionLabel:…)` for create-style flows (auth signup,
/// later: long create wizards) where a top-right action would scroll out
/// of view in long forms.
private struct FormBottomCTA: View {
    let label: String
    let icon: PantopusIcon?
    let isEnabled: Bool
    let isSaving: Bool
    let onCommit: () -> Void

    var body: some View {
        Button(action: onCommit) {
            Group {
                if isSaving {
                    ProgressView()
                        .tint(Theme.Color.appTextInverse)
                } else {
                    HStack(spacing: Spacing.s2) {
                        if let icon {
                            Icon(icon, size: 16, color: Theme.Color.appTextInverse)
                        }
                        Text(label)
                            .pantopusTextStyle(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                }
            }
            .frame(maxWidth: .infinity, minHeight: 48)
        }
        .background(isEnabled ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .disabled(!isEnabled)
        .accessibilityLabel(label)
        .accessibilityIdentifier("formBottomCommitButton")
    }
}

/// Error shake modifier — 3 oscillations of 1pt over 240ms. Honors
/// reduced motion.
public struct FirstInvalidShake: ViewModifier {
    let trigger: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public func body(content: Content) -> some View {
        content
            .modifier(Shaker(animatable: CGFloat(trigger), enabled: !reduceMotion))
    }
}

private struct Shaker: GeometryEffect {
    var animatable: CGFloat
    let enabled: Bool

    var animatableData: CGFloat {
        get { animatable }
        set { animatable = newValue }
    }

    func effectValue(size _: CGSize) -> ProjectionTransform {
        guard enabled else { return ProjectionTransform(.identity) }
        let phase = sin(animatable * .pi * 3) * 1
        return ProjectionTransform(CGAffineTransform(translationX: phase, y: 0))
    }
}

public extension View {
    /// Apply a 3-oscillation 240ms 1pt horizontal shake whenever
    /// `trigger` changes. Respects reduced motion.
    func formShakeOnChange(of trigger: Int) -> some View {
        modifier(FirstInvalidShake(trigger: trigger))
            .animation(.easeInOut(duration: 0.24), value: trigger)
    }
}
