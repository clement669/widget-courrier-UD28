import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { startReactDsfr } from '@codegouvfr/react-dsfr/spa'

// Initialisation du DSFR
startReactDsfr({ defaultColorScheme: 'system' });

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)