import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'

/**
 * Regression guard for the contrast defect found in independent review of
 * the navigation/color-token increment (2026-10): a text link reused
 * --color-primary/-hover (tuned for white BUTTON text on a primary
 * background) as its own foreground color on --color-surface, measuring
 * 2.49:1 resting / 2.09:1 hover in Dark - both failing WCAG AA's 4.5:1 for
 * normal text.
 *
 * This test parses the REAL tokens.css source (not a hand-copied value
 * list) so a future edit to any of these hex values is checked against the
 * same thresholds automatically, instead of relying on someone re-running
 * a manual audit.
 */

interface ThemeTokens {
  [name: string]: string
}

function extractBlock(css: string, selector: RegExp): string {
  const match = selector.exec(css)
  if (!match) throw new Error(`tokens.css block not found for ${selector.source}`)
  const start = match.index + match[0].length
  const end = css.indexOf('\n}', start)
  return css.slice(start, end)
}

function parseTokens(block: string): ThemeTokens {
  const tokens: ThemeTokens = {}
  const declRegex = /--([a-z0-9-]+):\s*([^;]+);/gi
  let decl: RegExpExecArray | null
  while ((decl = declRegex.exec(block))) {
    const name = decl[1]
    const value = decl[2]
    if (name == null || value == null) continue // regex always captures both groups when it matches
    tokens[name] = value.trim()
  }
  return tokens
}

function lookup(tokens: ThemeTokens, name: string): string {
  const found = Object.entries(tokens).find(([key]) => key === name)
  if (!found) throw new Error(`Unknown token referenced: --${name}`)
  return found[1]
}

/** Resolves `var(--other-token)` aliasing, following the chain until a
 * literal hex value is reached - e.g. in Light, --color-link points at
 * --color-primary-accent, which itself points at --color-primary (two
 * levels). A depth cap just guards against an accidental alias cycle. */
function resolve(value: string, tokens: ThemeTokens, depth = 0): string {
  if (depth > 10) throw new Error(`Alias chain too deep or cyclic starting from "${value}"`)
  const aliasMatch = /^var\(--([a-z0-9-]+)\)$/i.exec(value)
  const aliasName = aliasMatch?.[1]
  if (aliasName == null) return value
  return resolve(lookup(tokens, aliasName), tokens, depth + 1)
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16)) as [number, number, number]
}

function linearize(channel8bit: number): number {
  const srgb = channel8bit / 255
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

function contrast(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA))
  const lumB = relativeLuminance(hexToRgb(hexB))
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA]
  return (lighter + 0.05) / (darker + 0.05)
}

const lightBlock = parseTokens(extractBlock(tokensCss, /:root\s*\{/))
const darkBlock = parseTokens(extractBlock(tokensCss, /:root\[data-theme=['"]dark['"]\]\s*\{/))

// Dark inherits anything it doesn't redefine (e.g. shadows do, brand tokens
// don't) - merge so aliases like --color-link that resolve within the dark
// block still see every token that block itself declares.
const darkTokens: ThemeTokens = { ...lightBlock, ...darkBlock }

const NORMAL_TEXT_MIN = 4.5
const NON_TEXT_MIN = 3

describe.each([
  { theme: 'light', tokens: lightBlock },
  { theme: 'dark', tokens: darkTokens },
])('tokens.css contrast ($theme)', ({ tokens }) => {
  function c(nameA: string, nameB: string): number {
    const a = resolve(lookup(tokens, nameA), tokens)
    const b = resolve(lookup(tokens, nameB), tokens)
    return contrast(a, b)
  }

  it('button text (--color-primary-foreground on --color-primary) meets 4.5:1', () => {
    expect(c('color-primary-foreground', 'color-primary')).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN)
  })

  it('button text on hover (--color-primary-foreground on --color-primary-hover) meets 4.5:1', () => {
    expect(c('color-primary-foreground', 'color-primary-hover')).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN)
  })

  it('non-text accent (--color-primary-accent on --color-surface) meets 3:1', () => {
    expect(c('color-primary-accent', 'color-surface')).toBeGreaterThanOrEqual(NON_TEXT_MIN)
  })

  // The exact defect class found in independent review: a text link is
  // normal-size text, so it needs the full 4.5:1 against the surface it
  // actually sits on (Card -> --color-surface) - never just the 3:1 a
  // non-text accent gets away with.
  it('text link (--color-link on --color-surface) meets 4.5:1', () => {
    expect(c('color-link', 'color-surface')).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN)
  })

  it('text link on hover (--color-link-hover on --color-surface) meets 4.5:1', () => {
    expect(c('color-link-hover', 'color-surface')).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN)
  })
})

// The 4 auth screens are exactly where this defect was found - guard the
// actual consuming CSS directly, not just the token values in isolation,
// so a future edit can't quietly revert one file back to the unsafe pair.
describe('auth screens use --color-link, never --color-primary, for text links', () => {
  const authLinkStylesheets = import.meta.glob<string>(
    '../../features/auth/presentation/{LoginPage,SignUpPage,ForgotPasswordPage,ResetPasswordPage}.module.css',
    { query: '?raw', import: 'default', eager: true },
  )

  it('found all 4 expected stylesheets', () => {
    expect(Object.keys(authLinkStylesheets)).toHaveLength(4)
  })

  it.each(Object.entries(authLinkStylesheets))('%s', (_path, css) => {
    expect(css).toContain('var(--color-link)')
    expect(css).toContain('var(--color-link-hover)')
    expect(css).not.toMatch(/color:\s*var\(--color-primary\)/)
    expect(css).not.toMatch(/color:\s*var\(--color-primary-hover\)/)
  })
})
