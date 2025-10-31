import React, { useState, useEffect, useRef } from 'react';
import {
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth, rtdb, storage } from '../firebase';
import { ref, onValue, set, onDisconnect, push, query, limitToLast, orderByChild, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import '../styles/Chat.css';

const Chat = ({ currentUser, otherUserUid }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [nickname, setNickname] = useState(currentUser.displayName || '');
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(
    localStorage.getItem('chatBackground') || ''
  );
  const [showBackgroundInput, setShowBackgroundInput] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [otherUserData, setOtherUserData] = useState(null); // To store the other user's data
  const [replyToMessage, setReplyToMessage] = useState(null); // New state for replying
  const [seenMessageIds, setSeenMessageIds] = useState(new Set()); // Track seen messages
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null); // Ref for the hidden file input
  const typingTimeoutRef = useRef(null);

  // Generate a consistent conversation ID
  const conversationId = [currentUser.uid, otherUserUid].sort().join('_');

  // For swipe gesture
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const swipeThreshold = 50; // pixels

  // Function to trigger the hidden file input click
  const handleMediaButtonClick = () => {
    fileInputRef.current.click();
  };

  // Effect to save background to localStorage
  useEffect(() => {
    localStorage.setItem('chatBackground', backgroundImage);
  }, [backgroundImage]);

  // --- Intersection Observer for Read Receipts ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.8) { // Consider seen if 80% visible
            const messageId = entry.target.dataset.messageid;
            const messageUid = entry.target.dataset.messageuid;

            // Only mark as seen if it's from the other user and not already seen
            if (messageId && messageUid === otherUserUid && !seenMessageIds.has(messageId)) {
              const messageRef = ref(rtdb, `private_chats/${conversationId}/messages/${messageId}`);
              // Update status to 'seen' only if it's currently 'sent' or 'delivered'
              onValue(messageRef, (snapshot) => {
                const currentMessage = snapshot.val();
                if (currentMessage && (currentMessage.status === 'sent' || currentMessage.status === 'delivered')) {
                  set(messageRef, { ...currentMessage, status: 'seen' });
                  setSeenMessageIds((prev) => new Set(prev.add(messageId)));
                }
              }, { onlyOnce: true });
            }
          }
        });
      },
      { threshold: 0.8 } // 80% of the message must be visible
    );

    // Observe all messages
    document.querySelectorAll('.chat-message').forEach((messageElement) => {
      observer.observe(messageElement);
    });

    return () => observer.disconnect();
  }, [messages, currentUser.uid, seenMessageIds]); // Re-run when messages or currentUser changes

  // --- Presence (Online/Last Seen) --- //
  useEffect(() => {
    if (!currentUser) return;

    const userStatusDatabaseRef = ref(rtdb, 'status/' + currentUser.uid);
    const isOfflineForDatabase = {
      state: 'offline',
      last_changed: serverTimestamp(),
    };
    const isOnlineForDatabase = {
      state: 'online',
      last_changed: serverTimestamp(),
    };

    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
      if (snapshot.val() === true) {
        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
          set(userStatusDatabaseRef, isOnlineForDatabase);
        });
      }
    });

    // Listen for all users' status changes
    const usersStatusRef = ref(rtdb, 'status');
    const unsubscribeStatus = onValue(usersStatusRef, (snapshot) => {
      const statuses = snapshot.val();
      if (statuses) {
        setOnlineUsers(statuses);
      }
    });

    return () => {
      unsubscribeStatus();
      set(userStatusDatabaseRef, isOfflineForDatabase);
    };
  }, [currentUser]);

  // --- Typing Indicator --- //
  useEffect(() => {
    if (!currentUser) return;

    const userTypingRef = ref(rtdb, 'typing/' + currentUser.uid);

    // Listen for all users' typing status
    const typingRef = ref(rtdb, 'typing');
    const unsubscribeTyping = onValue(typingRef, (snapshot) => {
      const typers = snapshot.val();
      if (typers) {
        setTypingUsers(typers);
      }
    });

    return () => {
      unsubscribeTyping();
      set(userTypingRef, false);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const userTypingRef = ref(rtdb, 'typing/' + currentUser.uid);

    if (newMessage.trim() !== '') {
      set(userTypingRef, true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        set(userTypingRef, false);
      }, 1500);
    } else {
      set(userTypingRef, false);
    }
  }, [newMessage, currentUser]);

  // --- Fetch other user's data --- //
  useEffect(() => {
    if (!otherUserUid) return;
    const otherUserRef = ref(rtdb, `users/${otherUserUid}`);
    const unsubscribeOtherUser = onValue(otherUserRef, (snapshot) => {
      setOtherUserData(snapshot.val());
    });
    return () => unsubscribeOtherUser();
  }, [otherUserUid, conversationId]);

  // --- Message Fetching and Nickname Management --- //
  useEffect(() => {
    const messagesRef = query(ref(rtdb, `private_chats/${conversationId}/messages`), orderByChild('createdAt'), limitToLast(50));
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const fetchedMessages = [];
      snapshot.forEach((childSnapshot) => {
        const message = { id: childSnapshot.key, ...childSnapshot.val() };
        fetchedMessages.push(message);
      });
      setMessages(fetchedMessages);
    });

    const userProfileRef = ref(rtdb, 'users/' + currentUser.uid);
    const unsubscribeProfile = onValue(userProfileRef, (snapshot) => {
      const profile = snapshot.val();
      if (profile) {
        setNickname(profile.nickname || currentUser.displayName || '');
      } else {
        set(userProfileRef, { nickname: currentUser.displayName || currentUser.email });
        setNickname(currentUser.displayName || currentUser.email);
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeProfile();
    };
  }, [currentUser, conversationId, otherUserUid]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setMediaFile(e.target.files[0]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' && !mediaFile) return;

    let mediaUrl = null;
    if (mediaFile) {
      const storageReference = storageRef(storage, `chat_media/${mediaFile.name}_${Date.now()}`);
      const snapshot = await uploadBytes(storageReference, mediaFile);
      mediaUrl = await getDownloadURL(snapshot.ref);
    }

    const messageData = {
      text: newMessage,
      createdAt: serverTimestamp(),
      uid: currentUser.uid,
      displayName: nickname || currentUser.email,
      mediaUrl: mediaUrl, // Add mediaUrl to message data
      status: 'sent', // Initialize message status
    };

    if (replyToMessage) {
      messageData.replyTo = {
        id: replyToMessage.id,
        text: replyToMessage.text,
        displayName: replyToMessage.displayName,
      };
    }

    const newMessageRef = push(ref(rtdb, `private_chats/${conversationId}/messages`), messageData);
    await set(newMessageRef, { ...messageData, status: 'delivered' }); // Mark as delivered after successful push

    setNewMessage('');
    setMediaFile(null); // Clear media file after sending
    setReplyToMessage(null); // Clear reply state after sending
  };

  const handleSignOut = async () => {
    try {
      if (currentUser) {
        const userStatusDatabaseRef = ref(rtdb, 'status/' + currentUser.uid);
        await set(userStatusDatabaseRef, {
          state: 'offline',
          last_changed: serverTimestamp(),
        });
      }
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleUpdateNickname = async () => {
    if (nickname.trim() === '') return;
    try {
      await updateProfile(currentUser, { displayName: nickname });
      const userProfileRef = ref(rtdb, 'users/' + currentUser.uid);
      await set(userProfileRef, { nickname: nickname });
      setShowNicknameInput(false);
      alert('Nickname updated successfully!');
    } catch (error) {
      console.error("Error updating nickname: ", error);
      alert('Failed to update nickname.');
    }
  };

  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear all chat messages? This action cannot be undone.')) {
      try {
        await set(ref(rtdb, 'messages'), null); // Clear all messages in the database
        setMessages([]); // Optionally clear local state immediately
        alert('Chat messages cleared!');
        setShowSettingsMenu(false); // Close settings menu
      } catch (error) {
        console.error("Error clearing chat: ", error);
        alert('Failed to clear chat messages.');
      }
    }
  };

  const handleReply = (message) => {
    setReplyToMessage({
      id: message.id,
      text: message.text,
      displayName: message.displayName,
    });
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const getHeaderStatus = () => {
    if (!otherUserData) return 'Loading...';

    const otherUserStatus = onlineUsers[otherUserUid];
    const isOtherUserOnline = otherUserStatus?.state === 'online';
    const isOtherUserTyping = typingUsers[otherUserUid] === true;

    if (isOtherUserTyping) {
      return `${otherUserData.nickname || otherUserUid} is typing...`;
    } else if (isOtherUserOnline) {
      return `${otherUserData.nickname || otherUserUid} is online`;
    } else if (otherUserStatus?.last_changed) {
      const date = new Date(otherUserStatus.last_changed);
      return `${otherUserData.nickname || otherUserUid} last seen ${date.toLocaleTimeString()} on ${date.toLocaleDateString()}`;
    } else {
      return `${otherUserData.nickname || otherUserUid} is offline`;
    }
  };

  // --- Swipe Gesture Handlers --- //
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e, msg) => {
    if (touchStartX.current - touchEndX.current > swipeThreshold || touchEndX.current - touchStartX.current > swipeThreshold) {
      // Swipe detected
      handleReply(msg);
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-left">
          <h2 className="chat-current-user-display">{otherUserData?.nickname || otherUserUid}</h2>
          <span className="chat-header-status">{getHeaderStatus()}</span>
        </div>
        <div className="chat-user-actions">
          <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className="chat-settings-button">
            ⋮
          </button>
        </div>
      </div>

      {showSettingsMenu && (
        <div className="chat-settings-menu">
          <button onClick={() => { setShowNicknameInput(!showNicknameInput); setShowSettingsMenu(false); }} className="chat-menu-item">
            {showNicknameInput ? 'Cancel Nickname Edit' : 'Edit Nickname'}
          </button>
          <button onClick={() => { setShowBackgroundInput(!showBackgroundInput); setShowSettingsMenu(false); }} className="chat-menu-item">
            {showBackgroundInput ? 'Cancel Background Edit' : 'Change Background'}
          </button>
          <button onClick={handleSignOut} className="chat-menu-item">
            Sign Out
          </button>
          <button onClick={handleClearChat} className="chat-menu-item chat-clear-button">
            Clear Chat
          </button>
        </div>
      )}

      {showNicknameInput && (
        <div className="chat-nickname-input-container">
          <input
            type="text"
            placeholder="Enter new nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="chat-nickname-input"
          />
          <button onClick={handleUpdateNickname} className="chat-update-nickname-button">Save Nickname</button>
        </div>
      )}

      {showBackgroundInput && (
        <div className="chat-background-input-container">
          <input
            type="text"
            placeholder="Enter background image URL"
            value={backgroundImage}
            onChange={(e) => setBackgroundImage(e.target.value)}
            className="chat-background-input"
          />
          <button onClick={() => setShowBackgroundInput(false)} className="chat-update-background-button">Apply Background</button>
        </div>
      )}

      <div className="chat-messages-container"
        style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundAttachment: 'fixed' } : {}}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-messageid={msg.id} // Add data attribute for IntersectionObserver
            data-messageuid={msg.uid} // Add data attribute for IntersectionObserver
            className={msg.uid === currentUser.uid ? 'chat-message chat-my-message' : 'chat-message chat-other-message'}
            onClick={() => handleReply(msg)} // Single click for reply
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={(e) => handleTouchEnd(e, msg)}
          >
            {msg.replyTo && (
              <div className="chat-reply-context">
                <span className="chat-reply-sender">{msg.replyTo.displayName}</span>
                <p className="chat-reply-text">{msg.replyTo.text}</p>
              </div>
            )}
            {msg.mediaUrl && <img src={msg.mediaUrl} alt="shared media" className="chat-media" />}
            {msg.text && <p>{msg.text}</p>}
            <span className="chat-message-time">
              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}
              {msg.uid === currentUser.uid && (
                <span className="read-receipt-indicator">
                  <span className={`receipt-bulb ${msg.status === 'sent' ? 'red' : ''}`}></span>
                  <span className={`receipt-bulb ${msg.status === 'delivered' ? 'yellow' : ''}`}></span>
                  <span className={`receipt-bulb ${msg.status === 'seen' ? 'green' : ''}`}></span>
                </span>
              )}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {replyToMessage && (
        <div className="chat-reply-input-preview">
          <div className="chat-reply-input-content">
            <span>Replying to {replyToMessage.displayName}:</span>
            <p>{replyToMessage.text}</p>
          </div>
          <button onClick={handleCancelReply} className="chat-reply-cancel-button">X</button>
        </div>
      )}
      <form onSubmit={handleSendMessage} className="chat-message-input-container">
        <input
          type="file"
          ref={fileInputRef} // Assign the ref
          onChange={handleFileChange}
          className="chat-file-input"
          hidden // Keep the input hidden
        />
        <button type="button" onClick={handleMediaButtonClick} className="chat-media-button">
          +
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="chat-message-input"
        />
        <button type="submit" className="chat-send-button">✈️</button>
      </form>
    </div>
  );
};

export default Chat;
