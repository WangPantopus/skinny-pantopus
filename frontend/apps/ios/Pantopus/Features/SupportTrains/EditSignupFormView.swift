//
//  EditSignupFormView.swift
//  Pantopus
//
//  P3.7 — Organizer-side Edit Signup form. Built on the shared
//  `FormShell` archetype with three field groups: kind-specific
//  contribution, drop-off time inside the recipient's window, and
//  organizer-only dietary / accommodation notes. The form prefills
//  from the seed reservation, validates on every keystroke, and on
//  Save writes an optimistic patch into
//  `SupportTrainReservationsStore.shared` so the Review-signups list
//  reflects the edit when the user pops back.
//

import SwiftUI

@MainActor
public struct EditSignupFormView: View {
    @State private var viewModel: EditSignupFormViewModel
    private let onClose: @MainActor () -> Void

    public init(
        reservation: SupportTrainReservationDTO,
        onClose: @escaping @MainActor () -> Void,
        onSaved: @escaping @MainActor (SupportTrainReservationDTO) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: EditSignupFormViewModel(
            reservation: reservation,
            onSaved: onSaved
        ))
        self.onClose = onClose
    }

    public var body: some View {
        FormShell(
            title: "Edit signup",
            rightActionLabel: "Save",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: onClose,
            onCommit: { Task { await viewModel.save() } },
            content: {
                contributionGroup
                timingGroup
                notesGroup
            }
        )
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .overlay(alignment: .bottom) { toastOverlay }
        .onChange(of: viewModel.shouldDismiss) { _, dismiss in
            if dismiss {
                viewModel.acknowledgeDismiss()
                onClose()
            }
        }
        .accessibilityIdentifier("editSignupForm")
    }

    // MARK: - Groups

    private var contributionGroup: some View {
        FormFieldGroup("Contribution") {
            PantopusTextField(
                viewModel.contributionLabel,
                text: binding(.contribution),
                placeholder: viewModel.contributionPlaceholder,
                state: fieldState(.contribution),
                identifier: "editSignupContributionField"
            )
        }
    }

    private var timingGroup: some View {
        FormFieldGroup("Drop-off time") {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Drop-off time")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                DatePicker(
                    "Drop-off time",
                    selection: dateBinding,
                    displayedComponents: .hourAndMinute
                )
                .labelsHidden()
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("editSignupDropoffTimeField")
                if case let .error(message) = fieldState(.dropoffTime) {
                    Text(message)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                }
                Text("Pick a time inside the recipient's preferred drop window.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private var notesGroup: some View {
        FormFieldGroup("Dietary notes") {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Dietary / accommodation notes")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextEditor(text: binding(.dietaryNotes))
                    .frame(minHeight: 96)
                    .padding(Spacing.s2)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(
                                notesBorderColor,
                                lineWidth: 1
                            )
                    )
                    .accessibilityIdentifier("editSignupDietaryNotesField")
                if case let .error(message) = fieldState(.dietaryNotes) {
                    Text(message)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                }
                Text("Only the organizer sees this. Helpful for allergies or access needs.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    // MARK: - Overlays

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s10)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
                .accessibilityIdentifier("editSignupToast")
        }
    }

    // MARK: - Bindings

    private func binding(_ field: EditSignupField) -> Binding<String> {
        Binding(
            get: { viewModel.fields[field]?.value ?? "" },
            set: { viewModel.update(field, to: $0) }
        )
    }

    private var dateBinding: Binding<Date> {
        Binding(
            get: { Self.parseTime(viewModel.fields[.dropoffTime]?.value ?? "") ?? Date() },
            set: { viewModel.update(.dropoffTime, to: Self.formatTime($0)) }
        )
    }

    private func fieldState(_ field: EditSignupField) -> PantopusFieldState {
        guard let snapshot = viewModel.fields[field], snapshot.touched else { return .default }
        if let error = snapshot.error { return .error(error) }
        return snapshot.value.trimmingCharacters(in: .whitespaces).isEmpty ? .default : .valid
    }

    private var notesBorderColor: Color {
        switch fieldState(.dietaryNotes) {
        case .error: Theme.Color.error
        case .valid: Theme.Color.success
        case .default: Theme.Color.appBorder
        }
    }

    // MARK: - Time helpers

    private static func parseTime(_ value: String) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "HH:mm"
        return formatter.date(from: value)
    }

    private static func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        EditSignupFormView(
            reservation: SupportTrainReservationDTO(
                id: "preview",
                slotId: "slot-1",
                userId: "user-1",
                guestName: nil,
                status: "pending",
                contributionMode: "cook",
                dishTitle: "Veggie chili with cornbread",
                restaurantName: nil,
                estimatedArrivalAt: "2025-10-22T18:00:00Z",
                noteToRecipient: "Knocking on the door at 6 sharp.",
                privateNoteToOrganizer: "Vegetarian only.",
                createdAt: "2025-10-20T10:00:00Z",
                updatedAt: "2025-10-20T10:00:00Z",
                canceledAt: nil,
                helper: SupportTrainHelperDTO(
                    id: "user-1",
                    username: "lena",
                    name: "Lena Park",
                    profilePictureUrl: nil
                )
            )
        ) {}
    }
}
