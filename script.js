// Hanya menggunakan 2 ID bergantian secara otomatis
const FIXED_IDS = ["3Nberadik", "3Nkandung"];
let peer = null;
let localStream = null;
let currentCall = null;
let activeConnection = null;
let pendingCall = null;
let useFrontCamera = true;
let targetPeerId = ""; // Lawan bicara otomatis

const myIdDisplay = document.getElementById('my-id');
const labelMyId = document.getElementById('label-my-id');
const targetIdDisplay = document.getElementById('target-id-display');
const callVideoBtn = document.getElementById('call-video-btn');
const callAudioBtn = document.getElementById('call-audio-btn');
const hangupBtn = document.getElementById('hangup-btn');
const muteBtn = document.getElementById('mute-btn');
const cameraBtn = document.getElementById('camera-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const exitBtn = document.getElementById('exit-btn');
const videoGrid = document.getElementById('video-grid');

const incomingModal = document.getElementById('incoming-modal');
const incomingCallerId = document.getElementById('incoming-caller-id');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

inisialisasiKameraDanPeer(true);

function inisialisasiKameraAndPeer(isFirstTime = false, videoEnabled = true) {
    const constraints = {
        video: videoEnabled ? { facingMode: useFrontCamera ? 'user' : 'environment' } : false,
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
            } else if (currentCall) {
                // Perbarui stream jika sedang menelepon
                const videoTrack = localStream.getVideoTracks()[0];
                const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender && videoTrack) sender.replaceTrack(videoTrack);
            }
        })
        .catch(error => {
            console.error('Gagal akses media:', error);
            alert('Izin kamera dan mikrofon wajib diaktifkan.');
        });
}

function cariDanHubungkanID(index) {
    if (index >= FIXED_IDS.length) {
        alert('Kedua ID (3Nberadik & 3Nkandung) sedang digunakan perangkat lain!');
        myIdDisplay.innerText = "Slot Penuh";
        return;
    }

    const myId = FIXED_IDS[index];
    // Lawan bicara adalah ID yang bukan ID kita sendiri
    targetPeerId = FIXED_IDS.find(id => id !== myId);
    
    myIdDisplay.innerText = `Mengecek ${myId}...`;
    targetIdDisplay.innerText = targetPeerId;
    
    peer = new Peer(myId);

    peer.on('open', (id) => {
        myIdDisplay.innerText = id;
        labelMyId.innerText = id;
        setupListeners();
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            peer.destroy();
            cariDanHubungkanID(index + 1); // Coba ID berikutnya
        } else {
            console.error('PeerJS error:', err);
        }
    });
}

function setupListeners() {
    // Panggilan Masuk
    peer.on('call', (call) => {
        pendingCall = call;
        incomingCallerId.innerText = call.peer;
        incomingModal.style.display = 'flex';
        bunyikanNadaDering();
    });

    // Koneksi Chat Masuk
    peer.on('connection', (conn) => {
        setupDataConnection(conn);
    });

    acceptCallBtn.onclick = () => {
        if (pendingCall) {
            pendingCall.answer(localStream);
            handleActiveCall(pendingCall);
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

    // Tombol Panggil Video
    callVideoBtn.addEventListener('click', () => {
        mulaiPanggilan(true);
    });

    // Tombol Panggil Suara Saja (Tanpa Video)
    callAudioBtn.addEventListener('click', () => {
        // Matikan video lokal terlebih dahulu untuk panggilan suara murni
        inisialisasiKameraAndPeer(false, false);
        setTimeout(() => mulaiPanggilan(false), 500);
    });

    hangupBtn.addEventListener('click', () => {
        if (currentCall) {
            currentCall.close();
            akhiriPanggilanUI();
        }
    });

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
        inisialisasiKameraAndPeer(false, true);
    });

    exitBtn.addEventListener('click', () => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (currentCall) currentCall.close();
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

function mulaiPanggilan(denganVideo) {
    if (!targetPeerId) return;

    // Hubungkan video call
    const call = peer.call(targetPeerId, localStream);
    handleActiveCall(call);

    // Hubungkan data chat otomatis
    if (!activeConnection) {
        const conn = peer.connect(targetPeerId);
        setupDataConnection(conn);
    }
}

function handleActiveCall(call) {
    currentCall = call;
    callVideoBtn.style.display = 'none';
    callAudioBtn.style.display = 'none';
    hangupBtn.style.display = 'inline-block';

    call.on('stream', (remoteStream) => {
        tampilkanKotakLawanBicara(call.peer, remoteStream);
    });

    call.on('close', () => {
        akhiriPanggilanUI();
    });

    call.on('error', (err) => {
        console.error('Call error:', err);
        akhiriPanggilanUI();
    });
}

function akhiriPanggilanUI() {
    if (currentCall) {
        currentCall = null;
    }
    HapusKotakLawanBicara();
    callVideoBtn.style.display = 'inline-block';
    callAudioBtn.style.display = 'inline-block';
    hangupBtn.style.display = 'none';
}

function setupDataConnection(conn) {
    activeConnection = conn;

    conn.on('data', (data) => {
        tampilkanPesanChat(conn.peer, data, 'theirs');
    });

    conn.on('close', () => {
        activeConnection = null;
    });
}

function kirimPesanChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    tampilkanPesanChat('Anda', text, 'mine');

    if (activeConnection) {
        activeConnection.send(text);
    } else if (targetPeerId) {
        // Coba buat koneksi baru jika belum terhubung
        const conn = peer.connect(targetPeerId);
        setupDataConnection(conn);
        setTimeout(() => conn.send(text), 500);
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

function tampilkanKotakLawanBicara(peerId, stream) {
    let card = document.getElementById(`video-card-${peerId}`);
    if (!card) {
        card = document.createElement('div');
        card.className = 'video-card';
        card.id = `video-card-${peerId}`;
        card.innerHTML = `
            <span>${peerId}</span>
            <video autoplay playsinline></video>
        `;
        videoGrid.appendChild(card);
    }
    card.querySelector('video').srcObject = stream;
}

function HapusKotakLawanBicara() {
    const card = document.getElementById(`video-card-${targetPeerId}`);
    if (card) card.remove();
}

// Fungsi untuk Minimize / Sembunyikan Chat
window.toggleChatMinimize = function() {
    const chatSection = document.getElementById('chat-section');
    const toggleBtn = document.getElementById('toggle-chat-btn');
    chatSection.classList.toggle('minimized');
    if (chatSection.classList.contains('minimized')) {
        toggleBtn.innerText = "[+] Tampilkan";
    } else {
        toggleBtn.innerText = "[-] Sembunyikan";
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
