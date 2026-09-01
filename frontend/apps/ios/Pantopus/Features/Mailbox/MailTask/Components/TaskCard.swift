//
//  TaskCard.swift
//  Pantopus
//
//  A17.12 — the task hero. An accent-striped card carrying the priority
//  flag (or a "Completed" pill in the done frame), an "Auto-created"
//  sparkles eyebrow, a 26pt checkbox + title (struck through when done),
//  the case reference, a 1-of-3 progress bar, and a due/done chip.
//

import SwiftUI

struct TaskCard: View {
    let content: MailTaskContent

    private var done: Bool {
        content.isDone
    }

    private var accent: Color {
        done ? Theme.Color.success : Theme.Color.categoryTask
    }

    var body: some View {
        MailTaskAccentCard(accent: accent) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                topRow
                titleRow
                    .padding(.top, Spacing.s3)
                // The step checklist has no backend source on the live path,
                // so hide the progress bar when there are no subtasks.
                if content.totalSteps > 0 {
                    progress
                        .padding(.top, 14)
                }
                dueChip
                    .padding(.top, 14)
            }
            .padding(.leading, Spacing.s1 + 2)
        }
        .accessibilityIdentifier("mailTask_taskCard")
    }

    // MARK: - Top row (priority / completed + auto-created)

    private var topRow: some View {
        HStack(spacing: Spacing.s1 + 2) {
            if done {
                completedPill
            } else {
                priorityFlag
            }
            Spacer(minLength: Spacing.s0)
            HStack(spacing: 3) {
                Icon(.sparkles, size: 10, color: Theme.Color.appTextSecondary)
                Text("Auto-created")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .accessibilityHidden(true)
        }
    }

    private var priorityFlag: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.flag, size: 10, color: content.priority.foreground)
            Text(content.priority.label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(content.priority.foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(content.priority.background)
        .clipShape(Capsule())
        .accessibilityLabel(content.priority.label)
    }

    private var completedPill: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.checkCircle, size: 11, color: Theme.Color.success)
            Text("Completed")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.successBg)
        .clipShape(Capsule())
        .accessibilityLabel("Completed")
    }

    // MARK: - Title + checkbox

    private var titleRow: some View {
        HStack(alignment: .top, spacing: Spacing.s3 - 1) {
            checkbox
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(content.title)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .strikethrough(done, color: Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Text(content.reference)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var checkbox: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(done ? Theme.Color.success : Theme.Color.appSurface)
            if done {
                Icon(.check, size: 15, color: Theme.Color.appTextInverse)
            } else {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.categoryTask, lineWidth: 2)
            }
        }
        .frame(width: 26, height: 26)
        .padding(.top, 1)
        .accessibilityHidden(true)
    }

    // MARK: - Progress

    private var progress: some View {
        VStack(alignment: .leading, spacing: Spacing.s1 + 2) {
            HStack {
                Text("\(content.finishedSteps) of \(content.totalSteps) steps \(done ? "done" : "complete")")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Spacer(minLength: Spacing.s0)
                Text("\(Int((content.progress * 100).rounded()))%")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.Color.appSurfaceSunken)
                    Capsule()
                        .fill(accent)
                        .frame(width: max(0, geo.size.width * content.progress))
                }
            }
            .frame(height: 7)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Progress: \(content.finishedSteps) of \(content.totalSteps) steps")
    }

    // MARK: - Due / done chip

    @ViewBuilder
    private var dueChip: some View {
        if done {
            chip(
                icon: .checkCircle,
                tint: Theme.Color.success,
                background: Theme.Color.successBg,
                border: Theme.Color.successLight
            ) {
                if let completion = content.completion {
                    Text(completion.stamp)
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.success)
                    Text("· \(completion.note)")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.success)
                } else {
                    Text("Completed")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.success)
                }
            }
        } else if let due = content.due {
            chip(
                icon: .clock,
                tint: Theme.Color.error,
                background: Theme.Color.errorBg,
                border: Theme.Color.errorLight
            ) {
                Text(due.label)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.error)
                Text("· \(Self.titleCased(due.weekday)) \(Self.titleCased(due.month)) \(due.day) · \(due.time)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
    }

    private func chip(
        icon: PantopusIcon,
        tint: Color,
        background: Color,
        border: Color,
        @ViewBuilder text: () -> some View
    ) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 15, color: tint)
            text()
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(background)
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    /// "FRI" → "Fri", "MAY" → "May".
    private static func titleCased(_ value: String) -> String {
        guard let first = value.first else { return value }
        return String(first).uppercased() + value.dropFirst().lowercased()
    }
}

// MARK: - Shared accent card

/// White card with a 4pt leading accent strip — the shared shell for the
/// task hero, due card, checklist, and completion summary.
struct MailTaskAccentCard<Content: View>: View {
    var accent: Color?
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(Spacing.s3 + 2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .leading) {
                if let accent {
                    Rectangle().fill(accent).frame(width: 4)
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }
}

#if DEBUG
#Preview("Open") {
    TaskCard(content: MailTaskSampleData.task())
        .padding()
        .background(Theme.Color.appBg)
}

#Preview("Done") {
    TaskCard(content: MailTaskSampleData.task(done: true))
        .padding()
        .background(Theme.Color.appBg)
}
#endif
