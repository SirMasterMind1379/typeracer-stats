# Disapproved Feature Proposals

These features were proposed for TypeRacer Stats but were **not approved** for development, listed here for reference and traceability.

## Multi-user comparison
Side-by-side stats, overlay chart lines for two users, or head-to-head race history. Adds significant complexity for niche value; single-user focus preferred.

## Race timeline / replay
Intra-race WPM graph (speed fluctuation within a single race). The API does not provide per-race keystroke data, making this infeasible without a userscript capturing live race data.

## Full dashboard export
One-click download of the entire dashboard as a single PNG or PDF. Low perceived value vs. implementation complexity; individual chart/heatmap export already exists.

## Leaderboard snapshots
Show rank over time if TypeRacer exposes public leaderboards. No reliable public leaderboard API available; scraping would be brittle.

## Improvement by mode
Separate trend lines for each race mode. Superseded by the broader *per-mode statistics* feature (see README).
