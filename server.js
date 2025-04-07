const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 存储房间信息
const rooms = new Map();
const publicRooms = new Set();

app.use(express.static('public'));

// WebSocket连接处理
wss.on('connection', (ws) => {
    ws.id = uuidv4();
    ws.username = `用户${ws.id.substring(0, 4)}`;

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch(data.type) {
            case 'create-room':
                const roomId = data.isPublic ? uuidv4().substring(0, 6) : data.roomId;
                rooms.set(roomId, {
                    host: ws.id,
                    isPublic: data.isPublic,
                    connections: new Map([[ws.id, { ws, username: ws.username }]])
                });
                if (data.isPublic) {
                    publicRooms.add(roomId);
                }
                ws.roomId = roomId;
                ws.send(JSON.stringify({
                    type: 'room-created',
                    roomId: roomId,
                    users: [{id: ws.id, username: ws.username}]
                }));
                break;

            case 'join-room':
                const room = rooms.get(data.roomId);
                if (room) {
                    room.connections.set(ws.id, { ws, username: ws.username });
                    ws.roomId = data.roomId;
                    
                    // 获取房间内所有用户列表
                    const users = Array.from(room.connections.entries()).map(([id, {username}]) => ({
                        id,
                        username
                    }));

                    // 通知所有用户有新用户加入
                    room.connections.forEach(({ws: client}) => {
                        client.send(JSON.stringify({
                            type: 'user-list-update',
                            users: users
                        }));
                    });
                }
                break;

            case 'get-public-rooms':
                ws.send(JSON.stringify({
                    type: 'public-rooms',
                    rooms: Array.from(publicRooms)
                }));
                break;

            // WebRTC信令
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                const targetRoom = rooms.get(ws.roomId);
                if (targetRoom) {
                    const {to} = data;
                    const targetConnection = targetRoom.connections.get(to);
                    if (targetConnection) {
                        // 确保包含来源ID
                        data.from = ws.id;
                        targetConnection.ws.send(JSON.stringify(data));
                        console.log(`转发 ${data.type} 从 ${ws.id} 到 ${to}`);
                    } else {
                        console.log(`目标用户 ${to} 不存在`);
                    }
                }
                break;
        }
    });

    ws.on('close', () => {
        if (ws.roomId) {
            const room = rooms.get(ws.roomId);
            if (room) {
                room.connections.delete(ws.id);
                
                if (room.connections.size === 0) {
                    rooms.delete(ws.roomId);
                    publicRooms.delete(ws.roomId);
                } else {
                    // 通知房间内其他用户
                    const users = Array.from(room.connections.entries()).map(([id, {username}]) => ({
                        id,
                        username
                    }));
                    room.connections.forEach(({ws: client}) => {
                        client.send(JSON.stringify({
                            type: 'user-list-update',
                            users: users
                        }));
                    });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
