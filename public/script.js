const socket = io();

let myName = "";
let myId = "";
let currentRoom = "";
let players = [];

function goIn() {
    let name = document.getElementById("name").value;
    if (!name) return alert("Enter your name");

    myName = name;

    document.getElementById("step1").style.display = "none";
    document.getElementById("step2").style.display = "block";
    document.getElementById("playerName").innerText = name;
}

function showCreate() {
    document.getElementById("createRoomDiv").style.display = "block";
    document.getElementById("joinRoomDiv").style.display = "none";
}

function showJoin() {
    document.getElementById("joinRoomDiv").style.display = "block";
    document.getElementById("createRoomDiv").style.display = "none";
}

function createRoom() {
    let room = document.getElementById("createRoomName").value;
    if (!room) return alert("Enter room name");

    currentRoom = room;

    socket.emit("joinRoom", { name: myName, room });
    goToGame();
}

function joinRoom() {
    let room = document.getElementById("joinRoomName").value;
    if (!room) return alert("Enter room name");

    currentRoom = room;

    socket.emit("joinRoom", { name: myName, room });
    goToGame();
}

function goToGame() {
    document.getElementById("step2").style.display = "none";
    document.getElementById("createRoomDiv").style.display = "none";
    document.getElementById("joinRoomDiv").style.display = "none";

    document.getElementById("game").style.display = "block";
    document.getElementById("roomTitle").innerText = "Room: " + currentRoom;
}

socket.on("connect", () => {
    myId = socket.id;
});

socket.on("updatePlayers", (data) => {
    players = data;

    let div = document.getElementById("players");
    div.innerHTML = "";

    data.forEach(p => {
        let el = document.createElement("div");
        el.innerText = p.name;
        div.appendChild(el);
    });

    if (players.length === 5 && players[0].id === myId) {
        document.getElementById("startBtn").style.display = "block";
    }
});

socket.on("roomFull", () => {
    alert("Room is full!");
});

function startGame() {
    socket.emit("startGame", currentRoom);
}

socket.on("yourRole", (role) => {
    document.getElementById("role").innerText = "Your Role: " + role;

    if (role === "police") {
        document.getElementById("policePanel").style.display = "block";

        let choices = document.getElementById("choices");
        choices.innerHTML = "";

        players.forEach(p => {
            if (p.id !== myId) {
                let label = document.createElement("label");
                label.innerHTML = `
                    <input type="radio" name="target" value="${p.id}">
                    ${p.name}
                `;
                choices.appendChild(label);
            }
        });
    }
});

function guess() {
    let selected = document.querySelector("input[name='target']:checked");
    if (!selected) return;

    socket.emit("makeGuess", {
        room: currentRoom,
        targetId: selected.value
    });
}

socket.on("gameResult", (msg) => {
    document.getElementById("result").innerText = msg;
});