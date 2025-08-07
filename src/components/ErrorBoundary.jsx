// src/components/ErrorBoundary.jsx - Error boundary for graceful error handling

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Report to error tracking service if available
    if (window.reportError) {
      window.reportError(error);
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '2px solid #ff6b6b',
          borderRadius: '12px',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          color: '#ff6b6b',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#ff6b6b' }}>
            🚫 Something went wrong
          </h3>
          
          <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
            The video avatar encountered an error and needs to be reset.
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details style={{ 
              textAlign: 'left', 
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Error Details (Development)
              </summary>
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                margin: '10px 0 0 0',
                fontSize: '11px'
              }}>
                {this.state.error && this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              🔄 Try Again {this.state.retryCount > 0 && `(${this.state.retryCount})`}
            </button>
            
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              🔄 Reload Page
            </button>
          </div>
          
          {this.state.retryCount > 2 && (
            <p style={{ 
              margin: '15px 0 0 0', 
              fontSize: '12px', 
              fontStyle: 'italic',
              opacity: 0.8 
            }}>
              If the problem persists, try refreshing the page or check your video files.
            </p>
          )}
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;