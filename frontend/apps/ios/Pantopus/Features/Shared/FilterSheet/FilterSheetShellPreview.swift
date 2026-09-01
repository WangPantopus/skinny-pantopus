//
//  FilterSheetShellPreview.swift
//  Pantopus
//

import SwiftUI

#Preview("Populated") {
    FilterSheetShell(
        title: "Filters",
        sections: [
            FilterSection(
                id: "category",
                title: "Category",
                control: .chipGroup(
                    options: [
                        FilterOption(id: "handyman", label: "Handyman"),
                        FilterOption(id: "cleaning", label: "Cleaning"),
                        FilterOption(id: "moving", label: "Moving"),
                        FilterOption(id: "pets", label: "Pet care"),
                        FilterOption(id: "tutoring", label: "Tutoring")
                    ],
                    selectedIds: ["handyman", "moving"]
                )
            ),
            FilterSection(
                id: "sort",
                title: "Sort by",
                control: .radio(
                    options: [
                        FilterOption(id: "recent", label: "Most recent"),
                        FilterOption(id: "price-asc", label: "Price: low to high"),
                        FilterOption(id: "price-desc", label: "Price: high to low"),
                        FilterOption(id: "distance", label: "Distance")
                    ],
                    selectedId: "recent"
                )
            ),
            FilterSection(
                id: "tags",
                title: "Tags",
                control: .multiSelect(
                    options: [
                        FilterOption(id: "verified", label: "Verified posters"),
                        FilterOption(id: "delivery", label: "Delivery available"),
                        FilterOption(id: "negotiable", label: "Price negotiable")
                    ],
                    selectedIds: ["verified"]
                )
            ),
            FilterSection(
                id: "price",
                title: "Price",
                control: .rangeSlider(
                    FilterRange(min: 0, max: 500, lower: 50, upper: 350, step: 10)
                )
            )
        ],
        onApply: { _ in },
        onClose: {}
    )
    .frame(height: 600)
    .background(Theme.Color.appBg)
}
