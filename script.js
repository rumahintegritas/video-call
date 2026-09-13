let peer = null;
let localStream = null;
let remoteStream = null;
let activeConnection = null;
let targetPeerId = "";
let useFrontCamera = true;
let isMyVideoBig = false;

document.addEventListener("DOMContentLoaded", () => {
    // Cek apakah halaman dibuka melalui tautan undangan (?room=...)
    const urlParams = new URLSearchParams(window.location.search);
    const roomToJoin = urlParams.get('room');

    if (roomToJoin) {
        document.getElementById('panel-pemilihan').style.display = 'none';
        document.getElementById('panel-kontrol').style.display = 'flex';
        document.getElementById('status-koneksi').innerText = "Menghubungkan ke Ruang...";
        
        targetPeerId = roomToJoin;
        muatMediaKamera(true, () => {
            inisialisasiPeerOtomatis(true, true);
        });
    } else {
        document.getElementById('btn-vc').onclick = () => mulaiBuatRuang(true);
        document.getElementById('btn-chat').onclick = () => mulaiBuatRuang(false);
    }

    // Tombol Salin Tautan Ruang
    document.getElementById('copy-link-btn').onclick = () => {
        const myId = peer ? peer.id : "";
        if (!myId) {
            alert("Ruang sedang disiapkan, tunggu sebentar...");
            return;
        }
        const roomLink = window.location.origin + window.location.pathname + "?room=" + myId;
        navigator.clipboard.writeText(roomLink).then(() => {
            alert("Tautan berhasil disalin!\n\nTempel (Paste) link ini ke kolom chat di bawah dan kirim ke lawan bicara Anda.");
        });
    };

    // Tombol Keluar / Tutup Aplikasi
    document.getElementById('hangup-btn').onclick = () => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (peer) peer.destroy();
        window.location.href = "about:blank"; // Mengarah ke tab kosong browser
    };

    document.getElementById('send-chat-btn').onclick = kirimPesan;
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') kirimPesan();
    });

    // Kontrol Mute Suara
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

    // Kontrol Matikan/Nyalakan Kamera
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

    // Tombol Putar Kamera Depan/Belakang (HP)
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
});

function mulaiBuatRuang(pakaiVideo) {
    document.getElementById('panel-pemilihan').style.display = 'none';
    document.getElementById('panel-kontrol').style.display = 'flex';
    document.getElementById('status-koneksi').innerText = "Membuat Ruang...";

    if (!pakaiVideo) {
        document.getElementById('video-box').style.display = 'none';
        inisialisasiPeerOtomatis(false, false);
    } else {
        muatMediaKamera(true, () => {
            inisialisasiPeerOtomatis(true, false);
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
            if (localStream) localStream.getTracks().forEach(t => t.stop());
            localStream = stream;
            updateTampilanVideo();
            document.getElementById('video-controls').style.display = 'flex';
            if (callback) callback();
        })
        .catch(err => {
            alert("Gagal mengakses kamera/mikrofon! Pastikan izin browser diizinkan.");
            window.location.reload();
        });
}

function inisialisasiPeerOtomatis(pakaiVideo, sebagaiPengikut) {
    peer = new Peer({
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true
    });

    peer.on('open', (id) => {
        if (sebagaiPengikut) {
            document.getElementById('status-koneksi').innerText = "Terhubung!";
            
            const conn = peer.connect(targetPeerId);
            aturKoneksiData(conn);

            if (pakaiVideo && localStream) {
                setTimeout(() => {
                    const call = peer.call(targetPeerId, localStream);
                    call.on('stream', (stream) => {
                        remoteStream = stream;
                        updateTampilanVideo();
                    });
                }, 800);
            }
        } else {
            document.getElementById('status-koneksi').innerText = "Ruang Siap! (Silakan Salin Tautan)";
        }
    });

    peer.on('connection', (conn) => {
        targetPeerId = conn.peer;
        document.getElementById('status-koneksi').innerText = "Terhubung dengan Lawan!";
        aturKoneksiData(conn);
    });

    peer.on('call', (call) => {
        targetPeerId = call.peer;
        document.getElementById('status-koneksi').innerText = "Terhubung dengan Lawan!";
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

function updateTampilanVideo() {
    const mainVideo = document.getElementById('main-video');
    const floatingVideo = document.getElementById('floating-video');
    const floatingLabel = document.getElementById('floating-label');

    if (isMyVideoBig) {
        mainVideo.srcObject = localStream;
        mainVideo.muted = true;
        if (remoteStream) {
            floatingVideo.srcObject = remoteStream;
            floatingLabel.innerText = "Lawan";
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
