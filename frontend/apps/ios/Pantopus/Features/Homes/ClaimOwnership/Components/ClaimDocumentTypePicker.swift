//
//  ClaimDocumentTypePicker.swift
//  Pantopus
//
//  "Select document type" card list used by both evidence variants —
//  five ownership documents (deed / closing disclosure / property tax
//  statement / title-escrow attestation / title record match) or three
//  residency documents. Mirrors RN's `docCard` list
//  (`src/app/homes/[id]/claim-owner/evidence.tsx:299-338`): icon disc,
//  label + description, check glyph on the selected row.
//

import SwiftUI

struct ClaimDocumentTypePicker: View {
    let options: [ClaimDocumentOption]
    let selected: String?
    var onSelect: (String) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(options) { option in
                row(for: option)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("claimDocumentTypePicker")
    }

    private func row(for option: ClaimDocumentOption) -> some View {
        let isSelected = selected == option.id
        return Button {
            onSelect(option.id)
        } label: {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(isSelected ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                    .frame(width: 36, height: 36)
                    .overlay {
                        Icon(
                            option.icon,
                            size: 18,
                            strokeWidth: 2,
                            color: isSelected ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                        )
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.label)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(isSelected ? Theme.Color.primary600 : Theme.Color.appText)
                    Text(option.detail)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s0)
                if isSelected {
                    Icon(.checkCircle, size: 20, strokeWidth: 2, color: Theme.Color.primary600)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: 1.5
                    )
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityLabel("\(option.label). \(option.detail)")
        .accessibilityIdentifier("claimDocumentType_\(option.id)")
    }
}

#Preview {
    ClaimDocumentTypePicker(
        options: ClaimEvidenceSlot.residency.documentOptions,
        selected: "utility_bill"
    )
    .padding()
    .background(Theme.Color.appBg)
}
