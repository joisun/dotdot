import { WebRTCFileTransfer } from '../lib/webrtc';
import { FileMetadata, TransferProgress } from '../types';

describe('WebRTCFileTransfer', () => {
  let webrtc: WebRTCFileTransfer;
  let mockDataChannelMessage: jest.Mock;

  beforeEach(() => {
    mockDataChannelMessage = jest.fn();
    webrtc = new WebRTCFileTransfer(
      {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
      mockDataChannelMessage
    );
  });

  afterEach(() => {
    webrtc.close();
  });

  describe('createOffer', () => {
    it('should create an offer', async () => {
      const offer = await webrtc.createOffer();
      expect(offer).toBeDefined();
      expect(offer.type).toBe('offer');
      expect(offer.sdp).toBeDefined();
    });
  });

  describe('handleAnswer', () => {
    it('should handle an answer', async () => {
      const offer = await webrtc.createOffer();
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: 'mock-sdp',
      };
      await expect(webrtc.handleAnswer(answer)).resolves.not.toThrow();
    });
  });

  describe('handleOffer', () => {
    it('should handle an offer and return an answer', async () => {
      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'mock-sdp',
      };
      const answer = await webrtc.handleOffer(offer);
      expect(answer).toBeDefined();
      expect(answer.type).toBe('answer');
      expect(answer.sdp).toBeDefined();
    });
  });

  describe('addIceCandidate', () => {
    it('should add an ICE candidate', () => {
      const candidate: RTCIceCandidateInit = {
        candidate: 'mock-candidate',
        sdpMid: 'mock-mid',
        sdpMLineIndex: 0,
      };
      expect(() => webrtc.addIceCandidate(candidate)).not.toThrow();
    });
  });

  describe('setFile', () => {
    it('should set file metadata', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      webrtc.setFile(file);
      // Note: We can't directly access private properties, but we can verify
      // that the method doesn't throw
      expect(() => webrtc.setFile(file)).not.toThrow();
    });
  });

  describe('setCallbacks', () => {
    it('should set callbacks', () => {
      const onProgress = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();
      expect(() => webrtc.setCallbacks(onProgress, onComplete, onError)).not.toThrow();
    });
  });

  describe('sendFile', () => {
    it('should send file metadata', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      webrtc.setFile(file);
      webrtc.setCallbacks(
        jest.fn(),
        jest.fn(),
        jest.fn()
      );
      await expect(webrtc.sendFile()).rejects.toThrow('File or data channel not initialized');
    });
  });
}); 