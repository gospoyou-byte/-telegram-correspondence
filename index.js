jQuery(() => {
    'use strict';

    if (document.getElementById('cg-btn')) return;

    const DATA = 'cherry-gram:library:v1';
    const POS = 'cherry-gram:button:v1';
    const title = 'Cherry Gram ♡';
    let current = null;
    let tab = 'chat';

    function read(key, fallback) {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    }

    let rooms;
    try {
        rooms = read(DATA, []);
        if (!Array.isArray(rooms)) throw new Error('Некорректный список чатов');
    } catch (err) {
        console.error('[Cherry Gram]', err);
        window.toastr?.error('Не удалось прочитать переписки Cherry Gram. Данные не изменены.');
        return;
    }

    // Сначала сохраняем изменение. Если память закончилась,
    // окно не показывает сообщение как успешно отправленное.
    function save(next) {
        try {
            localStorage.setItem(DATA, JSON.stringify(next));
            rooms = next;
            return true;
        } catch (err) {
            console.error('[Cherry Gram]', err);
            window.alert('Не удалось сохранить. Проверь свободное место и доступ к хранилищу браузера.');
            return false;
        }
    }

    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function button(label, action, cls = 'cg-icon-btn') {
        const b = el('button', cls, label);
        b.type = 'button';
        b.addEventListener('click', action);
        return b;
    }

    const fab = el('button');
    fab.id = 'cg-btn';
    fab.type = 'button';
    fab.title = 'Открыть Cherry Gram • потяни, чтобы переместить';
    fab.setAttribute('aria-label', 'Открыть Cherry Gram');
    fab.setAttribute('aria-expanded', 'false');
    fab.style.touchAction = 'none';
    fab.style.zIndex = '100010';

    // Бумажный самолётик, а не системный эмодзи большого самолёта.
    fab.innerHTML = `<svg aria-hidden="true" width="28" height="28"
        viewBox="0 0 24 24" fill="white" style="pointer-events:none">
        <path d="M21.7 3.3 18.4 20c-.2 1-1 1.2-1.8.6l-5-3.7-2.4 2.3
        c-.3.3-.5.5-1 .5l.4-5.1L18 6.2c.4-.4-.1-.5-.6-.2L5.8 13.3
        1 11.8c-1-.3-1-1 .2-1.5L20.4 2.9c.9-.3 1.5.2 1.3.4Z"/>
    </svg>`;

    const overlay = el('div', 'cg-overlay cg-hidden');
    overlay.style.zIndex = '100011';
    const phone = el('section', 'cg-phone');
    phone.setAttribute('role', 'dialog');
    phone.setAttribute('aria-modal', 'true');
    phone.setAttribute('aria-label', title);
    phone.style.maxWidth = '96vw';
    phone.style.maxHeight = '92dvh';
    phone.style.color = 'var(--cg-text)';
    phone.style.fontFamily = 'var(--cg-font)';

    const header = el('header', 'cg-header');
    const content = el('div', 'cg-content');
    const footer = el('div');
    content.style.minHeight = '0';
    phone.append(header, content, footer);
    overlay.append(phone);
    document.body.append(fab, overlay);

    function close() {
        overlay.classList.add('cg-hidden');
        fab.setAttribute('aria-expanded', 'false');
        fab.focus();
    }

    function open() {
        render();
        overlay.classList.remove('cg-hidden');
        fab.setAttribute('aria-expanded', 'true');
        header.querySelector('button')?.focus();
    }

    overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
    });

    overlay.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
        if (e.key === 'Tab') {
            const all = [...phone.querySelectorAll('button, input, textarea')];
            const first = all[0], last = all[all.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        }
    });

    // Порог движения отличает касание от перетаскивания на телефоне.
    let drag = null;
    let wasDragged = false;

    function place(x, y) {
        const left = Math.max(0, Math.min(x, innerWidth - fab.offsetWidth));
        const top = Math.max(0, Math.min(y, innerHeight - fab.offsetHeight));
        Object.assign(fab.style, {
            left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto'
        });
        return { x: left, y: top };
    }

    try {
        const p = read(POS, null);
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) place(p.x, p.y);
    } catch { /* Без сохранённой позиции используем положение из CSS. */ }

    fab.addEventListener('pointerdown', e => {
        if (!e.isPrimary || e.button !== 0) return;
        const rect = fab.getBoundingClientRect();
        wasDragged = false;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY,
            left: rect.left, top: rect.top };
        fab.setPointerCapture(e.pointerId);
    });

    fab.addEventListener('pointermove', e => {
        if (!drag || drag.id !== e.pointerId) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!wasDragged && Math.hypot(dx, dy) < 7) return;
        wasDragged = true;
        drag.pos = place(drag.left + dx, drag.top + dy);
    });

    function release(e) {
        if (!drag || drag.id !== e.pointerId) return;
        if (drag.pos) {
            try { localStorage.setItem(POS, JSON.stringify(drag.pos)); } catch {}
        }
        drag = null;
    }

    fab.addEventListener('pointerup', release);
    fab.addEventListener('pointercancel', release);
    fab.addEventListener('click', e => {
        if (wasDragged && e.detail !== 0) {
            wasDragged = false;
            return;
        }
        open();
    });

    window.addEventListener('resize', () => {
        if (fab.style.left) place(parseFloat(fab.style.left), parseFloat(fab.style.top));
    });

    function createRoom() {
        const name = window.prompt(tab === 'chat'
            ? 'С кем будет переписка? Введи имя.'
            : 'Как называется твой канал?')?.trim();
        if (!name) return;
        const room = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: tab, name, messages: []
        };
        if (save([...rooms, room])) {
            current = room.id;
            render();
        }
    }

    function render() {
        header.replaceChildren();
        content.replaceChildren();
        footer.replaceChildren();

        const room = rooms.find(r => r.id === current);
        if (room) {
            const back = button('‹', () => { current = null; render(); });
            back.setAttribute('aria-label', 'Назад к списку');
            header.append(back);
        }

        const info = el('div', 'cg-header-center');
        const labels = el('div', 'cg-header-info');
        labels.append(
            el('h2', 'cg-header-title', room ? room.name : title),
            el('div', 'cg-header-subtitle', room
                ? (room.type === 'chat' ? 'Личная переписка' : 'Канал')
                : 'Твой ролевой мессенджер')
        );
        info.append(labels);
        const exit = button('×', close);
        exit.setAttribute('aria-label', 'Закрыть Cherry Gram');
        header.append(info, exit);

        if (!room) {
            const nav = el('div', 'cg-header');
            for (const [key, label] of [['chat', 'Чаты'], ['channel', 'Каналы']]) {
                const b = button(label, () => { tab = key; render(); }, 'cg-pill');
                b.setAttribute('aria-pressed', String(tab === key));
                nav.append(b);
            }
            const add = button(tab === 'chat' ? '+ Чат' : '+ Канал', createRoom, 'cg-pill');
            add.style.marginLeft = 'auto';
            nav.append(add);
            content.append(nav);

            const list = rooms.filter(r => r.type === tab);
            if (!list.length) {
                const hint = el('p', '', tab === 'chat'
                    ? 'Пока нет переписок. Нажми «+ Чат», чтобы начать.'
                    : 'Пока нет каналов. Создай канал, чтобы опубликовать первый пост.');
                hint.style.cssText = 'padding:8px 16px;color:var(--cg-text2)';
                content.append(hint);
            }

            for (const r of list) {
                const row = button('', () => { current = r.id; render(); }, 'cg-chat-item');
                row.style.cssText = 'width:100%;background:transparent;color:inherit;text-align:left';
                const desc = el('div');
                desc.style.minWidth = '0';
                const preview = el('div', 'cg-header-subtitle',
                    r.messages.at(-1)?.text || (r.type === 'chat' ? 'Нет сообщений' : 'Нет постов'));
                preview.style.cssText = 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
                desc.append(el('strong', '', r.name), preview);
                row.append(el('span', '', r.type === 'chat' ? '💌' : '📢'), desc);
                content.append(row);
            }
            return;
        }

        for (const m of room.messages) {
            const bubble = el('article', 'cg-local-bubble');
            const time = new Date(m.at).toLocaleTimeString('ru-RU',
                { hour: '2-digit', minute: '2-digit' });
            bubble.append(el('div', '', m.text), el('small', '', time));
            content.append(bubble);
        }

        const form = el('form', 'cg-header');
        const input = el('textarea', 'cg-search-input');
        input.rows = 2;
        input.placeholder = room.type === 'chat' ? 'Сообщение…' : 'Текст публикации…';
        input.setAttribute('aria-label', input.placeholder);
        const send = el('button', 'cg-pill', room.type === 'chat' ? 'Отправить' : 'Выложить');
        send.type = 'submit';
        form.append(input, send);
        footer.append(form);

        form.addEventListener('submit', e => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            const next = rooms.map(r => r.id === room.id
                ? { ...r, messages: [...r.messages, { text, at: Date.now() }] } : r);
            if (save(next)) {
                render();
                footer.querySelector('textarea')?.focus();
            }
        });
        requestAnimationFrame(() => { content.scrollTop = content.scrollHeight; });
    }
});
