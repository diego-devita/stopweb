import fs from 'fs';

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Determina il percorso del file .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '../../profili.env');

export function load(){
    const result = dotenv.config({ path: envPath });

    if (result.error || !result.parsed) {
        return {};
    }

    return result.parsed;
}

export async function change(varName, profilePath){
    await setEnvVar(varName, profilePath);
}

// Funzione per aggiornare una variabile d'ambiente nel file .env
async function setEnvVar(key, value) {
    // Carica le variabili d'ambiente esistenti
    const existingVars = dotenv.config({ path: envPath }).parsed || {};

    // Aggiorna il valore per la chiave specificata
    existingVars[key] = value;

    // Prepara il contenuto del file .env aggiornato
    const newEnvContent = Object.entries(existingVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    // Scrive il nuovo contenuto nel file .env
    await fs.writeFileSync(envPath, newEnvContent, 'utf8');
}