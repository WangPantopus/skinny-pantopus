//
//  ProSticky.swift
//  Pantopus
//
//  A.5 (A13.11) — the verification-aware sticky save bar. Two modes:
//
//  • .saved      — clean / published. A muted status line + a disabled
//                  Save. Reads "Published · all claims verified" or, after a
//                  submit with claims still in review, "Submitted · N in
//                  review".
//  • .pendingSave — unsaved edits. An amber SLA note (when new claims need
//                  verification), an "N edits" pill, Discard, and the
//                  Business-pillar "Save & submit" CTA.
//

import SwiftUI

@MainActor
struct ProSticky: View {
    enum Mode { case saved, pendingSave }

    let mode: Mode
    let dirtyCount: Int
    let pendingCount: Int
    var onDiscard: () -> Void
    var onSaveSubmit: () -> Void

    var body: some View {
        Group {
            switch mode {
            case .saved: savedBar
            case .pendingSave: pendingBar
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s5)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("proSticky")
    }

    // MARK: - Saved (published / submitted) mode

    private var savedBar: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.badgeCheck, size: 14, color: pendingCount == 0 ? Theme.Color.success : Theme.Color.warning)
            Text(savedText)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s2)
            Button(
                action: {},
                label: {
                    Text("Save")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s5)
                        .frame(minHeight: 44)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
            )
            .buttonStyle(.plain)
            .disabled(true)
            .accessibilityLabel("Save, disabled — nothing to submit")
            .accessibilityIdentifier("proSaveDisabledButton")
        }
    }

    private var savedText: String {
        pendingCount == 0
            ? "Published · all claims verified"
            : "Submitted · \(pendingCount) in review"
    }

    // MARK: - Pending-save mode

    private var pendingBar: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if pendingCount > 0 { slaNote }
            HStack(spacing: Spacing.s2) {
                editsPill
                Spacer(minLength: Spacing.s2)
                discardButton
                saveSubmitButton
            }
        }
    }

    private var slaNote: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.clock, size: 13, color: Theme.Color.warning)
            Text("\(pendingCount) new \(pendingCount == 1 ? "claim needs" : "claims need") verification · usually 1–2 business days")
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.warning)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    private var editsPill: some View {
        HStack(spacing: Spacing.s1) {
            Circle().fill(Theme.Color.business).frame(width: 6, height: 6)
            Text("\(dirtyCount) \(dirtyCount == 1 ? "edit" : "edits")")
                .pantopusTextStyle(.caption)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.business)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.businessBg)
        .clipShape(Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(dirtyCount) unsaved edits")
    }

    private var discardButton: some View {
        Button(action: onDiscard) {
            Text("Discard")
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Discard edits")
        .accessibilityIdentifier("proDiscardButton")
    }

    private var saveSubmitButton: some View {
        Button(action: onSaveSubmit) {
            HStack(spacing: Spacing.s1) {
                Icon(.check, size: 15, color: Theme.Color.appTextInverse)
                Text("Save & submit")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 44)
            .background(Theme.Color.business)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Save and submit for verification")
        .accessibilityIdentifier("proSaveSubmitButton")
    }
}

#Preview {
    VStack(spacing: Spacing.s10) {
        ProSticky(mode: .saved, dirtyCount: 0, pendingCount: 0, onDiscard: {}, onSaveSubmit: {})
        ProSticky(mode: .saved, dirtyCount: 0, pendingCount: 2, onDiscard: {}, onSaveSubmit: {})
        ProSticky(mode: .pendingSave, dirtyCount: 5, pendingCount: 2, onDiscard: {}, onSaveSubmit: {})
    }
    .background(Theme.Color.appBg)
}
