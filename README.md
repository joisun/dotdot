# WebRTC File Transfer

A secure file sharing application built with Next.js, WebRTC, and WebSocket.

## Features

- Create public or private rooms
- Join existing rooms
- Real-time file transfer using WebRTC
- Progress tracking
- Dark/Light mode support

## Getting Started

### Prerequisites

- Node.js 18 or later
- pnpm

### Installation

1. Clone the repository
2. Install dependencies:
```bash
pnpm install
```

### Development

Start the development server:
```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Production

Build the application:
```bash
pnpm build
```

Start the production server:
```bash
pnpm start
```

## How to Use

1. Create a room:
   - Click "创建公开房间" to create a public room
   - Or enter a room ID and click "创建私有房间" to create a private room

2. Join a room:
   - Enter a room ID and click "加入房间"
   - Or click "查看公开房间" to see available public rooms

3. Send files:
   - Select a target user from the dropdown
   - Choose a file to send
   - Click "发送" to start the transfer
   - Monitor the progress in real-time

4. Receive files:
   - Wait for the transfer to complete
   - Click "下载" to save the received file

## Technical Details

- Frontend: Next.js with TypeScript
- UI: shadcn/ui components
- Real-time communication: WebSocket for signaling
- File transfer: WebRTC Data Channels
- Styling: Tailwind CSS

## License

MIT 