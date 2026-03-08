import { useState, useEffect, useCallback } from 'react';
import MessageList from './components/MessageList';
import MessageDetail from './components/MessageDetail';
import RuleEditor from './components/RuleEditor';
import ConcurrencyPanel from './components/ConcurrencyPanel';
import BackendPanel from './components/BackendPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useBackendStatus } from './hooks/useBackendStatus';
import { fetchMessageCount } from './services/api';
import type { WebhookMessage } from './services/api';

type Tab = 'messages' | 'rules' | 'concurrency' | 'backend';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('messages');
  const [selectedMessage, setSelectedMessage] = useState<WebhookMessage | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const { latestMessage, connected } = useWebSocket();
  const { status: backendStatus } = useBackendStatus();

  const loadCount = useCallback(async () => {
    try {
      const count = await fetchMessageCount();
      setMessageCount(count);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (latestMessage) {
      setMessageCount((prev) => prev + 1);
    }
  }, [latestMessage]);

  const handleSelectMessage = (msg: WebhookMessage) => {
    setSelectedMessage(msg);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">Webhook Server Simulator</h1>
          <div className="connection-status">
            <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          <div className="connection-status">
            <span className={`backend-status-dot ${backendStatus === 'running' ? 'backend-running' : backendStatus === 'starting' ? 'backend-starting' : backendStatus === 'external' ? 'backend-external' : 'backend-stopped'}`} />
            Backend: {backendStatus}
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          Messages
          {messageCount > 0 && <span className="tab-badge">{messageCount}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Response Rules
        </button>
        <button
          className={`tab-btn ${activeTab === 'concurrency' ? 'active' : ''}`}
          onClick={() => setActiveTab('concurrency')}
        >
          Concurrency
        </button>
        <button
          className={`tab-btn ${activeTab === 'backend' ? 'active' : ''}`}
          onClick={() => setActiveTab('backend')}
        >
          Backend
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'messages' && (
          <div className="messages-layout">
            <div className="messages-sidebar">
              <MessageList
                onSelectMessage={handleSelectMessage}
                selectedMessageId={selectedMessage?.id ?? null}
                latestWsMessage={latestMessage}
              />
            </div>
            <div className="messages-content">
              <MessageDetail message={selectedMessage} />
            </div>
          </div>
        )}

        {activeTab === 'rules' && <RuleEditor />}
        {activeTab === 'concurrency' && <ConcurrencyPanel />}
        {activeTab === 'backend' && <BackendPanel />}
      </main>
    </div>
  );
}
