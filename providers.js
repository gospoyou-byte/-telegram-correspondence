// Cherry Gram — подключения, картинки и перенос переписки

const cgPrefsKey = 'cherry-gram:providers:v1';
let cgPrefs = {};
try {
    cgPrefs = JSON.parse(localStorage.getItem(cgPrefsKey) || '{}') || {};
} catch {}

// Ключи вводятся в телефоне и живут до перезагрузки страницы.
const cgKeys = { text: '', image: '' };

const cgSettings = document.createElement('dialog');
cgSettings.setAttribute('aria-label', 'Подключения Cherry Gram');
cgSettings.innerHTML = `
    <header>
        <div style="flex:1"><strong>Подключения</strong></div>
        <button type="button" data-close aria-label="Закрыть настройки">×</button>
    </header>
    <section class="cg-settings-body">
        <fieldset>
            <legend>💬 Сообщения и посты</legend>
            <label>Кто пишет
                <select data-f="textMode">
                    <option value="tavern">Текущая модель Таверны</option>
                    <option value="profile">Профиль подключения Таверны</option>
                    <option value="api">Свой API · OpenAI-совместимый</option>
                </select>
            </label>
            <div data-group="profile">
                <label>Профиль подключения
                    <select data-f="profile"></select>
                </label>
            </div>
            <div data-group="textApi">
                <label>Адрес API до /v1
                    <input data-f="textBase" placeholder="https://твой-провайдер/v1">
                </label>
                <label>Название текстовой модели
                    <input data-f="textModel" placeholder="ID модели у провайдера">
                </label>
                <label>Ключ текстового API
                    <input data-key="text" type="password" autocomplete="off">
                </label>
            </div>
        </fieldset>

        <fieldset>
            <legend>🖼 Изображения</legend>
            <label>Кто рисует
                <select data-f="imageMode">
                    <option value="st">Генерация изображений Таверны</option>
                    <option value="api">Свой API · OpenAI-совместимый</option>
                </select>
            </label>
            <p data-group="stImage">Для официального NovelAI выбери
                NovelAI в настройках Image Generation самой Таверны.
                Там же указываются ключ NovelAI и модель рисования.</p>
            <div data-group="imageApi">
                <label>Адрес API до /v1
                    <input data-f="imageBase" placeholder="https://твой-провайдер/v1">
                </label>
                <label>Название модели для картинок
                    <input data-f="imageModel" placeholder="ID модели изображений">
                </label>
                <label>Ключ API изображений
                    <input data-key="image" type="password" autocomplete="off">
                </label>
            </div>
        </fieldset>

        <fieldset data-tools>
            <legend>Открытая переписка</legend>
            <label>Промпт картинки
                <textarea data-prompt rows="4"
                    placeholder="Опиши картинку или попроси модель составить промпт"></textarea>
            </label>
            <div class="cg-actions">
                <button type="button" data-action="prompt">✨ Составить промпт</button>
                <button type="button" data-action="image">🖼 Нарисовать</button>
                <button type="button" data-action="post">✍ Написать пост</button>
                <button type="button" data-action="transfer">↗ В ролевой чат</button>
            </div>
        </fieldset>
        <p data-status role="status"></p>
        <button type="button" data-save>Сохранить настройки</button>
    </section>
`;
const cgStyle = document.createElement('style');
cgStyle.textContent = `
    .cg-settings-body { overflow:auto; padding:12px; min-height:0 }
    .cg-settings-body fieldset {
        min-width:0; margin:0 0 14px; padding:12px;
        border:1px solid #765368; border-radius:14px;
    }
    .cg-settings-body legend { color:#ffbfdc; padding:0 5px }
    .cg-settings-body label { display:block; margin:7px 0 }
    .cg-settings-body input, .cg-settings-body select,
    .cg-settings-body textarea {
        display:block; box-sizing:border-box; width:100%; margin-top:4px;
        padding:9px; font:inherit; background:#291f2b; color:#fff1f8;
        border:1px solid #825b74; border-radius:10px;
    }
    .cg-settings-body p { font-size:13px; color:#e5c5d8 }
    .cg-actions { display:flex; flex-wrap:wrap; gap:6px }
    .bubble img { display:block; max-width:100%; max-height:320px;
        height:auto; margin-top:6px; border-radius:10px }
`;
ui.append(cgStyle, cgSettings);

const cgFind = selector => cgSettings.querySelector(selector);
const cgField = name => cgFind('[data-f="' + name + '"]');
const cgStatus = text => { cgFind('[data-status]').textContent = text; };
const cgPromptDrafts = new Map();
let cgToolBusy = false;
let cgToolsId = null;

function cgGroups() {
    const text = cgField('textMode').value;
    cgFind('[data-group="profile"]').hidden = text !== 'profile';
    cgFind('[data-group="textApi"]').hidden = text !== 'api';
    cgFind('[data-group="imageApi"]').hidden = cgField('imageMode').value !== 'api';
    cgFind('[data-group="stImage"]').hidden = cgField('imageMode').value !== 'st';
}

function cgReadSettings() {
    const next = {};
    for (const node of cgSettings.querySelectorAll('[data-f]')) {
        next[node.dataset.f] = node.value.trim();
    }
    localStorage.setItem(cgPrefsKey, JSON.stringify(next));
    cgPrefs = next;
    for (const node of cgSettings.querySelectorAll('[data-key]')) {
        cgKeys[node.dataset.key] = node.value.trim();
    }
}

function cgOpenSettings() {
    const ctx = context();
    const profiles = ctx?.extensionSettings?.connectionManager?.profiles || [];
    const select = cgField('profile');
    select.replaceChildren(new Option('Выбери профиль', ''));
    if (Array.isArray(profiles)) {
        for (const p of profiles) {
            if (p?.id) select.add(new Option(p.name || p.id, p.id));
        }
    }
    for (const node of cgSettings.querySelectorAll('[data-f]')) {
        const saved = cgPrefs[node.dataset.f];
        if (saved !== undefined) node.value = saved;
    }
    for (const node of cgSettings.querySelectorAll('[data-key]')) {
        node.value = cgKeys[node.dataset.key];
    }
    const room = currentRoom();
    cgToolsId = room?.id || null;
    cgFind('[data-tools]').hidden = !room;
    cgFind('[data-action="post"]').hidden = room?.type !== 'channel';
    cgFind('[data-prompt]').value = cgPromptDrafts.get(cgToolsId) || '';
    cgStatus('');
    cgGroups();
    cgSettings.showModal();
}

const cgGear = button('⚙', cgOpenSettings);
cgGear.title = 'Подключения, картинки и перенос';
cgGear.setAttribute('aria-label', cgGear.title);
get('#close').before(cgGear);
cgFind('[data-close]').onclick = () => cgSettings.close();
cgField('textMode').onchange = cgGroups;
cgField('imageMode').onchange = cgGroups;
cgFind('[data-prompt]').oninput = event => {
    cgPromptDrafts.set(cgToolsId, event.target.value);
};
cgFind('[data-save]').onclick = () => {
    try {
        cgReadSettings();
        cgSettings.close();
    } catch (err) {
        cgStatus(err.message);
    }
};

async function cgRequest(kind, path, body) {
    const base = cgPrefs[kind + 'Base'];
    if (!base) throw new Error('Укажи адрес API в настройках.');
    const url = new URL(base);
    if (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
        throw new Error('Используй HTTPS для подключения к провайдеру.');
    }
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') + '/' + path;
    const headers = { 'Content-Type': 'application/json' };
    if (cgKeys[kind]) headers.Authorization = 'Bearer ' + cgKeys[kind];

    let response;
    try {
        response = await fetch(url, {
            method: 'POST', headers, body: JSON.stringify(body),
            credentials: 'omit', redirect: 'error'
        });
    } catch {
        throw new Error('Браузер не смог обратиться к API. Проверь адрес и разрешение CORS у провайдера.');
    }
    if (!response.ok) {
        throw new Error('Провайдер вернул HTTP ' + response.status +
            '. Проверь ключ, модель и баланс.');
    }
    return response.json();
}

function cgHistory(room) {
    return room.messages.slice(-30).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.text || '')
    }));
}

async function cgText(room, instruction) {
    const ctx = context();
    const card = character(ctx);
    const scene = (ctx?.chat || []).slice(-8).map(m =>
        `${m.name || ''}: ${m.mes || ''}`
    ).join('\n');
    const description = room.avatar && room.avatar === card?.avatar
        ? card.description || '' : '';
    const messages = [
        { role: 'system', content: [
            `Открытая переписка: ${room.name}.`,
            description, scene && 'Контекст открытой сцены:\n' + scene
        ].filter(Boolean).join('\n') },
        ...cgHistory(room),
        { role: 'user', content: instruction }
    ];

    let result;
    if (cgPrefs.textMode === 'api') {
        if (!cgPrefs.textModel) throw new Error('Укажи название текстовой модели.');
        const answer = await cgRequest('text', 'chat/completions', {
            model: cgPrefs.textModel, messages, stream: false
        });
        result = answer.choices?.[0]?.message?.content;
    } else if (cgPrefs.textMode === 'profile') {
        const service = ctx?.ConnectionManagerRequestService;
        if (!cgPrefs.profile || typeof service?.sendRequest !== 'function') {
            throw new Error('Выбранный профиль подключения недоступен в этой сборке Таверны.');
        }
        const answer = await service.sendRequest(cgPrefs.profile, messages, 600);
        result = typeof answer === 'string' ? answer
            : answer?.content || answer?.choices?.[0]?.message?.content;
    } else {
        if (typeof ctx?.generateQuietPrompt !== 'function') {
            throw new Error('Открой персонажа и подключи текстовую модель в Таверне.');
        }
        result = await ctx.generateQuietPrompt({
            quietPrompt: messages.map(m => m.role + ': ' + m.content).join('\n')
        });
    }
    if (typeof result !== 'string' || !result.trim()) {
        throw new Error('Модель вернула пустой ответ.');
    }
    return result.trim();
}

function cgImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) {
        return value;
    }
    if (!/^(?:https?:\/\/|\/(?!\/)|user\/)/i.test(value)) return '';
    try {
        const url = new URL(value, location.origin + '/');
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
}

async function cgImage(promptText) {
    if (cgPrefs.imageMode === 'api') {
        if (!cgPrefs.imageModel) throw new Error('Укажи модель для картинок.');
        const answer = await cgRequest('image', 'images/generations', {
            model: cgPrefs.imageModel, prompt: promptText, n: 1
        });
        const first = answer.data?.[0];
        const src = cgImageUrl(first?.url) ||
            (first?.b64_json ? cgImageUrl('data:image/png;base64,' + first.b64_json) : '');
        if (!src) throw new Error('API вернул ответ без изображения в data[0].');
        return src;
    }

    const ctx = context();
    const commands = ctx?.SlashCommandParser?.commands;
    const command = commands?.imagine || commands?.sd;
    if (typeof command?.callback !== 'function') {
        throw new Error('Включи Image Generation в Таверне и выбери источник изображений.');
    }
    // Вызываем команду с текстом как аргументом, сохраняя символы промпта.
    const result = await command.callback({ quiet: 'true', raw: 'true' }, promptText);
    const src = cgImageUrl(result);
    if (!src) throw new Error('Таверна не вернула путь к картинке. Проверь источник и ключ в Image Generation.');
    return src;
}

// Картинки хранятся рядом с сообщениями той же переписки.
// Существующий render() создаёт пузырьки, сюда добавляется фото.
const cgObserver = new MutationObserver(() => {
    const room = currentRoom();
    if (!room) return;
    const bubbles = main.querySelectorAll('.bubble');
    room.messages.forEach((message, index) => {
        const bubble = bubbles[index];
        const src = cgImageUrl(message.image);
        if (!bubble || !src || bubble.querySelector('img')) return;
        const img = document.createElement('img');
        img.alt = message.text || 'Изображение в переписке';
        img.src = src;
        bubble.append(img);
    });
});
cgObserver.observe(main, { childList: true });

async function cgTransfer(room) {
    const ctx = context();
    if (!Array.isArray(ctx?.chat) || !ctx.chatId ||
        typeof ctx.addOneMessage !== 'function' ||
        typeof ctx.saveChat !== 'function') {
        throw new Error('Сначала открой ролевой чат, в который хочешь перенести переписку.');
    }
    if (!room.messages.length) throw new Error('В переписке пока пусто.');

    const chat = ctx.chat;
    const target = ctx.chatId;
    const marker = JSON.stringify([room.id, target]);
    const previous = chat.reduce((count, msg) =>
        msg.extra?.cherryGramSource === marker
            ? Math.max(count, Number(msg.extra.cherryGramCount) || 0)
            : count, 0);
    const fresh = room.messages.slice(previous);
    if (!fresh.length) {
        await ctx.saveChat();
        return 'Все сообщения уже перенесены в этот ролевой чат.';
    }
    const text = fresh.map(m => {
        const sender = m.role === 'assistant' ? room.name : ctx.name1 || 'Я';
        return sender + ': ' + m.text;
    }).join('\n');
    const message = {
        name: ctx.name1 || 'Я', is_user: true, is_system: false,
        send_date: new Date().toISOString(),
        mes: `Переписка Cherry Gram · ${room.name}\n\n${text}`,
        extra: { cherryGramSource: marker, cherryGramCount: room.messages.length }
    };
    chat.push(message);
    ctx.addOneMessage(message);
    await ctx.saveChat();
    return `Перенесено сообщений: ${fresh.length}.`;
}

async function cgTool(action) {
    if (cgToolBusy) return;
    const room = rooms.find(r => r.id === cgToolsId);
    if (!room) return;
    cgToolBusy = true;
    const controls = [...cgSettings.querySelectorAll('[data-action]')];
    controls.forEach(node => node.disabled = true);
    try {
        cgReadSettings();
        if (action === 'transfer') {
            cgStatus(await cgTransfer(room));
            return;
        }
        if (action === 'prompt') {
            cgStatus('Модель составляет промпт…');
            const text = await cgText(room,
                'Составь один английский промпт для картинки по этой переписке и сцене. Верни только промпт.');
            cgPromptDrafts.set(room.id, text);
            if (cgToolsId === room.id) cgFind('[data-prompt]').value = text;
            cgStatus('Промпт готов. Его можно поправить перед генерацией.');
            return;
        }
        if (action === 'post') {
            cgStatus('Модель пишет пост…');
            const text = await cgText(room,
                `Напиши следующую публикацию канала «${room.name}». Верни только текст поста.`);
            if (!appendMessage(room.id, 'assistant', text)) return;
        }
        if (action === 'image') {
            const text = cgFind('[data-prompt]').value.trim();
            if (!text) throw new Error('Введи промпт или нажми «Составить промпт».');
            cgStatus('Идёт генерация картинки…');
            const image = await cgImage(text);
            const msg = { text, image, role: 'assistant', at: Date.now() };
            if (!save(rooms.map(r => r.id === room.id
                ? { ...r, messages: [...r.messages, msg] } : r))) {
                // Даже при переполненном хранилище даём забрать результат.
                cgStatus('Картинка готова, но память браузера заполнена. Можно сохранить её отсюда.');
                const link = document.createElement('a');
                link.href = image;
                link.download = 'cherry-gram-image.png';
                link.target = '_blank';
                link.rel = 'noopener';
                link.textContent = ' Открыть картинку';
                cgFind('[data-status]').append(link);
                return;
            }
        }
        if (active === room.id) render();
        cgSettings.close();
    } catch (err) {
        cgStatus(err?.message || 'Не удалось выполнить запрос.');
    } finally {
        controls.forEach(node => node.disabled = false);
        cgToolBusy = false;
    }
}

for (const node of cgSettings.querySelectorAll('[data-action]')) {
    node.onclick = () => void cgTool(node.dataset.action);
}

async function reply(id) {
    if (!cgPrefs.textMode || cgPrefs.textMode === 'tavern') {
        return cgTavernReply(id);
    }
    const room = rooms.find(r => r.id === id);
    if (!room || pending.has(id)) return;
    pending.add(id);
    errors.delete(id);
    if (active === id) render();
    try {
        const text = await cgText(room,
            `Ответь на последнее сообщение от лица ${room.name} как в личной переписке. Верни только реплику.`);
        if (!appendMessage(id, 'assistant', text)) {
            throw new Error('Не удалось сохранить ответ.');
        }
    } catch (err) {
        errors.set(id, err?.message || 'Ошибка текстового подключения.');
    } finally {
        pending.delete(id);
        if (active === id) render();
    }
}

async function cgTavernReply(id) {
