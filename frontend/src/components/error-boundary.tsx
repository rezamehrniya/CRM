/**
 * Error Boundary برای خطاهای رندر React
 * خطا را می‌گیرد و به‌جای crash، صفحهٔ خطای یکپارچه نشان می‌دهد.
 */
import React from 'react';
import { ErrorPage } from './error-page';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          variant="500"
          title="مشکلی پیش آمد"
          description="یک خطای غیرمنتظره رخ داده است. با «تلاش مجدد» یا رفرش صفحه دوباره امتحان کنید."
          onRetry={this.handleRetry}
          inline={false}
        />
      );
    }
    return this.props.children;
  }
}
