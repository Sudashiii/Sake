# Mobile Search Card Responsiveness Pass

## Scope
- Improve `/search` mobile UX:
  - Search form/button alignment
  - Smaller title on result cards
  - Move `Download` + `Library` actions to bottom row of each card

## Steps
1. Update `BookCard.svelte` mobile layout to wrap into two rows:
   - top: cover + text
   - bottom: full-width action row
2. Reduce mobile title sizing and preserve readable 2-3 line truncation.
3. Tighten `/search` mobile search bar/button spacing/alignment.
4. Run `bun run check`.
5. Delete this plan file after completion.

## Done criteria
- Buttons sit at the bottom of card on mobile.
- Mobile title is visually less dominant.
- Search button aligns cleanly within the search box container.
