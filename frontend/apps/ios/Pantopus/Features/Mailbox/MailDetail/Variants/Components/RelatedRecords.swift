//
//  RelatedRecords.swift
//  Pantopus
//
//  A17.10 — RelatedRecords. The "Other statements · this account" strip
//  rendered only in the filed state: each row carries a slate-tinted
//  document thumbnail (period label inside), the period title, a
//  lock-icon filed date, and the ending balance in mono on the right.
//
//  Design reference: `docs/designs/A17/records.jsx` (RelatedRecords).
//

import SwiftUI

/// Sibling records strip. Renders nothing when `records` is empty;
/// caller is expected to gate visibility on the filed state.
@MainActor
struct RelatedRecords: View {
    let records: [RelatedRecord]
    let total: Int

    init(records: [RelatedRecord], total: Int? = nil) {
        self.records = records
        self.total = total ?? records.count
    }

    var body: some View {
        if records.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                header
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                ForEach(Array(records.enumerated()), id: \.element.id) { index, record in
                    row(record)
                    if index < records.count - 1 {
                        Rectangle()
                            .fill(Theme.Color.appBorderSubtle)
                            .frame(height: 1)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .accessibilityIdentifier("mailDetail_records_relatedRecords")
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: Spacing.s1) {
            Text("OTHER STATEMENTS · THIS ACCOUNT")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            HStack(spacing: 3) {
                Text("See all \(total)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
                Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
            }
            .accessibilityIdentifier("mailDetail_records_relatedRecords_seeAll")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s2)
    }

    private func row(_ record: RelatedRecord) -> some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            documentThumbnail(record.period)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(record.period) Statement")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                HStack(spacing: 3) {
                    Icon(.lock, size: 9, color: Theme.Color.appTextSecondary)
                    Text(record.filedWhen)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
            Text(record.amount)
                .font(.system(size: 12.5, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.Color.categoryRecordsDeep)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(record.period) Statement, \(record.filedWhen), balance \(record.amount)"
        )
    }

    private func documentThumbnail(_ period: String) -> some View {
        // Mini document tile: 30×36 with the quarter label stacked under
        // a tiny file-text glyph. Decorative — accessibility is on the
        // row itself.
        let quarter = period.split(separator: " ").first.map(String.init) ?? period
        return VStack(spacing: 1) {
            Icon(.fileText, size: 11, color: Theme.Color.categoryRecordsDeep)
            Text(quarter)
                .font(.system(size: 7, weight: .heavy))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.categoryRecordsDeep)
        }
        .frame(width: 30, height: 36)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xs)
                .stroke(Theme.Color.categoryRecordsBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs))
        .accessibilityHidden(true)
    }
}

#Preview("RelatedRecords") {
    RelatedRecords(records: RecordsSampleData.record.related, total: 8)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
