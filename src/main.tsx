import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './App.css' 
import { Toaster } from 'react-hot-toast' // Importamos Toaster

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Añadimos el Toaster aquí, fuera de App */}
    <Toaster 
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#333',
          color: '#fff',
        },
        error: {
          duration: 4000,
        },
      }}
    />
    <App />
  </React.StrictMode>,
)


// Previous version of the code
//
//import { StrictMode } from 'react'
//import { createRoot } from 'react-dom/client'
//import './index.css'
//import App from './App.tsx'

//createRoot(document.getElementById('root')!).render(
//  <StrictMode>
//    <App />
//  </StrictMode>,
//)
//