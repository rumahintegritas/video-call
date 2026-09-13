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
let isMyVideoBig = false;

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
    // Berikan pilihan manual atau coba otomatis dengan timeout pengaman
    inisialisasiSistemCepat();
});

function inisialisasiSistemCepat() {
    myIdDisplay.innerText = "Memuat kamera...";
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
        .then(stream => {
            localStream = stream;
            updateTampilanVideo();
            hubungkanPeerJS(0);
        })
        .catch(err => {
            console.warn("Gagal izin kamera penuh, lanjut audio/tanpa video:", err);
            hubungkanPeerJS(0); // Tetap lanjut meski kamera gagal agar ID bisa ditarik
        });
}

function hubungkanPeerJS(index) {
    if (index >= FIXED_IDS.length) {
        myIdDisplay.innerText = "Gagal Terhubung (Slot Penuh)";
        alert("Kedua ID sedang aktif di tab lain. Tutup tab lain terlebih dahulu!");
        return;
    }

    const myId = FIXED_IDS[index];
    targetPeerId = FIXED_IDS.find(id => id !== myId);
    
    myIdDisplay.innerText = `Mencoba ${myId}...`;
    targetIdDisplay.innerText = targetPeerId;

    // Tambahkan opsi konfigurasi server publik yang stabil
    peer = new Peer(myId, {
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });

    peer.on('open', (id) => {
        myIdDisplay.innerText = id;
        setupListeners();
    });

    peer.on('error', (err) => {
        console.warn('PeerJS Error:', err.type);
        if (err.type === 'unavailable-id' || err.type === 'browser-incompatible' || err.type === 'network') {
            peer.destroy();
            // Coba ID cadangan berikutnya secara instan
            hubungkanPeerJS(index + 1);
        } else {
            myIdDisplay.innerText = "Koneksi Terputus";
        }
    });
}

function updateTampilanVideo() {
    if (!localStream) return;
    if (isMyVideoBig) {
        mainVideo.srcObject = localStream;
        mainVideo.muted = true;
        if (remoteStream) {
            floatingVideo.srcObject = remoteStream;
            floatingLabel.innerText = targetPeerId;
        }
    } else {
        if (remoteStream) {
            mainVideo.srcObject = remoteStream;
            mainVideo.muted = false;
        } else {
            mainVideo.srcObject = localStream;
            mainVideo.muted = true;
        }
        floatingVideo.srcObject = localStream;
        floatingVideo.muted = true;
        floatingLabel.innerText = "Anda";
    }
}

window.tukarPosisiVideo = function() {
    if (!remoteStream) return;
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
    callAudioBtn.addEventListener('click', () => mulaiPanggilan(false));

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
        navigator.mediaDevices.getUserMedia({ video: { facingMode: useFrontCamera ? 'user' : 'environment' }, audio: true })
            .then(stream => {
                if (localStream) localStream.getTracks().forEach(t => t.stop());
                localStream = stream;
                updateTampilanVideo();
            });
    });

    // Tombol Keluar & Otomatis "Membunuh" Sesi (Kill Tab / Cleanup)
    exitBtn.addEventListener('click', () => {
        tutupSesiDanMatikan();
    });

    // Otomatis bersihkan sesi jika tab ditutup atau berpindah
    window.addEventListener('beforeunload', () => {
        tutupSesiDanMatikan();
    });
}

function tutupSesiDanMatikan() {
    hentikanNadaDering();
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
    }
    if (currentCall) {
        currentCall.close();
    }
    if (activeConnection) {
        activeConnection.close();
    }
    if (peer) {
        peer.destroy(); // Menutup total sambungan ID agar langsung bersih dari server
    }
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
