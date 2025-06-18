const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN || '*'
        : 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Format memory usage
const formatMemoryUsage = (data) =>
  `${Math.round((data / 1024 / 1024) * 100) / 100} MB`;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Root route
app.get('/', (req, res) => {
  res.send('Chat server is running');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Health check
app.get('/health', (req, res) => {
  const used = process.memoryUsage();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: formatMemoryUsage(used.heapUsed),
      heapTotal: formatMemoryUsage(used.heapTotal),
    },
    port: process.env.PORT || 3000,
  });
});

// User tracking
const MAX_USERS = 20;
const users = new Set();
const userConnections = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  if (users.size >= MAX_USERS) {
    socket.emit('error', 'Server is at maximum capacity');
    socket.disconnect(true);
    return;
  }

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
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('chat message', (data) => {
    if (!socket.username) return;

    io.emit('chat message', {
      text: data.text,
      username: socket.username,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      users.delete(socket.username);
      userConnections.delete(socket.id);
      io.emit('user list', Array.from(users));
      io.emit('chat message', {
        text: `${socket.username} left the chat`,
        username: 'System',
        timestamp: new Date().toISOString(),
      });
    }
    console.log('A user disconnected');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    socket.emit('error', 'An error occurred');
  });
});

// Use the correct port from Render
const port = process.env.PORT || 3000;

http.listen(port, '0.0.0.0', () => {
  const used = process.memoryUsage();
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log('Memory usage:', {
    heapUsed: formatMemoryUsage(used.heapUsed),
    heapTotal: formatMemoryUsage(used.heapTotal),
  });
});

// Handle termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
