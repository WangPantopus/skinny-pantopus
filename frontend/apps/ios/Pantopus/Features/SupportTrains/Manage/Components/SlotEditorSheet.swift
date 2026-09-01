//
//  SlotEditorSheet.swift
//  Pantopus
//
//  S1 — organizer add / edit for one Support Train date. Mirrors RN's
//  `components/support-trains/SupportTrainSlotEditorSheet.tsx`: date,
//  slot label, support mode and the drop-off window. Posts through
//  `POST /:id/slots` (add) or `PATCH /:id/slots/:slotId` (edit); both
//  Joi schemas cap the label / mode to the enums surfaced here.
//

import SwiftUI

@MainActor
public struct SlotEditorSheet: View {
    @State private var editor: ManageSlotEditorState
    private let allowGroceries: Bool
    private let isSubmitting: Bool
    private let onSave: @MainActor (ManageSlotEditorState) -> Void
    private let onCancel: @MainActor () -> Void

    public init(
        editor: ManageSlotEditorState,
        allowGroceries: Bool = true,
        isSubmitting: Bool = false,
        onSave: @escaping @MainActor (ManageSlotEditorState) -> Void,
        onCancel: @escaping @MainActor () -> Void
    ) {
        _editor = State(initialValue: editor)
        self.allowGroceries = allowGroceries
        self.isSubmitting = isSubmitting
        self.onSave = onSave
        self.onCancel = onCancel
    }

    private var modes: [String] {
        allowGroceries
            ? ManageSlotEditorState.modes
            : ManageSlotEditorState.modes.filter { $0 != "groceries" }
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    DatePicker(
                        "Date",
                        selection: $editor.slotDate,
                        displayedComponents: .date
                    )
                    .accessibilityIdentifier("slotEditorDatePicker")

                    fieldLabel("What kind of date is this?")
                    chipRow(
                        options: ManageSlotEditorState.labels,
                        selection: editor.slotLabel,
                        identifierPrefix: "slotEditorLabel"
                    ) { editor.slotLabel = $0 }

                    fieldLabel("How can neighbors help?")
                    chipRow(
                        options: modes,
                        selection: editor.supportMode,
                        identifierPrefix: "slotEditorMode"
                    ) { editor.supportMode = $0 }

                    DatePicker(
                        "Window opens",
                        selection: $editor.startTime,
                        displayedComponents: .hourAndMinute
                    )
                    .accessibilityIdentifier("slotEditorStartPicker")

                    DatePicker(
                        "Window closes",
                        selection: $editor.endTime,
                        displayedComponents: .hourAndMinute
                    )
                    .accessibilityIdentifier("slotEditorEndPicker")

                    if editor.endTime <= editor.startTime {
                        Text("The window has to close after it opens.")
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.Color.error)
                    }
                }
                .padding(Spacing.s5)
            }
            footer
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("slotEditorSheet")
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onCancel) {
                Icon(.x, size: 20, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("slotEditorCloseButton")

            Spacer(minLength: Spacing.s0)

            Text(editor.isEditing ? "Edit date" : "Add a date")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)

            Spacer(minLength: Spacing.s0)

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private var footer: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            Button {
                onSave(editor)
            } label: {
                Text(editor.isEditing ? "Save date" : "Add date")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(canSave ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .accessibilityIdentifier("slotEditorSaveButton")
        }
        .background(Theme.Color.appBg)
    }

    private var canSave: Bool {
        !isSubmitting && editor.endTime > editor.startTime
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12.5, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextSecondary)
    }

    private func chipRow(
        options: [String],
        selection: String,
        identifierPrefix: String,
        onSelect: @escaping @MainActor (String) -> Void
    ) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(options, id: \.self) { option in
                    Button {
                        onSelect(option)
                    } label: {
                        Text(option.capitalized)
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(
                                option == selection ? Theme.Color.appTextInverse : Theme.Color.appText
                            )
                            .padding(.horizontal, Spacing.s3)
                            .frame(height: 34)
                            .background(
                                option == selection ? Theme.Color.primary600 : Theme.Color.appSurface
                            )
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(
                                    option == selection ? Theme.Color.primary600 : Theme.Color.appBorder,
                                    lineWidth: 1
                                )
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("\(identifierPrefix)-\(option)")
                }
            }
        }
    }
}

#Preview("Add a date") {
    SlotEditorSheet(
        editor: ManageSlotEditorState(
            slotId: nil,
            slotDate: Date(),
            slotLabel: "Dinner",
            supportMode: "meal",
            startTime: Date(),
            endTime: Date().addingTimeInterval(7200)
        ),
        onSave: { _ in },
        onCancel: {}
    )
}
