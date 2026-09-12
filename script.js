// Menggunakan ID kustom yang Anda inginkan
const customId = "3Nberadik";
const peer = new Peer(customId);

let localStream;
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const myIdDisplay = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id-input');
const callBtn = document.getElementById('call-btn');

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

// Peringatan jika ID tersebut sudah dipakai orang lain di server global
peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
        alert('Maaf, ID "3Nberadik" sudah digunakan orang lain di jaringan publik. Silakan ganti dengan kombinasi lain.');
    } else {
        console.error('PeerJS error:', err);
    }
});

peer.on('call', (call) => {
    call.answer(localStream);
    
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });
});

callBtn.addEventListener('click', () => {
    const peerIdToCall = peerIdInput.value.trim();
    
    if (!peerIdToCall) {
        alert('Masukkan ID tujuan terlebih dahulu!');
        return;
    }

    const call = peer.call(peerIdToCall, localStream);

    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });

    call.on('error', (err) => {
        console.error('Terjadi kesalahan saat memanggil:', err);
        alert('Gagal terhubung ke ID tersebut.');
    });
});
