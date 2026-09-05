//
//  PackagesKit.swift
//  Pantopus
//
//  Stream I15 — shared local primitives + formatters for the Packages &
//  Invoices surfaces (G8–G13). These are stream-local (not Foundation): the
//  designs lean on paper-card overline sections, segmented filters, steppers,
//  currency math, and a Stripe-not-connected gate that don't exist as shared
//  components. Tokens only — no hardcoded colours/spacing. Functional chrome
//  stays product sky; identity chrome uses the owner pillar accent.
//

import SwiftUI
import UIKit

// swiftlint:disable file_length

// MARK: - Money & date formatting

/// Currency / per-session math used across packages, buy, credits, invoices.
enum SchedulingMoney {
    /// Format integer cents to a localised currency string (e.g. `$220.00`).
    /// Defaults to USD when the wire currency is absent.
    static func format(cents: Int?, currency: String? = "USD") -> String {
        let amount = Double(cents ?? 0) / 100
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = (currency ?? "USD").uppercased()
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: amount)) ?? "$\(amount)"
    }

    /// Per-session price (`total / sessions`) formatted as currency. Returns a
    /// `$0.00`-style string when sessions is zero so the live math never divides
    /// by zero.
    static func perSession(totalCents: Int?, sessions: Int?, currency: String? = "USD") -> String {
        guard let sessions, sessions > 0 else { return format(cents: 0, currency: currency) }
        let per = (totalCents ?? 0) / sessions
        return format(cents: per, currency: currency)
    }

    /// Parse a user-typed price string ("$240.00", "240", "240.5" — or
    /// "240,50" from a comma-decimal locale's keypad) to cents. Locale-aware:
    /// the locale's decimal separator is normalised to "." before cleaning, so
    /// a de/fr/es "240,50" parses as 240.50 instead of inflating 100x to
    /// 24050. Only ASCII digits are accepted (non-Latin digits fail to nil
    /// rather than silently mis-parsing) and the scaled value is clamped so
    /// oversized input can never trap `Int(_:)`. Returns nil when the field is
    /// empty / unparseable.
    static func parseCents(_ raw: String, locale: Locale = .current) -> Int? {
        var normalized = raw
        if let separator = locale.decimalSeparator, separator != "." {
            normalized = normalized.replacingOccurrences(of: separator, with: ".")
        }
        let cleaned = normalized.filter { ($0.isASCII && $0.isNumber) || $0 == "." }
        guard !cleaned.isEmpty, let value = Double(cleaned) else { return nil }
        let scaled = (value * 100).rounded()
        // Int(exactly:) rather than `<= Double(Int.max)`: Double(Int.max)
        // rounds up to 2^63, so a product landing exactly on 2^63 would pass
        // that comparison and still trap in Int(_:).
        guard scaled >= 0, let cents = Int(exactly: scaled) else { return nil }
        return cents
    }
}

/// Date helpers for purchased/created timestamps. Renders in the device zone
/// (these are display-only timestamps, not slot reads, so no tz round-trip).
enum PackagesFormat {
    static func dayString(_ iso: String?) -> String? {
        guard let iso else { return nil }
        return SchedulingTime.localString(
            utcISO: iso,
            tz: SchedulingTime.deviceTimeZoneIdentifier,
            dateStyle: .medium,
            timeStyle: .none
        )
    }
}

// MARK: - Identity gradient

/// A two-stop gradient pair derived from the owner pillar tokens (never hex) —
/// used for the owner/payer avatar discs in My Packages, Buy Package, Invoices.
enum SchedulingGradient {
    static func pair(for ownerType: String?) -> [Color] {
        switch ownerType?.lowercased() {
        case "business": [Theme.Color.business, Theme.Color.businessDark]
        case "home": [Theme.Color.home, Theme.Color.homeDark]
        default: [Theme.Color.primary500, Theme.Color.primary700]
        }
    }

    static func linear(for ownerType: String?) -> LinearGradient {
        LinearGradient(
            colors: pair(for: ownerType),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

// MARK: - Top bar

/// 46pt scheduling top bar with a back chevron, centred title, and an optional
/// trailing slot. Mirrors the established scheduling chrome (cf. I13's BizTopBar)
/// kept stream-local to stay decoupled.
struct PkgTopBar<Trailing: View>: View {
    let title: String
    let onBack: (() -> Void)?
    @ViewBuilder var trailing: Trailing

    init(title: String, onBack: (() -> Void)? = nil, @ViewBuilder trailing: () -> Trailing = { EmptyView() }) {
        self.title = title
        self.onBack = onBack
        self.trailing = trailing()
    }

    var body: some View {
        HStack(spacing: Spacing.s0) {
            if let onBack {
                Button(action: onBack) {
                    Icon(.chevronLeft, size: 21, color: Theme.Color.appText).frame(width: 36, height: 36)
                }
                .accessibilityLabel("Back")
            } else {
                Color.clear.frame(width: 36, height: 36)
            }
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .tracking(-0.2)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
            trailing.frame(minWidth: 36, alignment: .trailing)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 46)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }
}

/// 32pt circular icon button for the top-bar trailing slot (the `+` on
/// Packages, the search glyph on Invoices).
struct PkgTopBarIconButton: View {
    let icon: PantopusIcon
    let accessibilityLabel: String
    var tint: Color = Theme.Color.primary600
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Icon(icon, size: 21, color: tint).frame(width: 36, height: 36)
        }
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: - Card

/// White paper card with an optional uppercase overline header. Matches the
/// design's `Card overline=…` section primitive (radius 16, hairline border,
/// soft shadow).
struct PkgCard<Content: View>: View {
    var overline: String?
    var padding = EdgeInsets(top: 13, leading: 14, bottom: 13, trailing: 14)
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if let overline {
                Text(overline.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            content
        }
        .padding(padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.sm)
    }
}

/// A plain grouped row-card (rows stacked inside a single bordered surface) —
/// used by the Packages list + Invoices grouped list.
struct PkgRowCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: Spacing.s0) { content }
            .padding(.horizontal, 14)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .pantopusShadow(.sm)
    }
}

// MARK: - Status chip (package active/archived, invoice status)

/// Small semantic chip with a tone-driven fill. Stream-local because invoice
/// statuses (paid/sent/overdue/void/refunded/draft) aren't booking statuses and
/// so aren't covered by the Foundation `SchedulingStatusPill`.
struct PkgChip: View {
    enum Tone { case success, sky, warning, neutral, business

        var background: Color {
            switch self {
            case .success: Theme.Color.successBg
            case .sky: Theme.Color.infoBg
            case .warning: Theme.Color.warningBg
            case .neutral: Theme.Color.appSurfaceSunken
            case .business: Theme.Color.businessBg
            }
        }

        var foreground: Color {
            switch self {
            case .success: Theme.Color.success
            case .sky: Theme.Color.info
            case .warning: Theme.Color.warning
            case .neutral: Theme.Color.appTextSecondary
            case .business: Theme.Color.business
            }
        }
    }

    let text: String
    let tone: Tone
    var uppercased = false

    var body: some View {
        Text(uppercased ? text.uppercased() : text)
            .font(.system(size: 9.5, weight: .bold))
            .foregroundStyle(tone.foreground)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(tone.background)
            .clipShape(Capsule())
    }
}

// MARK: - Segmented control

/// Inline segmented control (Active/Archived filter, Expiry, etc.). Pillar
/// accent for the selected segment label.
struct PkgSegmented: View {
    let options: [String]
    let selectedIndex: Int
    var accent: Color = Theme.Color.primary600
    var onSelect: (Int) -> Void

    var body: some View {
        HStack(spacing: 3) {
            ForEach(Array(options.enumerated()), id: \.offset) { idx, opt in
                let on = idx == selectedIndex
                Button { onSelect(idx) } label: {
                    Text(opt)
                        .font(.system(size: 12, weight: on ? .bold : .semibold))
                        .foregroundStyle(on ? accent : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                        .frame(maxWidth: .infinity)
                        .frame(height: 30)
                        .background(on ? Theme.Color.appSurface : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                        .pantopusShadow(on ? .sm : .init(color: .clear, opacity: 0, radius: 0, x: 0, y: 0))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
    }
}

// MARK: - Stepper

/// +/- stepper bound to an Int with min/max clamping.
struct PkgStepper: View {
    @Binding var value: Int
    var range: ClosedRange<Int> = 1...1000
    var disabled = false

    var body: some View {
        HStack(spacing: Spacing.s0) {
            stepButton(.minus, enabled: !disabled && value > range.lowerBound) {
                value = max(range.lowerBound, value - 1)
            }
            Text("\(value)")
                .font(.system(size: 15, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
                .frame(minWidth: 44)
            stepButton(.plus, enabled: !disabled && value < range.upperBound) {
                value = min(range.upperBound, value + 1)
            }
        }
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .opacity(disabled ? 0.5 : 1)
    }

    private func stepButton(_ icon: PantopusIcon, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: 16, color: enabled ? Theme.Color.appText : Theme.Color.appTextMuted)
                .frame(width: 36, height: 36)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(icon == .plus ? "Increase" : "Decrease")
    }
}

// MARK: - Toggle row

struct PkgToggleRow: View {
    let icon: PantopusIcon
    let label: String
    var sub: String?
    @Binding var isOn: Bool
    var accent: Color = Theme.Color.primary600

    var body: some View {
        HStack(spacing: 11) {
            Icon(icon, size: 16, color: Theme.Color.appTextSecondary)
                .frame(width: 32, height: 32)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                if let sub {
                    Text(sub).font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s2)
            Toggle("", isOn: $isOn).labelsHidden().tint(accent)
        }
        .frame(minHeight: 44)
    }
}

// MARK: - Text field

/// Labelled text input matching the design's form rows (1.5px border, sunken
/// focus-free fill). `error` paints the border red and surfaces `helper`.
struct PkgTextField: View {
    var label: String?
    let placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var error = false
    var helper: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let label {
                Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.Color.appTextStrong)
            }
            TextField(placeholder, text: $text)
                .font(.system(size: 13))
                .keyboardType(keyboard)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, 11)
                .frame(height: 40)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(error ? Theme.Color.error : Theme.Color.appBorder, lineWidth: 1.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            if let helper {
                Text(helper)
                    .font(.system(size: 10.5))
                    .foregroundStyle(error ? Theme.Color.error : Theme.Color.appTextSecondary)
            }
        }
    }
}

// MARK: - Note callout

struct PkgNote: View {
    enum Tone { case info, warning, error

        var background: Color {
            switch self {
            case .info: Theme.Color.infoBg
            case .warning: Theme.Color.warningBg
            case .error: Theme.Color.errorBg
            }
        }

        var foreground: Color {
            switch self {
            case .info: Theme.Color.info
            case .warning: Theme.Color.warning
            case .error: Theme.Color.error
            }
        }
    }

    let tone: Tone
    let icon: PantopusIcon
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            Icon(icon, size: 16, color: tone.foreground).padding(.top, 1)
            Text(text)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(tone.foreground)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
        .background(tone.background)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(tone.foreground.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

// MARK: - Primary button

/// Full-width primary CTA (sky) with optional leading icon + in-flight spinner.
struct PkgPrimaryButton: View {
    let label: String
    var icon: PantopusIcon?
    var loading = false
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if loading {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else {
                    if let icon { Icon(icon, size: 15, color: Theme.Color.appTextInverse) }
                    Text(label).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.Color.appTextInverse)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .opacity(enabled && !loading ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .disabled(!enabled || loading)
    }
}

/// Outline / ghost button used in docks and inline actions.
struct PkgGhostButton: View {
    let label: String
    var icon: PantopusIcon?
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let icon { Icon(icon, size: 15, color: Theme.Color.appText) }
                Text(label).font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .opacity(enabled ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

// MARK: - Sticky dock

/// Blurred bottom dock (top hairline) hosting one or more action buttons.
struct PkgDock<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        HStack(spacing: Spacing.s2) { content }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            .padding(.bottom, 22)
            .background(.ultraThinMaterial)
            .overlay(alignment: .top) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }
}

// MARK: - Stripe-not-connected gate

/// Big centred "Connect payments" gate (Invoices frame 5) — shown when the
/// owner hasn't connected Stripe. CTA deep-links to Payments setup (I14).
struct PkgStripeGate: View {
    let icon: PantopusIcon
    let title: String
    let message: String
    var ctaLabel = "Connect"
    let onConnect: () -> Void

    var body: some View {
        VStack {
            Spacer()
            VStack(spacing: 11) {
                ZStack {
                    Circle().fill(Theme.Color.appSurface).frame(width: 48, height: 48)
                    Icon(icon, size: 23, color: Theme.Color.warning)
                }
                Text(title)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.warning.opacity(0.9))
                    .multilineTextAlignment(.center)
                Button(action: onConnect) {
                    HStack(spacing: 6) {
                        Icon(.externalLink, size: 15, color: Theme.Color.appTextInverse)
                        Text(ctaLabel).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .padding(.horizontal, 22)
                    .frame(height: 40)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.top, 2)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 18)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.warningBg)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.warningLight, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            Spacer()
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
    }
}

// MARK: - Coming soon (paid flag off)

/// Calm gate shown when `SchedulingFeatureFlags.paidEnabled` is off — priced
/// surfaces (packages, invoices) are hidden behind the flag + Stripe TEST mode.
struct PkgComingSoon: View {
    let title: String
    var message = "Paid scheduling is coming soon."

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.businessBg).frame(width: 72, height: 72)
                Icon(.sparkles, size: 30, strokeWidth: 1.8, color: Theme.Color.business)
            }
            Text(title).font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
    }
}

// MARK: - Error state

/// Shared error body with a Retry button wired to the caller's reload.
struct PkgErrorState: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 64, height: 64)
                Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text("Something went wrong").font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button(action: onRetry) {
                HStack(spacing: 6) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
        .background(Theme.Color.appBg)
    }
}
