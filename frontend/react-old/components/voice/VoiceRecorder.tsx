import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mic, MicOff, Square, Play, Pause, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void
  onRecordingCancel?: () => void
  maxDuration?: number // seconds
  className?: string
  disabled?: boolean
}

interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
  error: string | null
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingCancel,
  maxDuration = 300, // 5 minutes default
  className = '',
  disabled = false
}) => {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    error: null
  })
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const { toast } = useToast()

  // Check browser support
  const isSupported = typeof MediaRecorder !== 'undefined' && 
                     typeof navigator.mediaDevices?.getUserMedia !== 'undefined'

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  const startRecording = async () => {
    if (!isSupported) {
      setState(prev => ({ ...prev, error: 'Voice recording not supported in this browser' }))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })

      // Check for supported MIME types
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav'
      ]
      
      const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type))
      
      if (!supportedType) {
        throw new Error('No supported audio format found')
      }

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: supportedType,
        audioBitsPerSecond: 128000 
      })
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: supportedType })
        setState(prev => ({ 
          ...prev, 
          audioBlob,
          isRecording: false,
          isPaused: false
        }))
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // Collect data every 100ms
      
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        isPaused: false,
        duration: 0,
        error: null 
      }))
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setState(prev => {
          const newDuration = prev.duration + 1
          
          // Auto-stop at max duration
          if (newDuration >= maxDuration) {
            stopRecording()
            toast({
              title: "Recording Complete",
              description: `Recording stopped at ${maxDuration} second limit`
            })
          }
          
          return { ...prev, duration: newDuration }
        })
      }, 1000)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording'
      setState(prev => ({ ...prev, error: errorMessage }))
      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause()
      setState(prev => ({ ...prev, isPaused: true }))
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume()
      setState(prev => ({ ...prev, isPaused: false }))
      
      // Resume timer
      intervalRef.current = setInterval(() => {
        setState(prev => {
          const newDuration = prev.duration + 1
          if (newDuration >= maxDuration) {
            stopRecording()
          }
          return { ...prev, duration: newDuration }
        })
      }, 1000)
    }
  }

  const discardRecording = () => {
    if (state.isRecording) {
      stopRecording()
    }
    
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      error: null
    })
    
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    
    onRecordingCancel?.()
  }

  const submitRecording = () => {
    if (state.audioBlob) {
      onRecordingComplete(state.audioBlob, state.duration)
      // Reset state
      setState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        error: null
      })
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getDurationColor = () => {
    const percentage = (state.duration / maxDuration) * 100
    if (percentage > 90) return 'text-red-600'
    if (percentage > 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  if (!isSupported) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            <MicOff className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Voice recording not supported in this browser</p>
            <p className="text-xs mt-1">Please use Chrome, Firefox, or Safari</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Recording Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {state.isRecording && (
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  state.isPaused ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
              )}
              <span className="text-sm font-medium">
                {state.isRecording 
                  ? (state.isPaused ? 'Recording Paused' : 'Recording...') 
                  : state.audioBlob 
                    ? 'Recording Complete' 
                    : 'Ready to Record'
                }
              </span>
            </div>
            
            <Badge variant="outline" className={getDurationColor()}>
              {formatDuration(state.duration)} / {formatDuration(maxDuration)}
            </Badge>
          </div>

          {/* Progress Bar */}
          {(state.isRecording || state.audioBlob) && (
            <Progress 
              value={(state.duration / maxDuration) * 100} 
              className="h-2"
            />
          )}

          {/* Error Display */}
          {state.error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {state.error}
            </div>
          )}

          {/* Audio Playback */}
          {state.audioBlob && !state.isRecording && (
            <div className="bg-gray-50 p-3 rounded">
              <audio 
                controls 
                className="w-full"
                src={audioUrlRef.current || (audioUrlRef.current = URL.createObjectURL(state.audioBlob))}
              />
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-2 justify-center">
            {!state.isRecording && !state.audioBlob && (
              <Button 
                onClick={startRecording}
                disabled={disabled}
                className="flex items-center gap-2"
              >
                <Mic className="h-4 w-4" />
                Start Recording
              </Button>
            )}

            {state.isRecording && (
              <>
                {!state.isPaused ? (
                  <Button 
                    onClick={pauseRecording}
                    variant="outline"
                    size="sm"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={resumeRecording}
                    variant="outline"
                    size="sm"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                
                <Button 
                  onClick={stopRecording}
                  variant="default"
                  size="sm"
                >
                  <Square className="h-4 w-4" />
                </Button>
                
                <Button 
                  onClick={discardRecording}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}

            {state.audioBlob && !state.isRecording && (
              <>
                <Button 
                  onClick={submitRecording}
                  className="flex items-center gap-2"
                >
                  <Mic className="h-4 w-4" />
                  Use Recording
                </Button>
                
                <Button 
                  onClick={discardRecording}
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4" />
                  Discard
                </Button>
              </>
            )}
          </div>

          {/* Usage Hint */}
          <div className="text-xs text-muted-foreground text-center">
            {state.duration > 0 
              ? `${Math.round((state.audioBlob?.size || 0) / 1024)} KB`
              : 'Click Start Recording to begin'
            }
          </div>
        </div>
      </CardContent>
    </Card>
  )
}