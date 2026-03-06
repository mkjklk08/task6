const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

mongoose.connect('mongodb+srv://mkjklk970901_db_user:2mGQXAXy4No7aDM9@cluster0.0hxjctp.mongodb.net/?appName=Cluster0');

const UserSchema = new mongoose.Schema({
  name: String,
  wins: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

let rooms = {}; // Хранение игровых сессий в памяти

io.on('connection', (socket) => {
  socket.on('join-lobby', async (username) => {
    let user = await User.findOne({ name: username });
    if (!user) user = await User.create({ name: username });
    socket.emit('init-stats', user);
    socket.emit('update-rooms', Object.values(rooms).filter(r => !r.full));
  });

  socket.on('create-room', (roomId, username) => {
    rooms[roomId] = { id: roomId, players: [username], board: Array(9).fill(null), turn: 0, full: false };
    socket.join(roomId);
    io.emit('update-rooms', Object.values(rooms).filter(r => !r.full));
  });

  socket.on('join-room', (roomId, username) => {
    if (rooms[roomId] && !rooms[roomId].full) {
      rooms[roomId].players.push(username);
      rooms[roomId].full = true;
      socket.join(roomId);
      io.to(roomId).emit('game-start', rooms[roomId]);
      io.emit('update-rooms', Object.values(rooms).filter(r => !r.full));
    }
  });

  socket.on('make-move', async ({ roomId, index, symbol }) => {
    const room = rooms[roomId];
    if (room && room.board[index] === null) {
      room.board[index] = symbol;
      room.turn = room.turn === 0 ? 1 : 0;
      
      const winnerSymbol = checkWinner(room.board);
      
      if (winnerSymbol) {
        let winnerName = "Draw";
        if (winnerSymbol !== 'Draw') {
          // Определяем имя победителя
          winnerName = room.players[winnerSymbol === 'X' ? 0 : 1];
          
          // 1. Обновляем в базе данных
          const updatedUser = await User.findOneAndUpdate(
            { name: winnerName },
            { $inc: { wins: 1 } },
            { new: true } // Чтобы получить уже обновленный документ
          );

          // 2. Рассылаем обновленную статистику всем (чтобы счетчик обновился)
          io.emit('stat-update', { name: winnerName, wins: updatedUser.wins });
        }

        // Отправляем сигнал об окончании игры с ИМЕНЕМ победителя
        io.to(roomId).emit('game-over', { 
          board: room.board, 
          winner: winnerName // Теперь передаем имя, а не символ
        });
        
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('update-board', { board: room.board, turn: room.turn });
      }
    }
  });
});

function checkWinner(b) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (let [a, b1, c] of lines) {
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
  }
  return b.includes(null) ? null : 'Draw';
}

server.listen(4000, () => console.log('Server running on port 4000'));