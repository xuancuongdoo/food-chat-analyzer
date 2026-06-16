// Validate required env vars at module load time
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required')
}

export const config = {
  openai: {
    apiKey: OPENAI_API_KEY,
    model: 'gpt-4o' as const,
    maxTokens: 1024,
    imageMaxBytes: 10 * 1024 * 1024, // 10MB
  },
} as const
