"""Reconcile the published, aggregate property study. No network or database access."""
import csv
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(name):
    with (ROOT / name).open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def verify():
    fields = read("field-dictionary.csv")
    cohort_rows = read("cohorts.csv")
    observations = read("cohort-fields.csv")
    totals = {
        (row["Source ID"], row["Class"]): int(row["Distinct assessment records"])
        for row in cohort_rows
    }
    names = [field["Screen field"] for field in fields]
    require(len(names) == len(set(names)) == 46, "Expected 46 distinct fields.")
    require(len(totals) == len(cohort_rows) == 39, "Expected 39 distinct cohorts.")
    require(sum(totals.values()) == 14_660_226, "Cohort denominators do not reconcile.")

    recovered = Counter()
    cells = {}
    for row in observations:
        source, subject, field = row["Source ID"], row["Property type"], row["Field"]
        key = (source, subject, field)
        value = int(row["Observed"]) if row["Observed"] else None
        required_status = ("unscored for source/subject" if value is None else
                           "measured zero" if value == 0 else "observed")
        denominator = totals[source, subject]
        require(key not in cells and field in names, f"Duplicate or unknown cell {key}.")
        require(int(row["Accounts"]) == denominator, f"Invalid denominator for {key}.")
        require(value is None or 0 <= value <= denominator, f"Invalid numerator for {key}.")
        require(row["Status"] == required_status, f"Wrong status for {key}.")
        cells[key] = value
        recovered[(subject, field)] += value or 0
    require(len(cells) == len(totals) * len(fields), "Missing cohort/field observation.")

    columns = {"House": "House found", "Townhouse": "Townhouse found", "Condo": "Condo found",
               "Apartment": "Apartment property found", "Office": "Office found"}
    for row in fields:
        field = row["Screen field"]
        for subject, column in columns.items():
            require(recovered[(subject, field)] == int(row[column]), f"Mismatch for {subject}/{field}.")
        total = sum(recovered[(subject, field)] for subject in columns)
        require(total == int(row["Found anywhere"]), f"Field total differs for {field}.")
    require(sum(int(row["Found anywhere"]) > 0 for row in fields) == 41, "Expected 41 observed fields.")

    files = read("government-files.csv")
    require(len(files) == len({(r["Source ID"], r["Publishing jurisdiction"]) for r in files}) == 417,
            "Bulk file inventory mismatch.")
    geography = read("jurisdiction-fields.csv")
    local_totals, local_fields = Counter(), Counter()
    for row in geography:
        source, subject = row["Source ID"], row["Property cohort"]
        local_totals[source, subject] += int(row["Accounts"])
        for field in names:
            if row[field]:
                local_fields[source, subject, field] += int(row[field])
    for key, denominator in totals.items():
        if key[0] in {"FL", "MA"}:
            require(local_totals[key] == denominator, f"Local denominator differs for {key}.")
            for field in names:
                cell = (*key, field)
                local_value = local_fields[cell] if cell in local_fields else None
                require(local_value == cells[cell], f"Local field rollup differs for {cell}.")

    states, counties = read("state-routes.csv"), read("national-jurisdictions.csv")
    codes = [r["County/equivalent FIPS (text)"] for r in counties]
    require(len({r["State/territory"] for r in states}) == 56, "State/territory scope differs.")
    require(len(codes) == len(set(codes)) == 3235 and all(len(c) == 5 and c.isdigit() for c in codes),
            "Invalid Census identifiers.")
    print("Verified 14,660,226 assessment records, 39 cohorts and 46 field totals.")
    print("Reconciled 417 source files, 56 scope entries and 3,235 county/equivalent IDs.")


if __name__ == "__main__":
    verify()
