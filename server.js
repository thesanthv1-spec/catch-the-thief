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

    // ✅ CREATE ROOM
    socket.on("createRoom", ({ name, room }) => {

        if (rooms[room]) {
            socket.emit("errorMsg", "Room already exists!");
            return;
        }

        rooms[room] = {
            players: [],
            host: socket.id,
            started: false
        };

        socket.join(room);

        rooms[room].players.push({
            id: socket.id,
            name
        });

        io.to(room).emit("updatePlayers", rooms[room].players);
    });

    // ✅ JOIN ROOM
    socket.on("joinRoom", ({ name, room }) => {

        if (!rooms[room]) {
            socket.emit("errorMsg", "Room does not exist!");
            return;
        }

        let data = rooms[room];

        if (data.players.length >= 5) {
            socket.emit("roomFull");
            return;
        }

        socket.join(room);

        data.players.push({
            id: socket.id,
            name
        });

        io.to(room).emit("updatePlayers", data.players);
    });

    // ✅ START GAME
    socket.on("startGame", (room) => {
        let data = rooms[room];

        if (!data) return;
        if (data.host !== socket.id) return;
        if (data.players.length !== 5) return;

        assignRoles(data.players);
        data.started = true;

        // send role to each player
        data.players.forEach(p => {
            io.to(p.id).emit("yourRole", p.role);
        });

        // 🔥 show police to all
        let policePlayer = data.players.find(p => p.role === "police");
        io.to(room).emit("showPolice", policePlayer.name);

        io.to(room).emit("gameStarted");
    });

    // ✅ POLICE GUESS
    socket.on("makeGuess", ({ room, targetId }) => {
        let players = rooms[room].players;
        let thief = players.find(p => p.role === "thief");

        let result = (thief.id === targetId)
            ? "🎉 Police caught the thief!"
            : "❌ Police failed!";

        io.to(room).emit("gameResult", result);
    });

    // ✅ DISCONNECT FIX (DELETE EMPTY ROOMS)
    socket.on("disconnect", () => {
    for (let room in rooms) {
        let data = rooms[room];

        // 🔴 If host leaves → close room for everyone
        if (data.host === socket.id) {
            io.to(room).emit("roomClosed");

            // force all sockets to leave room
            let clients = io.sockets.adapter.rooms.get(room);
            if (clients) {
                clients.forEach(id => {
                    let s = io.sockets.sockets.get(id);
                    if (s) s.leave(room);
                });
            }

            delete rooms[room];
            continue; // 🔥 important (not return)
        }

        // remove player normally
        data.players = data.players.filter(p => p.id !== socket.id);

        io.to(room).emit("updatePlayers", data.players);
    }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("Server running on port " + PORT));