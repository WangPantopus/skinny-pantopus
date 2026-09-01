//
//  EditProfileStickyBar.swift
//  Pantopus
//
//  A13.9 sticky save controls and dirty field label marker.
//

import SwiftUI

struct EditProfileFieldLabel: View {
    let title: String
    let dirty: Bool

    init(_ title: String, dirty: Bool) {
        self.title = title
        self.dirty = dirty
    }

    var body: some View {
        HStack(spacing: 2) {
            Text(title)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if dirty {
                Circle()
                    .fill(Theme.Color.warning)
                    .frame(width: 6, height: 6)
                    .padding(.leading, Spacing.s1)
                    .accessibilityHidden(true)
            }
        }
    }
}

struct EditProfileStickyBar: View {
    let dirtyCount: Int
    let isValid: Bool
    let isSaving: Bool
    let onDiscard: () -> Void
    let onSave: () -> Void

    private var canSave: Bool {
        dirtyCount > 0 && isValid && !isSaving
    }

    private var saveUsesPrimaryPose: Bool {
        dirtyCount > 0 && isValid
    }

    var body: some View {
        HStack(spacing: Spacing.s2) {
            if dirtyCount > 0 {
                dirtyPill
                Spacer(minLength: Spacing.s2)
                discardButton
                saveButton
            } else {
                cleanStrip
                Spacer(minLength: Spacing.s2)
                saveButton
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("editProfileStickySaveBar")
    }

    private var cleanStrip: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.clock, size: 13, color: Theme.Color.appTextMuted)
            Text("All changes saved · just now")
                .font(Theme.Font.role(.caption))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(minHeight: 34)
        .background(Theme.Color.appSurfaceMuted)
        .clipShape(Capsule())
        .accessibilityIdentifier("editProfileCleanSavedStrip")
    }

    private var dirtyPill: some View {
        HStack(spacing: Spacing.s1) {
            Circle()
                .fill(Theme.Color.warning)
                .frame(width: 6, height: 6)
            Text("\(dirtyCount) unsaved")
                .font(Theme.Font.role(.caption))
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.warning)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(minHeight: 34)
        .background(Theme.Color.warningBg)
        .overlay(Capsule().stroke(Theme.Color.warningLight, lineWidth: 1))
        .clipShape(Capsule())
        .accessibilityLabel("\(dirtyCount) unsaved changes")
        .accessibilityIdentifier("editProfileDirtyCountPill")
    }

    private var discardButton: some View {
        Button(action: onDiscard) {
            Text("Discard")
                .font(Theme.Font.role(.body))
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(minWidth: 78, minHeight: 42)
        }
        .buttonStyle(.plain)
        .disabled(isSaving)
        .accessibilityIdentifier("editProfileDiscardButton")
    }

    private var saveButton: some View {
        Button(action: onSave) {
            Group {
                if isSaving {
                    ProgressView()
                        .tint(saveUsesPrimaryPose ? Theme.Color.appTextInverse : Theme.Color.appTextMuted)
                } else if dirtyCount > 0 {
                    HStack(spacing: Spacing.s1) {
                        Icon(
                            .check,
                            size: 15,
                            color: saveUsesPrimaryPose ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
                        )
                        Text("Save")
                    }
                } else {
                    Text("Save")
                }
            }
            .font(Theme.Font.role(.body))
            .fontWeight(.semibold)
            .foregroundStyle(saveUsesPrimaryPose ? Theme.Color.appTextInverse : Theme.Color.appTextMuted)
            .frame(minWidth: 86, minHeight: 42)
        }
        .buttonStyle(.plain)
        .background(saveUsesPrimaryPose ? Theme.Color.primary600 : Theme.Color.appBorder)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .disabled(!canSave)
        .accessibilityLabel("Save")
        .accessibilityIdentifier("formCommitButton")
    }
}
