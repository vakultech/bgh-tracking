import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Search, 
  MoreVertical, 
  CheckCheck, 
  Check, 
  ArrowLeft,
  Circle,
  User
} from 'lucide-react';
import { databases, db, ID, Query, client, account } from '../lib/appwrite';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useUser } from '../UserContext';

export default function ChatBox() {
  const { profile, user: currentUser } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [activeThread, setActiveThread] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const activeThreadRef = useRef(null);

  // Sync ref with state for Realtime access
  useEffect(() => {
    activeThreadRef.current = activeThread;
    if (activeThread && isOpen) {
      markAllAsRead(activeThread.userId);
    }
  }, [activeThread, isOpen]);

  const myId = useMemo(() => profile?.userId || currentUser?.$id, [profile, currentUser]);

  // 1. INITIAL DATA FETCH
  useEffect(() => {
    if (!myId) return;
    initMessenger();
    
    // 2. REALTIME SUBSCRIPTION
    const unsubscribe = client.subscribe(
      `databases.${db.id}.collections.${db.collections.messages}.documents`,
      (response) => {
        const msg = response.payload;
        const myId = profile?.userId || currentUser?.$id;
        const myAltId = profile?.$id || currentUser?.$id;
        
        // Handle New Messages
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          const isForMe = msg.recipientId === myId || msg.recipientId === myAltId;
          const isFromMe = msg.senderId === myId || msg.senderId === myAltId;
          const activeContact = activeThreadRef.current;
          
          // Fuzzy match to the active conversation
          const isTalkingToSender = activeContact && (
            activeContact.userId === msg.senderId || 
            activeContact.$id === msg.senderId ||
            activeContact.fullName === msg.senderName
          );

          if (isForMe) {
            if (isOpen && isTalkingToSender) {
              // I am currently looking at this person
              appendMessage(msg);
              markMessageAsRead(msg.$id);
            } else {
              // Notification mode
              incrementUnread(msg.senderId);
              playNotificationSound();
            }
          } else if (isFromMe && activeContact && (
            activeContact.userId === msg.recipientId ||
            activeContact.$id === msg.recipientId
          )) {
            appendMessage(msg);
          }
        }

        // Handle Read Status Updates
        if (response.events.includes('databases.*.collections.*.documents.*.update')) {
          if (msg.recipientId === myId && msg.isRead === true) {
            decrementUnread(msg.senderId);
          }
          if (msg.senderId === myId && activeThreadRef.current?.userId === msg.recipientId) {
            updateMessageStatus(msg.$id, true);
          }
        }
      }
    );

    return () => unsubscribe();
  }, [myId]);

  const initMessenger = async () => {
    try {
      // Fetch all potential contacts (profiles)
      const { documents: profiles } = await databases.listDocuments(
        db.id, db.collections.profiles, [Query.limit(100)]
      );
      const activeContacts = profiles.filter(p => p.userId !== myId);
      setContacts(activeContacts);

      // Fetch ALL unread messages for me
      const { documents: unreads } = await databases.listDocuments(
        db.id, db.collections.messages, 
        [Query.equal('recipientId', myId), Query.equal('isRead', false)]
      );
      
      const counts = {};
      const strayMessages = [];
      
      console.log("Unread Check:", unreads.length, "messages found");
      console.log("Active Contacts:", activeContacts.map(c => c.userId));

      unreads.forEach(m => {
        // Try exact match or fuzzy match
        const contact = activeContacts.find(c => 
          c.userId === m.senderId || 
          c.$id === m.senderId ||
          c.fullName === m.senderName
        );
        
        if (contact) {
          counts[contact.userId] = (counts[contact.userId] || 0) + 1;
        } else {
          console.log("Stray message ID:", m.senderId, "from", m.senderName);
          strayMessages.push(m.$id);
        }
      });

      // CLEANUP STRAYS IMMEDIATELY
      if (strayMessages.length > 0) {
        await Promise.all(strayMessages.map(id => 
          databases.updateDocument(db.id, db.collections.messages, id, { isRead: true })
        ));
      }

      setUnreadMap(counts);
    } catch (err) {
      console.error("Messenger Init Error:", err);
    }
  };

  const markAllEverywhereAsRead = async () => {
    try {
      const { documents: unreads } = await databases.listDocuments(
        db.id, db.collections.messages, 
        [Query.equal('recipientId', myId), Query.equal('isRead', false)]
      );
      await Promise.all(unreads.map(m => 
        databases.updateDocument(db.id, db.collections.messages, m.$id, { isRead: true })
      ));
      setUnreadMap({});
    } catch (err) {
      console.error("Total Clear Error:", err);
    }
  };

  const clearConversation = async () => {
    if (!activeThread) return;
    if (!window.confirm(`Permanently delete all messages with ${activeThread.fullName}?`)) return;

    try {
      setLoading(true);
      const userRole = profile?.role || 'user';

      if (userRole !== 'admin') {
        alert("Action Denied: You do not have permission to delete messages.");
        setLoading(false);
        return;
      }

      const { documents } = await databases.listDocuments(
        db.id, db.collections.messages,
        [
          Query.or([
            Query.and([Query.equal('senderId', myId), Query.equal('recipientId', activeThread.userId)]),
            Query.and([Query.equal('senderId', activeThread.userId), Query.equal('recipientId', myId)])
          ]),
          Query.limit(100)
        ]
      );

      if (documents.length === 0) {
        alert("No messages found to delete.");
        setLoading(false);
        return;
      }

      // Force clear locally first
      setMessages([]);

      let deletedCount = 0;
      for (const m of documents) {
        try {
          await databases.deleteDocument(db.id, db.collections.messages, m.$id);
          deletedCount++;
        } catch (e) {
          console.warn(`Permission Denied for message ${m.$id}`);
        }
      }

      alert(`Cleanup Finished: ${deletedCount} of ${documents.length} messages removed from server. (Others were skipped due to Appwrite permissions).`);
    } catch (err) {
      console.error("Clear Error:", err);
      alert("System Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (contactId, silent = false) => {
    if (!contactId) return;
    if (!silent) setLoading(true);
    try {
      const { documents } = await databases.listDocuments(
        db.id, db.collections.messages,
        [
          Query.or([
            Query.and([Query.equal('senderId', myId), Query.equal('recipientId', contactId)]),
            Query.and([Query.equal('senderId', contactId), Query.equal('recipientId', myId)])
          ]),
          Query.orderAsc('$createdAt'),
          Query.limit(50)
        ]
      );
      setMessages(documents);
      if (!silent) scrollToBottom("auto");
    } catch (err) {
      console.error("Fetch Messages Error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // AUTO-REFRESH FALLBACK (If Realtime fails)
  useEffect(() => {
    if (!activeThread || !isOpen) return;
    
    const interval = setInterval(() => {
      fetchMessages(activeThread.userId, true);
    }, 10000); // Check every 10 seconds silently

    return () => clearInterval(interval);
  }, [activeThread, isOpen]);

  const markAllAsRead = async (contactId) => {
    try {
      const { documents: unread } = await databases.listDocuments(
        db.id, db.collections.messages,
        [Query.equal('recipientId', myId), Query.equal('senderId', contactId), Query.equal('isRead', false)]
      );
      
      if (unread.length > 0) {
        await Promise.all(unread.map(m => 
          databases.updateDocument(db.id, db.collections.messages, m.$id, { isRead: true })
        ));
      }
      setUnreadMap(prev => {
        const next = { ...prev };
        delete next[contactId];
        return next;
      });
    } catch (err) {
      console.error("Mark Read Error:", err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeThread) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      await databases.createDocument(db.id, db.collections.messages, ID.unique(), {
        senderId: myId,
        recipientId: activeThread.userId,
        senderName: profile?.fullName || currentUser?.email,
        senderRole: profile?.role || 'user',
        text: text,
        isRead: false
      });
      scrollToBottom();
    } catch (err) {
      console.error("Send Error:", err);
    }
  };

  // Helper Functions
  const appendMessage = (msg) => setMessages(prev => prev.some(m => m.$id === msg.$id) ? prev : [...prev, msg]);
  const updateMessageStatus = (id, status) => setMessages(prev => prev.map(m => m.$id === id ? { ...m, isRead: status } : m));
  const incrementUnread = (id) => setUnreadMap(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const decrementUnread = (id) => setUnreadMap(prev => {
    const next = { ...prev };
    delete next[id];
    return next;
  });
  const markMessageAsRead = (id) => databases.updateDocument(db.id, db.collections.messages, id, { isRead: true });
  const playNotificationSound = () => {
    try { new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play(); } catch(e) {}
  };
  const scrollToBottom = (behavior = "smooth") => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior }), 100);
  };

  const filteredContacts = contacts.filter(c => 
    c.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = useMemo(() => {
    let sum = 0;
    contacts.forEach(c => {
      const count = (Number(unreadMap[c.userId]) || 0) + (Number(unreadMap[c.$id]) || 0);
      sum += count;
    });
    return sum;
  }, [unreadMap, contacts]);

  return (
    <div className="messenger-system">
      {/* 1. FLOATING TOGGLE */}
      <motion.button 
        className={`messenger-toggle ${totalUnread > 0 ? 'pulse' : ''}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <MessageSquare size={24} />
        {totalUnread > 0 && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="unread-total"
          >
            {totalUnread}
          </motion.span>
        )}
      </motion.button>

      {/* 2. MAIN MESSENGER WINDOW */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="messenger-window card glass"
          >
            {/* SIDEBAR: THREADS */}
            <div className={`messenger-sidebar ${activeThread ? 'hide-mobile' : ''}`}>
              <div className="messenger-sidebar-header">
                <div>
                  <h3>Chats {totalUnread > 0 && <span className="header-count">({totalUnread})</span>}</h3>
                  <button className="clear-all-link" onClick={markAllEverywhereAsRead}>Mark all as read</button>
                </div>
                <button onClick={() => setIsOpen(false)} className="close-btn-mobile"><X size={20}/></button>
              </div>
              
              <div className="messenger-search">
                <Search size={18} />
                <input 
                  placeholder="Search Messenger" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="thread-list">
                {filteredContacts.map(contact => (
                  <button 
                    key={contact.$id}
                    className={`thread-item ${activeThread?.userId === contact.userId ? 'active' : ''}`}
                    onClick={() => {
                      setActiveThread(contact);
                      fetchMessages(contact.userId);
                    }}
                  >
                    <div className="avatar-wrapper">
                      <div className="avatar">
                        {contact.fullName?.charAt(0) || <User size={16}/>}
                      </div>
                      {contact.isOnline && <span className="online-indicator" />}
                    </div>
                    <div className="thread-info">
                      <div className="thread-name-row">
                        <span className="thread-name-text">{contact.fullName || 'User'}</span>
                        {/* We check multiple possible ID keys to ensure the dot shows up */}
                        {(unreadMap[contact.userId] > 0 || unreadMap[contact.$id] > 0) && (
                          <span className="unread-dot">
                            {(unreadMap[contact.userId] || 0) + (unreadMap[contact.$id] || 0)}
                          </span>
                        )}
                      </div>
                      <p className="thread-role">{contact.role?.replace('_', ' ')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* MAIN: CHAT AREA */}
            <div className={`messenger-chat ${activeThread ? 'show-mobile' : 'hide-mobile'}`}>
              {activeThread ? (
                <>
                  <div className="chat-header">
                    <button className="back-btn" onClick={() => setActiveThread(null)}><ArrowLeft size={20}/></button>
                    <div className="chat-header-user">
                      <div className="avatar sm">{activeThread.fullName?.charAt(0)}</div>
                      <div>
                        <h4>{activeThread.fullName}</h4>
                        <span className="status">{activeThread.isOnline ? 'Active Now' : 'Offline'}</span>
                      </div>
                    </div>
                    <div className="chat-actions">
                      {profile?.role === 'admin' && (
                        <button className="delete-chat-btn" onClick={clearConversation}>
                          Delete Message
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="chat-messages">
                    {loading ? (
                      <div className="chat-loading"><Circle className="spinner" /></div>
                    ) : (
                      <>
                        {messages.map((msg, i) => {
                          const isMe = msg.senderId === myId;
                          return (
                            <div key={msg.$id} className={`message-row ${isMe ? 'me' : 'them'}`}>
                              <div className="message-bubble">
                                <p>{msg.text}</p>
                                <div className="message-meta">
                                  <span>{format(new Date(msg.$createdAt), 'h:mm a')}</span>
                                  {isMe && (
                                    msg.isRead ? <CheckCheck size={12} className="read" /> : <Check size={12} />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  <form className="chat-input" onSubmit={sendMessage}>
                    <input 
                      placeholder="Type a message..." 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <button type="submit" disabled={!newMessage.trim()}><Send size={20} /></button>
                  </form>
                </>
              ) : (
                <div className="chat-empty">
                  <div className="empty-icon"><MessageSquare size={48} /></div>
                  <h3>Your Messages</h3>
                  <p>Select a contact to start a conversation</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .messenger-system { position: fixed; bottom: 2rem; right: 2rem; z-index: 1000; }
        
        .messenger-toggle { 
          width: 64px; height: 64px; border-radius: 50%; background: var(--primary); 
          color: white; border: none; cursor: pointer; box-shadow: 0 10px 25px rgba(14, 165, 233, 0.4);
          display: flex; align-items: center; justify-content: center; position: relative;
        }
        .unread-total { 
          position: absolute; top: -5px; right: -5px; background: #ef4444; 
          color: white; font-size: 0.75rem; font-weight: 800; width: 24px; height: 24px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          border: 3px solid white;
        }

        .messenger-window {
          position: absolute; bottom: 80px; right: 0; width: 850px; height: 600px;
          background: white; border-radius: 24px; display: flex; overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid var(--border);
        }

        @media (max-width: 900px) {
          .messenger-window { width: calc(100vw - 2rem); height: 80vh; right: -1rem; }
        }

        .messenger-sidebar { width: 320px; border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .messenger-sidebar-header { padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
        .messenger-sidebar-header h3 { font-size: 1.5rem; font-weight: 800; color: var(--primary); margin: 0; }
        .clear-all-link { 
          background: none; border: none; padding: 0; color: var(--accent); 
          font-size: 0.75rem; font-weight: 700; text-decoration: underline; 
          cursor: pointer; margin-top: 2px; display: block;
        }
        .clear-all-link:hover { color: var(--primary); }
        
        .messenger-search { 
          margin: 0 1.5rem 1.5rem; background: #f1f5f9; border-radius: 12px;
          display: flex; align-items: center; padding: 0.5rem 1rem; gap: 0.75rem; color: #64748b;
        }
        .messenger-search input { border: none; background: transparent; width: 100%; font-size: 0.9rem; font-weight: 500; }
        .messenger-search input:focus { outline: none; }

        .thread-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
        .thread-item { 
          width: 100%; display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem;
          border-radius: 12px; cursor: pointer; transition: all 0.2s; background: transparent;
        }
        .thread-item:hover { background: #f8fafc; }
        .thread-item.active { background: #f0f9ff; }
        
        .avatar-wrapper { position: relative; }
        .avatar { 
          width: 48px; height: 48px; border-radius: 50%; background: var(--primary-light);
          color: white; display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 1.2rem;
        }
        .avatar.sm { width: 40px; height: 40px; font-size: 1rem; }
        .online-indicator { 
          position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px;
          background: #22c55e; border: 2px solid white; border-radius: 50%;
        }

        .thread-info { flex: 1; text-align: left; min-width: 0; }
        .thread-name-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; width: 100%; }
        .thread-name-text { font-weight: 700; color: var(--primary); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 0.5rem; }
        .unread-dot { 
          background: #ef4444; color: white; font-size: 0.75rem; font-weight: 800; 
          min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; 
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);
          flex-shrink: 0; z-index: 10; position: relative;
        }
        .header-count { font-size: 1rem; color: var(--accent); opacity: 0.8; font-weight: 600; }
        .thread-role { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600; }

        .messenger-chat { flex: 1; display: flex; flex-direction: column; background: #fff; }
        .chat-header { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 1rem; }
        .chat-header-user { flex: 1; display: flex; align-items: center; gap: 0.75rem; }
        .chat-header-user h4 { font-weight: 800; color: var(--primary); }
        .chat-header-user .status { font-size: 0.75rem; color: #22c55e; font-weight: 600; }
        
        .delete-chat-btn { 
          background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; 
          padding: 0.5rem 0.8rem; border-radius: 8px; font-size: 0.75rem; 
          font-weight: 700; cursor: pointer; transition: all 0.2s;
        }
        .delete-chat-btn:hover { background: #fee2e2; color: #dc2626; transform: translateY(-1px); }

        .chat-messages { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .message-row { display: flex; width: 100%; }
        .message-row.me { justify-content: flex-end; }
        .message-row.them { justify-content: flex-start; }

        .message-bubble { 
          max-width: 75%; padding: 0.75rem 1rem; border-radius: 18px; 
          font-size: 0.95rem; line-height: 1.4; position: relative;
        }
        .me .message-bubble { background: var(--primary); color: white; border-bottom-right-radius: 4px; }
        .them .message-bubble { background: #f1f5f9; color: var(--primary); border-bottom-left-radius: 4px; }
        
        .message-meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.65rem; opacity: 0.7; margin-top: 0.25rem; }
        .me .message-meta { justify-content: flex-end; }
        .read { color: #facc15; }

        .chat-input { padding: 1.25rem; border-top: 1px solid var(--border); display: flex; gap: 1rem; }
        .chat-input input { 
          flex: 1; border: none; background: #f1f5f9; border-radius: 20px; 
          padding: 0.75rem 1.25rem; font-size: 0.95rem; font-weight: 500;
        }
        .chat-input input:focus { outline: none; box-shadow: 0 0 0 2px var(--primary-light); }
        .chat-input button { 
          background: var(--primary); color: white; border: none; width: 44px; height: 44px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: transform 0.2s;
        }
        .chat-input button:hover:not(:disabled) { transform: scale(1.1); }
        .chat-input button:disabled { opacity: 0.5; background: #cbd5e1; }

        .chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center; }
        .empty-icon { width: 100px; height: 100px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
        
        .back-btn { display: none; }
        .back-btn { display: none; }
        @media (max-width: 768px) {
          .messenger-window { 
            width: 100vw; height: 100dvh; 
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 0; z-index: 9999; display: flex; flex-direction: row;
          }
          .messenger-sidebar { width: 100%; border-right: none; height: 100%; display: flex; flex-direction: column; }
          .messenger-sidebar.hide-mobile { display: none !important; }
          
          .messenger-chat { 
            width: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
            z-index: 100; display: none; background: white; flex-direction: column;
            height: 100dvh;
          }
          .messenger-chat.show-mobile { display: flex !important; }
          
          .chat-input { padding-bottom: calc(1rem + env(safe-area-inset-bottom)); }
          
          .back-btn { display: flex; border: none; background: transparent; color: var(--primary); align-items: center; justify-content: center; padding: 0.5rem; }
          .close-btn-mobile { border: none; background: transparent; display: flex; }
          .messenger-window.card { border: none; box-shadow: none; }
        }

        .pulse { animation: pulse-red 2s infinite; }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .spinner { animation: rotate 2s linear infinite; }
        @keyframes rotate { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
