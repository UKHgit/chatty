import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import Chat from './components/Chat';
import PasswordEntry from './components/PasswordEntry'; // Import new component
import './index.css'; // Import global styles for dark mode

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Define the UIDs for Sanjana and Bimsara
  const SANJANA_UID = 'yeRLlrBHnqe9HrqhPDFIUUFBzeM2';
  const BIMSARA_UID = 'FUF2jjwGVYX84lNLZNbyP5iDa9E3';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    // Set dark mode class on body by default
    document.body.classList.add('dark-mode');
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>; // Or a more sophisticated loading spinner
  }

  let otherUserUid = null;
  if (user) {
    if (user.uid === BIMSARA_UID) {
      otherUserUid = SANJANA_UID;
    } else if (user.uid === SANJANA_UID) {
      otherUserUid = BIMSARA_UID;
    }
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/password-entry" /> : <Auth />} />
          <Route path="/password-entry" element={user ? <PasswordEntry /> : <Navigate to="/" />} />
          <Route
            path="/chat"
            element={user && otherUserUid ? <Chat currentUser={user} otherUserUid={otherUserUid} /> : <Navigate to="/" />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
