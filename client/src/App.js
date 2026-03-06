import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// Подключаемся к серверу
const socket = io('https://task6-nyy6.onrender.com');

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
    socket.on('update-rooms', (availableRooms) => {
      setRooms(availableRooms);
    });

    socket.on('init-stats', (userData) => {
      setStats({ wins: userData.wins });
    });

    socket.on('stat-update', (data) => {
      if (data.name === name) {
        setStats({ wins: data.wins });
      }
    });

    socket.on('game-start', (game) => {
      setGameResult(null);
      setCurrentGame(game);
      setMySymbol(game.players[0] === name ? 'X' : 'O');
    });

    socket.on('update-board', (data) => {
      setCurrentGame(prev => ({ ...prev, ...data }));
    });

    socket.on('game-over', (data) => {
      setCurrentGame(prev => ({ ...prev, board: data.board }));
      
      if (data.winner === 'Draw') {
        setGameResult("TIE");
      } else {
        setGameResult(`THE WINNER: ${data.winner}`);
      }

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
          <div className="login-screen">
            <h1>MKJKLK'S TOE</h1>
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