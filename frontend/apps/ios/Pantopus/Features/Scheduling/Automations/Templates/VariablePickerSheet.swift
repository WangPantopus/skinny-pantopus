//
//  VariablePickerSheet.swift
//  Pantopus
//
//  Stream I16 — H6 Variable Picker (local sheet, no route). Inserts a dynamic
//  `{{token}}` into a workflow or template message. A search field over grouped
//  cards (EVENT / PEOPLE / LINKS); each row shows a human label, a mono token
//  chip, and a sample value, and inserts + dismisses on tap. Catalog is the
//  client-side `TemplateVariableCatalog`; the backend `/preview` interpolates any
//  token. Pure local state — no networking.
//

import SwiftUI

struct VariablePickerSheet: View {
    var accent: Color = Theme.Color.primary600
    let onInsert: (TemplateVariable) -> Void
    let onClose: () -> Void

    @State private var query = ""

    private var groups: [VariableSection] {
        TemplateVariableCatalog.grouped(filter: query)
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            AutoSheetHeader(title: "Insert variable", onClose: onClose)
            searchField
            if groups.isEmpty {
                noResults
            } else {
                list
            }
        }
        .background(Theme.Color.appBg)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("scheduling.templates.variablePicker")
    }

    private var searchField: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 15, color: Theme.Color.appTextMuted)
            TextField("Search variables", text: $query)
                .font(.system(size: 14))
                .foregroundStyle(Theme.Color.appText)
                .autocorrectionDisabled()
        }
        .padding(.horizontal, 12)
        .frame(height: 42)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s2)
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                ForEach(groups) { entry in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        AutoOverline(text: entry.group.rawValue).padding(.horizontal, 2)
                        AutoCard(padding: EdgeInsets(top: Spacing.s0, leading: 14, bottom: Spacing.s0, trailing: 14)) {
                            VStack(spacing: Spacing.s0) {
                                ForEach(Array(entry.items.enumerated()), id: \.element.id) { idx, variable in
                                    row(variable)
                                    if idx < entry.items.count - 1 { AutoRowDivider() }
                                }
                            }
                        }
                    }
                }
                Color.clear.frame(height: Spacing.s4)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
        }
    }

    private func row(_ variable: TemplateVariable) -> some View {
        Button { onInsert(variable) } label: {
            HStack(spacing: Spacing.s2) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(variable.label).font(.system(size: 14.5, weight: .medium)).foregroundStyle(Theme.Color.appText)
                    Text(variable.token)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.Color.primary700)
                        .padding(.horizontal, Spacing.s2)
                        .padding(.vertical, 2)
                        .background(Theme.Color.primary50)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                }
                Spacer(minLength: Spacing.s2)
                Text(variable.sample)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(1)
            }
            .padding(.vertical, 11)
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("variableRow_\(variable.key)")
        .accessibilityLabel("Insert \(variable.label), \(variable.token)")
    }

    private var noResults: some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 72, height: 72)
                Icon(.search, size: 30, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text("No variables match").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.Color.appText)
            Text("Try a different word, or use the event link variables.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 230)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
    }
}
