// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
  }

  send(data) {
    // Mock send implementation
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  }
}

global.WebSocket = MockWebSocket;

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  constructor(configuration) {
    this.configuration = configuration;
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceConnectionState = 'new';
    this.onicecandidate = null;
    this.ondatachannel = null;
  }

  createOffer() {
    return Promise.resolve({
      type: 'offer',
      sdp: 'mock-sdp',
    });
  }

  createAnswer() {
    return Promise.resolve({
      type: 'answer',
      sdp: 'mock-sdp',
    });
  }

  setLocalDescription(description) {
    this.localDescription = description;
    return Promise.resolve();
  }

  setRemoteDescription(description) {
    this.remoteDescription = description;
    return Promise.resolve();
  }

  addIceCandidate(candidate) {
    return Promise.resolve();
  }

  createDataChannel(label, options) {
    return new MockRTCDataChannel(label, options);
  }

  close() {
    this.iceConnectionState = 'closed';
  }
}

class MockRTCDataChannel {
  constructor(label, options) {
    this.label = label;
    this.options = options;
    this.readyState = 'connecting';
    this.binaryType = 'arraybuffer';
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
  }

  send(data) {
    // Mock send implementation
  }

  close() {
    this.readyState = 'closed';
    if (this.onclose) {
      this.onclose();
    }
  }
}

global.RTCPeerConnection = MockRTCPeerConnection;
global.RTCDataChannel = MockRTCDataChannel; 