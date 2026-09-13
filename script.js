let peer = null;
let localStream = null;
let remoteStream = null;
let currentCall = null;
let activeConnection = null;
let pendingCall = null;
let targetPeerId = "";
let isMyVideoBig = false;
let ringtoneInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('btn-beradik').addEventListener('click', () => {
        mulaiInisialisasi("3Nberadik", "3Nkandung");
    });
    
    document.getElementById('btn-kandung').addEventListener('click', () => {
        mulaiInisialisasi("3Nkandung", "3Nberadik");
    });
});

function mulaiInisialisasi(myId, targetId) {
    targetPeerId = targetId;
    document.getElementById('target-id-display').innerText = targetPeerId;
    document.getElementById('panel-pemilihan').style.display = 'none';
    document.getElementById('panel-kontrol').style.display = 'flex';
    document.getElementById('my-id').innerText = "Menghubungkan kamera...";

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            document.getElementById('floating-video').srcObject = stream;
            document.getElementById('floating-video').muted = true;
            hubungkanPeerJS(myId);
        })
        .catch(err => {
            alert("Izin kamera/audio diperlukan untuk melanjutkan!");
            location.reload();
        });
}

function hubungkanPeerJS(myId) {
    document.getElementById('my-id').innerText = `Menghubungkan ${myId}...`;

    peer = new Peer(myId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/'
    });

    peer.on('open', (id) => {
        document.getElementById('my-id').innerText = id;
        setupListeners();
        alert(`Berhasil online sebagai: ${id}`);
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            alert(`ID "${myId}" sedang aktif di perangkat/tab lain!`);
            location.reload();
        } else {
            document.getElementById('my-id').innerText = "Koneksi Gagal";
        }
    });
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

    document.getElementById('call-video-btn').addEventListener('click', () => {
        mulaiPanggilan();
    });

    document.getElementById('call-audio-btn').addEventListener('click', () => {
        mulaiPanggilan();
    });

    document.getElementById('hangup-btn').addEventListener('click', () => {
        hentikanNadaDering();
        if (currentCall) currentCall.close();
        akhiriPanggilanUI();
    });

    document.getElementById('send-chat-btn').addEventListener('click', kirimPesanChat);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') kirimPesanChat();
    });

    document.getElementById('mute-btn').addEventListener('click', () => {
        if (!localStream) return;
        const track = localStream.getAudioTracks()[0];
        track.enabled = !track.enabled;
        document.getElementById('mute-btn').innerText = track.enabled ? "Mute" : "Unmute";
    });

    document.getElementById('camera-btn').addEventListener('click', () => {
        if (!localStream) return;
        const track = localStream.getVideoTracks()[0];
        track.enabled = !track.enabled;
        document.getElementById('camera-btn').innerText = track.enabled ? "Kamera" : "Buka";
    });

    document.getElementById('exit-btn').addEventListener('click', () => {
        if (peer) peer.destroy();
        location.reload();
    });
}

function mulaiPanggilan() {
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

function updateTampilanVideo() {
    const mainVideo = document.getElementById('main-video');
    const floatingVideo = document.getElementById('floating-video');
    const floatingLabel = document.getElementById('floating-label');

    if (isMyVideoBig) {
        if (localStream) mainVideo.srcObject = localStream;
        if (remoteStream) floatingVideo.srcObject = remoteStream;
        floatingLabel.innerText = targetPeerId;
    } else {
        if (remoteStream) mainVideo.srcObject = remoteStream;
        else if (localStream) mainVideo.srcObject = localStream;
        if (localStream) floatingVideo.srcObject = localStream;
        floatingLabel.innerText = "Anda";
    }
}

window.tukarPosisiVideo = function() {
    if (!remoteStream) return;
    isMyVideoBig = !isMyVideoBig;
    updateTampilanVideo();
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
    msgDiv.innerHTML = `<strong>${sender}</strong>: ${text}`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.toggleChatMinimize = function() {
    const chatSection = document.getElementById('chat-section');
    const toggleBtn = document.getElementById('toggle-chat-btn');
    chatSection.classList.toggle('minimized');
    toggleBtn.innerText = chatSection.classList.contains('minimized') ? "[+] Tampilkan" : "[-] Sembunyikan";
}

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
