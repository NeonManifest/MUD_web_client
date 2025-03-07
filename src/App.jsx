import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Create socket connection
    const socket = io('http://localhost:3000');
    socketRef.current = socket;

    // Handle connection events
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    // Handle messages from server
    socket.on('message', (message) => {
      console.log('Received message:', message);
      setMessages(prevMessages => [...prevMessages, message]);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    // Clean up on component unmount
    return () => {
      socket.disconnect();
    };
  }, []); // Empty dependency array ensures this runs once on mount

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && socketRef.current) {
      socketRef.current.emit('command', input);
      setInput('');
    }
  };

  return (
    <div className="mud-client">
      <div className="game-window">
        <div className="message-area">
          {messages.map((msg, index) => (
            <div key={index} className="message">{msg}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="input-area">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command..."
            disabled={!connected}
          />
          <button type="submit" disabled={!connected}>Send</button>
        </form>
        <div className="connection-status">
          Status: {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </div>
  );
}

export default App;