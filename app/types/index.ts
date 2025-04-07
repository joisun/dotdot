export type RoomType = 'public' | 'private';

export interface Room {
  id: string;
  type: RoomType;
  users: Set<string>;
}

export interface User {
  id: string;
  name: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface SignalingMessage {
  type: 'create-room' | 'join-room' | 'offer' | 'answer' | 'ice-candidate' | 'error';
  roomId?: string;
  roomType?: RoomType;
  userId?: string;
  targetUserId?: string;
  data?: any;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export interface ThemeConfig {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
} 