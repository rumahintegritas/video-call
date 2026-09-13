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
});

function mulai(myId, targetId, pakaiVideo) {
    targetPeerId = targetId;
    document.getElementById('target-id-display').innerText = targetId;
    document.getElementById('panel-pemilihan').style.display = 'none';
    document.getElementById('panel-kontrol').style.display = 'flex';
    document.getElementById('my-id').innerText = "Menghubungkan...";

    if (!pakaiVideo) {
        // Jika mode chat saja, sembunyikan kotak video
        document.getElementById('video-box').style.display = 'none';
        hubungkanPeer(myId);
    } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStream = stream;
                document.getElementById('main-video').srcObject = stream;
                hubungkanPeer(myId);
            })
            .catch(err => {
                alert("Gagal izin kamera!");
                location.reload();
            });
    }
}

function hubungkanPeer(myId) {
    peer = new Peer(myId);

    peer.on('open', (id) => {
        document.getElementById('my-id').innerText = id;
        
        // Siapkan koneksi data chat otomatis
        const conn = peer.connect(targetPeerId);
        aturKoneksiData(conn);
    });

    peer.on('connection', (conn) => {
        aturKoneksiData(conn);
    });

    peer.on('call', (call) => {
        if (confirm("Panggilan masuk! Terima?")) {
            call.answer(localStream);
            call.on('stream', (remoteStream) => {
                document.getElementById('main-video').srcObject = remoteStream;
            });
        } else {
            call.close();
        }
    });

    peer.on('error', (err) => {
        alert("ID sedang digunakan di tab lain!");
        location.reload();
    });
}

function aturKoneksiData(conn) {
    activeConnection = conn;
    conn.on('data', (data) => {
        tampilkanPesan("Lawan", data);
    });
}

function kirimPesan() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    tampilkanPesan("Anda", text);
    if (activeConnection) {
        activeConnection.send(text);
    } else if (targetPeerId) {
        const conn = peer.connect(targetPeerId);
        aturKoneksiData(conn);
        setTimeout(() => conn.send(text), 500);
    }
    input.value = '';
}

function tampilkanPesan(sender, text) {
    const box = document.getElementById('chat-messages');
    if (box.innerHTML.includes('Belum ada pesan')) box.innerHTML = '';
    box.innerHTML += `<div><b>${sender}:</b> ${text}</div>`;
    box.scrollTop = box.scrollHeight;
}
