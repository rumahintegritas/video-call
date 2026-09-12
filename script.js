const customId = "3Nberadik";
const peer = new Peer(customId);

let localStream;
let currentCall = null;

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const myIdDisplay = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id-input');
const callBtn = document.getElementById('call-btn');
const cancelBtn = document.getElementById('cancel-btn');

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
    })
    .catch(error => {
        console.error('Gagal mengakses kamera/mikrofon:', error);
        alert('Izin kamera dan mikrofon diperlukan untuk melakukan video call.');
    });

peer.on('open', (id) => {
    myIdDisplay.innerText = id;
});

peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
        alert('Maaf, ID "3Nberadik" sedang digunakan oleh perangkat lain.');
    } else {
        console.error('PeerJS error:', err);
    }
});

// Saat ada panggilan masuk dari orang lain
peer.on('call', (call) => {
    currentCall = call;
    call.answer(localStream);
    
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });

    call.on('close', () => {
        akhiriPanggilan();
    });

    tampilkanTombolBatal();
});

// Tombol Panggil diklik
callBtn.addEventListener('click', () => {
    const peerIdToCall = peerIdInput.value.trim();
    
    if (!peerIdToCall) {
        alert('Masukkan ID tujuan terlebih dahulu!');
        return;
    }

    const call = peer.call(peerIdToCall, localStream);
    currentCall = call;

    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });

    call.on('close', () => {
        akhiriPanggilan();
    });

    call.on('error', (err) => {
        console.error('Gagal memanggil:', err);
        alert('Gagal terhubung ke ID tersebut.');
        akhiriPanggilan();
    });

    tampilkanTombolBatal();
});

// Tombol Batalkan / Tutup Panggilan diklik
cancelBtn.addEventListener('click', () => {
    if (currentCall) {
        currentCall.close();
    }
    akhiriPanggilan();
});

function tampilkanTombolBatal() {
    callBtn.style.display = 'none';
    cancelBtn.style.display = 'inline-block';
}

function akhiriPanggilan() {
    if (currentCall) {
        currentCall = null;
    }
    remoteVideo.srcObject = null;
    callBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'none';
}
