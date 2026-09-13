let peer = null;
let localStream = null;
let remoteStream = null;
let activeConnection = null;
let targetPeerId = "";
let useFrontCamera = true;
let isMyVideoBig = false;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('btn-start-vc').onclick = () => inisialisasiDenganIdKustom(true);
    document.getElementById('btn-start-chat').onclick = () => inisialisasiDenganIdKustom(false);

    document.getElementById('hangup-btn').onclick = () => {
        tutupSesiDanKeluar();
    };

    document.getElementById('send-chat-btn').onclick = kirimPesan;
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') kirimPesan();
    });

    // Tombol Kontrol Media
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
});

function inisialisasiDenganIdKustom(pakaiVideo) {
    const customId = document.getElementById('my-custom-id').value.trim();
    targetPeerId = document.getElementById('target-id-input').value.trim();

    if (!customId) {
        alert("Mohon masukkan ID Anda terlebih dahulu!");
        return;
    }

    document.getElementById('panel-pemilihan').style.display = 'none';
    document.getElementById('panel-kontrol').style.display = 'flex';
    document.getElementById('display-my-id').innerText = customId;
    if (targetPeerId) {
        document.getElementById('target-id-display').innerText = targetPeerId;
    }

    if (!pakaiVideo) {
        document.getElementById('video-box').style.display = 'none';
        buatPeerCustom(customId, false);
    } else {
        muatMediaKamera(true, () => {
            buatPeerCustom(customId, true);
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
            alert("Gagal mengakses kamera/mikrofon! Periksa izin browser.");
            window.location.reload();
        });
}

function buatPeerCustom(myId, pakaiVideo) {
    // Membuat koneksi peer dengan ID kustom
    peer = new Peer(myId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true
    });

    peer.on('open', (id) => {
        console.log("Berhasil mendaftarkan ID:", id);
        // Jika kolom ID lawan sudah diisi sebelum klik mulai, langsung sambungkan
        if (targetPeerId) {
            hubungkanOtomatis(pakaiVideo);
        }
    });

    // Antisipasi jika ID sedang dipakai / nyangkut di server
    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            alert(`ID "${myId}" sedang dianggap aktif oleh server.\n\nTrik: Klik tombol "Keluar (Bersihkan ID)" atau tunggu 10 detik, lalu coba lagi.`);
            window.location.reload();
        } else {
            console.warn("Peer error: ", err);
        }
    });

    // Menerima panggilan data/chat masuk
    peer.on('connection', (conn) => {
        targetPeerId = conn.peer;
        document.getElementById('target-id-display').innerText = targetPeerId;
        document.getElementById('target-id-input').value = targetPeerId;
        aturKoneksiData(conn);
    });

    // Menerima panggilan video masuk
    peer.on('call', (call) => {
        targetPeerId = call.peer;
        document.getElementById('target-id-display').innerText = targetPeerId;
        document.getElementById('target-id-input').value = targetPeerId;
        call.answer(localStream);
        call.on('stream', (stream) => {
            remoteStream = stream;
            updateTampilanVideo();
        });
    });
}

function hubungkanOtomatis(pakaiVideo) {
    if (!targetPeerId) return;

    // Koneksi Data / Chat
    const conn = peer.connect(targetPeerId);
    aturKoneksiData(conn);

    // Koneksi Video Call
    if (pakaiVideo && localStream) {
        setTimeout(() => {
            const call = peer.call(targetPeerId, localStream);
            call.on('stream', (stream) => {
                remoteStream = stream;
                updateTampilanVideo();
            });
        }, 500);
    }
}

function tutupSesiDanKeluar() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
    }
    if (peer) {
        peer.destroy(); // Perintah utama untuk menghapus ID dari server agar tidak nyangkut
    }
    window.location.href = "about:blank"; // Menutup sesi bersih ke halaman kosong
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
