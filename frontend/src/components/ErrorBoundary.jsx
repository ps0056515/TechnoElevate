import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 200, padding: 32, textAlign: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, margin: 24,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, maxWidth: 400 }}>
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
