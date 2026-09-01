//
//  AddGuestFormContent.swift
//  Pantopus
//
//  A13.1 — Scrolling body for the Add Guest form, rendered inside the
//  shared `FormShell`. Three sections (Guest / Access window / Note) plus
//  the house-context strip that names the home the pass is for. Kept
//  separate from `AddGuestFormView` so the chrome (top bar, sticky CTA,
//  sheets, toast) stays in the host.
//

import SwiftUI

struct AddGuestFormContent: View {
    @Bindable var viewModel: AddGuestFormViewModel

    var body: some View {
        HomeContextStrip(context: viewModel.homeContext)
            .padding(.horizontal, Spacing.s4)

        FormFieldGroup("Guest") {
            PantopusTextField(
                "Name",
                text: Binding(
                    get: { viewModel.nameField.value },
                    set: { viewModel.updateName($0) }
                ),
                placeholder: "Sasha Petrov",
                state: viewModel.nameFieldState,
                isRequired: true,
                contentType: .name,
                identifier: "field_guestName"
            )
            VStack(alignment: .leading, spacing: Spacing.s1) {
                PantopusTextField(
                    "Email or phone",
                    text: Binding(
                        get: { viewModel.contactField.value },
                        set: { viewModel.updateContact($0) }
                    ),
                    placeholder: "sasha@petrov.co or (415) 555-…",
                    state: viewModel.contactFieldState,
                    isRequired: true,
                    keyboardType: .emailAddress,
                    identifier: "field_guestContact"
                )
                Text("We'll text or email them a one-tap pass link.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }

        FormFieldGroup("Access window") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                GuestFieldLabel("Duration", isRequired: true)
                ChipPicker(
                    options: viewModel.durationOptions,
                    selection: $viewModel.duration,
                    style: .tinted,
                    identifier: "field_duration"
                )
                HStack(spacing: Spacing.s1) {
                    Icon(.clock, size: 11, color: Theme.Color.appTextSecondary)
                    Text(viewModel.durationHint)
                        .pantopusTextStyle(.caption)
                        .italic()
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("durationHint")
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                GuestFieldLabel("Allowed areas", isRequired: false)
                ChipPicker(
                    options: viewModel.areaOptions,
                    selection: $viewModel.selectedAreas,
                    style: .tinted,
                    identifier: "field_areas"
                )
                Text(viewModel.areasHint)
                    .pantopusTextStyle(.caption)
                    .italic()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("areasHint")
            }
        }

        FormFieldGroup("Note") {
            WelcomeMessageEditor(
                text: Binding(
                    get: { viewModel.welcomeField.value },
                    set: { viewModel.updateWelcome($0) }
                ),
                maxLength: viewModel.welcomeMaxLength
            )
        }
    }
}

// MARK: - House-context strip

private struct HomeContextStrip: View {
    let context: AddGuestSampleData.HomeContext

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.home)
                    .frame(width: 30, height: 30)
                Icon(.home, size: 15, color: Theme.Color.appTextInverse)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(context.title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(context.subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Text("GUEST PASS")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.home)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 3)
                .background(Theme.Color.homeBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary100, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Guest pass for \(context.title), \(context.subtitle)")
    }
}

// MARK: - Field label with optional required marker

private struct GuestFieldLabel: View {
    let title: String
    let isRequired: Bool

    init(_ title: String, isRequired: Bool) {
        self.title = title
        self.isRequired = isRequired
    }

    var body: some View {
        HStack(spacing: 2) {
            Text(title)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if isRequired {
                Text("*")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityLabel(isRequired ? "\(title), required" : title)
    }
}

// MARK: - Welcome message editor

private struct WelcomeMessageEditor: View {
    @Binding var text: String
    let maxLength: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            GuestFieldLabel("Welcome message (optional)", isRequired: false)
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text("Anything they should know when they accept…")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s2 + 1)
                        .padding(.vertical, Spacing.s2)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $text)
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(minHeight: 92)
                    .padding(Spacing.s1)
                    .scrollContentBackground(.hidden)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .accessibilityIdentifier("field_welcome")
            }
            Text("\(text.count) / \(maxLength)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .accessibilityIdentifier("welcomeCharCount")
        }
    }
}
