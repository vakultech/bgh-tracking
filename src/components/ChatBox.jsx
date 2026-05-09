import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, User, Minus } from 'lucide-react';
import { databases, db, ID, Query, client, account } from '../lib/appwrite';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchUserAndMessages();

    // Subscribe to messages
    const unsubscribe = client.subscribe(
      `databases.${db.id}.collections.${db.collections.messages}.documents`,
      (response) => {
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          setMessages((prev) => [...prev, response.payload]);
          if (!isOpen) {
            // Play sound or show badge logic here
          }
        }
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const fetchUserAndMessages = async () => {
    try {
      const user = await account.get();
      setCurrentUser(user);
      
      const { documents: profiles } = await databases.listDocuments(
        db.id, db.collections.profiles, [Query.equal('userId', user.$id)]
      );
      if (profiles.length > 0) setProfile(profiles[0]);

      const { documents } = await databases.listDocuments(
        db.id, 
        db.collections.messages,
        [Query.orderAsc('$createdAt'), Query.limit(50)]
      );
      setMessages(documents);
    } catch (err) {
      console.error("Chat error:", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      await databases.createDocument(
        db.id,
        db.collections.messages,
        ID.unique(),
        {
          senderId: currentUser.$id,
          senderName: profile?.fullName || currentUser.email,
          text: messageText,
          senderRole: profile?.role || 'user',
          createdAt: new Date().toISOString()
        }
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message. Check collection permissions!");
    }
  };

  return (
    <div className="chat-system-root">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <motion.button 
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="chat-toggle-btn"
          onClick={() => setIsOpen(true)}
        >
          <MessageSquare size={24} />
          <span className="online-indicator"></span>
        </motion.button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="chat-window card glass"
          >
            <div className="chat-header">
              <div className="header-user">
                <div className="chat-avatar">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h4>BGH Logistics Chat</h4>
                  <p className="online-status">Global System Channel</p>
                </div>
              </div>
              <div className="header-actions">
                <button onClick={() => setIsOpen(false)} className="action-icon"><Minus size={20} /></button>
                <button onClick={() => setIsOpen(false)} className="action-icon danger"><X size={20} /></button>
              </div>
            </div>

            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-empty">
                  <div className="empty-icon"><MessageSquare size={32} /></div>
                  <p>Start a conversation with the team</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.$id} 
                    className={`message-row ${msg.senderId === currentUser?.$id ? 'mine' : 'theirs'}`}
                  >
                    <div className="message-content">
                      <div className="sender-meta">
                        <span className="sender-name">{msg.senderName}</span>
                        <span className={`sender-role-pill ${msg.senderRole}`}>{msg.senderRole?.replace('_', ' ')}</span>
                      </div>
                      <div className="message-bubble">
                        {msg.text}
                      </div>
                      <span className="message-time">
                        {new Date(msg.$createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-area">
              <input 
                placeholder="Type a message..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" disabled={!newMessage.trim()} className="send-btn">
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .chat-system-root { position: fixed; bottom: 2rem; right: 2rem; z-index: 9999; }
        
        .chat-toggle-btn { 
          width: 64px; height: 64px; 
          background: var(--primary); color: white; 
          border-radius: 50%; border: none; 
          box-shadow: 0 12px 24px -6px rgba(14, 165, 233, 0.4);
          cursor: pointer; position: relative;
          display: flex; align-items: center; justify-content: center;
        }
        .online-indicator {
          position: absolute; top: 2px; right: 2px;
          width: 14px; height: 14px; background: #10b981;
          border: 3px solid white; border-radius: 50%;
        }

        .chat-window {
          width: 400px; height: 550px;
          display: flex; flex-direction: column;
          background: white; border: 1px solid var(--border);
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          overflow: hidden; border-radius: 24px;
        }

        @media (max-width: 480px) {
          .chat-window { width: calc(100vw - 2rem); height: 70vh; right: 1rem; bottom: 1rem; position: fixed; }
        }

        .chat-header {
          padding: 1.25rem 1.5rem; background: var(--primary); color: white;
          display: flex; justify-content: space-between; align-items: center;
        }
        .header-user { display: flex; align-items: center; gap: 1rem; }
        .chat-avatar { 
          width: 40px; height: 40px; background: rgba(255,255,255,0.2); 
          border-radius: 12px; display: flex; align-items: center; justify-content: center;
        }
        .header-user h4 { margin: 0; font-size: 1rem; font-weight: 700; }
        .online-status { font-size: 0.75rem; opacity: 0.8; margin: 0; }
        
        .header-actions { display: flex; gap: 0.5rem; }
        .action-icon { background: transparent; border: none; color: white; padding: 4px; cursor: pointer; opacity: 0.7; transition: 0.2s; }
        .action-icon:hover { opacity: 1; transform: scale(1.1); }
        .action-icon.danger:hover { color: #f87171; }

        .chat-messages {
          flex: 1; overflow-y: auto; padding: 1.5rem;
          display: flex; flex-direction: column; gap: 1.25rem;
          background: #f8fafc;
        }
        
        .message-row { display: flex; width: 100%; }
        .message-row.mine { justify-content: flex-end; }
        .message-row.theirs { justify-content: flex-start; }

        .message-content { max-width: 80%; display: flex; flex-direction: column; gap: 0.35rem; }
        .sender-meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.65rem; font-weight: 800; }
        .mine .sender-meta { justify-content: flex-end; }
        .sender-name { color: var(--text-muted); }
        .sender-role-pill { 
          text-transform: uppercase; padding: 1px 4px; border-radius: 4px; 
          background: #e2e8f0; color: #475569; 
        }
        .sender-role-pill.admin { background: #fee2e2; color: #991b1b; }
        .sender-role-pill.supply_dept { background: #ccfbf1; color: #0f766e; }

        .message-bubble {
          padding: 0.85rem 1.15rem; border-radius: 18px; font-size: 0.95rem; line-height: 1.4;
          box-shadow: var(--shadow-sm);
        }
        .mine .message-bubble { background: var(--primary); color: white; border-bottom-right-radius: 4px; }
        .theirs .message-bubble { background: white; color: var(--primary); border-bottom-left-radius: 4px; }

        .message-time { font-size: 0.65rem; color: var(--text-muted); opacity: 0.7; }
        .mine .message-time { text-align: right; }

        .chat-empty { 
          height: 100%; display: flex; flex-direction: column; 
          align-items: center; justify-content: center; color: var(--text-muted); text-align: center;
          padding: 2rem; opacity: 0.6;
        }
        .empty-icon { margin-bottom: 1rem; }

        .chat-input-area {
          padding: 1.25rem; background: white; border-top: 1px solid var(--border);
          display: flex; gap: 0.75rem; align-items: center;
        }
        .chat-input-area input {
          flex: 1; height: 44px; border-radius: 22px; border: 1px solid var(--border);
          padding: 0 1.25rem; font-size: 0.9rem; font-weight: 600;
        }
        .chat-input-area input:focus { border-color: var(--primary); outline: none; }
        .send-btn { 
          width: 44px; height: 44px; background: var(--primary); color: white;
          border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: 0.2s;
        }
        .send-btn:hover { transform: scale(1.05); background: var(--primary-light); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
