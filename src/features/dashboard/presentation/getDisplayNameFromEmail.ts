/**
 * Temporary, explicit stand-in for a real display name. Account/Person
 * doesn't exist yet, so the only identity we have is the Supabase auth
 * session's email - this derives a greeting-friendly first name from its
 * local part (e.g. "rodrigo.duenas@gmail.com" -> "Rodrigo"). Replace with
 * the real name once that data is available; callers only need to swap the
 * input, not the greeting UI.
 */
export function getDisplayNameFromEmail(email: string | null | undefined): string | null {
  const localPart = email?.split('@')[0]
  const firstToken = localPart?.split(/[._-]+/).filter(Boolean)[0]

  if (!firstToken) return null

  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase()
}
