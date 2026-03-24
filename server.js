const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

const ROLES = ["king", "queen", "bishop", "police", "thief"];

let rooms = {};

// 🔀 Shuffle roles
function assignRoles(players) {
    let roles = [...ROLES];

    for (let i = roles.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    players.forEach((p, i) => {
        p.role = roles[i];
    });
}

io.on("connection", (socket) => {

    // ✅ CREATE ROOM
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

    // ✅ JOIN ROOM
    socket.on("joinRoom", ({ name, room }) => {

        let data = rooms[room];

        if (!data) {
            socket.emit("errorMsg", "Room does not exist!");
            return;
        }

        if (data.started) {
            socket.emit("errorMsg", "Game already started!");
            return;
        }

        if (data.players.length >= ROLES.length) {
            socket.emit("roomFull");
            return;
        }

        // prevent duplicate names
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

    // ✅ START GAME
    socket.on("startGame", (room) => {

        let data = rooms[room];

        if (!data) return;

        if (data.host !== socket.id) return;

        if (data.players.length !== ROLES.length) {
            socket.emit("errorMsg", "Need 5 players to start!");
            return;
        }

        if (data.started) return;

        assignRoles(data.players);
        data.started = true;

        // send role to each player
        data.players.forEach(p => {
            io.to(p.id).emit("yourRole", p.role);
        });

        // reveal police
        let policePlayer = data.players.find(p => p.role === "police");
        io.to(room).emit("showPolice", policePlayer.name);

        io.to(room).emit("gameStarted");
    });

    // ✅ POLICE GUESS
    socket.on("makeGuess", ({ room, targetId }) => {

        let data = rooms[room];
        if (!data || !data.started) return;

        let players = data.players;

        // check if player is police
        let player = players.find(p => p.id === socket.id);
        if (!player || player.role !== "police") return;

        let target = players.find(p => p.id === targetId);
        if (!target) return;

        let thief = players.find(p => p.role === "thief");

        let result = (thief.id === targetId)
            ? "🎉 Police caught the thief!"
            : "❌ Police failed!";

        io.to(room).emit("gameResult", result);

        // end game
        data.started = false;
    });

    // ✅ DISCONNECT
    socket.on("disconnect", () => {

        for (let room in rooms) {
            let data = rooms[room];

            // 🔴 If host leaves → close room
            if (data.host === socket.id) {
                io.to(room).emit("roomClosed");

                let clients = io.sockets.adapter.rooms.get(room);
                if (clients) {
                    clients.forEach(id => {
                        let s = io.sockets.sockets.get(id);
                        if (s) s.leave(room);
                    });
                }

                delete rooms[room];
                continue;
            }

            // remove player
            data.players = data.players.filter(p => p.id !== socket.id);

            // cancel game if running
            if (data.started && data.players.length < ROLES.length) {
                data.started = false;
                io.to(room).emit("gameCancelled");
            }

            // delete empty room
            if (data.players.length === 0) {
                delete rooms[room];
                continue;
            }

            io.to(room).emit("updatePlayers", data.players);
        }
    });

});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("Server running on port " + PORT));