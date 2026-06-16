'use client'

import { useState } from 'react'
import Image from 'next/image'
import { NutritionData } from '@/types/nutrition'
import ImageUpload from '@/components/ImageUpload'
import NutritionLabel from '@/components/NutritionLabel'
import ChatInterface from '@/components/ChatInterface'

export default function Home() {
  const [analysis, setAnalysis] = useState<NutritionData | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  function handleAnalysisComplete(data: NutritionData, dataUrl: string) {
    setAnalysis(data)
    setImageDataUrl(dataUrl)
    setIsAnalyzing(false)
  }

  function handleReset() {
    setAnalysis(null)
    setImageDataUrl(null)
    setIsAnalyzing(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 relative">
      {/* Analyzing overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <svg
            className="w-12 h-12 text-green-600 animate-spin mb-4"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-lg font-semibold text-green-700">Analyzing your food...</p>
          <p className="text-sm text-gray-500 mt-1">Reading nutrition data</p>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-green-600 tracking-tight">FoodChat</span>
            <span className="hidden sm:inline text-sm text-gray-400 font-normal ml-1">
              Know your food, naturally
            </span>
          </div>
          {analysis && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              Analyze another
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!analysis ? (
          /* Upload state: centered card */
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="w-full max-w-md">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Analyze your food
                </h1>
                <p className="text-gray-500">
                  Upload a photo and get instant nutrition info + a smart food assistant
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <ImageUpload
                  onAnalysisComplete={handleAnalysisComplete}
                  isAnalyzing={isAnalyzing}
                  setIsAnalyzing={setIsAnalyzing}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Results state: two-column grid with fade-in */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {/* Left column: image + nutrition label */}
            <div className="flex flex-col gap-4">
              {imageDataUrl && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <Image
                    src={imageDataUrl}
                    alt={analysis.foodName}
                    width={600}
                    height={400}
                    className="w-full max-h-80 object-cover"
                    unoptimized
                  />
                </div>
              )}
              <NutritionLabel data={analysis} />
            </div>

            {/* Right column: chat */}
            <div className="h-[600px] flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <ChatInterface
                nutritionContext={analysis}
                foodName={analysis.foodName}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
