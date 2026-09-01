//
//  DueSnoozeCard.swift
//  Pantopus
//
//  A17.12 — the due-date + quick-snooze card (open frame). A calendar
//  block (accent month header + day numeral + weekday), the due label +
//  reminder sub-line + a "Closes Fri 5:00 PM" caption, and a 3-up
//  quick-snooze row (This evening / Tomorrow AM / Pick a time).
//

import SwiftUI

struct DueSnoozeCard: View {
    let due: MailTaskDue
    let options: [MailTaskSnoozeOption]
    let onSnooze: (String) -> Void

    var body: some View {
        MailTaskAccentCard {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                header
                    .padding(.bottom, Spacing.s3)
                HStack(spacing: 14) {
                    calendarBlock
                    dueDetail
                }
                snoozeRow
                    .padding(.top, Spacing.s3)
            }
        }
        .accessibilityIdentifier("mailTask_dueCard")
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("DUE DATE")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
            HStack(spacing: Spacing.s1) {
                Circle().fill(Theme.Color.error).frame(width: 6, height: 6)
                Text(due.left)
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(Theme.Color.error)
            }
        }
    }

    // MARK: - Calendar block

    private var calendarBlock: some View {
        VStack(spacing: Spacing.s0) {
            Text(due.month)
                .font(.system(size: 10, weight: .heavy))
                .tracking(1)
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 3)
                .background(Theme.Color.categoryTask)
            VStack(spacing: 2) {
                Text(due.day)
                    .font(.system(size: 24, weight: .heavy))
                    .foregroundStyle(Theme.Color.appText)
                Text(due.weekday)
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.top, Spacing.s1)
            .padding(.bottom, Spacing.s1 + 1)
        }
        .frame(width: 58)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(due.month) \(due.day), \(due.weekday)")
    }

    private var dueDetail: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(due.label) · \(due.time)")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            HStack(spacing: 5) {
                Icon(.bell, size: 12, color: Theme.Color.appTextSecondary)
                Text(due.reminderLabel)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Text(due.closesLabel)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.error)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Snooze row

    private var snoozeRow: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            HStack(spacing: Spacing.s2) {
                ForEach(options) { option in
                    snoozeButton(option)
                }
            }
            .padding(.top, Spacing.s3)
        }
    }

    private func snoozeButton(_ option: MailTaskSnoozeOption) -> some View {
        Button {
            onSnooze(option.id)
        } label: {
            VStack(spacing: 3) {
                Icon(option.icon, size: 16, color: Theme.Color.categoryTask)
                Text(option.label)
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let when = option.when {
                    Text(when)
                        .font(.system(size: 9.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                } else {
                    Text(" ")
                        .font(.system(size: 9.5))
                        .accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Spacing.s1)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailTask_snooze_\(option.id)")
        .accessibilityLabel("Snooze \(option.label)\(option.when.map { ", \($0)" } ?? "")")
    }
}

#if DEBUG
#Preview {
    let task = MailTaskSampleData.task()
    return Group {
        if let due = task.due {
            DueSnoozeCard(due: due, options: task.snoozeOptions) { _ in }
        }
    }
    .padding()
    .background(Theme.Color.appBg)
}
#endif
