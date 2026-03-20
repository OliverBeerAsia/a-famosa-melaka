/**
 * Main Entry Point - React + Phaser Hybrid
 *
 * Initializes the React application shell which embeds the Phaser game
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Initialize React app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('A Famosa: Streets of Golden Melaka');
console.log('React + Phaser Hybrid Architecture');
