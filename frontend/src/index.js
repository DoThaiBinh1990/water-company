import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Quan trọng: Import file CSS ở đây
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../node_modules/frappe-gantt/dist/frappe-gantt.css'; // Đặt import CSS của frappe-gantt ở đây, sau index.css và App.css (nếu App.css được import ở đây)

// Tạo một instance của QueryClient ở đây
const queryClient = new QueryClient();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();