export function AdminSortStateInputs({
  sortKey,
  sortDirection,
}: {
  sortKey?: string | null;
  sortDirection?: string | null;
}) {
  return (
    <>
      {sortKey ? <input name="sort" type="hidden" value={sortKey} /> : null}
      {sortDirection ? <input name="dir" type="hidden" value={sortDirection} /> : null}
    </>
  );
}
