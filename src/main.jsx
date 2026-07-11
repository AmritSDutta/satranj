import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { ReactIntegration } from '@grafana/faro-react';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

initializeFaro({
  url: import.meta.env.VITE_FARO_COLLECTOR_URL || 'https://faro-collector-prod-ap-south-1.grafana.net/collect/a5f19c2684ab297f27fc603bf82a0e92',
  app: {
    name: 'satranj.amritai.org',
    version: '1.0.0',
    environment: 'production',
  },
  instrumentations: [
    ...getWebInstrumentations(),
    new TracingInstrumentation({
      instrumentationOptions: {
        propagateTraceHeaderCorsUrls: [/satranj\.amritai\.org/],
      },
    }),
    new ReactIntegration(),
  ],
});

createRoot(document.getElementById('root')).render(
  <App />
)


