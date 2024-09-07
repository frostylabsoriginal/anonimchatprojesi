const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const fetch = require('node-fetch');  // node-fetch 2.x için require yapısı
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Mesaj gönderme limitleyici
const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // 15 dakikada max 100 mesaj
  handler: (req, res) => {
    res.status(429).send('Çok fazla mesaj gönderdiniz, lütfen 20 dakika bekleyin.');
  },
});



app.use(express.static(path.join(__dirname, 'public')));
app.use('/send-message', messageLimiter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/enter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'enter.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

io.on('connection', (socket) => {
  console.log('Bir kullanıcı bağlandı');

  socket.on('join room', ({ username, room, profilePicture }) => {
    socket.join(room);
    socket.username = username || 'Anonim';
    socket.room = room;
    socket.profilePicture = profilePicture || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRfVDpdwIqq-JPXXlOTDUQwJkZUKQpDYf8JOw&s';

    io.to(room).emit('chat message', {
      username: 'System',
      text: `${socket.username} chate katıldı.`,
      profilePicture: 'https://via.placeholder.com/40',
    });

    io.to(room).emit('chat message', {
      username: 'System',
      text: `Online kullanıcı sayısı: ${getOnlineUserCount(room)}`,
      profilePicture: 'https://via.placeholder.com/40',
    });
  });

  socket.on('chat message', async (msg) => {
    const room = socket.room;
    if (msg.text.startsWith('/gpt ')) {
      const prompt = msg.text.slice(5);
      try {
        const response = await fetch(`https://msii.xyz/api/yapay-zeka?model=claude-3-haiku&prompt=${encodeURIComponent(prompt)}&system=You are an artificial intelligence that can be used in chat on a website developed for anonymous chat. You help users.&online=true`);
        const data = await response.json();
        io.to(room).emit('chat message', {
          username: 'AI',
          text: data.response,
          profilePicture: 'data:image/jpeg;base64,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',
        });
      } catch (error) {
        console.error('AI hatası:', error);
      }
    } else {
      io.to(room).emit('chat message', msg);
    }
  });

  socket.on('disconnect', () => {
    const room = socket.room;
    io.to(room).emit('chat message', {
      username: 'System',
      text: `${socket.username} chatten ayrıldı.`,
      profilePicture: 'https://via.placeholder.com/40',
    });
  });
});

function getOnlineUserCount(room) {
  const roomData = io.sockets.adapter.rooms.get(room);
  return roomData ? roomData.size : 0;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor.`));
