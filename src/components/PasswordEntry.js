import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Auth.css'; // Reusing Auth.css for basic styling

const PasswordEntry = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    const correctPassword = '20061222'; // The permanent password

    if (password === correctPassword) {
      navigate('/chat');
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <h2 className="auth-heading">Enter Chatroom Password</h2>
      <form onSubmit={handlePasswordSubmit} className="auth-form-group">
        <input
          type="password"
          placeholder="Chatroom Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
        />
        <button type="submit" className="auth-button">
          Enter Chat
        </button>
      </form>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
};

export default PasswordEntry;