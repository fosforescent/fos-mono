# Voice Input Implementation Plan

## 🚀 Minimum Viable Voice Input (MVP)

Essential voice features needed primarily for **ConsoleAgent** interactions:

### 1. **Browser Audio Recording** (1 day)
```typescript
// Basic MediaRecorder API integration
interface VoiceRecorder {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob>
  isRecording: boolean
  duration: number
}

// Core implementation: 50 lines of code
const useVoiceRecorder = () => {
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isRecording, setIsRecording] = useState(false)
}
```

### 2. **Audio File Upload & Storage** (1 day)
- Simple file upload endpoint: `POST /api/voice-notes`
- Cloud storage integration (AWS S3 or similar)
- Audio file serving: `GET /api/voice-notes/:id`
- Basic file validation (duration, size limits)

### 3. **Speech-to-Text Transcription** (1 day)
```typescript
// OpenAI Whisper API integration
const transcribeAudio = async (audioFile: File) => {
  const formData = new FormData()
  formData.append('file', audioFile)
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: formData
  })
  
  return response.json() // { text: "transcribed content" }
}
```

### 4. **Basic Playback Interface** (0.5 days)
- HTML5 audio player with controls
- Duration display and progress bar
- Play/pause/seek functionality

### 5. **Transcription Display** (0.5 days)
- Collapsible text below audio player
- Show/hide transcription toggle
- Basic confidence score display

**Total MVP: ~3 days of development** (focused on ConsoleAgent integration)

## Technical Architecture

### Frontend Components

#### VoiceRecorder.tsx
```typescript
interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  maxDuration?: number // seconds, default 300 (5 minutes)
  className?: string
}

interface VoiceRecorderState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
  error: string | null
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  maxDuration = 300,
  className
}) => {
  // MediaRecorder implementation
  // Real-time duration tracking
  // Visual feedback (recording indicator)
  // Auto-stop at max duration
}
```

#### VoiceNote.tsx
```typescript
interface VoiceNoteProps {
  audioUrl: string
  duration: number
  transcription?: {
    text: string
    confidence: number
  }
  showTranscription?: boolean
  onTranscriptionToggle?: () => void
}

export const VoiceNote: React.FC<VoiceNoteProps> = ({
  audioUrl,
  duration,
  transcription,
  showTranscription = false
}) => {
  // Audio player controls
  // Transcription toggle
  // Duration formatting
  // Error handling for audio loading
}
```

#### VoiceInput.tsx (Combined Component)
```typescript
interface VoiceInputProps {
  onVoiceNoteSubmit: (voiceNote: VoiceNoteData) => void
  placeholder?: string
  disabled?: boolean
}

interface VoiceNoteData {
  audioBlob: Blob
  duration: number
  transcription?: string
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onVoiceNoteSubmit,
  placeholder = "Record your message...",
  disabled = false
}) => {
  // Combines VoiceRecorder + automatic upload + transcription
  // Shows recording state, processing state, completed state
  // Handles all async operations internally
}
```

### Backend Implementation

#### Voice Note Storage
```typescript
// models/VoiceNote.ts
interface VoiceNote {
  id: string
  userId: string | null        // null for anonymous sessions
  sessionToken?: string        // for anonymous users
  requestId?: string          // linked to customer request
  audioFileUrl: string
  fileName: string
  fileSize: number            // bytes
  duration: number            // seconds
  mimeType: string           // audio/webm, audio/mp4, etc.
  transcription?: {
    text: string
    confidence: number
    language: string
    processingTime: number   // ms
  }
  createdAt: Date
  processedAt?: Date
}
```

#### API Endpoints
```typescript
// POST /api/voice-notes - Upload audio file
interface UploadVoiceNoteRequest {
  audioFile: File
  requestId?: string
  sessionToken?: string
}

interface UploadVoiceNoteResponse {
  voiceNote: VoiceNote
  uploadUrl?: string  // If using direct cloud upload
}

// GET /api/voice-notes/:id - Get voice note details
interface GetVoiceNoteResponse {
  voiceNote: VoiceNote
  audioUrl: string    // Signed URL for audio access
}

// POST /api/voice-notes/:id/transcribe - Trigger transcription
interface TranscribeRequest {
  forceRetranscribe?: boolean
}

interface TranscribeResponse {
  transcription: {
    text: string
    confidence: number
    language: string
  }
  processingTime: number
}
```

#### Transcription Service
```typescript
// services/transcriptionService.ts
class TranscriptionService {
  async transcribeAudio(audioFileUrl: string): Promise<TranscriptionResult> {
    // Download audio file from storage
    const audioBuffer = await this.downloadAudioFile(audioFileUrl)
    
    // Convert to format supported by OpenAI Whisper
    const audioFile = await this.prepareAudioFile(audioBuffer)
    
    // Call OpenAI Whisper API
    const response = await this.callWhisperAPI(audioFile)
    
    return {
      text: response.text,
      confidence: this.calculateConfidence(response),
      language: response.language || 'en',
      processingTime: Date.now() - startTime
    }
  }

  private async callWhisperAPI(audioFile: Buffer): Promise<WhisperResponse> {
    const formData = new FormData()
    formData.append('file', audioFile, 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'json')
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    })
    
    return response.json()
  }
}
```

### Integration Points

#### Primary: ConsoleAgent Integration
```typescript
// ConsoleAgent.tsx - Add voice input to existing console
interface ConsoleAgentProps {
  // Existing props
}

const ConsoleAgent: React.FC<ConsoleAgentProps> = (props) => {
  const [messages, setMessages] = useState<ConsoleMessage[]>([])
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  
  const handleVoiceInput = async (voiceNote: VoiceNoteData) => {
    // 1. Add voice message to console
    const voiceMessage: ConsoleMessage = {
      type: 'voice_input',
      content: voiceNote.transcription || '[Processing voice input...]',
      voiceNote: voiceNote,
      timestamp: new Date(),
      sender: 'user'
    }
    setMessages(prev => [...prev, voiceMessage])
    
    // 2. Process voice command through existing console logic
    if (voiceNote.transcription) {
      await handleUserCommand(voiceNote.transcription)
    }
  }
  
  const handleTextInput = async (text: string) => {
    // Existing text input handling
    await handleUserCommand(text)
  }
  
  return (
    <div className="console-agent">
      {/* Existing console header and messages */}
      <div className="console-messages">
        {messages.map(message => (
          message.type === 'voice_input' ? (
            <VoiceInputMessage key={message.id} message={message} />
          ) : (
            <TextMessage key={message.id} message={message} />
          )
        ))}
      </div>
      
      {/* Enhanced input area with voice toggle */}
      <div className="console-input">
        <div className="input-mode-toggle">
          <Button 
            variant={isVoiceMode ? "default" : "outline"}
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className="mr-2"
          >
            <Mic className="h-4 w-4" />
          </Button>
        </div>
        
        {isVoiceMode ? (
          <VoiceInput 
            onVoiceNoteSubmit={handleVoiceInput}
            placeholder="Speak your command..."
          />
        ) : (
          <TextInput 
            onSubmit={handleTextInput}
            placeholder="Type your command..."
          />
        )}
      </div>
    </div>
  )
}
```

#### Customer Request Flow via ConsoleAgent
```typescript
// Customer Portal uses ConsoleAgent for service requests
const CustomerPortal: React.FC = () => {
  return (
    <div className="customer-portal">
      <h1>Request a Service</h1>
      <p>Describe what you need using voice or text</p>
      
      {/* ConsoleAgent as the primary interface for customers */}
      <ConsoleAgent 
        mode="customer_request"
        onServiceRequestGenerated={(request) => {
          // Handle generated service request
          console.log('Service request created:', request)
        }}
        welcomeMessage="Hi! Tell me what service you need. You can speak or type your request."
        placeholder="Describe your service needs..."
        uiVariant="customer" // Different styling/layout but same functionality
      />
    </div>
  )
}

// Enhanced ConsoleAgent to handle both modes with same functionality
const ConsoleAgent: React.FC<ConsoleAgentProps> = ({ 
  mode = "standard", 
  uiVariant = "dashboard",
  onServiceRequestGenerated,
  welcomeMessage,
  ...props 
}) => {
  const handleVoiceInput = async (voiceNote: VoiceNoteData) => {
    // Same voice handling regardless of mode
    const voiceMessage: ConsoleMessage = {
      type: 'voice_input',
      content: voiceNote.transcription || '[Processing voice input...]',
      voiceNote: voiceNote,
      timestamp: new Date(),
      sender: 'user'
    }
    setMessages(prev => [...prev, voiceMessage])
    
    // Process based on mode (same core functionality)
    if (mode === "customer_request" && voiceNote.transcription) {
      await generateServiceRequest(voiceNote.transcription, voiceNote)
    } else if (voiceNote.transcription) {
      await handleUserCommand(voiceNote.transcription)
    }
  }
  
  const className = uiVariant === "customer" 
    ? "console-agent customer-variant" 
    : "console-agent dashboard-variant"
  
  return (
    <div className={className}>
      {/* Same functionality, different styling based on uiVariant */}
      {/* Voice input works identically in both modes */}
    </div>
  )
}

// Service Provider sees voice notes in request cards (CRITICAL)
const CustomerRequestCard = ({ request }: { request: CustomerRequest }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{request.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{request.description}</p>
        
        {/* CRITICAL: Voice notes from customer requests via ConsoleAgent */}
        {request.voiceNotes?.map(voiceNote => (
          <VoiceNote
            key={voiceNote.id}
            audioUrl={voiceNote.audioFileUrl}
            duration={voiceNote.duration}
            transcription={voiceNote.transcription}
            showTranscription={true}
          />
        ))}
        
        <BidSubmissionForm requestId={request.id} />
      </CardContent>
    </Card>
  )
}
```

## Browser Compatibility

### MediaRecorder API Support
```typescript
// Feature detection and fallbacks
const checkVoiceSupport = () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, reason: 'getUserMedia not supported' }
  }
  
  if (!window.MediaRecorder) {
    return { supported: false, reason: 'MediaRecorder not supported' }
  }
  
  const supportedTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/wav'
  ].filter(type => MediaRecorder.isTypeSupported(type))
  
  if (supportedTypes.length === 0) {
    return { supported: false, reason: 'No supported audio formats' }
  }
  
  return { supported: true, supportedTypes }
}

// Graceful fallback for unsupported browsers
const VoiceInputWithFallback = () => {
  const voiceSupport = checkVoiceSupport()
  
  if (!voiceSupport.supported) {
    return (
      <FileUpload 
        accept="audio/*"
        placeholder="Upload audio file..."
        helpText={`Voice recording not supported: ${voiceSupport.reason}`}
      />
    )
  }
  
  return <VoiceRecorder />
}
```

### Supported Browsers
- **Chrome 47+**: Full support
- **Firefox 29+**: Full support  
- **Safari 14.1+**: Full support
- **Edge 79+**: Full support
- **Mobile browsers**: iOS Safari 14.3+, Chrome Mobile 47+

## Performance Considerations

### Audio File Optimization
```typescript
// Client-side audio processing
const optimizeAudioBlob = async (audioBlob: Blob): Promise<Blob> => {
  // Basic compression for large files
  if (audioBlob.size > 5 * 1024 * 1024) { // 5MB threshold
    return await compressAudio(audioBlob, { quality: 0.8 })
  }
  return audioBlob
}

// Streaming upload for large files
const uploadLargeAudioFile = async (audioBlob: Blob) => {
  const chunkSize = 1024 * 1024 // 1MB chunks
  const chunks = []
  
  for (let start = 0; start < audioBlob.size; start += chunkSize) {
    const chunk = audioBlob.slice(start, start + chunkSize)
    chunks.push(chunk)
  }
  
  return await uploadInChunks(chunks)
}
```

### Transcription Performance
```typescript
// Queue-based transcription processing
interface TranscriptionJob {
  voiceNoteId: string
  priority: 'high' | 'normal' | 'low'
  retryCount: number
  createdAt: Date
}

// Background processing queue
class TranscriptionQueue {
  private queue: TranscriptionJob[] = []
  private processing = false
  
  async addJob(voiceNoteId: string, priority = 'normal') {
    this.queue.push({
      voiceNoteId,
      priority,
      retryCount: 0,
      createdAt: new Date()
    })
    
    if (!this.processing) {
      this.processQueue()
    }
  }
  
  private async processQueue() {
    this.processing = true
    
    while (this.queue.length > 0) {
      // Process high priority first
      const job = this.queue.find(j => j.priority === 'high') || this.queue[0]
      this.queue = this.queue.filter(j => j !== job)
      
      try {
        await this.processTranscription(job)
      } catch (error) {
        await this.handleTranscriptionError(job, error)
      }
    }
    
    this.processing = false
  }
}
```

## Security & Privacy

### Audio File Access Control
```typescript
// Secure audio file serving
app.get('/api/voice-notes/:id/audio', authenticateUser, async (req, res) => {
  const voiceNote = await VoiceNote.findById(req.params.id)
  
  // Verify user has access to this voice note
  if (!canUserAccessVoiceNote(req.user, voiceNote)) {
    return res.status(403).json({ error: 'Access denied' })
  }
  
  // Generate time-limited signed URL
  const signedUrl = await generateSignedAudioUrl(voiceNote.audioFileUrl, {
    expiresIn: '1h',
    userId: req.user.id
  })
  
  res.json({ audioUrl: signedUrl })
})

const canUserAccessVoiceNote = (user: User, voiceNote: VoiceNote): boolean => {
  // Owner access
  if (voiceNote.userId === user.id) return true
  
  // Service provider access to customer voice notes in their requests
  if (voiceNote.requestId) {
    const request = CustomerRequest.findById(voiceNote.requestId)
    const hasActiveBid = ServiceBid.exists({
      requestId: voiceNote.requestId,
      providerId: user.id
    })
    return hasActiveBid
  }
  
  return false
}
```

### Data Retention Policies
```typescript
// Automatic cleanup of old voice notes
interface VoiceNoteRetentionPolicy {
  anonymousUsers: number    // 30 days
  registeredUsers: number   // 365 days
  completedRequests: number // 90 days after completion
}

const cleanupOldVoiceNotes = async () => {
  const retentionPolicy: VoiceNoteRetentionPolicy = {
    anonymousUsers: 30,
    registeredUsers: 365,
    completedRequests: 90
  }
  
  // Anonymous user voice notes
  await VoiceNote.deleteMany({
    userId: null,
    createdAt: { $lt: new Date(Date.now() - retentionPolicy.anonymousUsers * 24 * 60 * 60 * 1000) }
  })
  
  // Registered user voice notes  
  await VoiceNote.deleteMany({
    userId: { $ne: null },
    createdAt: { $lt: new Date(Date.now() - retentionPolicy.registeredUsers * 24 * 60 * 60 * 1000) }
  })
}
```

## Cost Optimization

### Transcription Cost Management
```typescript
// Smart transcription strategies
interface TranscriptionStrategy {
  immediate: boolean        // Transcribe immediately vs batch
  confidence: number       // Skip if previous transcription confidence is high
  caching: boolean        // Cache transcriptions for similar audio
}

const optimizeTranscriptionCosts = async (voiceNote: VoiceNote) => {
  // Skip transcription for very short recordings
  if (voiceNote.duration < 3) {
    return { skipped: true, reason: 'Too short' }
  }
  
  // Check for cached similar transcriptions
  const similarTranscription = await findSimilarAudioTranscription(voiceNote)
  if (similarTranscription && similarTranscription.confidence > 0.9) {
    return similarTranscription
  }
  
  // Batch process non-urgent transcriptions
  if (!isUrgentRequest(voiceNote.requestId)) {
    await addToBatchTranscriptionQueue(voiceNote)
    return { queued: true, estimatedCompletion: '5-10 minutes' }
  }
  
  // Process immediately for urgent requests
  return await transcribeAudio(voiceNote)
}
```

### Storage Cost Management
```typescript
// Audio file lifecycle management
const manageAudioStorage = async (voiceNote: VoiceNote) => {
  // Move to cheaper storage after 30 days
  if (isOlderThan(voiceNote, 30, 'days')) {
    await moveToArchiveStorage(voiceNote)
  }
  
  // Delete audio file but keep transcription after 90 days
  if (isOlderThan(voiceNote, 90, 'days')) {
    await deleteAudioFileKeepTranscription(voiceNote)
  }
  
  // Complete deletion after 1 year (registered users)
  if (isOlderThan(voiceNote, 365, 'days')) {
    await deleteVoiceNote(voiceNote)
  }
}
```

## Implementation Timeline

### Week 1: Core Voice Recording
- **Day 1-2**: VoiceRecorder component with MediaRecorder API
- **Day 3-4**: Audio file upload and storage infrastructure
- **Day 5**: Basic transcription integration with OpenAI Whisper

### Week 2: Integration & Polish
- **Day 1-2**: Voice input integration in customer portal chat
- **Day 3**: Voice note display in service provider request cards
- **Day 4**: Browser compatibility testing and fallbacks
- **Day 5**: Security, access controls, and error handling

### Week 3: Advanced Features (Optional)
- **Day 1-2**: Batch transcription queue for cost optimization
- **Day 3**: Voice note analytics and insights
- **Day 4-5**: Mobile optimization and Progressive Web App features

## Testing Strategy

### Unit Tests
```typescript
// VoiceRecorder component tests
describe('VoiceRecorder', () => {
  it('should start recording when start button is clicked', async () => {
    const onRecordingComplete = jest.fn()
    render(<VoiceRecorder onRecordingComplete={onRecordingComplete} />)
    
    const startButton = screen.getByText('Start Recording')
    fireEvent.click(startButton)
    
    expect(mockMediaRecorder.start).toHaveBeenCalled()
  })
  
  it('should stop recording and call callback when stop button is clicked', async () => {
    // Test implementation
  })
  
  it('should handle microphone permission denied gracefully', async () => {
    // Test implementation
  })
})

// Transcription service tests
describe('TranscriptionService', () => {
  it('should transcribe audio file using OpenAI Whisper', async () => {
    const mockAudioFile = new Blob(['audio data'], { type: 'audio/webm' })
    const result = await transcriptionService.transcribeAudio(mockAudioFile)
    
    expect(result).toHaveProperty('text')
    expect(result).toHaveProperty('confidence')
  })
})
```

### Integration Tests
```typescript
// End-to-end voice input flow
describe('Voice Input Integration', () => {
  it('should complete full voice note submission flow', async () => {
    // 1. Record audio
    await user.click(screen.getByText('Record'))
    await waitFor(() => screen.getByText('Recording...'))
    
    // 2. Stop recording
    await user.click(screen.getByText('Stop'))
    
    // 3. Submit voice note
    await user.click(screen.getByText('Submit'))
    
    // 4. Verify upload and transcription
    await waitFor(() => screen.getByText('Transcribing...'))
    await waitFor(() => screen.getByText(/transcribed content/i))
  })
})
```

## Success Metrics

### Adoption Metrics
- **Voice input usage rate**: % of customer requests that include voice notes
- **Recording completion rate**: % of started recordings that are successfully submitted
- **Transcription accuracy**: Customer satisfaction with transcription quality

### Performance Metrics
- **Recording latency**: Time from start button to actual recording
- **Upload speed**: Average time to upload audio files
- **Transcription speed**: Average time from upload to transcription completion

### Quality Metrics
- **Transcription confidence scores**: Average confidence from Whisper API
- **Error rates**: % of failed recordings, uploads, or transcriptions
- **User satisfaction**: Ratings for voice input experience

This implementation plan provides a complete voice input system that integrates seamlessly with the existing customer portal and service provider interfaces, with careful attention to performance, security, and cost optimization.