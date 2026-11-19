// ==UserScript==
// @name         Cherry Gram — фото, стикеры и картинки
// @namespace    cherry-gram-media
// @version      1.0.0
// @description  Кнопка изображений в переписках Cherry Gram для SillyTavern
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const hostId = 'cherry-gram-messenger';
    const settingsKey = 'cherry-media:settings:1';
    const libraryKey = 'cherry-gram:library:v1';

    function start(host) {
        const root = host.shadowRoot;
        const chat = root?.querySelector('dialog');
        const footer = chat?.querySelector('footer');
        const list = chat?.querySelector('main');
        if (!footer || !list) return false;
        if (footer.querySelector('[data-cherry-camera]')) return true;

        const camera = document.createElement('button');
        camera.type = 'button';
        camera.dataset.cherryCamera = '1';
        camera.textContent = '📷';
        camera.title = 'Фото, стикеры и картинки';
        camera.setAttribute('aria-label', camera.title);
        footer.prepend(camera);

        const panel = document.createElement('dialog');
        panel.setAttribute('aria-label', 'Фото и картинки');
        panel.innerHTML = `
          <header>
            <strong style="flex:1">Фото и картинки</strong>
            <button data-close aria-label="Закрыть">×</button>
          </header>
          <section class="cherry-media-body">
            <details>
              <summary>⚙ Подключения и модели</summary>
              <fieldset>
                <legend>Кто смотрит фото и отвечает</legend>
                <label>Адрес API до /v1
                  <input name="visionBase" placeholder="https://твой-провайдер/v1">
                </label>
                <label>Имя модели с поддержкой фотографий
                  <input name="visionModel" placeholder="Точный ID модели">
                </label>
                <label>Ключ API
                  <input name="visionKey" type="password" autocomplete="off">
                </label>
              </fieldset>
              <fieldset>
                <legend>Кто рисует</legend>
                <select name="source" aria-label="Источник изображений">
                  <option value="st">Image Generation Таверны / NovelAI</option>
                  <option value="api">Мой API для картинок</option>
                </select>
                <div data-image-fields hidden>
                  <label>Адрес API до /v1 <input name="imageBase"></label>
                  <label>Имя модели изображений <input name="imageModel"></label>
                  <label>Ключ API
                    <input name="imageKey" type="password" autocomplete="off">
                  </label>
                </div>
              </fieldset>
              <button data-action="save">Сохранить настройки</button>
            </details>

            <fieldset>
              <legend>📷 Отправить фото персонажу</legend>
              <input name="file" type="file" accept="image/jpeg,image/png,image/webp">
              <textarea name="caption" rows="2" placeholder="Что написать к фото?"></textarea>
              <button data-action="photo">Отправить и получить ответ</button>
            </fieldset>

            <fieldset>
              <legend>🎨 Картинка от персонажа</legend>
              <textarea name="prompt" rows="3" placeholder="Что нарисовать?"></textarea>
              <button data-action="prompt">Составить промпт по переписке</button>
              <button data-action="draw">Нарисовать и прислать</button>
            </fieldset>

            <button data-action="sticker">💌 Попросить мемный стикер</button>
            <p data-status role="status" aria-live="polite"></p>
          </section>`;

        const style = document.createElement('style');
        style.textContent = `
          .cherry-media-body {overflow:auto; min-height:0; padding:12px}
          .cherry-media-body summary {cursor:pointer; color:#ffc6df}
          .cherry-media-body fieldset {
            min-width:0; margin:12px 0; padding:12px;
            border:1px solid #865c75; border-radius:14px
          }
          .cherry-media-body label {display:block; margin:8px 0}
          .cherry-media-body input, .cherry-media-body textarea,
          .cherry-media-body select {
            width:100%; display:block; padding:8px; margin:5px 0;
            font:inherit; background:#291e29; color:#ffeef6;
            border:1px solid #865c75; border-radius:10px
          }
          .cherry-media-body button {margin:4px 0}
          .cherry-media-body [data-status] {color:#ffc6df}
          .cherry-media-feed {
            max-height:32%; overflow:auto; flex-shrink:0;
            padding:0 10px; border-top:1px solid #654658
          }
          .cherry-media-feed img {
            display:block; max-width:100%; max-height:210px;
            object-fit:contain; border-radius:10px; margin:5px 0
          }
          .cherry-media-feed .sticker-face {font-size:52px; text-align:center}
        `;
        root.append(style, panel);

        const feed = document.createElement('section');
        feed.className = 'cherry-media-feed';
        feed.setAttribute('aria-label', 'Фото и ответы в этой переписке');
        feed.hidden = true;
        footer.before(feed);

        const field = name => panel.querySelector(`[name="${name}"]`);
        const status = text => { panel.querySelector('[data-status]').textContent = text; };
        const settings = ['visionBase', 'visionModel', 'source', 'imageBase', 'imageModel'];
        try {
            const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
            for (const name of settings) {
                if (typeof saved[name] === 'string') field(name).value = saved[name];
            }
        } catch {}
        function updateSource() {
            panel.querySelector('[data-image-fields]').hidden = field('source').value !== 'api';
        }
        field('source').onchange = updateSource;
        updateSource();

        function saveSettings() {
            const values = Object.fromEntries(settings.map(name => [name, field(name).value.trim()]));
            localStorage.setItem(settingsKey, JSON.stringify(values));
        }

        // Фотографии храним в IndexedDB отдельно для каждой переписки.
        let dbPromise;
        function database() {
            if (!dbPromise) {
                dbPromise = new Promise((resolve, reject) => {
                    const open = indexedDB.open('cherry-gram-media-album', 1);
                    open.onupgradeneeded = () => {
                        const store = open.result.createObjectStore('messages', {
                            keyPath: 'id', autoIncrement: true
                        });
                        store.createIndex('room', 'room');
                    };
                    open.onsuccess = () => resolve(open.result);
                    open.onerror = () => reject(open.error);
                }).catch(error => { dbPromise = null; throw error; });
            }
            return dbPromise;
        }
        async function album(id) {
            const db = await database();
            return new Promise((resolve, reject) => {
                const req = db.transaction('messages').objectStore('messages')
                    .index('room').getAll(id);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
        async function add(id, messages) {
            const db = await database();
            await new Promise((resolve, reject) => {
                const tx = db.transaction('messages', 'readwrite');
                for (const message of messages) {
                    tx.objectStore('messages').add({ ...message, room: id, at: Date.now() });
                }
                tx.oncomplete = resolve;
                tx.onabort = () => reject(tx.error || new Error('Не удалось сохранить фото.'));
            });
        }

        let selectedId;
        function rooms() { return JSON.parse(localStorage.getItem(libraryKey) || '[]'); }
        chat.addEventListener('click', event => {
            const row = event.target.closest?.('.room');
            if (row) {
                const index = [...list.querySelectorAll('.room')].indexOf(row);
                const tab = chat.querySelector('nav [aria-pressed="true"]')?.textContent;
                const type = tab === 'Каналы' ? 'channel' : 'chat';
                selectedId = rooms().filter(r => r.type === type)[index]?.id;
            } else if (event.target.closest?.('nav button,#back')) {
                selectedId = undefined;
            }
        }, true);

        function currentRoom() {
            if (footer.hidden) return null;
            const name = chat.querySelector('#title')?.textContent;
            const matches = rooms().filter(r => r.name === name);
            return matches.find(r => r.id === selectedId) ||
                (matches.length === 1 ? matches[0] : null);
        }

        let view = 0;
        async function refresh() {
            const token = ++view;
            const room = currentRoom();
            feed.hidden = true;
            feed.replaceChildren();
            if (!room) return;
            const messages = await album(room.id);
            if (view !== token) return;
            for (const m of messages) {
                const bubble = document.createElement('div');
                bubble.className = m.mine ? 'bubble mine' : 'bubble';
                if (m.face) {
                    const face = document.createElement('div');
                    face.className = 'sticker-face';
                    face.textContent = m.face;
                    bubble.append(face);
                }
                if (m.image) {
                    const img = document.createElement('img');
                    img.alt = m.text || 'Фото в переписке';
                    img.src = m.image;
                    bubble.append(img);
                }
                bubble.append(document.createTextNode(m.text || ''));
                feed.append(bubble);
            }
            feed.hidden = !messages.length;
            feed.scrollTop = feed.scrollHeight;
        }
        const redraw = () => refresh().catch(error => console.error('[Cherry Media]', error));
        new MutationObserver(redraw).observe(list, { childList: true });
        redraw();

        async function api(group, path, data) {
            const base = field(group + 'Base').value.trim();
            if (!base) throw new Error('Открой «Подключения и модели» и укажи адрес API.');
            const url = new URL(base);
            if (url.protocol !== 'https:' &&
                !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) {
                throw new Error('Для внешнего провайдера нужен адрес https://');
            }
            url.pathname = url.pathname.replace(/\/+$/, '') + '/' + path;
            url.search = '';
            url.hash = '';
            const headers = { 'Content-Type': 'application/json' };
            const key = field(group + 'Key').value.trim();
            if (key) headers.Authorization = 'Bearer ' + key;

            let res;
            try {
                res = await fetch(url, {
                    method:'POST', headers, body:JSON.stringify(data),
                    credentials:'omit', redirect:'error'
                });
            } catch {
                throw new Error('Браузер не смог подключиться. Проверь адрес API и доступ через CORS.');
            }
            if (!res.ok) throw new Error(`Провайдер вернул HTTP ${res.status}. Проверь ключ и название модели.`);
            return res.json();
        }

        async function ask(room, request, photo) {
            const model = field('visionModel').value.trim();
            const ctx = window.SillyTavern?.getContext?.();
            const media = await album(room.id);
            const history = [
                ...room.messages.map(m => ({ ...m, mine:m.role !== 'assistant' })),
                ...media
            ].sort((a,b) => a.at - b.at).slice(-20)
                .map(m => `${m.mine ? 'Я' : room.name}: ${m.text || '[фото]'}`).join('\n');
            const card = ctx?.characters?.[ctx.characterId];
            const persona = room.avatar && card?.avatar === room.avatar ? card.description : '';
            const system = `Ты ${room.name}. Ответь в стиле личной переписки.\n${persona || ''}\n${history}`;
            let result;
            if (model) {
                const content = photo ? [
                    { type:'text', text:request },
                    { type:'image_url', image_url:{ url:photo } }
                ] : request;
                const data = await api('vision', 'chat/completions', {
                    model, stream:false,
                    messages:[{ role:'system', content:system }, { role:'user', content }]
                });
                result = data.choices?.[0]?.message?.content;
            } else {
                if (photo) throw new Error('Для фото укажи в настройках API и модель с поддержкой зрения.');
                if (!ctx?.generateQuietPrompt) throw new Error('Подключи текстовую модель в Таверне или укажи свой API.');
                result = await ctx.generateQuietPrompt({ quietPrompt:system + '\n' + request });
            }
            if (typeof result !== 'string' || !result.trim()) throw new Error('Модель прислала пустой ответ.');
            return result.trim();
        }

        async function photoData(file) {
            const bitmap = await createImageBitmap(file);
            try {
                const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                const g = canvas.getContext('2d');
                g.fillStyle = 'white';
                g.fillRect(0, 0, canvas.width, canvas.height);
                g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                return canvas.toDataURL('image/jpeg', 0.83);
            } finally { bitmap.close(); }
        }

        async function draw(prompt) {
            let value;
            if (field('source').value === 'api') {
                const model = field('imageModel').value.trim();
                if (!model) throw new Error('Введи имя модели для рисования.');
                const result = await api('image', 'images/generations', { model, prompt, n:1 });
                const item = result.data?.[0];
                value = item?.b64_json ? 'data:image/png;base64,' + item.b64_json : item?.url;
            } else {
                const ctx = window.SillyTavern?.getContext?.();
                const commands = ctx?.SlashCommandParser?.commands;
                const command = commands?.imagine || commands?.sd;
                if (!command?.callback) throw new Error('Включи Image Generation в Таверне и выбери источник изображений.');
                value = await command.callback({ quiet:'true', raw:'true' }, prompt);
            }
            if (typeof value !== 'string' || !value.trim()) throw new Error('Источник не вернул картинку.');
            if (/^data:image\/(jpeg|png|webp);base64,/i.test(value)) return value;
            if (!/^(https?:\/\/|\/(?!\/)|user\/)/i.test(value)) throw new Error('Неизвестный формат ответа генератора.');
            return new URL(value, location.origin + '/').href;
        }

        const stickers = [
            ['👀','Я весь внимание'], ['😼','Так и было задумано'],
            ['🥺','Это мне?'], ['😭','Всё, я лужа'],
            ['💅','Без комментариев'], ['😳','Так, стоп']
        ];
        function sticker(index) {
            return { face:stickers[index][0], text:stickers[index][1] };
        }

        let busy = false;
        let openedRoom;
        camera.onclick = () => {
            const room = currentRoom();
            if (!room) {
                window.alert('Вернись к списку Cherry Gram и нажми на строку нужной переписки.');
                return;
            }
            if (openedRoom !== room.id) {
                field('file').value = '';
                field('caption').value = '';
                field('prompt').value = '';
            }
            openedRoom = room.id;
            status('');
            panel.showModal();
        };
        panel.querySelector('[data-close]').onclick = () => panel.close();
        panel.addEventListener('cancel', e => { if (busy) e.preventDefault(); });

        async function run(action) {
            if (busy) return;
            const room = currentRoom();
            if (!room || room.id !== openedRoom) return;
            busy = true;
            const controls = [...panel.querySelectorAll('button,input,textarea,select')];
            controls.forEach(el => el.disabled = true);
            try {
                saveSettings();
                if (action === 'save') {
                    status('Настройки сохранены. Ключи действуют до перезагрузки страницы.');
                    return;
                }
                if (action === 'prompt') {
                    status('Персонаж составляет промпт…');
                    field('prompt').value = await ask(room, 'Составь по нашей переписке один английский промпт для картинки. Верни только промпт.');
                    status('Промпт готов. Его можно поправить перед рисованием.');
                    return;
                }
                if (action === 'draw') {
                    const prompt = field('prompt').value.trim();
                    if (!prompt) throw new Error('Напиши промпт или нажми «Составить промпт».');
                    status('Рисую…');
                    await add(room.id, [{ image:await draw(prompt), text:prompt }]);
                }
                const options = stickers.map((s,i) => `${i + 1} — ${s[1]}`).join('\n');
                if (action === 'sticker') {
                    status('Персонаж выбирает стикер…');
                    const reply = await ask(room, `Выбери реакцию на последнее сообщение. Верни одну цифру.\n${options}`);
                    const match = reply.match(/^\s*([1-6])[.!]?\s*$/);
                    if (!match) throw new Error('Модель не выбрала стикер. Попробуй ещё раз.');
                    await add(room.id, [sticker(Number(match[1]) - 1)]);
                }
                if (action === 'photo') {
                    const file = field('file').files[0];
                    if (!file) throw new Error('Выбери фотографию из галереи.');
                    const caption = field('caption').value.trim() || 'Что думаешь об этом фото?';
                    status('Персонаж смотрит фотографию…');
                    const image = await photoData(file);
                    const reply = await ask(room,
                        `${caption}\nОтветь на фото. При желании добавь в конце [стикер:N], выбрав номер:\n${options}`, image);
                    const mark = reply.match(/\[стикер:\s*([1-6])\]\s*$/i);
                    const text = mark ? reply.slice(0, mark.index).trim() : reply;
                    const messages = [{ mine:true, image, text:caption }];
                    if (text) messages.push({ text });
                    if (mark) messages.push(sticker(Number(mark[1]) - 1));
                    await add(room.id, messages);
                    field('file').value = '';
                    field('caption').value = '';
                }
                await refresh();
                panel.close();
            } catch (error) {
                status(error?.message || 'Запрос не выполнен.');
            } finally {
                controls.forEach(el => el.disabled = false);
                busy = false;
            }
        }
        for (const btn of panel.querySelectorAll('[data-action]')) {
            btn.onclick = () => void run(btn.dataset.action);
        }
        return true;
    }

    function mount() {
        const host = document.getElementById(hostId);
        return host && start(host);
    }
    if (!mount()) {
        const observer = new MutationObserver(() => {
            if (mount()) observer.disconnect();
        });
        observer.observe(document.body, { childList:true });
    }
})();
