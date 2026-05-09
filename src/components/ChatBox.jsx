import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, User, ArrowLeft, ChevronRight } from 'lucide-react';
import { databases, db, ID, Query, client, account } from '../lib/appwrite';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadSenders, setUnreadSenders] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const hasUnread = Object.keys(unreadSenders).length > 0;

  useEffect(() => {
    fetchInitialData();

    // Subscribe to messages (Create and Update)
    const unsubscribe = client.subscribe(
      `databases.${db.id}.collections.${db.collections.messages}.documents`,
      (response) => {
        const msg = response.payload;
        const myId = profile?.userId || currentUser?.$id;
        if (!myId) return;

        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          // If message is for me
          if (msg.recipientId === myId) {
            const isTalkingToSender = selectedContact?.userId === msg.senderId;
            
            if (!isOpen || !isTalkingToSender) {
              setUnreadSenders(prev => ({
                ...prev,
                [msg.senderId]: (prev[msg.senderId] || 0) + 1
              }));
              try { new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play(); } catch(e) {}
            }

            if (isTalkingToSender) {
              setMessages((prev) => {
                if (prev.some(m => m.$id === msg.$id)) return prev;
                return [...prev, msg];
              });
              // Auto-mark as read if window is open
              databases.updateDocument(db.id, db.collections.messages, msg.$id, { isRead: true });
            }
          }

          // If message is from me
          if (msg.senderId === myId && selectedContact?.userId === msg.recipientId) {
            setMessages((prev) => {
              if (prev.some(m => m.$id === msg.$id)) return prev;
              return [...prev, msg];
            });
          }
        }

        // Listen for "isRead" updates to sync across devices/tabs
        if (response.events.includes('databases.*.collections.*.documents.*.update')) {
          if (msg.recipientId === myId && msg.isRead === true) {
            setUnreadSenders(prev => {
              const newCounts = { ...prev };
              delete newCounts[msg.senderId];
              return newCounts;
            });
          }
        }
      }
    );

    return () => unsubscribe();
  }, [selectedContact, currentUser, profile, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, selectedContact]);

  const fetchInitialData = async () => {
    try {
      const user = await account.get();
      setCurrentUser(user);
      
      const { documents: profiles } = await databases.listDocuments(
        db.id, db.collections.profiles, [Query.equal('userId', user.$id)]
      );
      if (profiles.length > 0) setProfile(profiles[0]);

      const { documents: allProfiles } = await databases.listDocuments(
        db.id, db.collections.profiles, [Query.limit(100)]
      );
      setContacts(allProfiles.filter(p => p.userId !== user.$id));

      const { documents: unreadMessages } = await databases.listDocuments(
        db.id,
        db.collections.messages,
        [Query.equal('recipientId', user.$id), Query.equal('isRead', false)]
      );
      
      const counts = unreadMessages.reduce((acc, msg) => {
        acc[msg.senderId] = (acc[msg.senderId] || 0) + 1;
        return acc;
      }, {});
      
      setUnreadSenders(counts);

    } catch (err) {
      console.error("Chat error:", err);
    }
  };

  const markMessagesAsRead = async (contactId) => {
    const myId = profile?.userId || currentUser?.$id;
    try {
      const { documents: unread } = await databases.listDocuments(
        db.id,
        db.collections.messages,
        [
          Query.equal('recipientId', myId),
          Query.equal('senderId', contactId),
          Query.equal('isRead', false)
        ]
      );

      await Promise.all(unread.map(msg => 
        databases.updateDocument(db.id, db.collections.messages, msg.$id, { isRead: true })
      ));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const fetchConversation = async (contact) => {
    setLoading(true);
    try {
      const myId = profile?.userId || currentUser?.$id;
      const { documents } = await databases.listDocuments(
        db.id, 
        db.collections.messages,
        [
          Query.or([
            Query.and([Query.equal('senderId', myId), Query.equal('recipientId', contact.userId)]),
            Query.and([Query.equal('senderId', contact.userId), Query.equal('recipientId', myId)])
          ]),
          Query.orderAsc('$createdAt'),
          Query.limit(50)
        ]
      );
      setMessages(documents);
      await markMessagesAsRead(contact.userId);
    } catch (err) {
      console.error("Fetch conversation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setUnreadSenders(prev => {
      const newCounts = { ...prev };
      delete newCounts[contact.userId];
      return newCounts;
    });
    fetchConversation(contact);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    const myId = profile?.userId || currentUser?.$id;
    if (!myId) return;

    // Optimistic local update
    const tempMsg = {
      $id: `temp-${Date.now()}`,
      senderId: myId,
      recipientId: selectedContact.userId,
      senderName: profile?.fullName || currentUser.email,
      text: messageText,
      senderRole: profile?.role || 'user',
      isRead: false,
      $createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await databases.createDocument(
        db.id,
        db.collections.messages,
        ID.unique(),
        {
          senderId: myId,
          recipientId: selectedContact.userId,
          senderName: profile?.fullName || currentUser.email,
          text: messageText,
          senderRole: profile?.role || 'user',
          isRead: false
        }
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(m => m.$id !== tempMsg.$id));
      alert("Failed to send message. Make sure you added 'isRead' (Boolean) to the messages collection attributes!");
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
          onClick={() => {
            setIsOpen(true);
          }}
        >
          <MessageSquare size={24} />
          {hasUnread && <span className="notification-badge-pulse"></span>}
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
                {selectedContact ? (
                  <button className="back-btn" onClick={() => setSelectedContact(null)}>
                    <ArrowLeft size={20} />
                  </button>
                ) : (
                  <div className="chat-avatar">
                    <MessageSquare size={18} />
                  </div>
                )}
                <div>
                  <h4>{selectedContact ? selectedContact.fullName : 'Direct Messages'}</h4>
                  <p className="online-status">
                    {selectedContact ? selectedContact.role.replace('_', ' ') : 'Select a contact to chat'}
                  </p>
                </div>
              </div>
              <div className="header-actions">
                <button onClick={() => setIsOpen(false)} className="action-icon danger"><X size={20} /></button>
              </div>
            </div>

            {selectedContact ? (
              <>
                <div className="chat-messages">
                  {loading ? (
                    <div className="chat-loading"><div className="spinner-sm"></div></div>
                  ) : messages.length === 0 ? (
                    <div className="chat-empty">
                      <p>No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.$id} 
                        className={`message-row ${msg.senderId === currentUser?.$id ? 'mine' : 'theirs'}`}
                      >
                        <div className="message-content">
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
              </>
            ) : (
              <div className="contact-list">
                {contacts.length === 0 ? (
                  <div className="chat-empty"><p>No other users found.</p></div>
                ) : (
                  contacts.map(contact => {
                    const lastActive = contact.lastActive ? new Date(contact.lastActive) : null;
                    const isOnline = contact.isOnline && lastActive && (new Date() - lastActive < 300000);
                    const unreadCount = unreadSenders[contact.userId] || 0;
                    
                    return (
                      <button 
                        key={contact.$id} 
                        className={`contact-item ${unreadCount > 0 ? 'has-unread' : ''}`}
                        onClick={() => handleSelectContact(contact)}
                      >
                        <div className={`contact-avatar-sm ${contact.role}`}>
                          {contact.fullName?.charAt(0)}
                          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                        </div>
                        <div className="contact-info">
                          <div className="contact-name-row">
                            <span className="contact-name">{contact.fullName}</span>
                            {unreadCount > 0 && <span className="unread-pill">{unreadCount}</span>}
                          </div>
                          <span className="contact-role">{contact.role.replace('_', ' ')}</span>
                        </div>
                        <ChevronRight size={16} className="contact-arrow" />
                      </button>
                    );
                  })
                )}
              </div>
            )}
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

        .back-btn { background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .back-btn:hover { background: rgba(255,255,255,0.3); }

        .contact-list { flex: 1; overflow-y: auto; background: white; padding: 0.5rem; }
        .contact-item { 
          width: 100%; display: flex; align-items: center; gap: 1rem; padding: 1rem; 
          border: none; background: transparent; border-radius: 12px; cursor: pointer; transition: 0.2s;
          border-bottom: 1px solid var(--border);
        }
        .contact-item:hover { background: #f1f5f9; }
        
        .contact-avatar-sm { 
          width: 40px; height: 40px; border-radius: 12px; background: #64748b; color: white;
          display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem;
          position: relative;
        }
        .contact-avatar-sm.admin { background: #0f172a; }
        .contact-avatar-sm.supply_dept { background: #0d9488; }
        .contact-avatar-sm.supplier { background: #7c3aed; }

        .status-dot {
          position: absolute; bottom: -2px; right: -2px;
          width: 12px; height: 12px; border-radius: 50%;
          border: 2px solid white;
        }
        .status-dot.online { background: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
        .status-dot.offline { background: #ef4444; }

        .notification-badge-pulse {
          position: absolute; top: -5px; right: -5px;
          width: 18px; height: 18px; background: #ef4444;
          border-radius: 50%; border: 2px solid white;
          animation: badge-pulse 1.5s infinite;
        }

        @keyframes badge-pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .unread-pill {
          background: #ef4444; color: white; font-size: 0.6rem; 
          padding: 2px 6px; border-radius: 10px; font-weight: 900;
          letter-spacing: 0.05em;
        }
        .contact-name-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
        .contact-item.has-unread { background: rgba(239, 68, 68, 0.03); }

        .contact-info { flex: 1; text-align: left; display: flex; flex-direction: column; }
        .contact-name { font-weight: 700; color: var(--primary); font-size: 0.95rem; }
        .contact-role { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; }
        .contact-arrow { color: var(--border); }
        .contact-item:hover .contact-arrow { color: var(--primary-light); }

        .chat-loading { height: 100%; display: flex; align-items: center; justify-content: center; }
        .spinner-sm { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
