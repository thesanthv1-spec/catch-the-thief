const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let rooms = {};

function assignRoles(players) {
    let roles = ["king", "queen", "bishop", "police", "thief"];

    for (let i = roles.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    players.forEach((p, i) => p.role = roles[i]);
}

io.on("connection", (socket) => {

    socket.on("joinRoom", ({ name, room }) => {

        if (!rooms[room]) {
            rooms[room] = {
                players: [],
                host: socket.id,
                started: false
            };
        }

        let data = rooms[room];

        if (data.players.length >= 5) {
            socket.emit("roomFull");
            return;
        }

        socket.join(room);

        data.players.push({
            id: socket.id,
            name: name
        });

        io.to(room).emit("updatePlayers", data.players);
    });

    socket.on("startGame", (room) => {
        let data = rooms[room];

        if (!data) return;
        if (data.host !== socket.id) return;
        if (data.players.length !== 5) return;

        assignRoles(data.players);
        data.started = true;

        data.players.forEach(p => {
            io.to(p.id).emit("yourRole", p.role);
        });

        io.to(room).emit("gameStarted");
    });

    socket.on("makeGuess", ({ room, targetId }) => {
        let players = rooms[room].players;
        let thief = players.find(p => p.role === "thief");

        let result = (thief.id === targetId)
            ? "🎉 Police caught the thief!"
            : "❌ Police failed!";

        io.to(room).emit("gameResult", result);
    });

    socket.on("disconnect", () => {
        for (let room in rooms) {
            rooms[room].players =
                rooms[room].players.filter(p => p.id !== socket.id);

            io.to(room).emit("updatePlayers", rooms[room].players);
        }
    });
});

// ✅ IMPORTANT FOR HOSTING
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("Server running on port " + PORT));