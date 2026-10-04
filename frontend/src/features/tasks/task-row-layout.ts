// Two mobile badge rows include inline baseline space (about 49px), not only badge heights.
// Reserve 50px in both real rows and placeholders without limiting longer content.
export const taskRowContentClassName =
  "grid grid-cols-[5rem_minmax(0,1fr)] grid-rows-[minmax(2.75rem,auto)_minmax(3.125rem,auto)] items-start gap-x-2 gap-y-1 px-3 py-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:grid-rows-[minmax(2.75rem,auto)_minmax(1.5rem,auto)] sm:px-3";
