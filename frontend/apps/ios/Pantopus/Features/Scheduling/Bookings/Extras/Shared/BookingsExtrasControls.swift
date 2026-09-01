//
//  BookingsExtrasControls.swift
//  Pantopus
//
//  Stream I9 — shared form controls for the message/filter sheets (E7 follow-up,
//  E9 filter, E11 nudge): pill chips, channel toggle rows, and the message
//  composer box with an optional live character counter. Tokens only.
//

import SwiftUI

/// A single-select / multi-select pill chip. Selected fills with a tint (+ an
/// optional leading identity dot); unselected is white with a 1px border.
struct ExtrasPillChip: View {
    let title: String
    var count: Int?
    var isSelected: Bool
    var selectedForeground: Color = Theme.Color.primary600
    var selectedBackground: Color = Theme.Color.primary50
    var showsDot: Bool = false
    let action: () -> Void

    private var label: String {
        if let count { return "\(title) · \(count)" }
        return title
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1 + 2) {
                if isSelected, showsDot {
                    Circle().fill(selectedForeground).frame(width: 7, height: 7)
                }
                Text(label)
            }
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(isSelected ? selectedForeground : Theme.Color.appTextStrong)
            .padding(.horizontal, Spacing.s3 + 2)
            .frame(height: 34)
            .background(isSelected ? selectedBackground : Theme.Color.appSurface)
            .overlay {
                if !isSelected {
                    Capsule().strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                }
            }
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// A removable active-filter summary chip (tinted fill + trailing ✕).
struct ExtrasRemovableChip: View {
    let title: String
    var foreground: Color = Theme.Color.primary600
    var background: Color = Theme.Color.primary50
    let onRemove: () -> Void

    var body: some View {
        Button(action: onRemove) {
            HStack(spacing: Spacing.s2) {
                Text(title)
                Icon(.x, size: 13, color: foreground)
            }
            .font(.system(size: 11.5, weight: .bold))
            .foregroundStyle(foreground)
            .padding(.leading, Spacing.s3)
            .padding(.trailing, 7)
            .frame(height: 30)
            .background(background)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Remove \(title) filter")
    }
}

/// A Push / Email channel row with a trailing toggle.
struct ExtrasChannelRow: View {
    let icon: PantopusIcon
    let label: String
    @Binding var isOn: Bool
    var accent: Color = Theme.Color.primary600

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(icon, size: 17, color: Theme.Color.appTextStrong)
            Text(label)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
            Toggle("", isOn: $isOn).labelsHidden().tint(accent)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

/// Multi-line message composer on a sunken field, with an optional live
/// character counter that turns red past the limit.
struct ExtrasMessageBox: View {
    @Binding var text: String
    var placeholder: String
    var minHeight: CGFloat = 84
    var limit: Int?

    private var isOver: Bool {
        guard let limit else { return false }
        return text.count > limit
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text(placeholder)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.horizontal, Spacing.s3 + 1)
                    .padding(.vertical, 11)
            }
            TextField("", text: $text, axis: .vertical)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3 + 1)
                .padding(.vertical, 11)
                .padding(.bottom, limit == nil ? 0 : Spacing.s3)
        }
        .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(isOver ? Theme.Color.errorLight : Theme.Color.appBorder, lineWidth: 1)
        )
        .overlay(alignment: .bottomTrailing) {
            if let limit {
                Text("\(text.count)/\(limit)")
                    .font(.system(size: 10, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(isOver ? Theme.Color.error : Theme.Color.appTextMuted)
                    .padding(.trailing, Spacing.s3)
                    .padding(.bottom, Spacing.s2)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

/// A small outline chip-button ("Use a template" / "Send rebook link").
struct ExtrasChipButton: View {
    let title: String
    let icon: PantopusIcon
    var accent: Color = Theme.Color.primary600
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 13, color: accent)
                Text(title)
            }
            .font(.system(size: 11.5, weight: .bold))
            .foregroundStyle(accent)
            .padding(.horizontal, Spacing.s3)
            .frame(height: 30)
            .overlay(Capsule().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
