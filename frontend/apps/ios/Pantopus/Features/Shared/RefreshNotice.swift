//
//  RefreshNotice.swift
//  Pantopus
//
//  The quiet line a screen shows when its content is older than its kind's
//  max shown age and the last refresh failed (Instant Screens contract
//  section 3): "Couldn't refresh. Showing 3:42 PM." with Retry. The content
//  stays on screen below it.
//

import SwiftUI

struct RefreshNotice: View {
    let text: String
    let onRetry: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.cloudOff, size: 14, color: Theme.Color.appTextSecondary)
                .accessibilityHidden(true)
            Text(text)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("Retry", action: onRetry)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.primaryInk)
                .accessibilityIdentifier("refreshNoticeRetry")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("refreshNotice")
    }
}

extension ScreenSnapshot {
    /// "Couldn't refresh. Showing 3:42 PM." when the copy is past its max
    /// shown age and the last refresh failed; nil otherwise.
    var refreshNotice: String? {
        guard showsRefreshFailureLine else { return nil }
        let shown = Calendar.current.isDateInToday(fetchedAt)
            ? fetchedAt.formatted(date: .omitted, time: .shortened)
            : fetchedAt.formatted(.dateTime.month(.abbreviated).day().hour().minute())
        return "Couldn't refresh. Showing \(shown)."
    }
}
