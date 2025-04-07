import { SignalingMessage } from '../types';

export class SignalingClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private messageQueue: SignalingMessage[] = [];
  private isConnected = false;

  constructor(
    private url: string,
    private onMessage: (message: SignalingMessage) => void,
    private onError: (error: Error) => void
  ) {}

  public connect(): void {
    try {
      this.ws = new WebSocket(this.url);
      this.setupWebSocket();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public send(message: SignalingMessage): void {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  private setupWebSocket(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleError(new Error('WebSocket error'));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SignalingMessage;
        this.onMessage(message);
      } catch (error) {
        this.handleError(error as Error);
      }
    };
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), this.reconnectTimeout * this.reconnectAttempts);
    } else {
      this.handleError(new Error('Max reconnection attempts reached'));
    }
  }

  private handleError(error: Error): void {
    console.error('Signaling error:', error);
    this.onError(error);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }
} 