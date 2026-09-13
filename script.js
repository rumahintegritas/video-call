let peer = null;
let localStream = null;
let remoteStream = null;
let activeConnection = null;
let targetPeerId = "";
let useFrontCamera = true;
let isMyVideoBig = false;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('btn-vc').onclick = () => inisialisasiAplikasi(true);
    document.getElementById('btn-chat').onclick = () => inisialisasiAplikasi(false);

    document.getElementById('connect-btn').onclick = () => {
        const inputId = document.getElementById('target-id-input').value.trim();
        if (!inputId) {
            alert("Masukkan ID lawan terlebih dahulu!");
            return;
        }
        targetPeerId = inputId;
        hubungkanKeLawan(true);
    };

    document.getElementById('hangup-btn').onclick = () => {
        tutupSesiDanKeluar();
    };

    document.getElementById('send-chat-btn').onclick = kirimPesan;
    
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') kirimPesan();
    });

    document.getElementById('mute-btn').onclick = () => {
        if (!localStream) return;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.getElementById('mute-btn');
            btn.innerText = audioTrack.enabled ? "Mute" : "Unmute";
            btn.classList.toggle('active', !audioTrack.enabled);
        }
    };

    document.getElementById('camera-btn').onclick = () => {
        if (!localStream) return;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const btn = document.getElementById('camera-btn');
            btn.innerText = videoTrack.enabled ? "Matikan Kamera" : "Nyalakan Kamera";
            btn.classList.toggle('active', !videoTrack.enabled);
        }
    };

    document.getElementById('switch-camera-btn').onclick = () => {
        useFrontCamera = !useFrontCamera;
        muatMediaKamera(true, () => {
            if (peer && targetPeerId && localStream) {
                const call = peer.call(targetPeerId, localStream);
                call.on('stream', (stream) => {
                    remoteStream = stream;
                    updateTampilanVideo();
                });
            }
        });
    };

    // Fitur klik untuk salin ID sendiri
    document.getElementById('my-id').onclick = () => {
        const idText = document.getElementById('my-id').innerText;
        navigator.clipboard.writeText(idText).then(() => {
            alert("ID Anda berhasil disalin! Kirimkan ke lawan bicara.");
        });
    };
});

function inisialisasiAplikasi(pakaiVideo) {
    document.getElementById('panel-pemilihan').style.display = 'none';
    document.getElementById('panel-kontrol').style.display = 'flex';
    document.getElementById('my-id').innerText = "Membuat ID...";

    if (!pakaiVideo) {
        document.getElementById('video-box').style.display = 'none';
        buatPeerBaru(false);
    } else {
        muatMediaKamera(true, () => {
            buatPeerBaru(true);
        });
    }
}

function muatMediaKamera(pakaiVideo, callback) {
    const constraints = {
        video: pakaiVideo ? { facingMode: useFrontCamera ? 'user' : 'environment' } : false,
        audio: true
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            localStream = stream;
            updateTampilanVideo();
            document.getElementById('video-controls').style.display = 'flex';
            if (callback) callback();
        })
        .catch(err => {
            alert("Gagal mengakses kamera/mikrofon! Pastikan izin browser diizinkan.");
            location.reload();
        });
}

function buatPeerBaru(pakaiVideo) {
    // Tanpa parameter ID, PeerJS otomatis membuat ID acak yang unik dan bebas bentrok
    peer = new Peer({
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true
    });

    peer.on('open', (id) => {
        document.getElementById('my-id').innerText = id;
    });

    peer.on('connection', (conn) => {
        targetPeerId = conn.peer;
        document.getElementById('target-id-input').value = targetPeerId;
        aturKoneksiData(conn);
    });

    peer.on('call', (call) => {
        targetPeerId = call.peer;
        document.getElementById('target-id-input').value = targetPeerId;
        call.answer(localStream);
        call.on('stream', (stream) => {
            remoteStream = stream;
            updateTampilanVideo();
        });
    });

    peer.on('error', (err) => {
        console.warn("Peer error: ", err);
    });
}

function hubungkanKeLawan(pakaiVideo) {
    if (!targetPeerId) return;

    // 1. Hubungkan koneksi data chat
    const conn = peer.connect(targetPeerId);
    aturKoneksiData(conn);

    // 2. Hubungkan panggilan video jika dalam mode VC
    if (pakaiVideo && localStream) {
        const call = peer.call(targetPeerId, localStream);
        call.on('stream', (stream) => {
            remoteStream = stream;
            updateTampilanVideo();
        });
        alert("Menghubungkan panggilan ke " + targetPeerId);
    } else {
        alert("Terhubung ke chat " + targetPeerId);
    }
}

function tutupSesiDanKeluar() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peer) {
        peer.destroy();
    }
    window.location.href = "about:blank";
}

function updateTampilanVideo() {
    const mainVideo = document.getElementById('main-video');
    const floatingVideo = document.getElementById('floating-video');
    const floatingLabel = document.getElementById('floating-label');

    if (isMyVideoBig) {
        mainVideo.srcObject = localStream;
        mainVideo.muted = true;
        if (remoteStream) {
            floatingVideo.srcObject = remoteStream;
            floatingLabel.innerText = targetPeerId || "Lawan";
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

function aturKoneksiData(conn) {
    activeConnection = conn;
    conn.on('data', (data) => {
        tampilkanPesan("theirs", data);
    });
}

function kirimPesan() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    tampilkanPesan("mine", text);
    
    if (activeConnection) {
        activeConnection.send(text);
    } else if (targetPeerId) {
        const conn = peer.connect(targetPeerId);
        aturKoneksiData(conn);
        setTimeout(() => conn.send(text), 500);
    }
    input.value = '';
}

function tampilkanPesan(tipe, text) {
    const box = document.getElementById('chat-messages');
    if (box.innerHTML.includes('Belum ada pesan')) box.innerHTML = '';
    
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${tipe}`;
    bubble.innerText = text;
    
    box.appendChild(bubble);
    box.scrollTop = box.scrollHeight;
}
