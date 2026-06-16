import OpenAI from 'openai'
import { config } from './config'

// Singleton - instantiated once at module load, not per request
export const openai = new OpenAI({ apiKey: config.openai.apiKey })

export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1)
  return raw.trim()
}
