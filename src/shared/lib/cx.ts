type ClassValue = string | undefined | null | false

/**
 * Joins class names, dropping falsy values. Exists because CSS Modules class
 * lookups (`styles['button']`) are typed `string | undefined` under this
 * project's `noUncheckedIndexedAccess` + `noPropertyAccessFromIndexSignature`
 * tsconfig, so composing classNames directly would require scattering `?? ''`
 * everywhere.
 */
export function cx(...values: ClassValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(' ')
}
