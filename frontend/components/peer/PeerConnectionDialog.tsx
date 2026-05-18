import React, { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  QrCode,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Camera,
  CameraOff,
  Smartphone,
  RefreshCw,
} from 'lucide-react'

interface PeerConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected?: (dataChannel: RTCDataChannel) => void
}

// Split connection string into chunks for QR codes
const QR_CHUNK_SIZE = 800
function splitIntoChunks(str: string): string[] {
  if (!str) return []
  const chunks: string[] = []
  const totalChunks = Math.ceil(str.length / QR_CHUNK_SIZE)
  for (let i = 0; i < str.length; i += QR_CHUNK_SIZE) {
    const chunkNum = Math.floor(i / QR_CHUNK_SIZE) + 1
    chunks.push(`${chunkNum}/${totalChunks}:${str.slice(i, i + QR_CHUNK_SIZE)}`)
  }
  return chunks
}

// Reassemble chunks into full string
function reassembleChunks(chunks: Map<number, string>, total: number): string | null {
  if (chunks.size !== total) return null
  let result = ''
  for (let i = 1; i <= total; i++) {
    const chunk = chunks.get(i)
    if (!chunk) return null
    result += chunk
  }
  return result
}

// Parse a chunk string to extract index, total, and data
function parseChunk(chunk: string): { index: number; total: number; data: string } | null {
  const match = chunk.match(/^(\d+)\/(\d+):(.*)$/)
  if (!match) return null
  return {
    index: parseInt(match[1], 10),
    total: parseInt(match[2], 10),
    data: match[3],
  }
}

export function PeerConnectionDialog({
  open,
  onOpenChange,
  onConnected,
}: PeerConnectionDialogProps) {
  const { toast } = useToast()

  // Connection state
  const [connectionString, setConnectionString] = useState('')
  const [syncMode, setSyncMode] = useState<'offer' | 'answer'>('offer')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  // QR display state
  const [showQrCode, setShowQrCode] = useState(true)
  const [qrCodeIndex, setQrCodeIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  // Camera scanner state
  const [scanning, setScanning] = useState(false)
  const [scannedChunks, setScannedChunks] = useState<Map<number, string>>(new Map())
  const [expectedChunks, setExpectedChunks] = useState(0)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerRef = useRef<HTMLDivElement>(null)

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)

  const qrCodeChunks = React.useMemo(() => splitIntoChunks(connectionString), [connectionString])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner()
      if (pcRef.current) {
        pcRef.current.close()
      }
    }
  }, [])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setConnectionString('')
      setSyncMode('offer')
      setIsConnected(false)
      setScannedChunks(new Map())
      setExpectedChunks(0)
      setQrCodeIndex(0)
    } else {
      stopScanner()
    }
  }, [open])

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  const generateOffer = async () => {
    setIsGenerating(true)
    try {
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      })
      pcRef.current = pc

      // Create data channel
      const dc = pc.createDataChannel('fos-sync', { ordered: true })
      dcRef.current = dc

      dc.onopen = () => {
        console.log('Data channel opened (offerer)')
        setIsConnected(true)
        onConnected?.(dc)
        toast({ title: 'Connected!', description: 'Peer connection established' })
      }

      dc.onmessage = (e) => {
        console.log('Received:', e.data)
      }

      // Collect ICE candidates
      const candidates: RTCIceCandidate[] = []

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('ICE gathering timed out'))
        }, 30000)

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            candidates.push(e.candidate)
          }
        }

        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            resolve()
          }
        }

        // Create offer
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .catch(reject)
      })

      // Encode offer with candidates
      const connectionData = {
        type: 'offer',
        sdp: pc.localDescription?.sdp,
        candidates: candidates.map((c) => c.toJSON()),
      }

      const encoded = btoa(JSON.stringify(connectionData))
      setConnectionString(encoded)
      setSyncMode('offer')

      toast({ title: 'Ready', description: 'Show QR to other device, then scan their response' })
    } catch (error: any) {
      console.error('Error generating offer:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to create connection',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const processScannedData = useCallback(async (data: string) => {
    try {
      const decoded = JSON.parse(atob(data))

      if (decoded.type === 'offer') {
        // We scanned an offer, need to create answer
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        })
        pcRef.current = pc

        // Handle incoming data channel
        pc.ondatachannel = (e) => {
          const dc = e.channel
          dcRef.current = dc
          dc.onopen = () => {
            console.log('Data channel opened (answerer)')
            setIsConnected(true)
            onConnected?.(dc)
            toast({ title: 'Connected!', description: 'Peer connection established' })
          }
          dc.onmessage = (msg) => {
            console.log('Received:', msg.data)
          }
        }

        // Collect ICE candidates
        const candidates: RTCIceCandidate[] = []

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('ICE gathering timed out'))
          }, 30000)

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              candidates.push(e.candidate)
            }
          }

          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(timeout)
              resolve()
            }
          }

          // Set remote description and create answer
          pc.setRemoteDescription({ type: 'offer', sdp: decoded.sdp })
            .then(() => {
              // Add remote ICE candidates
              return Promise.all(
                decoded.candidates.map((c: RTCIceCandidateInit) => pc.addIceCandidate(c))
              )
            })
            .then(() => pc.createAnswer())
            .then((answer) => pc.setLocalDescription(answer))
            .catch(reject)
        })

        // Create answer connection string
        const answerData = {
          type: 'answer',
          sdp: pc.localDescription?.sdp,
          candidates: candidates.map((c) => c.toJSON()),
        }

        setConnectionString(btoa(JSON.stringify(answerData)))
        setSyncMode('answer')
        stopScanner()

        toast({
          title: 'Answer Ready',
          description: 'Show this QR code to the other device to complete connection',
        })
      } else if (decoded.type === 'answer') {
        // We scanned an answer, complete the connection
        const pc = pcRef.current
        if (!pc) {
          throw new Error('No pending connection - generate offer first')
        }

        await pc.setRemoteDescription({ type: 'answer', sdp: decoded.sdp })

        for (const candidate of decoded.candidates) {
          await pc.addIceCandidate(candidate)
        }

        stopScanner()
        toast({ title: 'Connecting...', description: 'Establishing peer connection' })
      }
    } catch (error: any) {
      console.error('Error processing scanned data:', error)
      toast({
        title: 'Invalid QR Code',
        description: error.message || 'Could not process the scanned code',
        variant: 'destructive',
      })
    }
  }, [onConnected, stopScanner, toast])

  const handleQrCodeScanned = useCallback((decodedText: string) => {
    // Check if this is a chunked QR code
    const parsed = parseChunk(decodedText)

    if (parsed) {
      // Multi-chunk QR code
      setExpectedChunks(parsed.total)
      setScannedChunks((prev) => {
        const newMap = new Map(prev)
        if (!newMap.has(parsed.index)) {
          newMap.set(parsed.index, parsed.data)
          toast({
            title: `Scanned ${newMap.size}/${parsed.total}`,
            description: newMap.size === parsed.total ? 'Processing...' : 'Continue scanning',
          })
        }

        // Check if we have all chunks
        const fullData = reassembleChunks(newMap, parsed.total)
        if (fullData) {
          processScannedData(fullData)
        }

        return newMap
      })
    } else {
      // Single QR code (or raw base64)
      processScannedData(decodedText)
    }
  }, [processScannedData, toast])

  const startScanner = async () => {
    if (!scannerContainerRef.current) return

    try {
      const scanner = new Html5Qrcode('qr-scanner-container')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleQrCodeScanned,
        () => {} // Ignore errors during scanning
      )

      setScanning(true)
      setScannedChunks(new Map())
      setExpectedChunks(0)
    } catch (error: any) {
      console.error('Error starting scanner:', error)
      toast({
        title: 'Camera Error',
        description: error.message || 'Could not access camera',
        variant: 'destructive',
      })
    }
  }

  const copyConnectionString = async () => {
    try {
      await navigator.clipboard.writeText(connectionString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Copied', description: 'Connection code copied to clipboard' })
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Peer Connection
          </DialogTitle>
          <DialogDescription>
            Connect two devices directly using WebRTC. No server required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isConnected ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium">Connected!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Devices are now connected and can sync data
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Generate or Scan */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  {connectionString ? `Your ${syncMode} code:` : 'Start connection:'}
                </Label>

                {!connectionString ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={generateOffer}
                      disabled={isGenerating}
                      className="flex-1"
                    >
                      {isGenerating ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="mr-2 h-4 w-4" />
                      )}
                      {isGenerating ? 'Generating...' : 'Create Invite'}
                    </Button>
                    <Button
                      onClick={scanning ? stopScanner : startScanner}
                      variant="outline"
                      className="flex-1"
                    >
                      {scanning ? (
                        <CameraOff className="mr-2 h-4 w-4" />
                      ) : (
                        <Camera className="mr-2 h-4 w-4" />
                      )}
                      {scanning ? 'Stop Camera' : 'Scan Invite'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={showQrCode ? 'default' : 'outline'}
                      onClick={() => setShowQrCode(true)}
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      QR
                    </Button>
                    <Button
                      size="sm"
                      variant={!showQrCode ? 'default' : 'outline'}
                      onClick={() => setShowQrCode(false)}
                    >
                      Text
                    </Button>
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={scanning ? stopScanner : startScanner}
                    >
                      {scanning ? (
                        <CameraOff className="h-4 w-4" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* QR Code Display */}
              {connectionString && showQrCode && (
                <div className="flex flex-col items-center space-y-3">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <QRCodeSVG
                      value={qrCodeChunks[qrCodeIndex] || ''}
                      size={220}
                      level="M"
                    />
                  </div>
                  {qrCodeChunks.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setQrCodeIndex(Math.max(0, qrCodeIndex - 1))}
                        disabled={qrCodeIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium min-w-[60px] text-center">
                        {qrCodeIndex + 1} / {qrCodeChunks.length}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setQrCodeIndex(Math.min(qrCodeChunks.length - 1, qrCodeIndex + 1))}
                        disabled={qrCodeIndex === qrCodeChunks.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    {syncMode === 'offer'
                      ? 'Have the other device scan this, then scan their response'
                      : 'Have the other device scan this to complete connection'}
                  </p>
                </div>
              )}

              {/* Text Display */}
              {connectionString && !showQrCode && (
                <div className="relative">
                  <Textarea
                    value={connectionString}
                    readOnly
                    className="pr-10 font-mono text-xs h-24"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={copyConnectionString}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {/* Camera Scanner */}
              <div
                id="qr-scanner-container"
                ref={scannerContainerRef}
                className={`w-full rounded-lg overflow-hidden ${scanning ? 'block' : 'hidden'}`}
                style={{ minHeight: scanning ? '300px' : '0' }}
              />

              {/* Scan Progress */}
              {scanning && expectedChunks > 1 && (
                <div className="text-center text-sm text-muted-foreground">
                  Scanned {scannedChunks.size} of {expectedChunks} QR codes
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
