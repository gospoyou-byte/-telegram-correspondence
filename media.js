export function installMedia({ ui, currentRoom, saveRoomMessage, render, context }) {
    if (ui.querySelector('#cg-paperclip')) return;

    const footer = ui.querySelector('footer');
    const main = ui.querySelector('main');
    const clip = document.createElement('button');
    clip.id = 'cg-paperclip';
    clip.textContent = '📎';
    clip.title = 'Фото, стикеры и генерация';
    clip.setAttribute('aria-label', clip.title);
    footer.prepend(clip);

    const panel = document.createElement('dialog');
    panel.setAttribute('aria-label', 'Фото и картинки');
    panel.innerHTML = `
        <header>
            <strong style="flex:1">Фото и картинки</strong>
            <button data-close aria-label="Закрыть">×</button>
        </header>
        <section class="media-body">
            <details>
                <summary>⚙ Подключения API</summary>
                <fieldset>
                    <legend>Модель, которая видит фото и отвечает</legend>
                    <label>Адрес API до /v1
                        <input name="visionBase" placeholder="https://мой-провайдер/v1">
                    </label>
                    <label>Название модели с поддержкой изображений
                        <input name="visionModel" placeholder="ID модели у провайдера">
                    </label>
                    <label>API-ключ
                        <input name="visionKey" type="password" autocomplete="off">
                    </label>
                </fieldset>
                <fieldset>
                    <legend>Модель, которая рисует</legend>
                    <label>Источник
                        <select name="source">
                            <option value="tavern">Image Generation в Таверне / NovelAI</option>
                            <option value="api">Свой API изображений</option>
                        </select>
                    </label>
                    <div data-image-api>
                        <label>Адрес API до /v1
                            <input name="imageBase" placeholder="https://мой-провайдер/v1">
                        </label>
                        <label>Название модели для рисования
                            <input name="imageModel">
                        </label>
                        <label>API-ключ для рисования
                            <input name="imageKey" type="password" autocomplete="off">
                        </label>
                    </div>
                </fieldset>
                <button data-action="settings">Сохранить настройки</button>
            </details>

            <fieldset>
                <legend>📎 Отправить боту фото</legend>
                <input name="photo" type="file" accept="image/jpeg,image/png,image/webp">
                <label>Сообщение к фото
                    <textarea name="caption" rows="2"
                        placeholder="Например: как тебе мой наряд?"></textarea>
                </label>
                <button data-action="photo">Отправить фото и получить ответ</button>
            </fieldset>

            <fieldset>
                <legend>🎨 Картинка от персонажа</legend>
                <label>Промпт
                    <textarea name="prompt" rows="3"
                        placeholder="Напиши, что нарисовать, или составь промпт по переписке"></textarea>
                </label>
                <button data-action="prompt">✨ Составить промпт</button>
                <button data-action="draw">🖼 Нарисовать и прислать</button>
            </fieldset>

            <fieldset>
                <legend>💌 Реакция персонажа</legend>
                <button data-action="sticker">Прислать мемный стикер по переписке</button>
            </fieldset>

            <p data-status role="status" aria-live="polite"></p>
        </section>
    `;

    const style = document.createElement('style');
    style.textContent = `
        .media-body { overflow:auto; min-height:0; padding:12px; }
        .media-body summary { cursor:pointer; color:#ffc5e1; padding:6px; }
        .media-body fieldset {
            min-width:0; margin:12px 0; padding:12px;
            border:1px solid #79556e; border-radius:15px;
        }
        .media-body legend { color:#ffc5e1; }
        .media-body label { display:block; margin:8px 0; }
        .media-body input, .media-body select, .media-body textarea {
            display:block; width:100%; min-width:0; margin:4px 0 8px;
            padding:8px; background:#291f2b; color:#fff0f7; font:inherit;
            border:1px solid #825b74; border-radius:10px;
        }
        .media-body button { margin:3px 0; }
        .media-body [data-status] { color:#ffd4e7; overflow-wrap:anywhere; }
        .bubble img.cg-media-photo {
            display:block; max-width:100%; max-height:260px;
            margin:5px 0; border-radius:10px; object-fit:contain;
        }
    `;
    ui.append(style, panel);

    const field = name => panel.querySelector(`[name="${name}"]`);
    const status = text => {
        panel.querySelector('[data-status]').textContent = text;
    };
    const settingsKey = 'cherry-gram:media-settings:v1';
    const publicFields = ['visionBase', 'visionModel', 'source', 'imageBase', 'imageModel'];
    try {
        const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
        for (const name of publicFields) {
            if (typeof saved[name] === 'string') field(name).value = saved[name];
        }
    } catch {}

    function updateSource() {
        panel.querySelector('[data-image-api]').hidden = field('source').value !== 'api';
    }
    field('source').onchange = updateSource;
    updateSource();

    function persistSettings() {
        const data = {};
        for (const name of publicFields) data[name] = field(name).value.trim();
        localStorage.setItem(settingsKey, JSON.stringify(data));
    }

    let roomId;
    let busy = false;
    const prompts = new Map();
    clip.onclick = () => {
        const room = currentRoom();
        if (!room) return;
        if (roomId !== room.id) {
            field('photo').value = '';
            field('caption').value = '';
        }
        roomId = room.id;
        field('prompt').value = prompts.get(roomId) || '';
        status('');
        panel.showModal();
    };
    field('prompt').oninput = () => prompts.set(roomId, field('prompt').value);
    panel.querySelector('[data-close]').onclick = () => {
        if (!busy) panel.close();
    };
    panel.addEventListener('cancel', e => { if (busy) e.preventDefault(); });

    // Рисуем вложения после каждого обновления списка сообщений.
    function showPhotos() {
        const room = currentRoom();
        if (!room) return;
        const bubbles = main.querySelectorAll('.bubble');
        room.messages.forEach((message, i) => {
            const bubble = bubbles[i];
            if (!message.mediaSrc || !bubble || bubble.querySelector('.cg-media-photo')) return;
            const img = document.createElement('img');
            img.className = 'cg-media-photo';
            img.alt = message.mediaAlt || 'Фото';
            img.src = safeImage(message.mediaSrc);
            bubble.insertBefore(img, bubble.querySelector('time'));
        });
    }
    new MutationObserver(showPhotos).observe(main, { childList: true });

    function safeImage(value) {
        if (typeof value !== 'string') throw new Error('Провайдер не вернул картинку.');
        if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(value)) {
            return value;
        }
        if (!/^(?:https?:\/\/|\/(?!\/)|user\/)/i.test(value)) {
            throw new Error('Неизвестный формат адреса картинки.');
        }
        const url = new URL(value, location.origin + '/');
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Некорректный адрес картинки.');
        return url.href;
    }

    async function request(kind, path, body) {
        const base = field(kind + 'Base').value.trim();
        if (!base) throw new Error('Открой «Подключения API» и введи адрес провайдера.');
        const url = new URL(base);
        if (url.protocol !== 'https:' &&
            !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
            throw new Error('Для внешнего API нужен HTTPS.');
        }
        url.pathname = url.pathname.replace(/\/+$/, '') + '/' + path;
        url.search = '';
        url.hash = '';
        const key = field(kind + 'Key').value.trim();
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers.Authorization = 'Bearer ' + key;
        let res;
        try {
            res = await fetch(url, {
                method: 'POST', headers, body: JSON.stringify(body),
                credentials: 'omit', redirect: 'error'
            });
        } catch {
            throw new Error('Не удалось связаться с API. Проверь адрес и поддержку запросов из браузера (CORS).');
        }
        if (!res.ok) throw new Error(`API вернул HTTP ${res.status}. Проверь ключ, модель и баланс.`);
        return res.json();
    }

    function history(room) {
        return room.messages.slice(-14).map(m =>
            `${m.role === 'assistant' ? room.name : 'Пользователь'}: ${m.text || '[картинка]'}`
        ).join('\n');
    }

    async function ask(room, instruction, image) {
        const model = field('visionModel').value.trim();
        const ctx = context();
        const card = ctx?.characters?.[ctx.characterId];
        const description = room.avatar && room.avatar === card?.avatar ? card.description : '';
        const system = [
            `Ты ${room.name}. Это личная переписка в Cherry Gram.`,
            description, history(room)
        ].filter(Boolean).join('\n');
        let result;
        if (model) {
            const content = image ? [
                { type: 'text', text: instruction },
                { type: 'image_url', image_url: { url: image } }
            ] : instruction;
            const data = await request('vision', 'chat/completions', {
                model, stream: false,
                messages: [{ role: 'system', content: system }, { role: 'user', content }]
            });
            result = data.choices?.[0]?.message?.content;
        } else {
            if (image) throw new Error('В «Подключения API» укажи модель, которая умеет видеть фото.');
            if (typeof ctx?.generateQuietPrompt !== 'function') {
                throw new Error('Подключи текстовую модель в Таверне или укажи API в настройках.');
            }
            result = await ctx.generateQuietPrompt({ quietPrompt: system + '\n' + instruction });
        }
        if (typeof result !== 'string' || !result.trim()) throw new Error('Модель вернула пустой ответ.');
        return result.trim();
    }

    async function resizePhoto(file) {
        const bitmap = await createImageBitmap(file);
        try {
            const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const g = canvas.getContext('2d');
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, canvas.width, canvas.height);
            g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.78);
        } finally {
            bitmap.close();
        }
    }

    async function draw(prompt) {
        if (field('source').value === 'api') {
            const model = field('imageModel').value.trim();
            if (!model) throw new Error('Введи название модели для рисования.');
            const data = await request('image', 'images/generations', { model, prompt, n: 1 });
            const item = data.data?.[0];
            if (item?.b64_json) {
                const bytes = Uint8Array.from(atob(item.b64_json), c => c.charCodeAt(0));
                return resizePhoto(new Blob([bytes]));
            }
            return safeImage(item?.url);
        }
        const commands = context()?.SlashCommandParser?.commands;
        const command = commands?.imagine || commands?.sd;
        if (typeof command?.callback !== 'function') {
            throw new Error('Не найдена команда Image Generation. Включи расширение генерации в Таверне.');
        }
        return safeImage(await command.callback({ quiet: 'true', raw: 'true' }, prompt));
    }

    // Небольшой набор стикеров. Модель выбирает реакцию по смыслу.
    const stickers = [
        ['😼', 'Я всё видел'],
        ['🥹', 'Это мне?'],
        ['😳', 'Так, стоп'],
        ['💅', 'Без комментариев'],
        ['😭', 'Всё, я лужа'],
        ['👀', 'Продолжай…']
    ];

    function stickerImage(index) {
        const [face, label] = stickers[index];
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 220;
        const g = canvas.getContext('2d');
        g.fillStyle = '#623e58';
        g.fillRect(0, 0, 320, 220);
        g.textAlign = 'center';
        g.font = '90px system-ui';
        g.fillText(face, 160, 120);
        g.fillStyle = '#fff0f7';
        g.font = 'bold 26px system-ui';
        g.fillText(label, 160, 180, 304);
        return canvas.toDataURL('image/png');
    }

    async function chooseSticker(room) {
        const choices = stickers.map(([face, label], i) => `${i + 1}. ${face} ${label}`).join('\n');
        const answer = await ask(room, `Выбери стикер в ответ на переписку. Верни только номер.\n${choices}`);
        const match = answer.match(/^\s*([1-6])(?:[.)!])?\s*$/);
        if (!match) throw new Error('Модель не выбрала номер стикера. Попробуй ещё раз.');
        return Number(match[1]) - 1;
    }

    function add(id, messages) {
        const now = Date.now();
        if (!saveRoomMessage(id, messages.map(m => ({ ...m, at: now })))) {
            throw new Error('Переписка не сохранилась. Проверь свободное место в браузере.');
        }
        if (currentRoom()?.id === id) render();
    }

    async function run(action) {
        if (busy) return;
        const room = currentRoom();
        if (!room || room.id !== roomId) return;
        busy = true;
        const controls = [...panel.querySelectorAll('button,input,select,textarea')];
        controls.forEach(node => node.disabled = true);
        try {
            persistSettings();
            if (action === 'settings') {
                status('Настройки сохранены. Ключи действуют до перезагрузки страницы.');
                return;
            }
            if (action === 'prompt') {
                status('Модель составляет промпт…');
                const prompt = await ask(room, 'Составь один английский промпт для иллюстрации по последним сообщениям. Верни только описание для художника.');
                field('prompt').value = prompt;
                prompts.set(room.id, prompt);
                status('Промпт готов. Его можно изменить и нажать «Нарисовать и прислать».');
                return;
            }
            if (action === 'draw') {
                const prompt = field('prompt').value.trim();
                if (!prompt) throw new Error('Напиши промпт или нажми «Составить промпт».');
                status('Генерируется картинка…');
                const src = await draw(prompt);
                add(room.id, [{ role: 'assistant', text: prompt, mediaSrc: src, mediaAlt: prompt }]);
            }
            if (action === 'sticker') {
                status('Персонаж выбирает стикер…');
                const i = await chooseSticker(room);
                add(room.id, [{
                    role: 'assistant', text: '', mediaSrc: stickerImage(i), mediaAlt: stickers[i][1]
                }]);
            }
            if (action === 'photo') {
                const file = field('photo').files[0];
                if (!file) throw new Error('Сначала выбери фото из галереи.');
                const caption = field('caption').value.trim() || 'Что думаешь об этом фото?';
                status('Персонаж смотрит фото…');
                const src = await resizePhoto(file);
                const choices = stickers.map(([, label], i) => `${i + 1}=${label}`).join(', ');
                const answer = await ask(room, [
                    caption,
                    'Ответь на сообщение и приложенное фото от лица персонажа.',
                    `Если подходит мемная реакция, допиши в конце [стикер:N]. Варианты: ${choices}.`
                ].join('\n'), src);
                const match = answer.match(/\[стикер:\s*([1-6])\]\s*$/i);
                const messages = [{ role: 'user', text: caption, mediaSrc: src, mediaAlt: caption }];
                const text = match ? answer.slice(0, match.index).trim() : answer;
                if (text) messages.push({ role: 'assistant', text });
                if (match) {
                    const i = Number(match[1]) - 1;
                    messages.push({
                        role: 'assistant', text: '', mediaSrc: stickerImage(i), mediaAlt: stickers[i][1]
                    });
                }
                add(room.id, messages);
                field('photo').value = '';
                field('caption').value = '';
            }
            panel.close();
        } catch (error) {
            status(error?.message || 'Не удалось выполнить запрос.');
        } finally {
            controls.forEach(node => node.disabled = false);
            busy = false;
        }
    }
    for (const node of panel.querySelectorAll('[data-action]')) {
        node.onclick = () => void run(node.dataset.action);
    }
}
