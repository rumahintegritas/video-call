let peer;
let localStream;
let currentCall = null;

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const myIdDisplay = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id-input');
const callBtn = document.getElementById('call-btn');
const cancelBtn = document.getElementById('cancel-btn');
const muteBtn = document.getElementById('mute-btn');
const cameraBtn = document.getElementById('camera-btn');
const exitBtn = document.getElementById('exit-btn');

// 1. Dapatkan izin kamera/mikrofon terlebih dahulu
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
        
        // Setelah kamera aktif, jalankan pengecekan ID otomatis
        inisialisasiIDOtomatis();
    })
    .catch(error => {
        console.error('Gagal mengakses kamera/mikrofon:', error);
        alert('Izin kamera dan mikrofon diperlukan untuk melakukan video call.');
    });

// Fungsi untuk mencoba ID pertama, jika gagal/pakai orang lain, otomatis pakai ID kedua
function inisialisasiIDOtomatis() {
    myIdDisplay.innerText = "Mengecek ID 3Nberadik...";
    
    // Coba hubungkan dengan ID pertama: "3Nberadik"
    peer = new Peer("3Nberadik");

    peer.on('open', (id) => {
        myIdDisplay.innerText = id;
        setupPeerEvents();
    });

    // Jika ID "3Nberadik" ternyata sudah dipakai orang lain, otomatis buat ID "3Nkandung"
    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            myIdDisplay.innerText = "ID 3Nberadik dipakai, beralih ke 3Nkandung...";
            
            peer.destroy();
            peer = new Peer("3Nkandung");

            peer.on('open', (id) => {
                myIdDisplay.innerText = id;
                setupPeerEvents();
            });

            peer.on('error', (secondErr) => {
                console.error('PeerJS error:', secondErr);
                alert('Kedua ID (3Nberadik & 3Nkandung) sedang sibuk/digunakan.');
            });
        } else {
            console.error('PeerJS error:', err);
        }
    });
}

function setupPeerEvents() {
    // Fitur Mute Suara
    muteBtn.addEventListener('click', () => {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack.enabled) {
            audioTrack.enabled = false;
            muteBtn.innerText = "Unmute Suara";
            muteBtn.classList.add('active');
        } else {
            audioTrack.enabled = true;
            muteBtn.innerText = "Mute Suara";
            muteBtn.classList.remove('active');
        }
    });

    // Fitur Matikan / Nyalakan Kamera
    cameraBtn.addEventListener('click', () => {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack.enabled) {
            videoTrack.enabled = false;
            cameraBtn.innerText = "Nyalakan Kamera";
            cameraBtn.classList.add('active');
        } else {
            videoTrack.enabled = true;
            cameraBtn.innerText = "Matikan Kamera";
            cameraBtn.classList.remove('active');
        }
    });

    // Fitur Tombol Keluar Aplikasi
    exitBtn.addEventListener('click', () => {
        // Matikan semua track kamera dan mikrofon agar lampu indikator perangkat mati
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        // Tutup koneksi panggilan jika sedang aktif
        if (currentCall) {
            currentCall.close();
        }
        // Hancurkan koneksi Peer
        if (peer) {
            peer.destroy();
        }

        // Tampilkan halaman kosong penutup atau kembali ke halaman kosong
        document.body.innerHTML = `
            <div style="font-family: Arial; text-align: center; margin-top: 100px;">
                <h2>Anda telah keluar dari aplikasi.</h2>
                <p>Kamera dan mikrofon telah dimatikan. Anda sekarang aman menutup tab ini.</p>
                <button onclick="window.location.reload()" style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 20px;">Masuk Lagi</button>
            </div>
        `;
    });

    // Saat ada panggilan masuk
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

    // Tombol Tutup Panggilan diklik
    cancelBtn.addEventListener('click', () => {
        if (currentCall) {
            currentCall.close();
        }
        akhiriPanggilan();
    });
}

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
