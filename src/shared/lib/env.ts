import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

function loadEnv() {
  const result = envSchema.safeParse(import.meta.env)

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration: ${z.prettifyError(result.error)}. ` +
        'Copy .env.example to .env and provide real Supabase project values.',
    )
  }

  return result.data
}

export const env = loadEnv()
