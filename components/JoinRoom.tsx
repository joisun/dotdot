"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface JoinRoomProps {
  onJoin: (roomId: string) => void
  onCreateRoom: () => void
}

export function JoinRoom({ onJoin, onCreateRoom }: JoinRoomProps) {
  const [roomId, setRoomId] = useState("")

  const handleJoin = () => {
    if (roomId.trim()) {
      onJoin(roomId.trim())
    }
  }

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Join Room</CardTitle>
        <CardDescription>
          Enter a room ID to join an existing room or create a new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="roomId">Room ID</Label>
            <Input
              id="roomId"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleJoin()
                }
              }}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onCreateRoom}>
          Create New Room
        </Button>
        <Button onClick={handleJoin}>Join Room</Button>
      </CardFooter>
    </Card>
  )
} 