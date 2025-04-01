let ws;
let peerConnections = new Map();
let dataChannels = new Map();
let currentRoom;
let fileQueue = [];
let currentFile = null;
let receivedSize = 0;
let fileSize = 0;
let myId = null;

const CHUNK_SIZE = 16384; // 16KB chunks

// WebSocket连接
function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onopen = function() {
        console.log('WebSocket连接已打开');
    };
    
    ws.onclose = function() {
        console.log('WebSocket连接已关闭');
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket错误:', error);
    };
    
    ws.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('收到消息:', data.type);
            
            switch(data.type) {
                case 'room-created':
                    currentRoom = data.roomId;
                    myId = data.users[0].id;
                    document.getElementById('room-info').textContent = `房间号: ${currentRoom}`;
                    document.getElementById('room-controls').style.display = 'none';
                    document.getElementById('file-transfer').style.display = 'block';
                    updateUserList(data.users);
                    break;

                case 'user-list-update':
                    updateUserList(data.users);
                    // 只连接新加入的用户，不要连接已有连接或自己
                    const newUsers = data.users.filter(user => 
                        user.id !== myId && 
                        !peerConnections.has(user.id)
                    );
                    
                    if (newUsers.length > 0) {
                        console.log(`检测到新用户: ${newUsers.map(u => u.username).join(', ')}`);
                        
                        // 延迟一秒再建立连接，让两边都有时间处理用户列表
                        setTimeout(() => {
                            for (const user of newUsers) {
                                console.log(`主动连接用户: ${user.username} (${user.id})`);
                                initConnection(user.id);
                            }
                        }, 1000);
                    }
                    break;

                case 'public-rooms':
                    displayPublicRooms(data.rooms);
                    break;

                case 'offer':
                    console.log('收到offer，来自:', data.from);
                    await handleOffer(data);
                    break;

                case 'answer':
                    console.log('收到answer，来自:', data.from);
                    const peerConnection = peerConnections.get(data.from);
                    if (peerConnection) {
                        try {
                            await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
                            console.log('已设置远程描述');
                        } catch (err) {
                            console.error('设置远程描述错误:', err);
                        }
                    }
                    break;

                case 'ice-candidate':
                    console.log('收到ice candidate，来自:', data.from);
                    const pc = peerConnections.get(data.from);
                    if (pc && data.candidate) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                            console.log('已添加ICE候选');
                        } catch (err) {
                            console.error('添加ICE候选错误:', err);
                        }
                    }
                    break;
            }
        } catch (err) {
            console.error('处理消息错误:', err);
        }
    };
}

// 更新用户列表
function updateUserList(users) {
    const usersList = document.getElementById('users');
    const targetUser = document.getElementById('target-user');
    usersList.innerHTML = '';
    targetUser.innerHTML = '';
    
    users.forEach(user => {
        // 更新用户列表
        const li = document.createElement('li');
        li.textContent = user.username;
        if (user.id === myId) {
            li.textContent += ' (你)';
        }
        usersList.appendChild(li);

        // 更新目标用户选择下拉框
        if (user.id !== myId) {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username;
            targetUser.appendChild(option);
        }
    });
}

// 初始化连接
async function initConnection(targetId) {
    console.log(`初始化与用户 ${targetId} 的连接`);
    try {
        // 创建连接，但先不创建数据通道，避免双方同时创建
        const pc = createPeerConnection(targetId);
        
        // 比较ID，让ID较小的一方先发起连接
        if (myId < targetId) {
            console.log(`作为发起方创建数据通道 (${myId} < ${targetId})`);
            await createDataChannel(targetId);
        } else {
            console.log(`等待对方创建数据通道 (${myId} > ${targetId})`);
        }
    } catch (err) {
        console.error(`初始化连接错误:`, err);
    }
}

// 创建WebRTC连接
function createPeerConnection(targetId) {
    if (peerConnections.has(targetId)) {
        return peerConnections.get(targetId);
    }

    console.log(`创建PeerConnection, 目标ID: ${targetId}`);
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('本地ICE候选生成，发送给:', targetId);
            sendSignalingMessage('ice-candidate', { 
                to: targetId,
                candidate: event.candidate 
            });
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE连接状态: ${peerConnection.iceConnectionState}`);
    };

    peerConnection.ondatachannel = (event) => {
        console.log('收到数据通道，来自:', targetId);
        setupDataChannel(event.channel, targetId);
    };

    peerConnections.set(targetId, peerConnection);
    return peerConnection;
}

// 创建数据通道
async function createDataChannel(targetId) {
    const peerConnection = createPeerConnection(targetId);
    
    // 如果已有数据通道且处于打开状态，则不需要重新创建
    if (dataChannels.has(targetId) && dataChannels.get(targetId).readyState === 'open') {
        return dataChannels.get(targetId);
    }
    
    console.log(`创建数据通道, 目标ID: ${targetId}`);
    const dataChannel = peerConnection.createDataChannel('fileTransfer');
    setupDataChannel(dataChannel, targetId);
    
    try {
        console.log('创建offer...');
        const offer = await peerConnection.createOffer();
        console.log('设置本地描述...');
        await peerConnection.setLocalDescription(offer);
        console.log('发送offer给:', targetId);
        sendSignalingMessage('offer', { 
            to: targetId,
            type: 'offer',
            sdp: peerConnection.localDescription.sdp
        });
        
        return new Promise((resolve) => {
            // 等待通道打开
            const checkOpen = setInterval(() => {
                if (dataChannels.has(targetId) && dataChannels.get(targetId).readyState === 'open') {
                    clearInterval(checkOpen);
                    clearTimeout(timeout);
                    resolve(dataChannels.get(targetId));
                }
            }, 100);
            
            // 设置超时
            const timeout = setTimeout(() => {
                clearInterval(checkOpen);
                resolve(null);
            }, 10000);
        });
    } catch (err) {
        console.error('创建数据通道错误:', err);
        return null;
    }
}

// 设置数据通道
function setupDataChannel(channel, peerId) {
    channel.binaryType = 'arraybuffer';
    
    channel.onopen = () => {
        console.log(`数据通道打开, 对等方: ${peerId}`);
        dataChannels.set(peerId, channel);
        
        // 检查队列中是否有待发送的文件
        const queuedItem = fileQueue.find(item => item.targetId === peerId);
        if (queuedItem) {
            const index = fileQueue.indexOf(queuedItem);
            if (index > -1) {
                fileQueue.splice(index, 1);
                sendFile(queuedItem.file, peerId);
            }
        }
    };

    channel.onclose = () => {
        console.log(`数据通道关闭, 对等方: ${peerId}`);
        dataChannels.delete(peerId);
    };

    channel.onerror = (error) => {
        console.error(`数据通道错误, 对等方: ${peerId}`, error);
    };

    channel.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
            handleFileChunk(event.data);
        } else {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'file-metadata') {
                    handleFileMetadata(message.metadata);
                }
            } catch (e) {
                console.error('解析消息错误:', e);
            }
        }
    };
}

// 处理文件元数据
function handleFileMetadata(metadata) {
    console.log('收到文件元数据:', metadata);
    currentFile = {
        name: metadata.name,
        type: metadata.type,
        size: metadata.size,
        data: []
    };
    receivedSize = 0;
    fileSize = metadata.size;
    updateProgress(0);
}

// 处理收到的文件块
function handleFileChunk(data) {
    if (!currentFile) {
        console.error('收到文件块但无文件元数据');
        return;
    }
    
    currentFile.data.push(data);
    receivedSize += data.byteLength;
    updateProgress(receivedSize / fileSize);

    if (receivedSize === fileSize) {
        // 文件接收完成，创建下载
        const blob = new Blob(currentFile.data, { type: currentFile.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFile.name;
        a.textContent = `下载 ${currentFile.name}`;
        document.getElementById('file-list').appendChild(a);
        currentFile = null;
    }
}

// 处理Offer
async function handleOffer(data) {
    console.log(`处理offer, 来自: ${data.from}`);
    const peerConnection = createPeerConnection(data.from);
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: data.sdp
        }));
        console.log('已设置远程描述');
        
        console.log('创建answer...');
        const answer = await peerConnection.createAnswer();
        
        console.log('设置本地描述...');
        await peerConnection.setLocalDescription(answer);
        
        console.log('发送answer给:', data.from);
        sendSignalingMessage('answer', { 
            to: data.from,
            type: 'answer',
            sdp: peerConnection.localDescription.sdp
        });
    } catch (err) {
        console.error('处理offer错误:', err);
    }
}

// 发送信令消息
function sendSignalingMessage(type, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: type,
            ...data
        }));
    } else {
        console.error('WebSocket未连接，无法发送信令消息');
    }
}

// UI相关函数
function createPublicRoom() {
    ws.send(JSON.stringify({
        type: 'create-room',
        isPublic: true
    }));
}

function createPrivateRoom() {
    const roomId = document.getElementById('room-id').value;
    if (!roomId) {
        alert('请输入房间号');
        return;
    }
    ws.send(JSON.stringify({
        type: 'create-room',
        isPublic: false,
        roomId: roomId
    }));
}

function joinRoom() {
    const roomId = document.getElementById('room-id').value;
    if (!roomId) {
        alert('请输入房间号');
        return;
    }
    ws.send(JSON.stringify({
        type: 'join-room',
        roomId: roomId
    }));
    currentRoom = roomId;
    document.getElementById('room-info').textContent = `房间号: ${roomId}`;
    document.getElementById('room-controls').style.display = 'none';
    document.getElementById('file-transfer').style.display = 'block';
}

function getPublicRooms() {
    ws.send(JSON.stringify({
        type: 'get-public-rooms'
    }));
}

function displayPublicRooms(rooms) {
    const container = document.getElementById('public-rooms');
    container.innerHTML = '';
    rooms.forEach(roomId => {
        const button = document.createElement('button');
        button.textContent = `加入房间 ${roomId}`;
        button.onclick = () => {
            document.getElementById('room-id').value = roomId;
            joinRoom();
        };
        container.appendChild(button);
    });
}

// 更新进度条
function updateProgress(progress) {
    const percentage = Math.round(progress * 100);
    document.getElementById('progress').textContent = `${percentage}%`;
}

// 文件选择处理
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const files = e.target.files;
    const targetId = document.getElementById('target-user').value;
    
    if (!targetId) {
        alert('请选择要发送给的用户');
        return;
    }
    
    if (files.length === 0) {
        return;
    }
    
    try {
        // 如果没有连接或连接未打开，尝试建立连接
        let dataChannel = dataChannels.get(targetId);
        if (!dataChannel || dataChannel.readyState !== 'open') {
            console.log('数据通道未打开，尝试建立连接...');
            dataChannel = await createDataChannel(targetId);
        }
        
        if (!dataChannel || dataChannel.readyState !== 'open') {
            console.log('无法建立连接，当前状态:', dataChannel ? dataChannel.readyState : 'null');
            alert('连接未打开，请重试');
            return;
        }
        
        // 循环发送所有文件
        for (const file of files) {
            try {
                console.log(`开始发送文件: ${file.name} (${file.size} 字节)`);
                
                // 发送文件元数据
                dataChannel.send(JSON.stringify({
                    type: 'file-metadata',
                    metadata: {
                        name: file.name,
                        type: file.type || 'application/octet-stream',
                        size: file.size
                    }
                }));
                
                console.log('文件元数据已发送');
                
                // 分块发送文件
                const chunks = Math.ceil(file.size / CHUNK_SIZE);
                for (let i = 0; i < chunks; i++) {
                    if (dataChannel.readyState !== 'open') {
                        throw new Error('数据通道在传输过程中关闭');
                    }
                    
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const chunk = await file.slice(start, end).arrayBuffer();
                    
                    // 使用缓冲区控制发送速度
                    await new Promise(resolve => {
                        if (dataChannel.bufferedAmount > 1024 * 1024) { // 如果缓冲区超过1MB
                            const onBufferLow = () => {
                                dataChannel.removeEventListener('bufferedamountlow', onBufferLow);
                                resolve();
                            };
                            dataChannel.addEventListener('bufferedamountlow', onBufferLow);
                        } else {
                            resolve();
                        }
                    });
                    
                    dataChannel.send(chunk);
                    updateProgress((i + 1) / chunks);
                    
                    if ((i + 1) % 10 === 0 || i === chunks - 1) {
                        console.log(`已发送块 ${i+1}/${chunks}`);
                    }
                }
                console.log(`文件 ${file.name} 发送完成`);
            } catch (err) {
                console.error('发送文件时出错:', err);
                alert(`发送文件 ${file.name} 时出错: ${err.message}`);
                break;
            }
        }
    } catch (err) {
        console.error('文件传输错误:', err);
        alert(`文件传输错误: ${err.message}`);
    }
});

// 初始化WebSocket连接
connectWebSocket();
