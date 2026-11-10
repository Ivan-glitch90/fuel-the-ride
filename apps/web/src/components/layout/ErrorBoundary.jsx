import { Component } from 'react';
import { t } from '../../i18n/index.js';
import { reportError } from '../../lib/errorReporting.js';

/** Catches a crash while drawing a page: reports it and offers a reload instead of a blank screen. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="auth-page" role="alert">
        <h1 className="auth-page__brand">Fuel the Ride</h1>
        <div className="card form">
          <h2>{t('Something went wrong')}</h2>
          <p>{t('Sorry, this page hit an error. It has been reported. Reloading usually fixes it.')}</p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => window.location.reload()}>
            {t('Reload')}
          </button>
        </div>
      </div>
    );
  }
}
