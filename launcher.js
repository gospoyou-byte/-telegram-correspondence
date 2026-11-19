(() => {
    'use strict';

    function start() {
        if (document.getElementById('cherry-gram-messenger')) return;

        const host = document.createElement('div');
        host.id = 'cherry-gram-messenger';
        document.body.append(host);
        const ui = host.attachShadow({ mode: 'open' });

        ui.innerHTML = `
            <style>
                :host { color-scheme: dark; }
                *, *::before, *::after { box-sizing: border-box; }
                button, textarea { font: inherit; }
                button { cursor: pointer; }
                button:focus-visible, textarea:focus-visible {
                    outline: 2px solid #ffbadb; outline-offset: 2px;
                }
                [hidden] { display: none !important; }

                #plane {
                    position: fixed; z-index: 2147483600;
                    right: 14px; top: 44%; width: 54px; height: 54px;
                    display: grid; place-items: center; padding: 12px;
                    border-radius: 50%; border: 2px solid #f3b6d6;
                    background: linear-gradient(145deg,#d58bb3,#81486c);
                    color: white; box-shadow: 0 4px 16px #0006;
                    touch-action: none; user-select: none;
                }
                #plane svg { width: 100%; height: 100%; pointer-events: none; }

                dialog {
                    position: fixed; inset: 0; margin: auto; padding: 0;
                    width: min(410px, calc(100vw - 16px));
                    height: min(680px, calc(100dvh - 20px));
                    max-width: 100vw; max-height: 100dvh;
                    overflow: hidden; border: 1px solid #cc8bab;
                    border-radius: 22px; background: #241c28; color: #fff0f7;
                    font: 15px/1.4 system-ui, sans-serif;
                    box-shadow: 0 16px 55px #0008;
                }
                dialog[open] { display: flex; flex-direction: column; }
                dialog::backdrop { background: #100b15ad; }
                header, nav, footer, #faces {
                    display: flex; align-items: center; gap: 8px;
                    padding: 10px 12px; flex: none;
                }
                header { background: #432d40; min-height: 62px; }
                #heading { flex: 1; min-width: 0; }
                #title { font-weight: 700; overflow-wrap: anywhere; }
                #subtitle, .preview, time { color: #dbb7cc; font-size: 12px; }
                button {
                    color: #fff0f7; border: 1px solid #96617f;
                    border-radius: 14px; background: #54374d;
                    padding: 8px 11px;
                }
                button[aria-pressed="true"], #send { background: #834e70; }
                button:disabled { opacity: .55; }
                nav { flex-wrap: wrap; border-bottom: 1px solid #624356; }
                main {
                    flex: 1; min-height: 0; overflow-y: auto;
                    overscroll-behavior: contain; padding: 12px;
                }
                .room {
                    display: block; width: 100%; text-align: left;
                    padding: 12px; margin-bottom: 6px; background: #302331;
                    border-color: #5e4054;
                }
                .preview {
                    display: block; overflow: hidden; white-space: nowrap;
                    text-overflow: ellipsis; margin-top: 3px;
                }
                .bubble {
                    width: fit-content; max-width: 85%; margin: 7px 0;
                    padding: 9px 13px; background: #453044;
                    border-radius: 15px 15px 15px 4px;
                    white-space: pre-wrap; overflow-wrap: anywhere;
                }
                .mine {
                    margin-left: auto; background: #734562;
                    border-radius: 15px 15px 4px 15px;
                }
                time { display: block; text-align: right; margin-top: 3px; }
                footer { background: #352535; padding-bottom: max(10px,env(safe-area-inset-bottom)); }
                textarea {
                    flex: 1; min-width: 0; resize: none; padding: 9px 12px;
                    border-radius: 15px; border: 1px solid #79566c;
                    background: #241c28; color: #fff0f7; font-size: 16px;
                }
                #faces { flex-wrap: wrap; gap: 4px; }
                #faces button { padding: 5px 8px; }
                #notice { padding: 8px 12px; background: #523544; font-size: 13px; }
                #notice button { margin-left: 6px; }
                .hint { color: #dbb7cc; }
            </style>

            <button id="plane" type="button" aria-label="Открыть Cherry Gram">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M21.8 3.2 18.5 20c-.2 1-1 1.2-1.8.6l-5-3.7-2.4 2.3.4-5.1 9.1-8.2-11.4 7.2-5-1.6c-1-.3-1-1 .2-1.5L20.5 2.8c.9-.3 1.5.1 1.3.4Z"/>
                </svg>
            </button>

            <dialog aria-labelledby="title">
                <header>
                    <button id="back" aria-label="К списку">‹</button>
                    <div id="heading">
                        <div id="title"></div>
                        <div id="subtitle" aria-live="polite"></div>
                    </div>
                    <button id="close" aria-label="Закрыть">×</button>
                </header>
                <nav aria-label="Разделы"></nav>
                <main></main>
                <div id="notice" role="status" hidden></div>
                <div id="faces" hidden></div>
                <footer hidden>
                    <button id="emoji" aria-label="Эмодзи">😊</button>
                    <textarea rows="1" aria-label="Текст сообщения"></textarea>
                    <button id="send">Отправить</button>
                </footer>
            </dialog>
        `;

        const get = selector => ui.querySelector(selector);
        const plane = get('#plane');
        const dialog = get('dialog');
        const main = get('main');
        const input = get('textarea');
        const notice = get('#notice');
        const libraryKey = 'cherry-gram:library:v1';
        const positionKey = 'cherry-gram:launcher-position:v2';
        const drafts = new Map();
        const pending = new Set();
        const errors = new Map();
        let rooms = [];
        let storageError = '';
        let active = null;
        let tab = 'chat';

        try {
            const saved = JSON.parse(localStorage.getItem(libraryKey) || '[]');
            if (!Array.isArray(saved) || saved.some(r =>
                !r || typeof r.name !== 'string' || !Array.isArray(r.messages)
            )) throw new Error();
            rooms = saved;
        } catch {
            storageError = 'Не удалось прочитать сохранённые переписки. Проверь хранилище браузера.';
        }

        function save(next) {
            if (storageError) {
                alert(storageError);
                return false;
            }
            try {
                localStorage.setItem(libraryKey, JSON.stringify(next));
                rooms = next;
                return true;
            } catch {
                alert('Браузер не смог сохранить сообщение. Проверь свободное место.');
                return false;
            }
        }

        function button(text, action) {
            const node = document.createElement('button');
            node.type = 'button';
            node.textContent = text;
            node.onclick = action;
            return node;
        }

        function context() {
            return window.SillyTavern?.getContext?.();
        }

        function character(ctx) {
            return ctx?.characters?.[ctx.characterId];
        }

        function currentRoom() {
            return rooms.find(r => r.id === active);
        }

        function enter(id) {
            active = id;
            input.value = drafts.get(id) || '';
            get('#faces').hidden = true;
            render();
        }

        function create(name, avatar = '') {
            name = name?.trim();
            if (!name) return;
            const room = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                type: tab, name, avatar, messages: []
            };
            if (save([...rooms, room])) enter(room.id);
        }

        function openCharacter() {
            const card = character(context());
            if (!card) return;
            const found = rooms.find(r =>
                r.type === 'chat' && r.avatar === card.avatar
            );
            if (found) enter(found.id);
            else create(card.name, card.avatar);
        }

        function appendMessage(id, role, text) {
            return save(rooms.map(room => room.id !== id ? room : {
                ...room,
                messages: [...room.messages, { role, text, at: Date.now() }]
            }));
        }

        function hint(text) {
            const p = document.createElement('p');
            p.className = 'hint';
            p.textContent = text;
            main.append(p);
        }

        function render() {
            const room = currentRoom();
            const nav = get('nav');
            nav.replaceChildren();
            main.replaceChildren();
            notice.replaceChildren();
            notice.hidden = true;
            get('#back').hidden = !room;
            get('footer').hidden = !room;
            nav.hidden = !!room;
            get('#title').textContent = room?.name || 'Cherry Gram ♡';

            if (!room) {
                get('#faces').hidden = true;
                get('#subtitle').textContent = 'Переписки и каналы';
                for (const [key, label] of [['chat', 'Чаты'], ['channel', 'Каналы']]) {
                    const item = button(label, () => { tab = key; render(); });
                    item.setAttribute('aria-pressed', String(tab === key));
                    nav.append(item);
                }
                const channel = tab === 'channel';
                nav.append(button(channel ? '+ Канал' : '+ Чат', () => {
                    create(prompt(channel ? 'Название канала' : 'Имя собеседника'));
                }));
                const card = character(context());
                if (!channel && card?.name) {
                    nav.append(button(`Написать · ${card.name}`, openCharacter));
                }

                const list = rooms.filter(r => r.type === tab);
                for (const entry of list) {
                    const item = button(entry.name, () => enter(entry.id));
                    item.className = 'room';
                    const preview = document.createElement('span');
                    preview.className = 'preview';
                    preview.textContent = entry.messages.at(-1)?.text || 'Пока пусто';
                    item.append(preview);
                    main.append(item);
                }
                if (storageError) hint(storageError);
                else if (!list.length) hint(channel
                    ? 'Нажми «+ Канал», чтобы опубликовать первый пост.'
                    : 'Выбери собеседника сверху или нажми «+ Чат».');
                return;
            }

            const channel = room.type === 'channel';
            const busy = pending.has(room.id);
            get('#subtitle').textContent = busy ? 'печатает…'
                : channel ? 'Канал' : 'Личная переписка';
            input.placeholder = channel ? 'Текст поста…' : 'Сообщение…';
            get('#send').textContent = channel ? 'Выложить' : 'Отправить';
            get('#send').disabled = busy;

            if (!room.messages.length) hint(channel
                ? 'Напиши первый пост внизу.'
                : `Напиши первое сообщение для ${room.name}.`);
            for (const message of room.messages) {
                const bubble = document.createElement('div');
                bubble.className = message.role === 'assistant' ? 'bubble' : 'bubble mine';
                bubble.textContent = message.text;
                const time = document.createElement('time');
                time.textContent = new Date(message.at).toLocaleTimeString('ru', {
                    hour: '2-digit', minute: '2-digit'
                });
                bubble.append(time);
                main.append(bubble);
            }
            if (errors.has(room.id)) {
                notice.hidden = false;
                notice.textContent = errors.get(room.id) + ' ';
                notice.append(button('Повторить ответ', () => reply(room.id)));
            }
            main.scrollTop = main.scrollHeight;
        }

        async function reply(id) {
            const room = rooms.find(r => r.id === id);
            if (!room || pending.has(id)) return;
            pending.add(id);
            errors.delete(id);
            if (active === id) render();

            try {
                const ctx = context();
                if (typeof ctx?.generateQuietPrompt !== 'function') {
                    throw new Error('Таверна не предоставила функцию генерации. Открой чат персонажа.');
                }
                const card = character(ctx);
                if (room.avatar && card?.avatar !== room.avatar) {
                    throw new Error(`Открой в Таверне персонажа «${room.name}» и повтори ответ.`);
                }

                const transcript = room.messages.slice(-30).map(msg =>
                    `${msg.role === 'assistant' ? room.name : ctx.name1 || 'Я'}: ${msg.text}`
                ).join('\n');
                const promptText = [
                    `Ты пишешь личное сообщение от лица ${room.name} в Cherry Gram.`,
                    'Учитывай текущую сцену. Ответь на последнее сообщение естественно,',
                    'как в мессенджере. Верни только текст ответа без имени отправителя.',
                    room.avatar && card?.description ? card.description : '',
                    'Переписка:', transcript
                ].filter(Boolean).join('\n');

                const result = await ctx.generateQuietPrompt({ quietPrompt: promptText });
                const text = typeof result === 'string' ? result.trim() : '';
                if (!text) throw new Error('Модель вернула пустой ответ.');
                if (!appendMessage(id, 'assistant', text)) {
                    throw new Error('Не удалось сохранить ответ.');
                }
            } catch (error) {
                errors.set(id, error?.message || 'Проверь подключение модели в Таверне.');
            } finally {
                pending.delete(id);
                if (active === id) render();
            }
        }

        function send() {
            const room = currentRoom();
            const text = input.value.trim();
            if (!room || !text || pending.has(room.id)) return;
            if (!appendMessage(room.id, 'user', text)) return;
            input.value = '';
            drafts.delete(room.id);
            get('#faces').hidden = true;
            if (room.type === 'channel') render();
            else void reply(room.id);
        }

        input.oninput = () => drafts.set(active, input.value);
        input.onkeydown = event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                send();
            }
        };
        get('#send').onclick = send;
        get('#emoji').onclick = () => {
            get('#faces').hidden = !get('#faces').hidden;
        };
        for (const emoji of ['♡', '❤️', '🥺', '😂', '🌸', '💋', '🐈', '✨', '💕', '😭']) {
            get('#faces').append(button(emoji, () => {
                input.setRangeText(emoji, input.selectionStart, input.selectionEnd, 'end');
                drafts.set(active, input.value);
                input.focus();
            }));
        }

        get('#back').onclick = () => enter(null);
        get('#close').onclick = () => dialog.close();

        // Диалог браузера открывается в верхнем слое поверх темы Таверны.
        // Кнопка остаётся на месте после закрытия.
        plane.onclick = event => {
            if (dragged && event.detail !== 0) return;
            dialog.showModal();
            render();
            get('#close').focus();
        };

        function place(x, y) {
            plane.style.left = Math.max(0, Math.min(x, innerWidth - 54)) + 'px';
            plane.style.top = Math.max(0, Math.min(y, innerHeight - 54)) + 'px';
            plane.style.right = 'auto';
        }

        let drag = null;
        let dragged = false;
        try {
            const p = JSON.parse(localStorage.getItem(positionKey));
            if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) place(p.x, p.y);
        } catch {}

        plane.onpointerdown = event => {
            if (!event.isPrimary || event.button !== 0) return;
            const rect = plane.getBoundingClientRect();
            dragged = false;
            drag = {
                id: event.pointerId, x: event.clientX, y: event.clientY,
                left: rect.left, top: rect.top
            };
            plane.setPointerCapture(event.pointerId);
        };
        plane.onpointermove = event => {
            if (!drag || drag.id !== event.pointerId) return;
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (!dragged && Math.hypot(dx, dy) < 8) return;
            dragged = true;
            place(drag.left + dx, drag.top + dy);
        };
        plane.onlostpointercapture = () => {
            if (dragged) {
                const rect = plane.getBoundingClientRect();
                try {
                    localStorage.setItem(positionKey, JSON.stringify({
                        x: rect.left, y: rect.top
                    }));
                } catch {}
            }
            drag = null;
        };
        window.addEventListener('resize', () => {
            if (plane.style.left) {
                place(parseFloat(plane.style.left), parseFloat(plane.style.top));
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
