import { WebRTCFileTransfer, FileTransferState } from '@/lib/webrtc'

describe('WebRTCFileTransfer', () => {
  let fileTransfer: WebRTCFileTransfer

  beforeEach(() => {
    fileTransfer = new WebRTCFileTransfer()
  })

  afterEach(() => {
    fileTransfer.close()
  })

  test('should initialize with idle state', () => {
    expect(fileTransfer.getState()).toBe('idle')
  })

  test('should create offer', async () => {
    const offer = await fileTransfer.createOffer()
    expect(offer).toHaveProperty('type', 'offer')
    expect(offer).toHaveProperty('sdp')
  })

  test('should set file and update progress', () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    fileTransfer.setFile(file)
    
    const progress = fileTransfer.getProgress()
    expect(progress.totalBytes).toBe(file.size)
    expect(progress.bytesTransferred).toBe(0)
    expect(progress.percentage).toBe(0)
  })

  test('should handle file transfer state changes', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    fileTransfer.setFile(file)

    // Mock data channel
    const mockDataChannel = {
      send: jest.fn(),
      close: jest.fn()
    }
    // @ts-ignore
    fileTransfer.dataChannel = mockDataChannel

    await fileTransfer.sendFile()
    expect(fileTransfer.getState()).toBe('completed')
  })

  test('should close connection', () => {
    fileTransfer.close()
    expect(fileTransfer.getState()).toBe('idle')
  })
}) 