-- Separate ordering from content revisions so reordering cannot invalidate an editor.
CREATE TABLE builder_set_order (
 builder_id TEXT PRIMARY KEY REFERENCES builder_sets(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>0)
);
