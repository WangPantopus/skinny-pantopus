//
//  MailboxRootContent.swift
//  Pantopus
//
//  B.1 — chrome rendered in the List-of-Rows `customHeader` slot for the
//  Mailbox root: the 4-drawer chip row (Me / Home / Biz / Earn) and the
//  3-tab segmented underline bar (Incoming / Counter / Vault). Mirrors
//  the JSX `DrawerRow` + `TabRow`.
//

import SwiftUI

/// Drawer chips + segmented tab bar, stacked. Sits between the navigation
/// bar and the list body. Above the drawer row sits the A13.16
/// "My mail day" call-to-action — the host-supplied entry point into
/// today's triage editor.
struct MailboxRootHeader: View {
    let viewModel: MailboxRootViewModel

    var body: some View {
        VStack(spacing: Spacing.s0) {
            mailDayCTA
            drawerRow
            if viewModel.pendingRoutingCount > 0 {
                pendingRoutingBanner
            }
            tabBar
        }
        .background(Theme.Color.appSurface)
    }

    /// "N items need routing" — opens the disambiguation queue. Rendered
    /// only when `GET /api/mailbox/v2/pending` returned rows. Mirrors RN
    /// (`src/app/mailbox/index.tsx:176-188`).
    private var pendingRoutingBanner: some View {
        Button(action: viewModel.openRoutingQueue) {
            HStack(spacing: Spacing.s2) {
                Icon(.helpCircle, size: 16, strokeWidth: 2.2, color: Theme.Color.warning)
                Text(viewModel.pendingRoutingLabel)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.warning)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 14, strokeWidth: 2.2, color: Theme.Color.warning)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 10)
            .frame(minHeight: 44)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.warningBg)
        }
        .buttonStyle(.plain)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.warningLight).frame(height: 1)
        }
        .accessibilityLabel("\(viewModel.pendingRoutingLabel). Opens the routing queue.")
        .accessibilityIdentifier("mailboxRootPendingBanner")
    }

    private var mailDayCTA: some View {
        Button(action: viewModel.onOpenMailDay) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.primary50)
                    Icon(.mailbox, size: 16, strokeWidth: 2.2, color: Theme.Color.primary700)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text("My mail day")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Triage today's stack")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 15, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 10)
            .frame(minHeight: 44)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurface)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("My mail day — triage today's stack")
        .accessibilityIdentifier("mailboxRootMailDayCTA")
    }

    private var drawerRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(viewModel.drawers) { drawer in
                    MailboxDrawerChip(
                        label: drawer.label,
                        icon: drawer.icon,
                        accent: drawer.accent,
                        isActive: drawer == viewModel.selectedDrawer,
                        unread: viewModel.drawerBadge(drawer)
                    ) {
                        viewModel.selectDrawer(drawer)
                    }
                    .accessibilityIdentifier("mailboxRootDrawer.\(drawer.rawValue)")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("mailboxRootDrawerRow")
    }

    private var tabBar: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(viewModel.mailTabs) { tab in
                MailboxTabSegment(
                    id: tab.rawValue,
                    label: tab.label,
                    count: viewModel.tabBadge(tab),
                    isActive: tab == viewModel.currentTab
                ) {
                    viewModel.selectTab(tab)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("mailboxRootTabBar")
    }
}

// MARK: - Drawer chip

private struct MailboxDrawerChip: View {
    let label: String
    let icon: PantopusIcon
    let accent: Color
    let isActive: Bool
    let unread: Int
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 16, color: foreground)
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(foreground)
            }
            .padding(.leading, Spacing.s3)
            .padding(.trailing, 14)
            .frame(height: 40)
            .background(background)
            .overlay(
                Capsule().stroke(isActive ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(Capsule())
            .overlay(alignment: .topTrailing) {
                if unread > 0 {
                    MailboxChipBadge(count: unread, onAccent: isActive, accent: accent)
                        .offset(x: 4, y: -4)
                }
            }
            .frame(minHeight: 44, alignment: .center)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(unread > 0 ? "\(label), \(unread) unread" : label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    private var foreground: Color {
        isActive ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary
    }

    private var background: Color {
        isActive ? accent : Theme.Color.appSurface
    }
}

/// Top-right unread count badge on a drawer chip. Colours invert on the
/// active (filled) chip so the count stays legible.
private struct MailboxChipBadge: View {
    let count: Int
    let onAccent: Bool
    let accent: Color

    var body: some View {
        Text("\(count)")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(onAccent ? accent : Theme.Color.appTextInverse)
            .padding(.horizontal, 5)
            .frame(minWidth: 18, minHeight: 18)
            .background(onAccent ? Theme.Color.appTextInverse : Theme.Color.primary600)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Theme.Color.appSurface, lineWidth: 2))
            .accessibilityHidden(true)
    }
}

// MARK: - Tab segment

private struct MailboxTabSegment: View {
    let id: String
    let label: String
    let count: Int?
    let isActive: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: Spacing.s1) {
                HStack(spacing: Spacing.s1) {
                    Text(label)
                        .font(.system(size: 13, weight: isActive ? .bold : .medium))
                        .foregroundStyle(isActive ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                    if let count {
                        MailboxTabCount(count: count, isActive: isActive)
                    }
                }
                .frame(maxWidth: .infinity)
                Rectangle()
                    .fill(isActive ? Theme.Color.primary600 : Color.clear)
                    .frame(height: 2.5)
                    .clipShape(Capsule())
                    .padding(.horizontal, Spacing.s5)
            }
            .padding(.top, Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailboxRootTab.\(id)")
        .accessibilityLabel(count.map { "\(label), \($0) unread" } ?? label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }
}

private struct MailboxTabCount: View {
    let count: Int
    let isActive: Bool

    var body: some View {
        Text("\(count)")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
            .padding(.horizontal, 5)
            .frame(minWidth: 18, minHeight: 16)
            .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
            .accessibilityHidden(true)
    }
}
