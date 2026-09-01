//
//  ReviewedRow.swift
//  Pantopus
//
//  A13.16 — compact reviewed-today row. 36pt MailThumb (dimmed for
//  junked / returned actions) + label (line-through for junked) +
//  meta line carrying the routed-to chip / action label + time. The
//  latest row carries an `UndoCountdown` chip in the trailing slot; the
//  earlier rows fall back to a small icon-only undo button.
//

import SwiftUI

struct ReviewedRow: View {
    let item: ReviewedMailDayItem
    let isLast: Bool
    let onUndo: () -> Void

    private var isJunked: Bool {
        item.action == .junked
    }

    private var isReturned: Bool {
        item.action == .returned
    }

    private var dimThumb: Bool {
        isJunked || isReturned
    }

    var body: some View {
        HStack(spacing: 10) {
            MailThumb(kind: item.kind, size: 36, dim: dimThumb)
            VStack(alignment: .leading, spacing: 1) {
                labelLine
                metaLine
            }
            Spacer(minLength: Spacing.s0)
            trailingControl
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(item.undoCountdown != nil ? Theme.Color.warningBg : Color.clear)
        .overlay(alignment: .bottom) {
            if !isLast {
                Rectangle()
                    .fill(Theme.Color.appBorderSubtle)
                    .frame(height: 1)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier("mailDayReviewed.\(item.id)")
    }

    private var labelLine: some View {
        Text(item.label)
            .font(.system(size: 12.5, weight: .semibold))
            .foregroundStyle(Theme.Color.appText)
            .strikethrough(isJunked, color: Theme.Color.appTextMuted)
            .lineLimit(1)
    }

    private var metaLine: some View {
        HStack(spacing: Spacing.s1) {
            Icon(actionIcon, size: 10, strokeWidth: 2.4, color: actionIconColor)
            switch item.action {
            case .routed:
                if let routedTo = item.routedTo, let tint = item.routedTint {
                    RoutedChip(label: routedTo, tint: tint)
                }
            case .junked:
                Text("Junked")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            case .returned:
                Text("Returned to sender")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Text("· \(item.whenLabel)")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .lineLimit(1)
    }

    @ViewBuilder
    private var trailingControl: some View {
        if let countdown = item.undoCountdown {
            UndoCountdown(seconds: countdown, onTap: onUndo)
        } else {
            Button(action: onUndo) {
                Icon(.refreshCw, size: 14, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Undo")
            .accessibilityIdentifier("mailDayReviewedUndo.\(item.id)")
        }
    }

    private var actionIcon: PantopusIcon {
        switch item.action {
        case .routed: .arrowRight
        case .junked: .trash2
        case .returned: .refreshCw
        }
    }

    private var actionIconColor: Color {
        switch item.action {
        case .routed: Theme.Color.appTextStrong
        case .junked: Theme.Color.error
        case .returned: Theme.Color.appTextSecondary
        }
    }

    private var accessibilityLabel: String {
        switch item.action {
        case .routed:
            "\(item.label). Routed to \(item.routedTo ?? "—"), \(item.whenLabel)."
        case .junked:
            "\(item.label). Junked, \(item.whenLabel)."
        case .returned:
            "\(item.label). Returned to sender, \(item.whenLabel)."
        }
    }
}

// MARK: - Helpers

/// Tinted recipient chip — pill of `tint.background` carrying the
/// recipient label in `appText`.
private struct RoutedChip: View {
    let label: String
    let tint: MailDayRoutedTint

    var body: some View {
        Text(label)
            .font(.system(size: 10.5, weight: .semibold))
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(tint.background)
            .clipShape(Capsule())
    }
}
