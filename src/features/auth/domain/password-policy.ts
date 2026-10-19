/**
 * Mirrors supabase/config.toml's `[auth] minimum_password_length = 6` - the
 * actual server-side policy this project's stacks enforce (config.toml also
 * leaves `password_requirements = ""`, i.e. no character-class rule beyond
 * length). One named constant shared by every client-side password schema,
 * so a future policy change updates in one place instead of N duplicated
 * literals.
 */
export const MINIMUM_PASSWORD_LENGTH = 6
