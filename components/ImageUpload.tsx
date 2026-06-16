'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { NutritionData } from '@/types/nutrition'

interface Props {
  onAnalysisComplete: (nutrition: NutritionData, imageDataUrl: string) => void
  isAnalyzing: boolean
  setIsAnalyzing?: (v: boolean) => void
}

export default function ImageUpload({ onAnalysisComplete, isAnalyzing, setIsAnalyzing }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.')
      return
    }
    setError(null)
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleZoneClick = () => {
    if (!previewUrl) fileInputRef.current?.click()
  }

  const handleAnalyze = async () => {
    if (!selectedFile || !previewUrl) return
    setError(null)
    setIsAnalyzing?.(true)

    const formData = new FormData()
    formData.append('image', selectedFile)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Analysis failed. Please try again.')
        setIsAnalyzing?.(false)
        return
      }

      const nutrition: NutritionData = await res.json()
      onAnalysisComplete(nutrition, previewUrl)
    } catch {
      setError('Network error. Please check your connection and try again.')
      setIsAnalyzing?.(false)
    }
  }

  const handleReset = () => {
    setPreviewUrl(null)
    setSelectedFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {!previewUrl && (
        <div
          onClick={handleZoneClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            'flex flex-col items-center justify-center gap-3',
            'border-2 border-dashed rounded-2xl p-10 cursor-pointer',
            'transition-colors duration-200 select-none',
            isDragging
              ? 'border-green-500 bg-green-50'
              : 'border-green-300 bg-white hover:border-green-500 hover:bg-green-50',
          ].join(' ')}
        >
          <svg
            className={`w-12 h-12 ${isDragging ? 'text-green-600' : 'text-green-400'}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm font-medium text-gray-600 text-center">
            Drop food photo here or{' '}
            <span className="text-green-600 font-semibold">click to upload</span>
          </p>
          <p className="text-xs text-gray-400">PNG, JPG, WEBP up to 20MB</p>
        </div>
      )}

      {previewUrl && (
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <img
            src={previewUrl}
            alt="Food preview"
            className="w-full max-h-64 object-cover"
          />
          <button
            onClick={handleReset}
            disabled={isAnalyzing}
            className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 rounded-full p-1.5 shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Remove image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {previewUrl && (
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !selectedFile}
          className={[
            'flex items-center justify-center gap-2',
            'w-full py-3 px-6 rounded-xl font-semibold text-sm',
            'transition-all duration-200',
            isAnalyzing || !selectedFile
              ? 'bg-green-300 text-white cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white shadow-md hover:shadow-lg',
          ].join(' ')}
        >
          {isAnalyzing ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
              Analyze Food
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        aria-hidden="true"
      />
    </div>
  )
}
