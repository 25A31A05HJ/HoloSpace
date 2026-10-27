import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('HoloSpace crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center">
        <div className="card">
          <h2>Something went wrong</h2>
          <p className="muted">{String((this.state.error && this.state.error.message) || this.state.error)}</p>
          <button
            className="primary"
            onClick={() => {
              window.location.hash = '';
              window.location.reload();
            }}
          >
            Back to start
          </button>
        </div>
      </div>
    );
  }
}
