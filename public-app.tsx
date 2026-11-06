import React from 'react';
import {createRoot} from 'react-dom/client';
import FamilyApp from './app/family-app';
import './app/globals.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><FamilyApp/></React.StrictMode>);
