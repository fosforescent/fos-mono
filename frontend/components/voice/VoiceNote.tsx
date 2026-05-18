import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Play, Pause, Volume2, FileAudio, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface VoiceNoteProps {
  audioUrl: string
  duration: number
  transcription?: {
    text: string
    confidence: number
    language?: string
  }
  showTranscription?: boolean
  className?: string
  title?: string
  timestamp?: Date
}

export const VoiceNote: React.FC<VoiceNoteProps> = ({
  audioUrl,
  duration,
  transcription,
  showTranscription = true,
  className = '',
  title,
  timestamp
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isTranscriptionOpen, setIsTranscriptionOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const handleEnded = () => setIsPlaying(false)
    const handleError = () => {
      setError('Failed to load audio')
      setIsPlaying(false)
    }
    const handleLoadedData = () => setError(null)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('loadeddata', handleLoadedData)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('loadeddata', handleLoadedData)
    }
  }, [audioUrl])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        await audio.play()
        setIsPlaying(true)
      }
    } catch (error) {
      setError('Failed to play audio')
      setIsPlaying(false)
    }
  }

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const rect = event.currentTarget.getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    const newTime = percent * duration
    
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600'
    if (confidence >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.9) return 'High'
    if (confidence >= 0.7) return 'Medium'
    return 'Low'
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded">
                <Volume2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {title || 'Voice Note'}
                </div>
                {timestamp && (
                  <div className="text-xs text-muted-foreground">
                    {timestamp.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            
            <Badge variant="outline" className="text-xs">
              🎤 {formatTime(duration)}
            </Badge>
          </div>

          {/* Audio Player */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={togglePlayback}
                disabled={!!error}
                className="h-8 w-8 p-0"
              >
                {isPlaying ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>

              <div className="flex-1 space-y-1">
                <div 
                  className="h-2 bg-gray-200 rounded cursor-pointer relative overflow-hidden"
                  onClick={handleSeek}
                >
                  <div 
                    className="h-full bg-blue-500 transition-all duration-200"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
          </div>

          {/* Transcription */}
          {transcription && showTranscription && (
            <Collapsible 
              open={isTranscriptionOpen} 
              onOpenChange={setIsTranscriptionOpen}
            >
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-between p-2 h-auto"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm">Transcription</span>
                    {transcription.confidence && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getConfidenceColor(transcription.confidence)}`}
                      >
                        {getConfidenceText(transcription.confidence)} confidence
                      </Badge>
                    )}
                  </div>
                  {isTranscriptionOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2">
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <div className="whitespace-pre-wrap">
                    {transcription.text}
                  </div>
                  
                  {(transcription.confidence || transcription.language) && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                      {transcription.confidence && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(transcription.confidence * 100)}% confident
                        </Badge>
                      )}
                      {transcription.language && (
                        <Badge variant="outline" className="text-xs">
                          {transcription.language.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Hidden Audio Element */}
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  )
}