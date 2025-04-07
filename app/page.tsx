"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ThemeToggle } from "@/components/theme-toggle"
import { useTheme } from "next-themes"
import { WebRTCFileTransfer } from "./lib/webrtc"
import { SignalingClient } from "./lib/websocket"
import { FileMetadata, Room, RoomType, SignalingMessage, TransferProgress, User } from "./types"

const CHUNK_SIZE = 16384 // 16KB chunks

export default function Home() {
  const [roomId, setRoomId] = useState("")
  const [roomType, setRoomType] = useState<RoomType>("public")
  const [userId, setUserId] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const { theme, setTheme } = useTheme()
  const signalingClient = useRef<SignalingClient | null>(null)
  const webrtc = useRef<WebRTCFileTransfer | null>(null)

  useEffect(() => {
    // Generate a unique user ID
    setUserId(crypto.randomUUID())

    // Initialize WebRTC
    webrtc.current = new WebRTCFileTransfer(
      {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
      handleDataChannelMessage
    )

    // Initialize WebSocket
    signalingClient.current = new SignalingClient(
      "ws://localhost:3000",
      handleSignalingMessage,
      handleSignalingError
    )

    return () => {
      signalingClient.current?.disconnect()
      webrtc.current?.close()
    }
  }, [])

  const handleSignalingMessage = async (message: SignalingMessage) => {
    switch (message.type) {
      case "create-room":
        setRoomId(message.roomId || "")
        setIsConnected(true)
        break
      case "join-room":
        setIsConnected(true)
        break
      case "offer":
        if (webrtc.current) {
          const answer = await webrtc.current.handleOffer(message.data)
          signalingClient.current?.send({
            type: "answer",
            roomId,
            targetUserId: message.userId,
            data: answer,
          })
        }
        break
      case "answer":
        if (webrtc.current) {
          await webrtc.current.handleAnswer(message.data)
        }
        break
      case "ice-candidate":
        if (webrtc.current) {
          webrtc.current.addIceCandidate(message.data)
        }
        break
      case "error":
        setError(message.data)
        break
    }
  }

  const handleSignalingError = (error: Error) => {
    setError(error.message)
    setIsConnected(false)
  }

  const handleDataChannelMessage = (data: any) => {
    if (typeof data === "string") {
      try {
        const message = JSON.parse(data)
        if (message.type === "metadata") {
          // Handle file metadata
          console.log("Received file metadata:", message.data)
        }
      } catch (error) {
        console.error("Error parsing message:", error)
      }
    } else {
      // Handle binary data (file chunks)
      console.log("Received binary data")
    }
  }

  const handleCreateRoom = () => {
    if (signalingClient.current) {
      signalingClient.current.send({
        type: "create-room",
        roomType,
        userId,
      })
    }
  }

  const handleJoinRoom = () => {
    if (signalingClient.current) {
      signalingClient.current.send({
        type: "join-room",
        roomId,
        userId,
      })
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (webrtc.current) {
        webrtc.current.setFile(file)
      }
    }
  }

  const handleSendFile = async () => {
    if (!selectedFile || !selectedUser || !webrtc.current) {
      setError("Please select a file and a user")
      return
    }

    try {
      const offer = await webrtc.current.createOffer()
      signalingClient.current?.send({
        type: "offer",
        roomId,
        targetUserId: selectedUser,
        data: offer,
      })

      webrtc.current.setCallbacks(
        (progress) => setTransferProgress(progress),
        () => {
          setTransferProgress(null)
          setSelectedFile(null)
        },
        (error) => setError(error.message)
      )

      await webrtc.current.sendFile()
    } catch (error) {
      setError((error as Error).message)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">WebRTC File Transfer</h1>
          <Button
            variant="outline"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Room Management</CardTitle>
            <CardDescription>Create or join a room to start file transfer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={handleCreateRoom} disabled={isConnected}>
                Create {roomType === "public" ? "Public" : "Private"} Room
              </Button>
              <Button onClick={handleJoinRoom} disabled={isConnected}>
                Join Room
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Room ID</Label>
              <Input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID"
                disabled={isConnected}
              />
            </div>
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select
                value={roomType}
                onValueChange={(value) => setRoomType(value as RoomType)}
                disabled={isConnected}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isConnected && (
          <Card>
            <CardHeader>
              <CardTitle>File Transfer</CardTitle>
              <CardDescription>Select a file and a user to transfer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select File</Label>
                <Input type="file" onChange={handleFileSelect} />
              </div>
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSendFile} disabled={!selectedFile || !selectedUser}>
                Send File
              </Button>
              {transferProgress && (
                <div className="space-y-2">
                  <Progress value={transferProgress.percentage} />
                  <p className="text-sm text-muted-foreground">
                    {Math.round(transferProgress.percentage)}% complete
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
} 