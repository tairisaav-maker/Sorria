/**
 * Intervalos half-open [start, end).
 * 10:00–11:00 e 11:00–12:00 NÃO conflitam.
 * 10:00–11:00 e 10:59–12:00 conflitam.
 */
export function rangesOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  const as = +new Date(aStart);
  const ae = +new Date(aEnd);
  const bs = +new Date(bStart);
  const be = +new Date(bEnd);
  return as < be && bs < ae;
}
