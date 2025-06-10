const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? process.env.CORS_ORIGIN || '*'
            : 'http://localhost:3000',
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Memory usage monitoring
const used = process.memoryUsage();
const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Root route for basic check
app.get('/', (req, res) => {
    res.send('Chat server is running');
});

// Basic error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Enhanced health check endpoint for Render
app.get('/health', (req, res) => {
    const memoryData = {
        heapUsed: formatMemoryUsage(used.heapUsed),
        heapTotal: formatMemoryUsage(used.heapTotal)
    };
    
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        memory: memoryData
    });
});

// Store connected users (with a maximum limit for free tier)
const MAX_USERS = 20;
const users = new Set();
const userConnections = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    // Check if maximum user limit is reached
    if (users.size >= MAX_USERS) {
        socket.emit('error', 'Server is at maximum capacity');
        socket.disconnect(true);
        return;
    }

    // Handle user join
    socket.on('user join', (username) => {
        if (users.has(username)) {
            socket.emit('error', 'Username already taken');
            return;
        }

        socket.username = username;
        users.add(username);
        userConnections.set(socket.id, username);
        io.emit('user list', Array.from(users));
        
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
            
            io.emit('chat message', {
                text: `${socket.username} left the chat`,
                username: 'System',
                timestamp: new Date().toISOString()
            });
        }
        console.log('A user disconnected');
    });

    // Enhanced error handling
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        socket.emit('error', 'An error occurred');
    });
});

// Configure port properly for Render
const PORT = process.env.PORT || 10000;

// Start server with better error handling
const server = http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log('Memory usage:', {
        heapUsed: formatMemoryUsage(used.heapUsed),
        heapTotal: formatMemoryUsage(used.heapTotal)
    });
}).on('error', (err) => {
    console.error('Server failed to start:', err);
    console.error('Port:', PORT);
    process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
