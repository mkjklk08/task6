import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// Подключаемся к серверу
const socket = io('http://localhost:4000');

function App() {
  // Состояния пользователя
  const [name, setName] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [stats, setStats] = useState({ wins: 0 });

  // Состояния лобби и игры
  const [rooms, setRooms] = useState([]);
  const [currentGame, setCurrentGame] = useState(null);
  const [mySymbol, setMySymbol] = useState(null);
  const [gameResult, setGameResult] = useState(null);

  useEffect(() => {
    // 1. Слушаем список доступных комнат
    socket.on('update-rooms', (availableRooms) => {
      setRooms(availableRooms);
    });

    // 2. Получаем начальную статистику при входе
    socket.on('init-stats', (userData) => {
      setStats({ wins: userData.wins });
    });

    // 3. Обновление статистики (счетчика) в реальном времени
    socket.on('stat-update', (data) => {
      if (data.name === name) {
        setStats({ wins: data.wins });
      }
    });

    // 4. Начало игры
    socket.on('game-start', (game) => {
      setGameResult(null);
      setCurrentGame(game);
      // Определяем, кто мы: X или O
      setMySymbol(game.players[0] === name ? 'X' : 'O');
    });

    // 5. Обновление доски после каждого хода
    socket.on('update-board', (data) => {
      setCurrentGame(prev => ({ ...prev, ...data }));
    });

    // 6. Конец игры
    socket.on('game-over', (data) => {
      setCurrentGame(prev => ({ ...prev, board: data.board }));
      
      if (data.winner === 'Draw') {
        setGameResult("НИЧЬЯ");
      } else {
        setGameResult(`ПОБЕДИТЕЛЬ: ${data.winner}`);
      }

      // Возвращаемся в лобби через 4 секунды
      setTimeout(() => {
        setCurrentGame(null);
        setGameResult(null);
      }, 4000);
    });

    return () => {
      socket.off('update-rooms');
      socket.off('init-stats');
      socket.off('stat-update');
      socket.off('game-start');
      socket.off('update-board');
      socket.off('game-over');
    };
  }, [name]);

  // Функции взаимодействия
  const login = () => {
    if (name.trim()) {
      setIsLogged(true);
      socket.emit('join-lobby', name);
    }
  };

  const createRoom = () => {
    const roomId = `room-${name}-${Date.now()}`;
    socket.emit('create-room', roomId, name);
  };

  const joinRoom = (id) => {
    socket.emit('join-room', id, name);
  };

  const makeMove = (index) => {
    // Проверяем: сейчас наш ход? Клетка пуста? Игра не окончена?
    if (
      currentGame &&
      !gameResult &&
      currentGame.board[index] === null &&
      currentGame.players[currentGame.turn] === name
    ) {
      socket.emit('make-move', { 
        roomId: currentGame.id, 
        index: index, 
        symbol: mySymbol 
      });
    }
  };

  return (
    <div className="app-container">
      <div className="card">
        {!isLogged ? (
          /* ЭКРАН ВХОДА */
          <div className="login-screen">
            <h1>NEURAL TOE</h1>
            <p className="status-text">IDENTIFICATION REQUIRED</p>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="ENTER USERNAME..." 
              maxLength="15"
            />
            <button className="btn" onClick={login}>INITIALIZE</button>
          </div>
        ) : !currentGame ? (
          /* ЭКРАН ЛОББИ */
          <div className="lobby-screen">
            <div className="user-info">
              <h2>{name}</h2>
              <div className="wins-badge">WINS: {stats.wins}</div>
            </div>
            
            <button className="btn" onClick={createRoom}>CREATE NEW SESSION</button>
            
            <div className="rooms-list">
              <p className="status-text">ACTIVE NODES:</p>
              {rooms.length === 0 && <p style={{opacity: 0.5}}>No active games...</p>}
              {rooms.map(r => (
                <div key={r.id} className="room-item">
                  <span>HOST: {r.players[0]}</span>
                  <button onClick={() => joinRoom(r.id)} className="connect-link">CONNECT</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ЭКРАН ИГРЫ */
          <div className="game-screen">
            <div className="game-header">
              <div className="status-text">
                {gameResult ? "SESSION TERMINATED" : (
                  currentGame.players[currentGame.turn] === name 
                    ? ">>> YOUR TURN" 
                    : ">>> OPPONENT THINKING..."
                )}
              </div>
            </div>

            {gameResult && <div className="winner-announcement">{gameResult}</div>}

            <div className="grid">
              {currentGame.board.map((cell, i) => (
                <div 
                  key={i} 
                  onClick={() => makeMove(i)} 
                  className={`cell ${cell === 'X' ? 'x-player' : cell === 'O' ? 'o-player' : ''}`}
                >
                  {cell}
                </div>
              ))}
            </div>

            <div className="game-footer">
              <span>YOU ARE: <b className={mySymbol === 'X' ? 'x-player' : 'o-player'}>{mySymbol}</b></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;