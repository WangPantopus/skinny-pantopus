//
//  SavedPlaceSkeletonRow.swift
//  Pantopus
//

import SwiftUI

struct SavedPlaceSkeletonRow: View {
    var body: some View {
        HStack(spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: Radii.lg).fill(Theme.Color.appSurfaceSunken).frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                RoundedRectangle(cornerRadius: Radii.xs).fill(Theme.Color.appSurfaceSunken).frame(width: 140, height: 12)
                RoundedRectangle(cornerRadius: Radii.xs).fill(Theme.Color.appSurfaceSunken).frame(width: 90, height: 10)
                RoundedRectangle(cornerRadius: Radii.xs).fill(Theme.Color.appSurfaceSunken).frame(width: 110, height: 10)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 11)
        .redacted(reason: .placeholder)
    }
}
