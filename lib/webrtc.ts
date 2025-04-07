import { v4 as uuidv4 } from 'uuid'
import { SignalingClient, SignalingMessage } from './websocket'

export type FileTransferState = 'idle' | 'connecting' | 'transferring' | 'completed' | 'error'

export interface FileTransferProgress {
  bytesTransferred: number
  totalBytes: number
  percentage: number
}

export interface FileTransferError {
  code: string
  message: string
}

export class WebRTCFileTransfer {
  private peerConnection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private file: File | null = null
  private state: FileTransferState = 'idle'
  private progress: FileTransferProgress = {
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0
  }
  private signalingClient: SignalingClient
  private targetId: string | null = null
  private onStateChange: ((state: FileTransferState) => void) | null = null
  private onProgressChange: ((progress: FileTransferProgress) => void) | null = null

  constructor() {
    this.signalingClient = new SignalingClient()
    this.signalingClient.connect()
    this.signalingClient.setOnMessage(this.handleSignalingMessage.bind(this))
  }

  setOnStateChange(callback: (state: FileTransferState) => void) {
    this.onStateChange = callback
  }

  setOnProgressChange(callback: (progress: FileTransferProgress) => void) {
    this.onProgressChange = callback
  }

  private updateState(state: FileTransferState) {
    this.state = state
    if (this.onStateChange) {
      this.onStateChange(state)
    }
  }

  private updateProgress(progress: FileTransferProgress) {
    this.progress = progress
    if (this.onProgressChange) {
      this.onProgressChange(progress)
    }
  }

  private handleSignalingMessage(message: SignalingMessage) {
    switch (message.type) {
      case 'offer':
        this.handleOffer(message)
        break
      case 'answer':
        this.handleAnswer(message)
        break
      case 'ice-candidate':
        this.handleIceCandidate(message)
        break
      case 'user-list-update':
        this.handleUserListUpdate(message)
        break
    }
  }

  private handleUserListUpdate(message: SignalingMessage) {
    if (!message.users) return
    console.log('User list updated:', message.users)
  }

  private async handleOffer(message: SignalingMessage) {
    if (!message.sdp || !message.from) return

    this.targetId = message.from
    this.updateState('connecting')

    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    })

    this.setupDataChannel()
    this.setupIceHandling()

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp))
      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)
      this.signalingClient.sendAnswer(message.from, answer)
    } catch (error) {
      console.error('Error handling offer:', error)
      this.updateState('error')
    }
  }

  private async handleAnswer(message: SignalingMessage) {
    if (!message.sdp || !this.peerConnection) return
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp))
    } catch (error) {
      console.error('Error handling answer:', error)
      this.updateState('error')
    }
  }

  private async handleIceCandidate(message: SignalingMessage) {
    if (!message.candidate || !this.peerConnection) return
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
    } catch (error) {
      console.error('Error handling ICE candidate:', error)
    }
  }

  private setupIceHandling() {
    if (!this.peerConnection) return

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.targetId) {
        this.signalingClient.sendIceCandidate(this.targetId, event.candidate)
      }
    }

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState)
    }

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState)
      if (this.peerConnection?.connectionState === 'connected') {
        this.updateState('idle')
      } else if (this.peerConnection?.connectionState === 'disconnected' || 
                 this.peerConnection?.connectionState === 'failed') {
        this.updateState('error')
      }
    }
  }

  private setupDataChannel() {
    if (!this.peerConnection) return

    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true
    })
    
    this.dataChannel.onopen = () => {
      console.log('Data channel opened')
      this.updateState('idle')
    }

    this.dataChannel.onclose = () => {
      console.log('Data channel closed')
      this.updateState('idle')
    }

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error)
      this.updateState('error')
    }

    this.dataChannel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.handleFileChunk(event.data)
      } else {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'file-metadata') {
            this.handleFileMetadata(message.metadata)
          }
        } catch (e) {
          console.error('Error parsing message:', e)
        }
      }
    }
  }

  private handleFileChunk(chunk: ArrayBuffer) {
    // Handle received file chunk
    console.log('Received chunk:', chunk.byteLength)
  }

  private handleFileMetadata(metadata: any) {
    // Handle file metadata
    console.log('Received file metadata:', metadata)
  }

  async connect(targetId: string) {
    this.targetId = targetId
    this.updateState('connecting')

    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    })

    this.setupDataChannel()
    this.setupIceHandling()

    try {
      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)
      this.signalingClient.sendOffer(targetId, offer)
    } catch (error) {
      console.error('Error creating offer:', error)
      this.updateState('error')
    }
  }

  setFile(file: File): void {
    this.file = file
    this.updateProgress({
      bytesTransferred: 0,
      totalBytes: file.size,
      percentage: 0
    })
  }

  async sendFile(): Promise<void> {
    if (!this.dataChannel || !this.file) {
      throw new Error('Data channel or file not initialized')
    }

    if (this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel is not open')
    }

    this.updateState('transferring')

    const CHUNK_SIZE = 16384 // 16KB chunks
    const fileReader = new FileReader()
    let offset = 0

    // Send file metadata first
    this.dataChannel.send(JSON.stringify({
      type: 'file-metadata',
      metadata: {
        name: this.file.name,
        size: this.file.size,
        type: this.file.type
      }
    }))

    fileReader.onload = (event) => {
      if (!event.target?.result || !this.dataChannel) return

      const chunk = event.target.result as ArrayBuffer
      this.dataChannel.send(chunk)

      offset += chunk.byteLength
      this.updateProgress({
        bytesTransferred: offset,
        totalBytes: this.file!.size,
        percentage: (offset / this.file!.size) * 100
      })

      if (offset < this.file!.size) {
        readNextChunk()
      } else {
        this.updateState('completed')
      }
    }

    const readNextChunk = () => {
      const slice = this.file!.slice(offset, offset + CHUNK_SIZE)
      fileReader.readAsArrayBuffer(slice)
    }

    readNextChunk()
  }

  getState(): FileTransferState {
    return this.state
  }

  getProgress(): FileTransferProgress {
    return this.progress
  }

  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close()
    }
    if (this.peerConnection) {
      this.peerConnection.close()
    }
    this.updateState('idle')
    this.signalingClient.disconnect()
  }
}

export function generateRoomId(): string {
  return uuidv4()
} 