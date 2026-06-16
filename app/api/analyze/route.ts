import { NextRequest, NextResponse } from 'next/server'
import { openai, extractJson } from '@/lib/openai'
import { config } from '@/lib/config'
import { ANALYZE_SYSTEM_PROMPT } from '@/lib/prompts'

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > config.openai.imageMaxBytes) {
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 413 })
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = imageFile.type

    const response = await openai.chat.completions.create({
      model: config.openai.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze the food in this image and return the nutrition JSON.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' } },
          ],
        },
      ],
      max_tokens: config.openai.maxTokens,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from model' }, { status: 500 })
    }

    const data = JSON.parse(extractJson(content))
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
