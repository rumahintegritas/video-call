const AVAILABLE_IDS = ["3Nberadik", "3Nkandung", "3Nketiga", "3Nkeempat", "3Nkelima", "3Nkeenam"];
let peer = null;
let localStream = null;
let screenStream = null;
let activeCalls = {}; 
let activeConnections = {}; // Menyimpan koneksi data chat
let pendingCall = null;
let useFrontCamera = true;

const myIdDisplay = document.getElementById('my-id');
const labelMyId = document.getElementById('label-my-id');
const peerIdInput = document.getElementById('peer-id-input');
const callBtn = document.getElementById('call-btn');
const shareScreenBtn = document.getElementById('share-screen-btn');
const muteBtn = document.getElementById('mute-btn');
const cameraBtn = document.getElementById('camera-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const exitBtn = document.getElementById('exit-btn');
const videoGrid = document.getElementById('video-grid');
const presentationContainer = document.getElementById('presentation-container');
const presentationVideo = document.getElementById('presentation-video');
const presentationTitle = document.getElementById('presentation-title');
const incomingModal = document.getElementById('incoming-modal');
const incomingCallerId = document.getElementById('incoming-caller-id');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

inisialisasiKameraAndPeer(true);

function inisialisasiKameraAndPeer(isFirstTime = false) {
    const constraints = {
        video: { facingMode: useFrontCamera ? 'user' : 'environment' },
        audio: true
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            if (localStream) {
                localStream.getTracks().forEach(t => t.stop());
            }
            localStream = stream;
            const localVideo = document.getElementById('local-video');
            localVideo.srcObject = stream;
            
            if (isFirstTime) {
                cariDanHubungkanID(0);
            } else {
                const videoTrack = localStream.getVideoTracks()[0];
                for (let peerId in activeCalls) {
                    const call = activeCalls[peerId];
                    const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                }
            }
        })
        .catch(error => {
            console.error('Gagal akses kamera:', error);
            alert('Izin kamera dan mikrofon wajib diaktifkan.');
        });
}

function cariDanHubungkanID(index) {
    if (index >= AVAILABLE_IDS.length) {
        alert('Seluruh 6 slot ID penuh!');
        myIdDisplay.innerText = "Penuh";
        return;
    }

    const targetId = AVAILABLE_IDS[index];
    myIdDisplay.innerText = `Mengecek ${targetId}...`;
    
    peer = new Peer(targetId);

    peer.on('open', (id) => {
        myIdDisplay.innerText = id;
        labelMyId.innerText = id;
        setupListeners();
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            peer.destroy();
            cariDanHubungkanID(index + 1);
        } else {
            console.error('PeerJS error:', err);
        }
    });
}

function setupListeners() {
    // Panggilan Video Masuk
    peer.on('call', (call) => {
        pendingCall = call;
        incomingCallerId.innerText = call.peer;
        incomingModal.style.display = 'flex';
        bunyikanNadaDering();
    });

    // Koneksi Data Chat Masuk
    peer.on('connection', (conn) => {
        setupDataConnection(conn);
    });

    acceptCallBtn.onclick = () => {
        if (pendingCall) {
            pendingCall.answer(localStream);
            handleIncomingCall(pendingCall);
            incomingModal.style.display = 'none';
            pendingCall = null;
        }
    };

    rejectCallBtn.onclick = () => {
        if (pendingCall) {
            pendingCall.close();
            incomingModal.style.display = 'none';
            pendingCall = null;
        }
    };

    callBtn.addEventListener('click', () => {
        const targetId = peerIdInput.value.trim();
        if (!targetId || targetId === peer.id) {
            alert('Masukkan ID tujuan yang valid!');
            return;
        }

        // 1. Hubungkan Video Call
        if (!activeCalls[targetId]) {
            const call = peer.call(targetId, localStream);
            handleIncomingCall(call);
        }

        // 2. Hubungkan Data Chat (DataConnection)
        if (!activeConnections[targetId]) {
            const conn = peer.connect(targetId);
            setupDataConnection(conn);
        }
    });

    // Kirim Pesan Chat
    sendChatBtn.addEventListener('click', kirimPesanChat);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') kirimPesanChat();
    });

    muteBtn.addEventListener('click', () => {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            muteBtn.innerText = audioTrack.enabled ? "Mute" : "Unmute";
            muteBtn.classList.toggle('active', !audioTrack.enabled);
        }
    });

    cameraBtn.addEventListener('click', () => {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            cameraBtn.innerText = videoTrack.enabled ? "Kamera" : "Buka";
            cameraBtn.classList.toggle('active', !videoTrack.enabled);
        }
    });

    switchCameraBtn.addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        switchCameraBtn.innerText = useFrontCamera ? "Putar" : "Depan";
        inisialisasiKameraAndPeer(false);
    });

    shareScreenBtn.addEventListener('click', async () => {
        try {
            if (!screenStream) {
                screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                const screenTrack = screenStream.getVideoTracks()[0];

                for (let peerId in activeCalls) {
                    const call = activeCalls[peerId];
                    const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                }

                presentationVideo.srcObject = screenStream;
                presentationTitle.innerText = `Paparan Anda (${peer.id})`;
                presentationContainer.classList.add('active');
                shareScreenBtn.innerText = "Stop";
                shareScreenBtn.classList.add('active');

                screenTrack.onended = () => hentikanScreenSharing();
            } else {
                hentikanScreenSharing();
            }
        } catch (err) {
            console.error('Gagal screen share:', err);
        }
    });

    exitBtn.addEventListener('click', () => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (screenStream) screenStream.getTracks().forEach(t => t.stop());
        for (let id in activeCalls) activeCalls[id].close();
        if (peer) peer.destroy();

        document.body.innerHTML = `
            <div style="font-family: Arial; text-align: center; margin-top: 100px;">
                <h2>Keluar Rapat</h2>
                <p>Kamera & mikrofon dimatikan.</p>
                <button onclick="window.location.reload()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Masuk Lagi</button>
            </div>
        `;
    });
}

function setupDataConnection(conn) {
    activeConnections[conn.peer] = conn;

    conn.on('data', (data) => {
        tampilkanPesanChat(conn.peer, data, 'theirs');
    });

    conn.on('close', () => {
        delete activeConnections[conn.peer];
    });
}

function kirimPesanChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    tampilkanPesanChat('Anda', text, 'mine');

    // Kirim pesan ke semua peserta yang terhubung
    for (let peerId in activeConnections) {
        activeConnections[peerId].send(text);
    }

    chatInput.value = '';
}

function tampilkanPesanChat(sender, text, type) {
    if (chatMessages.innerHTML.includes('Belum ada pesan')) {
        chatMessages.innerHTML = '';
    }
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${type}`;
    msgDiv.innerHTML = `<strong>${sender}</strong>: ${text} <small>${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleIncomingCall(call) {
    activeCalls[call.peer] = call;

    call.on('stream', (remoteStream) => {
        tambahkanKotakVideo(call.peer, remoteStream);
    });

    call.on('close', () => {
        hapusKotakVideo(call.peer);
        delete activeCalls[call.peer];
    });
}

function hentikanScreenSharing() {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
    const videoTrack = localStream.getVideoTracks()[0];
    for (let peerId in activeCalls) {
        const call = activeCalls[peerId];
        const videoSender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (videoSender) videoSender.replaceTrack(videoTrack);
    }
    presentationContainer.classList.remove('active');
    presentationVideo.srcObject = null;
    shareScreenBtn.innerText = "Paparan";
    shareScreenBtn.classList.remove('active');
}

function tambahkanKotakVideo(peerId, stream) {
    let card = document.getElementById(`video-card-${peerId}`);
    if (!card) {
        card = document.createElement('div');
        card.className = 'video-card';
        card.id = `video-card-${peerId}`;
        card.innerHTML = `
            <span>${peerId}</span>
            <video autoplay playsinline></video>
            <div class="card-controls">
                <button onclick="akhiriPanggilanSpesifik('${peerId}')" style="background-color: #dc3545; font-size: 11px; padding: 3px 6px; border:none; color:white; border-radius:3px; cursor:pointer;">Tutup</button>
            </div>
        `;
        videoGrid.appendChild(card);
    }
    card.querySelector('video').srcObject = stream;
}

function hapusKotakVideo(peerId) {
    const card = document.getElementById(`video-card-${peerId}`);
    if (card) card.remove();
}

window.akhiriPanggilanSpesifik = function(peerId) {
    if (activeCalls[peerId]) {
        activeCalls[peerId].close();
        hapusKotakVideo(peerId);
        delete activeCalls[peerId];
    }
}

function bunyikanNadaDering() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
    } catch(e) {}
}
