import { v4 as uuidv4 } from 'uuid';
import { FileMetadata, TransferProgress, WebRTCConfig } from '../types';

export class WebRTCFileTransfer {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private file: File | null = null;
  private fileMetadata: FileMetadata | null = null;
  private chunkSize = 16 * 1024; // 16KB chunks
  private currentChunk = 0;
  private totalChunks = 0;
  private onProgress: ((progress: TransferProgress) => void) | null = null;
  private onComplete: (() => void) | null = null;
  private onError: ((error: Error) => void) | null = null;

  constructor(
    private config: WebRTCConfig,
    private onDataChannelMessage: (data: any) => void
  ) {}

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.peerConnection = new RTCPeerConnection(this.config);
    this.setupDataChannel();
    this.setupIceCandidates();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    await this.peerConnection.setRemoteDescription(answer);
  }

  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.peerConnection = new RTCPeerConnection(this.config);
    this.setupDataChannel();
    this.setupIceCandidates();

    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  public addIceCandidate(candidate: RTCIceCandidateInit): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  public setFile(file: File): void {
    this.file = file;
    this.fileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
    };
    this.totalChunks = Math.ceil(file.size / this.chunkSize);
  }

  public setCallbacks(
    onProgress: (progress: TransferProgress) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): void {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
  }

  public async sendFile(): Promise<void> {
    if (!this.file || !this.dataChannel || !this.fileMetadata) {
      throw new Error('File or data channel not initialized');
    }

    try {
      // Send metadata first
      this.dataChannel.send(JSON.stringify({ type: 'metadata', data: this.fileMetadata }));

      // Send file in chunks
      while (this.currentChunk < this.totalChunks) {
        const start = this.currentChunk * this.chunkSize;
        const end = Math.min(start + this.chunkSize, this.file.size);
        const chunk = this.file.slice(start, end);
        const arrayBuffer = await chunk.arrayBuffer();
        
        this.dataChannel.send(arrayBuffer);
        this.currentChunk++;

        if (this.onProgress) {
          this.onProgress({
            bytesTransferred: end,
            totalBytes: this.file.size,
            percentage: (end / this.file.size) * 100,
          });
        }
      }

      if (this.onComplete) {
        this.onComplete();
      }
    } catch (error) {
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }

  private setupDataChannel(): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
    });

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
    };

    this.dataChannel.onmessage = (event) => {
      this.onDataChannelMessage(event.data);
    };
  }

  private setupIceCandidates(): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Handle ICE candidate
        console.log('New ICE candidate:', event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
    };
  }

  public close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
  }
} 