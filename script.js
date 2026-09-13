let peer = null;
let localStream = null;
let remoteStream = null;
let activeConnection = null;
let targetPeerId = "";
let useFrontCamera = true; // Status kamera depan/belakang
let isMyVideoBig = false;  // Status apakah video kita sedang di layar besar

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('btn-vc-1').onclick = () => mulai('3Nberadik', '3Nkandung', true);
    document.getElementById('btn-vc-2').onclick = () => mulai('3Nkandung', '3Nberadik', true);
    document.getElementById('btn-chat-1').onclick = () => mulai('3Nberadik', '3Nkandung', false);
    document.getElementById('btn-chat-2').onclick = () => mulai('3Nkandung', '3Nberadik', false);

    document.getElementById('hangup-btn').onclick = () => location.reload();
    document.getElementById('send-chat-btn').onclick = kirimPesan;
    
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') kirimPesan();
    });

    // Tombol putar kamera depan / belakang
    document.getElementById('switch-camera-btn').onclick = gantiKamera;
});

function mulai(myId, targetId, pakaiVideo) {
    targetPeerId = targetId;
    document.getElementById('target-id-display').innerText = targetId;
    document.getElementById('panel-pemilihan').style.display = 'none';
    document.getElementById('panel-kontrol').style.display = 'flex';
    document.getElementById('my-id').innerText = "Menghubungkan...";

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
            // Jika sudah ada stream sebelumnya, hentikan track lama agar kamera tidak nyangkut
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            localStream = stream;
            updateTampilanVideo();
            document.getElementById('video-controls').style.display = 'flex';
            if (callback) callback();
        })
        .catch(err => {
            alert("Gagal mengakses kamera/mikrofon!");
            location.reload();
        });
}

function gantiKamera() {
    useFrontCamera = !useFrontCamera;
    muatMediaKamera(true, () => {
        // Jika sedang dalam panggilan aktif, perbarui stream ke lawan bicara
        if (peer && targetPeerId) {
            // Sambungkan ulang panggilan dengan stream kamera baru
            const call = peer.call(targetPeerId, localStream);
            call.on('stream', (stream) => {
                remoteStream = stream;
                updateTampilanVideo();
            });
        }
    });
}

function hubungkanPeer(myId, pakaiVideo) {
    peer = new Peer(myId);

    peer.on('open', (id) => {
        document.getElementById('my-id').innerText = id;
        
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
        alert("ID sedang digunakan di tab lain!");
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

// Fungsi utama untuk mengatur tata letak video besar / kecil (Bisa tukar posisi)
function updateTampilanVideo() {
    const mainVideo = document.getElementById('main-video');
    const floatingVideo = document.getElementById('floating-video');
    const floatingLabel = document.getElementById('floating-label');

    if (isMyVideoBig) {
        // Jika video kita di layar besar
        mainVideo.srcObject = localStream;
        mainVideo.muted = true; // Mute suara sendiri agar tidak gema
        if (remoteStream) {
            floatingVideo.srcObject = remoteStream;
            floatingLabel.innerText = targetPeerId;
        }
    } else {
        // Jika video lawan di layar besar, video kita di kotak kecil
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

// Fungsi saat kotak kecil diklik untuk bertukar posisi besar/kecil
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
