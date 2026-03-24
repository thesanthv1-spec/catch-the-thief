const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

const ROLES = ["king", "queen", "bishop", "police", "thief"];

let rooms = {};

function assignRoles(players) {
    let roles = [...ROLES];
    for (let i = roles.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    players.forEach((p, i) => p.role = roles[i]);
}

io.on("connection", (socket) => {

    socket.on("createRoom", ({ name, room }) => {
        if (!name || !room) return;

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

    socket.on("joinRoom", ({ name, room }) => {
        let data = rooms[room];

        if (!data) {
            socket.emit("errorMsg", "Room not found!");
            return;
        }

        if (data.started) {
            socket.emit("errorMsg", "Game already started!");
            return;
        }

        if (data.players.length >= 5) {
            socket.emit("roomFull");
            return;
        }

        if (data.players.some(p => p.name === name)) {
            socket.emit("errorMsg", "Name already taken!");
            return;
        }

        socket.join(room);

        data.players.push({
            id: socket.id,
            name
        });

        io.to(room).emit("updatePlayers", data.players);
    });

    socket.on("startGame", (room) => {
        let data = rooms[room];
        if (!data) return;

        if (data.host !== socket.id) return;

        if (data.players.length !== 5) {
            socket.emit("errorMsg", "Need 5 players!");
            return;
        }

        assignRoles(data.players);
        data.started = true;

        data.players.forEach(p => {
            io.to(p.id).emit("yourRole", p.role);
        });

        let police = data.players.find(p => p.role === "police");
        io.to(room).emit("showPolice", police.name);

        io.to(room).emit("gameStarted");
    });

    socket.on("makeGuess", ({ room, targetId }) => {
        let data = rooms[room];
        if (!data || !data.started) return;

        let players = data.players;

        let player = players.find(p => p.id === socket.id);
        if (!player || player.role !== "police") return;

        let target = players.find(p => p.id === targetId);
        if (!target) return;

        let thief = players.find(p => p.role === "thief");

        let result = (thief.id === targetId)
            ? `🎉 Correct! Thief: ${thief.name}`
            : `❌ Wrong! You picked ${target.name}. Thief was ${thief.name}`;

        io.to(room).emit("gameResult", result);

        data.started = false;
    });

    socket.on("disconnect", () => {
        for (let room in rooms) {
            let data = rooms[room];

            if (data.host === socket.id) {
                io.to(room).emit("roomClosed");
                delete rooms[room];
                continue;
            }

            data.players = data.players.filter(p => p.id !== socket.id);

            if (data.started && data.players.length < 5) {
                data.started = false;
                io.to(room).emit("gameCancelled");
            }

            if (data.players.length === 0) {
                delete rooms[room];
                continue;
            }

            io.to(room).emit("updatePlayers", data.players);
        }
    });
});

http.listen(3000, () => console.log("Server running on port 3000"));