let peer = null;
let localStream = null;
let remoteStream = null;
let activeConnection = null;
let targetPeerId = "";
let useFrontCamera = true;
let isMyVideoBig = false;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('btn-vc-1').onclick = () => mulai('3Nberadik', '3Nkandung', true);
    document.getElementById('btn-vc-2').onclick = () => mulai('3Nkandung', '3Nberadik', true);
    document.getElementById('btn-chat-1').onclick = () => mulai('3Nberadik', '3Nkandung', false);
    document.getElementById('btn-chat-2').onclick = () => mulai('3Nkandung', '3Nberadik', false);

    // Tombol Keluar: Mematikan kamera/koneksi lalu mengarahkannya ke tab kosong (about:blank)
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
});

function tutupSesiDanKeluar() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peer) {
        peer.destroy();
    }
    // Mengarahkan ke halaman/tab kosong browser
    window.location.href = "about:blank";
}

function mulai(myId, targetId, pakaiVideo) {
    targetPeerId = targetId;
    document.getElementById('target-id-display').innerText = targetId;
    document.getElementById('panel-pemilihan').style.display = 'none';
    document.getElementById('panel-kontrol').style.display = 'flex';
    document.getElementById('my-id').innerText = myId;

    if (!pakaiVideo) {
        document.getElementById('video-box').style.display = 'none';
        hubungkanPeer(myId, false);
    } else {
        muatMediaKamera(true, () => {
            hubungkanPeer(myId, true);
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

function hubungkanPeer(myId, pakaiVideo) {
    peer = new Peer(myId);

    peer.on('open', (id) => {
        const conn = peer.connect(targetPeerId);
        aturKoneksiData(conn);

        if (pakaiVideo) {
            setTimeout(() => {
                mulaiPanggilanVideo();
            }, 1000);
        }
    });

    peer.on('connection', (conn) => {
        aturKoneksiData(conn);
    });

    peer.on('call', (call) => {
        call.answer(localStream);
        call.on('stream', (stream) => {
            remoteStream = stream;
            updateTampilanVideo();
        });
    });

    peer.on('error', (err) => {
        alert("ID sedang digunakan di tab/perangkat lain!");
        location.reload();
    });
}

function mulaiPanggilanVideo() {
    if (!localStream || !targetPeerId) return;
    
    const call = peer.call(targetPeerId, localStream);
    call.on('stream', (stream) => {
        remoteStream = stream;
        updateTampilanVideo();
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
