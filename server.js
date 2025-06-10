const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// Basic error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Store connected users
const users = new Set();

// Keep track of user connections
const userConnections = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle user join
    socket.on('user join', (username) => {
        // Check if username is already taken
        if (users.has(username)) {
            socket.emit('error', 'Username already taken');
            return;
        }

        socket.username = username;
        users.add(username);
        userConnections.set(socket.id, username);
        io.emit('user list', Array.from(users));
        
        // Broadcast welcome message
        io.emit('chat message', {
            text: `${username} joined the chat`,
            username: 'System',
            timestamp: new Date().toISOString()
        });
    });

    // Handle chat messages
    socket.on('chat message', (data) => {
        if (!socket.username) return;

        io.emit('chat message', {
            text: data.text,
            username: socket.username,
            timestamp: new Date().toISOString()
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (socket.username) {
            users.delete(socket.username);
            userConnections.delete(socket.id);
            io.emit('user list', Array.from(users));
            
            // Broadcast disconnect message
            io.emit('chat message', {
                text: `${socket.username} left the chat`,
                username: 'System',
                timestamp: new Date().toISOString()
            });
        }
        console.log('A user disconnected');
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
