const FIXED_IDS = ["3Nberadik", "3Nkandung"];
let peer = null;
let localStream = null;
let remoteStream = null;
let currentCall = null;
let activeConnection = null;
let pendingCall = null;
let useFrontCamera = true;
let targetPeerId = "";
let ringtoneInterval = null;
let isMyVideoBig = false; // Status posisi video utama

const myIdDisplay = document.getElementById('my-id');
const targetIdDisplay = document.getElementById('target-id-display');
const callVideoBtn = document.getElementById('call-video-btn');
const callAudioBtn = document.getElementById('call-audio-btn');
const hangupBtn = document.getElementById('hangup-btn');
const muteBtn = document.getElementById('mute-btn');
const cameraBtn = document.getElementById('camera-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const exitBtn = document.getElementById('exit-btn');

const mainVideo = document.getElementById('main-video');
const floatingVideo = document.getElementById('floating-video');
const floatingLabel = document.getElementById('floating-label');

const incomingModal = document.getElementById('incoming-modal');
const incomingCallerId = document.getElementById('incoming-caller-id');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

document.addEventListener("DOMContentLoaded", () => {
    cariDanHubungkanID(0);
});

function cariDanHubungkanID(index) {
    if (index >= FIXED_IDS.length) {
        myIdDisplay.innerText = "Slot Penuh";
        alert('Kedua ID (3Nberadik & 3Nkandung) sedang digunakan!');
        return;
    }

    const myId = FIXED_IDS[index];
    targetPeerId = FIXED_IDS.find(id => id !== myId);
    
    myIdDisplay.innerText = myId;
    targetIdDisplay.innerText = targetPeerId;
    
    peer = new Peer(myId);

    peer.on('open', (id) => {
        myIdDisplay.innerText = id;
        aktifkanKameraDanSetup(true);
    });

    peer.on('error', (err) => {
        console.warn('Peer error:', err);
        if (err.type === 'unavailable-id') {
            peer.destroy();
            cariDanHubungkanID(index + 1); 
        } else {
            myIdDisplay.innerText = "Koneksi Gagal";
        }
    });
}

function aktifkanKameraDanSetup(videoEnabled = true) {
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
            
            // Atur posisi awal video lokal (di pojok mengambang jika ada remote stream, atau di utama jika belum)
            updateTampilanVideo();
            setupListeners();
        })
        .catch(error => {
            console.error('Gagal akses media:', error);
            alert('Izin kamera/mikrofon diperlukan.');
            setupListeners();
        });
}

function updateTampilanVideo() {
    if (isMyVideoBig) {
        mainVideo.srcObject = localStream;
        mainVideo.muted = true; // Supaya tidak gema
        if (remoteStream) {
            floatingVideo.srcObject = remoteStream;
            floatingLabel.innerText = targetPeerId;
        }
    } else {
        if (remoteStream) {
            mainVideo.srcObject = remoteStream;
            mainVideo.muted = false;
        } else {
            mainVideo.srcObject = localStream; // Default sebelum ada panggilan
            mainVideo.muted = true;
        }
        floatingVideo.srcObject = localStream;
        floatingVideo.muted = true;
        floatingLabel.innerText = "Anda";
    }
}

// Fungsi untuk menukar posisi video besar dan kecil saat diklik
window.tukarPosisiVideo = function() {
    if (!remoteStream) return; // Jangan tukar jika belum ada lawan bicara
    isMyVideoBig = !isMyVideoBig;
    updateTampilanVideo();
}

function setupListeners() {
    peer.on('call', (call) => {
        pendingCall = call;
        incomingCallerId.innerText = call.peer;
        incomingModal.style.display = 'flex';
        mulaiNadaDeringPenerima();
    });

    peer.on('connection', (conn) => {
        setupDataConnection(conn);
    });

    acceptCallBtn.onclick = () => {
        if (pendingCall) {
            hentikanNadaDering();
            pendingCall.answer(localStream);
            handleActiveCall(pendingCall);
            incomingModal.style.display = 'none';
            pendingCall = null;
        }
    };

    rejectCallBtn.onclick = () => {
        if (pendingCall) {
            hentikanNadaDering();
            pendingCall.close();
            incomingModal.style.display = 'none';
            pendingCall = null;
        }
    };

    callVideoBtn.addEventListener('click', () => mulaiPanggilan(true));
    callAudioBtn.addEventListener('click', () => {
        aktifkanKameraDanSetup(false);
        setTimeout(() => mulaiPanggilan(false), 500);
    });

    hangupBtn.addEventListener('click', () => {
        hentikanNadaDering();
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
        if (!localStream) return;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            muteBtn.innerText = audioTrack.enabled ? "Mute" : "Unmute";
            muteBtn.classList.toggle('active', !audioTrack.enabled);
        }
    });

    cameraBtn.addEventListener('click', () => {
        if (!localStream) return;
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
        aktifkanKameraDanSetup(true);
    });

    exitBtn.addEventListener('click', () => {
        hentikanNadaDering();
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (currentCall) currentCall.close();
        if (peer) peer.destroy();

        document.body.innerHTML = `
            <div style="font-family: Arial; text-align: center; margin-top: 100px;">
                <h2>Keluar Rapat</h2>
                <button onclick="window.location.reload()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">Masuk Lagi</button>
            </div>
        `;
    });
}

function mulaiPanggilan(denganVideo) {
    if (!targetPeerId) return;
    mulaiSuaraBerderingPanggil();

    const call = peer.call(targetPeerId, localStream);
    handleActiveCall(call);

    if (!activeConnection) {
        const conn = peer.connect(targetPeerId);
        setupDataConnection(conn);
    }
}

function handleActiveCall(call) {
    hentikanNadaDering();
    currentCall = call;
    callVideoBtn.style.display = 'none';
    callAudioBtn.style.display = 'none';
    hangupBtn.style.display = 'inline-block';

    call.on('stream', (stream) => {
        remoteStream = stream;
        updateTampilanVideo();
    });

    call.on('close', () => akhiriPanggilanUI());
    call.on('error', () => akhiriPanggilanUI());
}

function akhiriPanggilanUI() {
    hentikanNadaDering();
    currentCall = null;
    remoteStream = null;
    isMyVideoBig = false;
    updateTampilanVideo();

    callVideoBtn.style.display = 'inline-block';
    callAudioBtn.style.display = 'inline-block';
    hangupBtn.style.display = 'none';
}

function setupDataConnection(conn) {
    activeConnection = conn;
    conn.on('data', (data) => tampilkanPesanChat(conn.peer, data, 'theirs'));
    conn.on('close', () => { activeConnection = null; });
}

function kirimPesanChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    tampilkanPesanChat('Anda', text, 'mine');

    if (activeConnection) {
        activeConnection.send(text);
    } else if (targetPeerId) {
        const conn = peer.connect(targetPeerId);
        setupDataConnection(conn);
        setTimeout(() => conn.send(text), 500);
    }
    chatInput.value = {};
    chatInput.value = '';
}

function tampilkanPesanChat(sender, text, type) {
    if (chatMessages.innerHTML.includes('Belum ada pesan')) chatMessages.innerHTML = '';
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${type}`;
    msgDiv.innerHTML = `<strong>${sender}</strong>: ${text} <small>${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.toggleChatMinimize = function() {
    const chatSection = document.getElementById('chat-section');
    const toggleBtn = document.getElementById('toggle-chat-btn');
    chatSection.classList.toggle('minimized');
    toggleBtn.innerText = chatSection.classList.contains('minimized') ? "[+] Tampilkan" : "[-] Sembunyikan";
}

let ringtoneInterval = null;
function putarBipSuara(f1, f2) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(f1, ctx.currentTime);
        osc.frequency.setValueAtTime(f2, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch(e) {}
}

function mulaiNadaDeringPenerima() {
    hentikanNadaDering();
    ringtoneInterval = setInterval(() => putarBipSuara(440, 523), 2000);
}

function mulaiSuaraBerderingPanggil() {
    hentikanNadaDering();
    ringtoneInterval = setInterval(() => putarBipSuara(350, 440), 3000);
}

function hentikanNadaDering() {
    if (ringtoneInterval) { clearInterval(ringtoneInterval); ringtoneInterval = null; }
}
