import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VoiceRecorder } from './VoiceRecorder'
import { VoiceNote } from './VoiceNote'
import { Mic, MicOff, Type, Send, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface VoiceNoteData {
  audioBlob: Blob
  duration: number
  transcription?: string
  audioUrl?: string
}

interface VoiceInputProps {
  onVoiceNoteSubmit: (voiceNote: VoiceNoteData) => void
  onTextSubmit?: (text: string) => void
  placeholder?: string
  disabled?: boolean
  apiUrl?: string
  className?: string
  showModeToggle?: boolean
  defaultMode?: 'text' | 'voice'
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onVoiceNoteSubmit,
  onTextSubmit,
  placeholder = "Type your message or click the mic to record...",
  disabled = false,
  apiUrl = '/api',
  className = '',
  showModeToggle = true,
  defaultMode = 'text'
}) => {
  const [mode, setMode] = useState<'text' | 'voice'>(defaultMode)
  const [textInput, setTextInput] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordedNote, setRecordedNote] = useState<VoiceNoteData | null>(null)
  const { toast } = useToast()

  const handleVoiceRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setIsTranscribing(true)

    try {
      // Create the voice note data
      const audioUrl = URL.createObjectURL(audioBlob)
      let voiceNote: VoiceNoteData = {
        audioBlob,
        duration,
        audioUrl
      }

      // Attempt transcription
      try {
        const transcription = await transcribeAudio(audioBlob)
        voiceNote.transcription = transcription
      } catch (transcriptionError) {
        console.warn('Transcription failed:', transcriptionError)
        toast({
          title: "Transcription Unavailable",
          description: "Voice note recorded but transcription failed. You can still submit the recording.",
          variant: "default"
        })
      }

      setRecordedNote(voiceNote)
    } catch (error) {
      toast({
        title: "Recording Error",
        description: "Failed to process voice recording",
        variant: "destructive"
      })
    } finally {
      setIsTranscribing(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')

    const response = await fetch(`${apiUrl}/voice/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth')}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error('Transcription service unavailable')
    }

    const result = await response.json()
    return result.transcription?.text || ''
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim() || disabled) return

    onTextSubmit?.(textInput.trim())
    setTextInput('')
  }

  const handleVoiceNoteSubmit = () => {
    if (recordedNote) {
      onVoiceNoteSubmit(recordedNote)
      // Clean up the blob URL
      if (recordedNote.audioUrl) {
        URL.revokeObjectURL(recordedNote.audioUrl)
      }
      setRecordedNote(null)
      setMode('text') // Switch back to text mode
    }
  }

  const handleVoiceNoteCancel = () => {
    if (recordedNote?.audioUrl) {
      URL.revokeObjectURL(recordedNote.audioUrl)
    }
    setRecordedNote(null)
    setMode('text')
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Mode Toggle */}
      {showModeToggle && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'text' ? 'default' : 'outline'}
            onClick={() => setMode('text')}
            disabled={disabled || isTranscribing}
            className="h-8"
          >
            <Type className="h-3 w-3 mr-1" />
            Text
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'voice' ? 'default' : 'outline'}
            onClick={() => setMode('voice')}
            disabled={disabled || isTranscribing}
            className="h-8"
          >
            {mode === 'voice' ? (
              <Mic className="h-3 w-3 mr-1" />
            ) : (
              <MicOff className="h-3 w-3 mr-1" />
            )}
            Voice
          </Button>
        </div>
      )}

      {/* Text Input Mode */}
      {mode === 'text' && (
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={placeholder}
            disabled={disabled || isTranscribing}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={disabled || !textInput.trim() || isTranscribing}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}

      {/* Voice Input Mode */}
      {mode === 'voice' && !recordedNote && (
        <div className="space-y-2">
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecordingComplete}
            onRecordingCancel={() => setMode('text')}
            disabled={disabled || isTranscribing}
            maxDuration={300} // 5 minutes
          />
          
          {isTranscribing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcribing audio...
            </div>
          )}
        </div>
      )}

      {/* Recorded Voice Note Review */}
      {recordedNote && (
        <div className="space-y-3">
          <VoiceNote
            audioUrl={recordedNote.audioUrl!}
            duration={recordedNote.duration}
            transcription={recordedNote.transcription ? {
              text: recordedNote.transcription,
              confidence: 0.8 // Default confidence since we don't get it from simple transcription
            } : undefined}
            title="Your Recording"
            showTranscription={true}
          />
          
          <div className="flex gap-2 justify-center">
            <Button
              onClick={handleVoiceNoteSubmit}
              disabled={disabled}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send Voice Note
            </Button>
            <Button
              onClick={handleVoiceNoteCancel}
              variant="outline"
              disabled={disabled}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}