//
//  StickySave.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Bottom-anchored save bar with two
//  modes: `.dirty` (N unsaved badge · Discard ghost · Save primary) and
//  `.setup` (Save draft ghost · Publish · N to go primary, disabled
//  until N == 0). Renders the "N to go" hint inside the publish button
//  itself — that's the design's signature.
//

import SwiftUI

public enum EditBusinessStickySaveMode: Sendable, Equatable {
    /// Published business mid-edit. `count` drives the "N unsaved" badge.
    case dirty(count: Int)
    /// Setup mode. `remaining > 0` keeps Publish disabled and renders
    /// the "Publish · N to go" hint inside the button. `remaining == 0`
    /// flips the button to active "Publish".
    case setup(remaining: Int)
}

@MainActor
public struct EditBusinessStickySave: View {
    private let mode: EditBusinessStickySaveMode
    private let onDiscard: @MainActor () -> Void
    private let onSave: @MainActor () -> Void
    private let onSaveDraft: @MainActor () -> Void
    private let onPublish: @MainActor () -> Void

    public init(
        mode: EditBusinessStickySaveMode,
        onDiscard: @escaping @MainActor () -> Void = {},
        onSave: @escaping @MainActor () -> Void = {},
        onSaveDraft: @escaping @MainActor () -> Void = {},
        onPublish: @escaping @MainActor () -> Void = {}
    ) {
        self.mode = mode
        self.onDiscard = onDiscard
        self.onSave = onSave
        self.onSaveDraft = onSaveDraft
        self.onPublish = onPublish
    }

    public var body: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
            HStack(spacing: Spacing.s2) {
                switch mode {
                case let .dirty(count):
                    dirtyBadge(count: count)
                    Spacer(minLength: Spacing.s2)
                    Button {
                        onDiscard()
                    } label: {
                        Text("Discard")
                            .font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .frame(minHeight: 42)
                            .padding(.horizontal, Spacing.s3)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("editBusinessPage.discard")

                    Button {
                        onSave()
                    } label: {
                        HStack(spacing: 6) {
                            Icon(.check, size: 15, color: Theme.Color.appTextInverse)
                            Text("Save")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.Color.appTextInverse)
                        }
                        .padding(.horizontal, 22)
                        .frame(minHeight: 42)
                        .background(Theme.Color.business)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .pantopusShadow(WizardIdentity.business.ctaShadow)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("editBusinessPage.save")

                case let .setup(remaining):
                    Button {
                        onSaveDraft()
                    } label: {
                        HStack(spacing: 5) {
                            Icon(.upload, size: 14, color: Theme.Color.business)
                            Text("Save draft")
                                .font(.system(size: 13.5, weight: .semibold))
                                .foregroundStyle(Theme.Color.business)
                        }
                        .padding(.horizontal, Spacing.s3)
                        .frame(minHeight: 42)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("editBusinessPage.saveDraft")

                    Spacer(minLength: Spacing.s2)

                    Button {
                        if remaining == 0 { onPublish() }
                    } label: {
                        publishLabel(remaining: remaining)
                    }
                    .buttonStyle(.plain)
                    .disabled(remaining > 0)
                    .accessibilityIdentifier("editBusinessPage.publish")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, 10)
            .padding(.bottom, 22)
            .background(Theme.Color.appSurface.opacity(0.96))
        }
        .accessibilityIdentifier("editBusinessPage.stickySave")
    }

    private func dirtyBadge(count: Int) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Theme.Color.warning)
                .frame(width: 6, height: 6)
            Text("\(count) UNSAVED")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.1)
                .foregroundStyle(Theme.Color.warmAmber)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Theme.Color.warningBg)
        .clipShape(Capsule())
        .overlay(
            Capsule().stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .accessibilityLabel("\(count) unsaved changes")
    }

    @ViewBuilder private func publishLabel(remaining: Int) -> some View {
        let isLocked = remaining > 0
        Group {
            HStack(spacing: 6) {
                if isLocked {
                    Icon(.lock, size: 13, color: Theme.Color.appTextMuted)
                    Text("Publish · \(remaining) to go")
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                } else {
                    Icon(.check, size: 15, color: Theme.Color.appTextInverse)
                    Text("Publish")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 42)
            .background(isLocked ? Theme.Color.appSurfaceSunken : Theme.Color.business)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .modifier(PublishShadowModifier(isLocked: isLocked))
        .accessibilityLabel(
            isLocked ? "Publish, locked, \(remaining) sections to complete" : "Publish business page"
        )
    }
}

private struct PublishShadowModifier: ViewModifier {
    let isLocked: Bool

    func body(content: Content) -> some View {
        if isLocked {
            content
        } else {
            content.pantopusShadow(WizardIdentity.business.ctaShadow)
        }
    }
}

#Preview("Dirty") {
    EditBusinessStickySave(mode: .dirty(count: 3))
}

#Preview("Setup") {
    EditBusinessStickySave(mode: .setup(remaining: 4))
}
