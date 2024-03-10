export class ExpiredLoginError extends Error {
    constructor(message) {
        super(message);
        this.name = "ExpiredLoginError";
        this.message = "La pagina ha risposto con un errore.\nRitentare la login prima di ripetere l\'operazione."
    }
}

export class MissingLoginError extends Error {
    constructor(message) {
        super(message);
        this.name = "MissingLoginError";
        this.message = "Eseguire la login prima di interrogare l'api presenze."
    }
}