//
//  EditProfileView+Fields.swift
//  Pantopus
//
//  Field groups and input builders for `EditProfileView`.
//

import SwiftUI

extension EditProfileView {
    /// A13.9 §① — avatar + "Change photo". The photo does not ride the
    /// PATCH body; it has its own multipart route
    /// (`POST /api/upload/profile-picture`), so the block sits above the
    /// field groups rather than inside one.
    var avatarSection: some View {
        EditProfileAvatarBlock(
            avatarURL: viewModel.avatarURL,
            initial: viewModel.avatarInitial,
            state: viewModel.avatarState,
            onPicked: { data, filename, mimeType in
                Task { await viewModel.uploadAvatar(data: data, filename: filename, mimeType: mimeType) }
            },
            onDismissError: { viewModel.dismissAvatarError() }
        )
        .padding(.bottom, Spacing.s2)
    }

    var aboutSection: some View {
        FormFieldGroup("About") {
            textField(.firstName, label: "First name")
            textField(.middleName, label: "Middle name (optional)")
            textField(.lastName, label: "Last name")
            taglineField
            bioField
        }
    }

    /// Skills ride `PUT /api/users/skills`, not the profile PATCH, but
    /// they commit through the same Save so the group sits inline with
    /// the rest of the form (`backend/routes/users.js:2246`).
    var skillsSection: some View {
        FormFieldGroup("Skills") {
            EditProfileSkillsBlock(
                skills: viewModel.skills,
                draft: viewModel.skillDraft,
                canAdd: viewModel.canAddSkill,
                onDraftChange: { viewModel.skillDraft = $0 },
                onAdd: { viewModel.addSkill() },
                onRemove: { viewModel.removeSkill($0) }
            )
        }
    }

    var contactSection: some View {
        FormFieldGroup("Contact") {
            // Note: the design allows editing email when `verified ==
            // false`. `updateProfileSchema` exposes no `email` key, so
            // the field is read-only until the backend adds it.
            readOnlyEmail
            textField(
                .phoneNumber,
                label: "Phone (optional)",
                placeholder: "+15555550123",
                keyboardType: .phonePad,
                contentType: .telephoneNumber
            )
            dateOfBirthField
        }
    }

    var addressSection: some View {
        FormFieldGroup("Address") {
            textField(
                .address,
                label: "Street",
                placeholder: "123 Main St",
                contentType: .streetAddressLine1
            )
            textField(
                .city,
                label: "City",
                contentType: .addressCity
            )
            HStack(alignment: .top, spacing: Spacing.s2) {
                textField(.state, label: "State", contentType: .addressState)
                textField(.zipcode, label: "Zip", contentType: .postalCode)
            }
        }
    }

    var socialSection: some View {
        FormFieldGroup("Social") {
            textField(
                .website,
                label: "Website",
                placeholder: "https://example.com",
                keyboardType: .URL,
                contentType: .URL
            )
            textField(.linkedin, label: "LinkedIn", placeholder: "https://linkedin.com/in/…", keyboardType: .URL)
            textField(.twitter, label: "Twitter / X", placeholder: "https://x.com/…", keyboardType: .URL)
            textField(.instagram, label: "Instagram", placeholder: "https://instagram.com/…", keyboardType: .URL)
            textField(.facebook, label: "Facebook", placeholder: "https://facebook.com/…", keyboardType: .URL)
        }
    }

    var visibilitySection: some View {
        // Note: the design also calls for a `show_in_neighbor_discovery`
        // toggle. That key isn't in `updateProfileSchema` today, so it
        // stays omitted; the 3-way `profileVisibility` enum and the two
        // contact-visibility booleans below are the schema's full set
        // (`backend/routes/users.js:797-800`).
        FormFieldGroup("Visibility") {
            visibilityPicker
            contactVisibilityToggle(
                .showEmail,
                label: "Show Email on Profile",
                subtitle: "Neighbors viewing your profile can see your email address."
            )
            contactVisibilityToggle(
                .showPhone,
                label: "Show Phone on Profile",
                subtitle: "Neighbors viewing your profile can see your phone number."
            )
        }
    }

    /// Boolean row backed by a `"true"` / `"false"` `FormFieldState`, so it
    /// flows through the same dirty / discard / PATCH machinery as every
    /// other field. Mirrors RN `settings.tsx:236`.
    @ViewBuilder
    func contactVisibilityToggle(
        _ key: EditProfileField,
        label: String,
        subtitle: String
    ) -> some View {
        let snapshot = viewModel.fields[key] ?? FormFieldState(id: key.rawValue, originalValue: "false")
        let isOn = snapshot.value == "true"
        HStack(spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                EditProfileFieldLabel(label, dirty: snapshot.isDirty)
                Text(subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: Spacing.s0)
            Toggle(
                "",
                isOn: Binding(
                    get: { isOn },
                    set: { viewModel.update(key, to: $0 ? "true" : "false") }
                )
            )
            .labelsHidden()
            .tint(Theme.Color.primary600)
            .accessibilityIdentifier("field_\(key.rawValue)")
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(label), \(isOn ? "on" : "off")")
    }

    @ViewBuilder
    func textField(
        _ key: EditProfileField,
        label: String,
        placeholder: String = "",
        keyboardType: UIKeyboardType = .default,
        contentType: UITextContentType? = nil
    ) -> some View {
        let snapshot = viewModel.fields[key] ?? FormFieldState(id: key.rawValue, originalValue: "")
        let binding = Binding<String>(
            get: { snapshot.value },
            set: { viewModel.update(key, to: $0) }
        )
        PantopusTextField(
            label,
            text: binding,
            placeholder: placeholder,
            state: fieldState(for: snapshot),
            isRequired: isRequiredField(key),
            isDirty: snapshot.isDirty,
            keyboardType: keyboardType,
            contentType: contentType,
            identifier: "field_\(key.rawValue)"
        )
    }

    var taglineField: some View {
        textField(
            .tagline,
            label: "Tagline (optional)",
            placeholder: "A short headline"
        )
    }

    @ViewBuilder var bioField: some View {
        let snapshot = viewModel.fields[.bio] ?? FormFieldState(id: "bio", originalValue: "")
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack {
                EditProfileFieldLabel("Bio", dirty: snapshot.isDirty)
                Spacer()
                generateBioButton
            }
            TextEditor(text: Binding(
                get: { snapshot.value },
                set: { viewModel.update(.bio, to: $0) }
            ))
            .frame(minHeight: 96)
            .padding(Spacing.s2)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        snapshot.error != nil ? Theme.Color.error : Theme.Color.appBorder,
                        lineWidth: 1
                    )
            )
            if let error = snapshot.error {
                Text(error)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
            if case let .failed(message) = viewModel.bioDraftState {
                HStack(spacing: Spacing.s2) {
                    Text(message)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Dismiss") { viewModel.dismissBioDraftError() }
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .accessibilityIdentifier("editProfileBioDraftError")
            }
        }
        .accessibilityIdentifier("field_bio")
    }

    /// "Generate with AI" — drafts a bio through `POST /api/ai/draft/post`
    /// from the name / skills / tagline / city already on the form and
    /// writes it into the bio field, where it rides the normal PATCH.
    /// Disabled while in flight and while the form has nothing to prompt
    /// with, so the CTA is never enabled when the route would refuse.
    @ViewBuilder var generateBioButton: some View {
        let isGenerating = viewModel.bioDraftState == .generating
        let tint = viewModel.canGenerateBio ? Theme.Color.primary600 : Theme.Color.appTextMuted
        Button {
            Task { await viewModel.generateBio() }
        } label: {
            HStack(spacing: Spacing.s1) {
                if isGenerating {
                    ProgressView().controlSize(.small)
                } else {
                    Icon(.sparkles, size: 13, color: tint)
                }
                Text(isGenerating ? "Generating…" : "Generate with AI")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(tint)
            }
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .disabled(!viewModel.canGenerateBio)
        .accessibilityIdentifier("editProfileGenerateBioButton")
        .accessibilityHint("Drafts a bio from your name, skills, tagline and city")
    }

    @ViewBuilder var dateOfBirthField: some View {
        let snapshot = viewModel.fields[.dateOfBirth]
            ?? FormFieldState(id: "dateOfBirth", originalValue: "")
        let dateBinding = Binding<Date>(
            get: { Self.parseISO(snapshot.value) ?? Date() },
            set: { viewModel.update(.dateOfBirth, to: Self.formatISO($0)) }
        )
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack {
                EditProfileFieldLabel("Date of birth (optional)", dirty: snapshot.isDirty)
                Spacer()
                if !snapshot.value.isEmpty {
                    Button("Clear") { viewModel.update(.dateOfBirth, to: "") }
                        .font(Theme.Font.role(.caption))
                        .foregroundStyle(Theme.Color.primary600)
                        .accessibilityIdentifier("field_dateOfBirth_clear")
                }
            }
            DatePicker(
                "Date of birth",
                selection: dateBinding,
                in: ...Date(),
                displayedComponents: .date
            )
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        snapshot.error != nil ? Theme.Color.error : Theme.Color.appBorder,
                        lineWidth: 1
                    )
            )
            .accessibilityIdentifier("field_dateOfBirth")
            if let error = snapshot.error {
                Text(error)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
        }
    }

    var readOnlyEmail: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Email")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack {
                Text(viewModel.email)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                if viewModel.emailVerified {
                    Icon(.check, size: 16, color: Theme.Color.success)
                }
            }
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .accessibilityIdentifier("field_email")
            .accessibilityLabel("Email \(viewModel.email), read only")
        }
    }

    @ViewBuilder var visibilityPicker: some View {
        let snapshot = viewModel.fields[.profileVisibility] ?? FormFieldState(
            id: "profileVisibility", originalValue: "public"
        )
        VStack(alignment: .leading, spacing: Spacing.s1) {
            EditProfileFieldLabel("Profile visibility", dirty: snapshot.isDirty)
            Picker(
                "Profile visibility",
                selection: Binding(
                    get: { snapshot.value },
                    set: { viewModel.update(.profileVisibility, to: $0) }
                )
            ) {
                Text("Public").tag("public")
                Text("Registered").tag("registered")
                Text("Private").tag("private")
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("field_profileVisibility")
        }
    }

    func fieldState(for snapshot: FormFieldState) -> PantopusFieldState {
        if let error = snapshot.error { return .error(error) }
        if snapshot.touched, snapshot.isDirty { return .valid }
        return .default
    }

    func isRequiredField(_ field: EditProfileField) -> Bool {
        field == .firstName || field == .lastName
    }

    private static func makeISOFormatter() -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }

    private static func parseISO(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        return makeISOFormatter().date(from: trimmed)
    }

    private static func formatISO(_ date: Date) -> String {
        makeISOFormatter().string(from: date)
    }
}
