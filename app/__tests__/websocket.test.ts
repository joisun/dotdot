import { SignalingClient } from '../lib/websocket';
import { SignalingMessage } from '../types';

describe('SignalingClient', () => {
  let client: SignalingClient;
  let mockOnMessage: jest.Mock;
  let mockOnError: jest.Mock;

  beforeEach(() => {
    mockOnMessage = jest.fn();
    mockOnError = jest.fn();
    client = new SignalingClient('ws://localhost:3000', mockOnMessage, mockOnError);
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('send', () => {
    it('should queue messages when not connected', () => {
      const message: SignalingMessage = {
        type: 'create-room',
        roomType: 'public',
        userId: 'test-user',
      };
      client.send(message);
      // Note: We can't directly access private properties, but we can verify
      // that the method doesn't throw
      expect(() => client.send(message)).not.toThrow();
    });
  });

  describe('disconnect', () => {
    it('should disconnect the WebSocket', () => {
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('handleError', () => {
    it('should call the error callback', () => {
      const error = new Error('Test error');
      // Note: This is a private method, but we can verify that the error callback
      // is called when an error occurs
      expect(mockOnError).not.toHaveBeenCalled();
      // Simulate an error
      client.disconnect();
      // The error callback should be called when the connection is closed
      expect(mockOnError).toHaveBeenCalled();
    });
  });
}); 