const AVAILABLE_IDS = ["3Nberadik", "3Nkandung", "3Nketiga", "3Nkeempat", "3Nkelima", "3Nkeenam"];
let peer = null;
let localStream = null;
let screenStream = null;
let activeCalls = {}; 
let pendingCall = null;
let useFrontCamera = true; // Status kamera depan/belakang

const myIdDisplay = document.getElementById('my-id');
const labelMyId = document.getElementById('label-my-id');
const peerIdInput = document.getElementById('peer-id-input');
const callBtn = document.getElementById('call-btn');
const shareScreenBtn = document.getElementById('share-screen-btn');
const muteBtn = document.getElementById('mute-btn');
const cameraBtn = document.getElementById('camera-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const exitBtn = document.getElementById('exit-btn');
const videoGrid = document.getElementById('video-grid');
const presentationContainer = document.getElementById('presentation-container');
const presentationVideo = document.getElementById('presentation-video');
const presentationTitle = document.getElementById('presentation-title');
const incomingModal = document.getElementById('incoming-modal');
const incomingCallerId = document.getElementById('incoming-caller-id');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

// Inisialisasi Akses Kamera Pertama Kali
inisialisasiKameraAndPeer(true);

function inisialisasiKameraAndPeer(isFirstTime = false) {
    const constraints = {
        video: { facingMode: useFrontCamera ? 'user' : 'environment' },
        audio: true
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            if (localStream) {
                // Hentikan stream lama jika ini proses switch kamera
                localStream.getTracks().forEach(t => t.stop());
            }
            localStream = stream;
            const localVideo = document.getElementById('local-video');
            localVideo.srcObject = stream;
            
            if (isFirstTime) {
                cariDanHubungkanID(0);
            } else {
                // Perbarui stream video untuk semua panggilan aktif saat kamera diputar
                const videoTrack = localStream.getVideoTracks()[0];
                for (let peerId in activeCalls) {
                    const call = activeCalls[peerId];
                    const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                }
            }
        })
        .catch(error => {
            console.error('Gagal mengakses kamera/mikrofon:', error);
            alert('Izin kamera dan mikrofon wajib diaktifkan.');
        });
}

function cariDanHubungkanID(index) {
    if (index >= AVAILABLE_IDS.length) {
        alert('Seluruh 6 slot ID sedang penuh digunakan!');
        myIdDisplay.innerText = "Slot Penuh";
        return;
    }

    const targetId = AVAILABLE_IDS[index];
    myIdDisplay.innerText = `Mengecek ${targetId}...`;
    
    peer = new Peer(targetId);

    peer.on('open', (id) => {
        myIdDisplay.innerText = id;
        labelMyId.innerText = id;
        setupListeners();
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            peer.destroy();
            cariDanHubungkanID(index + 1);
        } else {
            console.error('PeerJS error:', err);
        }
    });
}

function setupListeners() {
    // Tangani panggilan masuk dengan memunculkan modal Terima/Tolak
    peer.on('call', (call) => {
        pendingCall = call;
        incomingCallerId.innerText = call.peer;
        incomingModal.style.display = 'flex';
        bunyikanNadaDering();
    });

    acceptCallBtn.onclick = () => {
        if (pendingCall) {
            pendingCall.answer(localStream);
            handleIncomingCall(pendingCall);
            incomingModal.style.display = 'none';
            pendingCall = null;
        }
    };

    rejectCallBtn.onclick = () => {
        if (pendingCall) {
            pendingCall.close();
            incomingModal.style.display = 'none';
            pendingCall = null;
        }
    };

    callBtn.addEventListener('click', () => {
        const targetId = peerIdInput.value.trim();
        if (!targetId) {
            alert('Masukkan ID peserta tujuan!');
            return;
        }
        if (targetId === peer.id) {
            alert('Tidak dapat memanggil ID sendiri.');
            return;
        }
        if (activeCalls[targetId]) {
            alert('Sudah terhubung dengan ID tersebut.');
            return;
        }

        const call = peer.call(targetId, localStream);
        handleIncomingCall(call);
    });

    muteBtn.addEventListener('click', () => {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            if (audioTrack.enabled) {
                muteBtn.innerText = "Mute Suara";
                muteBtn.classList.remove('active');
            } else {
                muteBtn.innerText = "Unmute Suara";
                muteBtn.classList.add('active');
            }
        }
    });

    cameraBtn.addEventListener('click', () => {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            if (videoTrack.enabled) {
                cameraBtn.innerText = "Matikan Kamera";
                cameraBtn.classList.remove('active');
            } else {
                cameraBtn.innerText = "Nyalakan Kamera";
                cameraBtn.classList.add('active');
            }
        }
    });

    // Fitur Putar Kamera (Depan / Belakang)
    switchCameraBtn.addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        switchCameraBtn.innerText = useFrontCamera ? "Kamera Belakang" : "Kamera Depan";
        inisialisasiKameraAndPeer(false);
    });

    shareScreenBtn.addEventListener('click', async () => {
        try {
            if (!screenStream) {
                screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                const screenTrack = screenStream.getVideoTracks()[0];

                for (let peerId in activeCalls) {
                    const call = activeCalls[peerId];
                    const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                }

                presentationVideo.srcObject = screenStream;
                presentationTitle.innerText = `Paparan Anda (${peer.id})`;
                presentationContainer.classList.add('active');

                shareScreenBtn.innerText = "Hentikan Paparan";
                shareScreenBtn.classList.add('active');

                screenTrack.onended = () => {
                    hentikanScreenSharing();
                };
            } else {
                hentikanScreenSharing();
            }
        } catch (err) {
            console.error('Gagal berbagi layar:', err);
        }
    });

    exitBtn.addEventListener('click', () => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (screenStream) screenStream.getTracks().forEach(t => t.stop());
        for (let id in activeCalls) activeCalls[id].close();
        if (peer) peer.destroy();

        document.body.innerHTML = `
            <div style="font-family: Arial; text-align: center; margin-top: 100px;">
                <h2>Anda telah keluar dari ruang rapat.</h2>
                <p>Kamera dan mikrofon telah dimatikan.</p>
                <button onclick="window.location.reload()" style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 20px;">Masuk Kembali</button>
            </div>
        `;
    });
}

function handleIncomingCall(call) {
    activeCalls[call.peer] = call;

    call.on('stream', (remoteStream) => {
        tambahkanKotakVideo(call.peer, remoteStream);
    });

    call.on('close', () => {
        hapusKotakVideo(call.peer);
        delete activeCalls[call.peer];
    });

    call.on('error', (err) => {
        console.error('Koneksi error:', err);
        hapusKotakVideo(call.peer);
        delete activeCalls[call.peer];
    });
}

function hentikanScreenSharing() {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
    const videoTrack = localStream.getVideoTracks()[0];
    for (let peerId in activeCalls) {
        const call = activeCalls[peerId];
        const videoSender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (videoSender) videoSender.replaceTrack(videoTrack);
    }
    presentationContainer.classList.remove('active');
    presentationVideo.srcObject = null;
    shareScreenBtn.innerText = "Bagikan Layar (Paparan)";
    shareScreenBtn.classList.remove('active');
}

function tambahkanKotakVideo(peerId, stream) {
    let card = document.getElementById(`video-card-${peerId}`);
    if (!card) {
        card = document.createElement('div');
        card.className = 'video-card';
        card.id = `video-card-${peerId}`;
        card.innerHTML = `
            <span>Peserta: ${peerId}</span>
            <video autoplay playsinline></video>
            <div class="card-controls">
                <button onclick="akhiriPanggilanSpesifik('${peerId}')" style="background-color: #dc3545; font-size: 12px; padding: 4px 8px; border:none; color:white; border-radius:4px; cursor:pointer;">Tutup Sambungan</button>
            </div>
        `;
        videoGrid.appendChild(card);
    }
    
    const videoElement = card.querySelector('video');
    videoElement.srcObject = stream;

    videoElement.onloadedmetadata = () => {
        if (stream.getVideoTracks().length > 0) {
            // Bisa mendeteksi screen share jika diperlukan
        }
    };
}

function hapusKotakVideo(peerId) {
    const card = document.getElementById(`video-card-${peerId}`);
    if (card) card.remove();
    if (presentationTitle.innerText.includes(peerId)) {
        presentationContainer.classList.remove('active');
        presentationVideo.srcObject = null;
    }
}

window.akhiriPanggilanSpesifik = function(peerId) {
    if (activeCalls[peerId]) {
        activeCalls[peerId].close();
        hapusKotakVideo(peerId);
        delete activeCalls[peerId];
    }
}

// Fungsi Bunyi Nada Dering Sederhana Menggunakan Web Audio API (Tanpa file mp3 eksternal)
function bunyikanNadaDering() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // Nada A4
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5); // Bunyi setengah detik
    } catch(e) {
        console.log('Audio context tidak didukung otomatis.');
    }
}
