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

// Jalankan segera saat dokumen siap
document.addEventListener("DOMContentLoaded", () => {
    const myIdDisplay = document.getElementById('my-id');
    
    // Tampilkan tombol pilihan ID secara instan di layar agar tidak macet
    myIdDisplay.innerHTML = `
        <span style="color: #ffc107;">Pilih Perangkat:</span> 
        <button onclick="mulaiAplikasi('3Nberadik', '3Nkandung')" style="background:#28a745; color:white; padding:4px 10px; margin-left:5px; cursor:pointer; border:none; border-radius:4px;">1: 3Nberadik</button>
        <button onclick="mulaiAplikasi('3Nkandung', '3Nberadik')" style="background:#17a2b8; color:white; padding:4px 10px; margin-left:5px; cursor:pointer; border:none; border-radius:4px;">2: 3Nkandung</button>
    `;
});

// Fungsi utama saat tombol ID diklik oleh pengguna
window.mulaiAplikasi = function(myId, targetId) {
    targetPeerId = targetId;
    document.getElementById('target-id-display').innerText = targetPeerId;
    document.getElementById('my-id').innerText = `Menghubungkan ${myId}...`;

    // 1. Ambil izin kamera terlebih dahulu
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
        .then(stream => {
            localStream = stream;
            inisialisasiVideoLokal();
            inisambungkanPeerJS(myId);
        })
        .catch(err => {
            console.warn("Kamera ditolak/tidak ada, lanjut mode audio:", err);
            inisambungkanPeerJS(myId);
        });
}

function inisialisasiVideoLokal() {
    if (!localStream) return;
    const floatingVideo = document.getElementById('floating-video');
    floatingVideo.srcObject = localStream;
    floatingVideo.muted = true;
}

function inisambungkanPeerJS(myId) {
    peer = new Peer(myId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/'
    });

    peer.on('open', (id) => {
        document.getElementById('my-id').innerText = id;
        setupListeners();
        alert(`Berhasil terhubung sebagai: ${id}`);
    });

    peer.on('error', (err) => {
        console.warn('PeerJS Error:', err);
        if (err.type === 'unavailable-id') {
            alert(`ID "${myId}" sedang digunakan di tab/perangkat lain! Tutup tab tersebut dan refresh.`);
            location.reload();
        } else {
            document.getElementById('my-id').innerText = "Koneksi Gagal, Refresh Ulang";
        }
    });
}

function updateTampilanVideo() {
    const mainVideo = document.getElementById('main-video');
    const floatingVideo = document.getElementById('floating-video');
    const floatingLabel = document.getElementById('floating-label');

    if (isMyVideoBig) {
        if (localStream) {
            mainVideo.srcObject = localStream;
            mainVideo.muted = true;
        }
        if (remoteStream) {
            floatingVideo.srcObject = remoteStream;
            floatingLabel.innerText = targetPeerId;
        }
    } else {
        if (remoteStream) {
            mainVideo.srcObject = remoteStream;
            mainVideo.muted = false;
        } else if (localStream) {
            mainVideo.srcObject = localStream;
            mainVideo.muted = true;
        }
        if (localStream) {
            floatingVideo.srcObject = localStream;
            floatingVideo.muted = true;
            floatingLabel.innerText = "Anda";
        }
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
        document.getElementById('incoming-caller-id').innerText = call.peer;
        document.getElementById('incoming-modal').style.display = 'flex';
        mulaiNadaDeringPenerima();
    });

    peer.on('connection', (conn) => {
        setupDataConnection(conn);
    });

    document.getElementById('accept-call-btn').onclick = () => {
        if (pendingCall) {
            hentikanNadaDering();
            pendingCall.answer(localStream);
            handleActiveCall(pendingCall);
            document.getElementById('incoming-modal').style.display = 'none';
            pendingCall = null;
        }
    };

    document.getElementById('reject-call-btn').onclick = () => {
        if (pendingCall) {
            hentikanNadaDering();
            pendingCall.close();
            document.getElementById('incoming-modal').style.display = 'none';
            pendingCall = null;
        }
    };

    document.getElementById('call-video-btn').addEventListener('click', () => mulaiPanggilan(true));
    document.getElementById('call-audio-btn').addEventListener('click', () => mulaiPanggilan(false));

    document.getElementById('hangup-btn').addEventListener('click', () => {
        hentikanNadaDering();
        if (currentCall) {
            currentCall.close();
            akhiriPanggilanUI();
        }
    });

    document.getElementById('send-chat-btn').addEventListener('click', kirimPesanChat);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') kirimPesanChat();
    });

    document.getElementById('mute-btn').addEventListener('click', () => {
        if (!localStream) return;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            document.getElementById('mute-btn').innerText = audioTrack.enabled ? "Mute" : "Unmute";
            document.getElementById('mute-btn').classList.toggle('active', !audioTrack.enabled);
        }
    });

    document.getElementById('camera-btn').addEventListener('click', () => {
        if (!localStream) return;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            document.getElementById('camera-btn').innerText = videoTrack.enabled ? "Kamera" : "Buka";
            document.getElementById('camera-btn').classList.toggle('active', !videoTrack.enabled);
        }
    });

    document.getElementById('switch-camera-btn').addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        navigator.mediaDevices.getUserMedia({ video: { facingMode: useFrontCamera ? 'user' : 'environment' }, audio: true })
            .then(stream => {
                if (localStream) localStream.getTracks().forEach(t => t.stop());
                localStream = stream;
                updateTampilanVideo();
            });
    });

    document.getElementById('exit-btn').addEventListener('click', () => {
        tutupSesiDanMatikan();
        window.location.reload();
    });

    window.addEventListener('beforeunload', () => {
        tutupSesiDanMatikan();
    });
}

function tutupSesiDanMatikan() {
    hentikanNadaDering();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (currentCall) currentCall.close();
    if (activeConnection) activeConnection.close();
    if (peer) peer.destroy();
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
    document.getElementById('call-video-btn').style.display = 'none';
    document.getElementById('call-audio-btn').style.display = 'none';
    document.getElementById('hangup-btn').style.display = 'inline-block';

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

    document.getElementById('call-video-btn').style.display = 'inline-block';
    document.getElementById('call-audio-btn').style.display = 'inline-block';
    document.getElementById('hangup-btn').style.display = 'none';
}

function setupDataConnection(conn) {
    activeConnection = conn;
    conn.on('data', (data) => tampilkanPesanChat(conn.peer, data, 'theirs'));
    conn.on('close', () => { activeConnection = null; });
}

function kirimPesanChat() {
    const chatInput = document.getElementById('chat-input');
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
    const chatMessages = document.getElementById('chat-messages');
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
