# Source boundaries

- `app/` contains only Next.js routing concerns: pages, layouts, metadata,
  route groups, dynamic segments, and global styles.
- `frontend/` contains screens, components, hooks, animation, asset manifests,
  and browser rendering logic.
- `backend/` contains repository contracts and data implementations. The current
  `local/` adapter uses browser storage; a future MySQL adapter belongs beside
  it and is selected from `backend/data/index.ts`.

Keep `page.tsx` files thin and import their UI from `frontend/screens`. This
preserves URL structure while keeping route definitions separate from feature
implementations.
