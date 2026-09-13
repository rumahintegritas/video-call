const FIXED_IDS = ["3Nberadik", "3Nkandung"];
let peer = null;
let localStream = null;
let currentCall = null;
let activeConnection = null;
let pendingCall = null;
let useFrontCamera = true;
let targetPeerId = "";
let ringtoneInterval = null; // Variabel untuk menyimpan interval nada dering

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
    
    myIdDisplay.innerText = `Menghubungkan ke ${myId}...`;
    targetIdDisplay.innerText = targetPeerId;
    
    peer = new Peer(myId);

    peer.on('open', (id) => {
        myIdDisplay.innerText = id;
        labelMyId.innerText = id;
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
            const localVideo = document.getElementById('local-video');
            localVideo.srcObject = stream;
            
            setupListeners();
        })
        .catch(error => {
            console.error('Gagal akses media:', error);
            alert('Izin kamera/mikrofon diperlukan agar video call dapat berjalan.');
            setupListeners();
        });
}

function setupListeners() {
    // Saat ada panggilan masuk (Penerima)
    peer.on('call', (call) => {
        pendingCall = call;
        incomingCallerId.innerText = call.peer;
        incomingModal.style.display = 'flex';
        
        // Bunyikan nada dering berulang-ulang sampai diangkat atau ditolak
        mulaiNadaDeringPenerima();
    });

    peer.on('connection', (conn) => {
        setupDataConnection(conn);
    });

    acceptCallBtn.onclick = () => {
        if (pendingCall) {
            hentikanNadaDering(); // Matikan dering
            pendingCall.answer(localStream);
            handleActiveCall(pendingCall);
            incomingModal.style.display = 'none';
            pendingCall = null;
        }
    };

    rejectCallBtn.onclick = () => {
        if (pendingCall) {
            hentikanNadaDering(); // Matikan dering
            pendingCall.close();
            incomingModal.style.display = 'none';
            pendingCall = null;
        }
    };

    callVideoBtn.addEventListener('click', () => {
        mulaiPanggilan(true);
    });

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
                <p>Kamera & mikrofon dimatikan.</p>
                <button onclick="window.location.reload()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Masuk Lagi</button>
            </div>
        `;
    });
}

function mulaiPanggilan(denganVideo) {
    if (!targetPeerId) return;

    // Bunyikan suara berdering (ringback tone) bagi yang memanggil
    mulaiSuaraBerderingPanggil();

    const call = peer.call(targetPeerId, localStream);
    handleActiveCall(call);

    if (!activeConnection) {
        const conn = peer.connect(targetPeerId);
        setupDataConnection(conn);
    }
}

function handleActiveCall(call) {
    hentikanNadaDering(); // Hentikan suara dering saat tersambung
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
    hentikanNadaDering();
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

// Generator Suara Dering Menggunakan Web Audio API
function putarBipSuara(freq1, freq2) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq1, audioCtx.currentTime);
        osc.frequency.setValueAtTime(freq2, audioCtx.currentTime + 0.2);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } catch(e) {}
}

// Nada Dering Masuk untuk Penerima (Berulang setiap 2 detik)
function mulaiNadaDeringPenerima() {
    hentikanNadaDering();
    ringtoneInterval = setInterval(() => {
        putarBipSuara(440, 523); // Nada berdering ganda
    }, 2000);
}

// Suara Berdering (Ringback tone) saat Memanggil (Berulang setiap 3 detik)
function mulaiSuaraBerderingPanggil() {
    hentikanNadaDering();
    ringtoneInterval = setInterval(() => {
        putarBipSuara(350, 440); // Nada tunggu panggilan
    }, 3000);
}

// Hentikan semua suara dering
function hentikanNadaDering() {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
}
