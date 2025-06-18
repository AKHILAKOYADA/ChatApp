const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

// Serve static files (optional)
app.use(express.static(__dirname));

// Basic health check
app.get('/', (req, res) => {
  res.send('Chat server is running');
});

// Set port from environment (Render provides this)
const port = process.env.PORT || 3000;

// Socket.io logic
io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server (IMPORTANT: use http.listen, not app.listen)
http.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${port}`);
});

});
