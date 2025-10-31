import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import '../styles/Auth.css'; // Import the CSS file

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [hearts, setHearts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setHearts((prevHearts) => [
        ...prevHearts,
        {
          id: Date.now(),
          left: Math.random() * 100 + 'vw',
          animationDuration: Math.random() * 3 + 2 + 's', // 2 to 5 seconds
          delay: Math.random() * 2 + 's',
        },
      ].filter(heart => Date.now() - heart.id < 5000)); // Remove hearts older than 5 seconds
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/password-entry');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/password-entry');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="auth-container">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="heart"
          style={{
            left: heart.left,
            animationDuration: heart.animationDuration,
            animationDelay: heart.delay,
          }}
        ></div>
      ))}
      <h2 className="auth-heading">This chat room is made for 💕 Sanjana and Chamodya 💕</h2>
      <div className="auth-form-group">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
        />
      </div>
      <div className="auth-form-group">
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
        />
      </div>
      <div className="auth-button-group">
        <button onClick={handleSignIn} className="auth-button">
          Sign In
        </button>
      </div>
      <div className="auth-button-group">
        <button onClick={handleGoogleSignIn} className="auth-button google">
          Sign in with Google
        </button>
      </div>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
};

export default Auth;
