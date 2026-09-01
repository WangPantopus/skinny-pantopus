"""Manual script to backfill the seeder content queue from configured sources for testing."""


def backfill(region: str) -> None:
    """Fetch from all sources for the given region and populate the queue."""
    raise NotImplementedError


if __name__ == "__main__":
    backfill("clark_county")
