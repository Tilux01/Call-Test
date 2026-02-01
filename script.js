// DOM Elements
const usernameInput = document.getElementById('username');
const userStatus = document.getElementById('userStatus');
const usersSection = document.getElementById('usersSection');
const userList = document.getElementById('userList');
const callSection = document.getElementById('callSection');
const userSelect = document.getElementById('userSelect');
const incomingCallDiv = document.getElementById('incomingCall');
const callerName = document.getElementById('callerName');
const callControls = document.getElementById('callControls');
const connectedUser = document.getElementById('connectedUser');
const callStatus = document.getElementById('callStatus');
const localAudio = document.getElementById('localAudio');
const remoteAudio = document.getElementById('remoteAudio');

// Global variables
let socket;
let localStream;
let peerConnection;
let currentCall = null;
let username = null;
let iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Initialize
function init() {
    // Connect to signaling server
    socket = io('http://localhost:3000');
    
    // Socket event listeners
    socket.on('connect', () => {
        console.log('Connected to signaling server');
    });
    
    socket.on('incoming-call', async (data) => {
        console.log('Incoming call from:', data.from);
        
        // Store call data
        currentCall = {
            from: data.from,
            offer: data.offer
        };
        
        // Show incoming call UI
        callerName.textContent = data.from;
        incomingCallDiv.style.display = 'block';
        callStatus.textContent = `Incoming call from ${data.from}`;
    });
    
    socket.on('call-accepted', async (data) => {
        console.log('Call accepted by:', data.from);
        
        // Set remote description
        if (peerConnection) {
            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.answer)
            );
            callStatus.textContent = `Connected with ${data.from}`;
        }
    });
    
    socket.on('call-rejected', (data) => {
        console.log('Call rejected by:', data.from);
        alert(`Call rejected by ${data.from}`);
        resetCall();
    });
    
    socket.on('call-ended', (data) => {
        console.log('Call ended by:', data.from);
        alert(`${data.from} ended the call`);
        resetCall();
    });
    
    socket.on('ice-candidate', (data) => {
        if (peerConnection) {
            peerConnection.addIceCandidate(
                new RTCIceCandidate(data.candidate)
            );
        }
    });
    
    socket.on('users-list', (users) => {
        updateUserList(users);
    });
    
    socket.on('user-unavailable', (username) => {
        alert(`${username} is not available`);
    });
    
    socket.on('user-disconnected', (username) => {
        alert(`${username} disconnected`);
        refreshUsers();
    });
}

// Register user
function registerUser() {
    username = usernameInput.value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    socket.emit('register', username);
    userStatus.textContent = `Registered as: ${username}`;
    userStatus.style.color = 'green';
    
    // Show other sections
    usersSection.style.display = 'block';
    callSection.style.display = 'block';
    
    // Get user list
    refreshUsers();
}

// Refresh online users
function refreshUsers() {
    socket.emit('get-users');
}

// Update user list
function updateUserList(users) {
    userList.innerHTML = '';
    userSelect.innerHTML = '';
    
    users.forEach(user => {
        // Add to user list display
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <span>${user}</span>
            <button onclick="callUser('${user}')">Call</button>
        `;
        userList.appendChild(userItem);
        
        // Add to dropdown
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        userSelect.appendChild(option);
    });
}

// Call a user
async function callUser(targetUsername) {
    if (!targetUsername) {
        alert('Please select a user to call');
        return;
    }
    
    try {
        // Get local audio stream
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });
        
        // Play local audio (muted)
        localAudio.srcObject = localStream;
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(iceServers);
        
        // Add local stream tracks
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteAudio.srcObject = event.streams[0];
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    to: targetUsername,
                    from: username
                });
            }
        };
        
        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send offer via signaling server
        socket.emit('call-user', {
            to: targetUsername,
            offer: offer,
            from: username
        });
        
        // Update UI
        currentCall = {
            to: targetUsername,
            from: username
        };
        connectedUser.textContent = targetUsername;
        callControls.style.display = 'block';
        callStatus.textContent = `Calling ${targetUsername}...`;
        
    } catch (error) {
        console.error('Error starting call:', error);
        alert('Error accessing microphone. Please check permissions.');
    }
}

// Start call from dropdown
function startCall() {
    const targetUser = userSelect.value;
    callUser(targetUser);
}

// Accept incoming call
async function acceptCall() {
    if (!currentCall) return;
    
    try {
        // Get local audio stream
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });
        
        // Play local audio (muted)
        localAudio.srcObject = localStream;
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(iceServers);
        
        // Add local stream tracks
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteAudio.srcObject = event.streams[0];
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    to: currentCall.from,
                    from: username
                });
            }
        };
        
        // Set remote description from offer
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(currentCall.offer)
        );
        
        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send answer via signaling server
        socket.emit('call-accepted', {
            to: currentCall.from,
            answer: answer,
            from: username
        });
        
        // Update UI
        connectedUser.textContent = currentCall.from;
        incomingCallDiv.style.display = 'none';
        callControls.style.display = 'block';
        callStatus.textContent = `Connected with ${currentCall.from}`;
        
    } catch (error) {
        console.error('Error accepting call:', error);
        alert('Error accepting call');
    }
}

// Reject incoming call
function rejectCall() {
    if (!currentCall) return;
    
    socket.emit('reject-call', {
        to: currentCall.from,
        from: username
    });
    
    resetCall();
}

// End current call
function endCall() {
    if (currentCall && peerConnection) {
        socket.emit('hangup', {
            to: currentCall.to || currentCall.from,
            from: username
        });
    }
    
    resetCall();
}

// Reset call state
function resetCall() {
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Reset UI
    currentCall = null;
    incomingCallDiv.style.display = 'none';
    callControls.style.display = 'none';
    callStatus.textContent = '';
    localAudio.srcObject = null;
    remoteAudio.srcObject = null;
}

// Initialize when page loads
window.onload = init;