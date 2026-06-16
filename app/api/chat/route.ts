import { NextRequest } from 'next/server'
import { openai } from '@/lib/openai'
import { config } from '@/lib/config'
import { buildChatSystemPrompt } from '@/lib/prompts'
import type { NutritionData } from '@/types/nutrition'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  messages: ChatMessage[]
  nutritionContext: NutritionData
  foodName?: string
}

const MAX_MESSAGES = 50

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ChatRequestBody
    const { messages, nutritionContext } = body

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const foodName = body.foodName ?? nutritionContext?.foodName ?? 'this food'
    const trimmedMessages = messages.slice(-MAX_MESSAGES)

    const stream = await openai.chat.completions.create({
      model: config.openai.model,
      stream: true,
      messages: [
        { role: 'system', content: buildChatSystemPrompt(foodName, nutritionContext) },
        ...trimmedMessages,
      ],
    })

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? ''
            if (text) controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
