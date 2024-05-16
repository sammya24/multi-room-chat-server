// Require the packages we will use:
const http = require("http"),
    fs = require("fs");

const port = 3456;
const file = "client.html";
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html, on port 3456:
const server = http.createServer(function (req, res) {
    // This callback runs when a new connection is made to our HTTP server.

    fs.readFile(file, function (err, data) {
        // This callback runs when the client.html file has been read from the filesystem.

        if (err) return res.writeHead(500);
        res.writeHead(200);
        res.end(data);
    });
});
server.listen(port);

// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
    wsEngine: 'ws'
});

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
const connectedUsers = {}; //keep track of connected users : chatrooms
const roomsPass = {}; //keep track of roomnames : passwords
const roomsAdmin = {} //keep track of roomnames : admins
const userSocketIds = {}; // keep track of usernames: socket ids
const bannedUsers = {}; // keep track of roomnames: banned

io.sockets.on("connection", function (socket) {

    socket.on('login', function (data) {

        const requestedUsername = data.username;

        if (connectedUsers[requestedUsername]) {
            io.to(socket.id).emit("username_taken");

        } else {
            roomsPass["Main Lobby"] = "";

            userSocketIds[requestedUsername] = socket.id;
            connectedUsers[requestedUsername] = "Main Lobby";
            socket.username = requestedUsername;

            //set the initial room to "Main Lobby"
            //connectedUsers[requestedUsername] = "Main Lobby";
            socket.room = "Main Lobby";
            socket.join("Main Lobby");
            io.to(socket.room).emit("display_lists", { roomName: "Main Lobby", connectedUsers: connectedUsers, roomsAdmin: roomsAdmin });

            //tell user about room change
            io.to(socket.id).emit("room_change", { roomName: "Main Lobby" });

        }
    });

    socket.on('private_message', function (data) {
        socket.to(userSocketIds[data.targetUsername]).emit('', { message: data.message, sender: socket.username, target: data.userSocketIds[data.targetUsername]});
    });
    
    

    socket.on('message_to_server', function (data) {
        console.log(`[${socket.username}] message: ${data.message}`);

        //relay message to users in same room
        io.to(socket.room).emit("message_to_client", { message: data.message, username: socket.username });
    });


    socket.on('create_room', function (data) {
        const roomName = data.roomName;
        const roomPass = data.roomPass;
        const currentRoom = connectedUsers[socket.username];

        let roomExists = false;

        //see if room exists in list of users
        for (const key in connectedUsers) {
            if (connectedUsers.hasOwnProperty(key) && connectedUsers[key] === roomName) {
                roomExists = true;
                break;
            }
        }

        if (roomExists) {
            socket.emit("chatroom_taken");

            return;
        }
        else {
            //room doesn't exist yet
            if (socket.room) {
                //leave current room if user already in one
                socket.leave(socket.room);
            }

            roomsPass[roomName] = roomPass;
            
            roomsAdmin[roomName] = [];
            roomsAdmin[roomName].push(socket.username);
            
            bannedUsers[roomName] = [];

            if (roomsAdmin[currentRoom]) {
                // alert("this work");
                const users = roomsAdmin[currentRoom];
                const updatedUsers = [];

                for (let i = 0; i < users.length; i++) {
                    if (users[i] !== socket.username) {
                        updatedUsers.push(users[i]);
                    }
                }

                roomsAdmin[currentRoom] = updatedUsers;
            }

            //join new room
            socket.join(roomName);
            socket.room = roomName;
            connectedUsers[socket.username] = roomName; //update user room

            updateRooms(currentRoom);

            //notify all users in previous and new rooms about changes
            io.to(roomName).emit("display_lists", { roomName: roomName, connectedUsers: connectedUsers, roomsAdmin: roomsAdmin });
            io.to(currentRoom).emit("display_lists", { roomName: currentRoom, connectedUsers: connectedUsers, roomsAdmin: roomsAdmin });

            socket.emit("room_change", { roomName: roomName });

        }
    });

    function updateRooms(currentRoom) { //delete stuff we don't need anymore
        //console.log("runing updte rooms w" + currentRoom);

        roomsPass["Main Lobby"] = "";

        if (currentRoom === "Main Lobby") {
            return;
        }

        let usersInRoom = 0;
        for (const username in connectedUsers) {
            if (connectedUsers.hasOwnProperty(username) && connectedUsers[username] === currentRoom) {
                usersInRoom++;
            }
        }

        if (usersInRoom === 0) {
            if (roomsPass.hasOwnProperty(currentRoom)) {
                delete roomsPass[currentRoom];
            }
            if (roomsAdmin.hasOwnProperty(currentRoom)) {
                delete roomsAdmin[currentRoom];
            }
            if (bannedUsers.hasOwnProperty(currentRoom)){
                delete bannedUsers[currentRoom];
            }
        }
    }

    socket.on('kick_user', function (data) {
        roomsPass["Main Lobby"] = "";

        console.log("POOPie")
        //io.to(socket.id).emit("kick_helper", { roomName: "Main Lobby", roomPass: "", username: data.targetUsername });
        const targetSocket = userSocketIds[data.targetUsername];
        const currentRoom = data.currentRoom;
       
        console.log(targetSocket);
        if (targetSocket){
            console.log("hi");

            socketio.to(targetSocket).emit('kick_helper', {
                roomName: "Main Lobby",
                roomPass: "",
                username: data.targetUsername,
                socket: targetSocket,
                currentRoom: currentRoom
            });
            
        }
        else{
            console.log("fail!")
        }
        
       
    });

    socket.on('ban_user', function (data) {
        roomsPass["Main Lobby"] = "";
        //console.log("POOPie")
        //io.to(socket.id).emit("kick_helper", { roomName: "Main Lobby", roomPass: "", username: data.targetUsername });
        //const targetSocket = userSocketIds[data.targetUsername];
        const currentRoom = data.currentRoom;
        if (bannedUsers[currentRoom]){
            bannedUsers[currentRoom].push(data.targetUsername);
        }
        else{
            bannedUsers[currentRoom] = [];
            bannedUsers[currentRoom].push(data.targetUsername);
        }
       
    });

    socket.on('join_room', function (data) {
        console.log(bannedUsers);
        console.log('join room event start');
        roomsPass["Main Lobby"] = "";
        connectedUsers[""] = "Main Lobby";

        const roomName = data.roomName;
        const roomPass = data.roomPass;
        const username = data.username;
        
        console.log("room name to be: " + roomName);
        console.log("room pass: " + roomPass);
        console.log("username " + username);

        const currentRoom = connectedUsers[username];
        console.log("Current room is " + currentRoom);
        console.log("-----------------------------");

        for (const key in connectedUsers) {
            
            if (connectedUsers.hasOwnProperty(key) && connectedUsers[key] === roomName) { //room exists
                
                if (bannedUsers.hasOwnProperty(roomName)) {
                   
                    const bannedInRoom = bannedUsers[roomName];
                    
                    for (const user of bannedInRoom) {
                         console.log("NO");
                        if (user === username) {
                            socket.emit("banned");
                            return;
                        }
                    }
                }
                
                
                if (currentRoom !== roomName) { //if user not already in requested room
                    if (roomsPass[roomName] == roomPass) { //if password correct

                        connectedUsers[username] = roomName; //update the user's room
                        socket.leave(currentRoom);
                        socket.join(roomName);
                        socket.room = roomName;

                        //notify all users in the new room about change
                        updateRooms(currentRoom);

                        io.to(roomName).emit("display_lists", { roomName: roomName, connectedUsers: connectedUsers, roomsAdmin: roomsAdmin });
                        io.to(currentRoom).emit("display_lists", { roomName: currentRoom, connectedUsers: connectedUsers, roomsAdmin: roomsAdmin });
                        
                        socket.emit("room_change", { roomName: roomName });
                       
                    }
                    else {
                        socket.emit("incorrect_password");
                    }

                }
                return;
            }
        }
        //room doesn't exist
        socket.emit("no_room_exist");
    });
});
