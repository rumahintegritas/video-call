let peer = null;
let localStream = null;
let activeConnection = null;
let targetPeerId = "";

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
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStream = stream;
                // Tampilkan kamera sendiri di kotak kecil (floating-video)
                document.getElementById('floating-video').srcObject = stream;
                hubungkanPeer(myId, true);
            })
            .catch(err => {
                alert("Gagal izin kamera!");
                location.reload();
            });
    }
}

function hubungkanPeer(myId, pakaiVideo) {
    peer = new Peer(myId);

    peer.on('open', (id) => {
        document.getElementById('my-id').innerText = id;
        
        // Hubungkan data chat
        const conn = peer.connect(targetPeerId);
        aturKoneksiData(conn);

        // Jika mode VC, otomatis panggil lawan bicara
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
        call.on('stream', (remoteStream) => {
            // Tampilkan video lawan di layar utama
            document.getElementById('main-video').srcObject = remoteStream;
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
    call.on('stream', (remoteStream) => {
        // Tampilkan video lawan di layar utama
        document.getElementById('main-video').srcObject = remoteStream;
    });
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
