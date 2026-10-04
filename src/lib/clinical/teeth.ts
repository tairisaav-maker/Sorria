/** Numeração FDI — 32 dentes permanentes, ordem visual odontológica. */
export const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11] as const;
export const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28] as const;
export const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38] as const;
export const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41] as const;

export const ALL_PERMANENT_TEETH = [
  ...UPPER_RIGHT,
  ...UPPER_LEFT,
  ...LOWER_RIGHT,
  ...LOWER_LEFT,
] as const;

export type FdiTooth = (typeof ALL_PERMANENT_TEETH)[number];

export function isValidFdiTooth(n: number): n is FdiTooth {
  return (ALL_PERMANENT_TEETH as readonly number[]).includes(n);
}
