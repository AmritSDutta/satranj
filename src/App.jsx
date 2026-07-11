import React from 'react';
import { FaroErrorBoundary } from '@grafana/faro-react';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <FaroErrorBoundary fallback={
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          padding: '2.5rem',
          borderRadius: '12px',
          maxWidth: '480px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '1rem' }}>
            Game Interrupted
          </h1>
          <p style={{ color: '#a1a1aa', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            An unexpected error occurred. The application state has been reported to our telemetry dashboard.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#047857'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#059669'}
          >
            Reload Board
          </button>
        </div>
      </div>
    }>
      <Dashboard />
    </FaroErrorBoundary>
  );
}

export default App;

