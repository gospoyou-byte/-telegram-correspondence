// ============================================
// Cherry Gram ♡ — SillyTavern Extension
// Version 1.0.0 | SillyTavern 1.19.0
// ============================================

import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types, generateQuietPrompt } from '../../../../script.js';

const EXTENSION_NAME = 'Cherry-Gram';

// ============================================
// DEFAULT SETTINGS
// ============================================

const DEFAULT_SETTINGS = {
    enabled: true,
    // UI
    buttonIcon: '✈️',
    buttonPosX: null,
    buttonPosY: null,
    phonePosition: 'center',
    // AI Chat
    useMainProvider: true,
    chatModel: 'main',
    channelPostModel: 'main',
    commentModel: 'main',
    storyModel: 'main',
    // Image Generation
    imageProvider: 'novelai',
    imageApiUrl: '',
    imageApiKey: '',
    imageModel: '',
    imageWidth: 512,
    imageHeight: 768,
    imageAspectRatio: 'portrait',
    negativePrompt: 'low quality, blurry, distorted, deformed, ugly, bad anatomy',
    imagePromptModel: 'main',
    useAiForPrompt: true,
    // Auto
    autoMessages: true,
    autoMessageFrequency: 'medium',
    autoChannelPosts: true,
    autoStories: true,
    storyDuration: 24,
    // Sync
    syncWithRoleplay: true,
    // Profile
    userName: 'User',
    userUsername: '@user',
    userBio: '',
    userAvatar: '',
    // Message
    messageMaxLength: 600,
};

// ============================================
// STORAGE
// ============================================

class Storage {
    constructor() {
        this.key = 'cherry_gram_data';
    }

    load() {
        try {
            const raw = localStorage.getItem(this.key);
            return raw ? JSON.parse(raw) : this._default();
        } catch (e) {
            console.error('[Cherry Gram] Storage load error:', e);
            return this._default();
        }
    }

    save(data) {
        try {
            localStorage.setItem(this.key, JSON.stringify(data));
        } catch (e) {
            console.error('[Cherry Gram] Storage save error:', e);
        }
    }

    _default() {
        return {
            chats: {},
            channels: {},
            stories: {},
            gallery: [],
            contacts: [],
        };
    }

    getChat(charId) {
        const data = this.load();
        if (!data.chats[charId]) {
            data.chats[charId] = {
                messages: [],
                unread: 0,
                lastMessage: null,
                lastTimestamp: null,
                pinned: false,
                muted: false,
            };
            this.save(data);
        }
        return data.chats[charId];
    }

    addMessage(charId, msg) {
        const data = this.load();
        if (!data.chats[charId]) {
            data.chats[charId] = {
                messages: [],
                unread: 0,
                lastMessage: null,
                lastTimestamp: null,
                pinned: false,
                muted: false,
            };
        }
        data.chats[charId].messages.push(msg);
        data.chats[charId].lastMessage = msg.text || (msg.type === 'sticker' ? '🎀 Стикер' : msg.type === 'image' ? '🖼 Фото' : '');
        data.chats[charId].lastTimestamp = msg.timestamp;
        if (msg.sender !== 'user') {
            data.chats[charId].unread++;
        }
        this.save(data);
        return data;
    }

    markRead(charId) {
        const data = this.load();
        if (data.chats[charId]) {
            data.chats[charId].unread = 0;
            this.save(data);
        }
    }

    deleteMessage(charId, msgIndex) {
        const data = this.load();
        if (data.chats[charId] && data.chats[charId].messages[msgIndex]) {
            data.chats[charId].messages.splice(msgIndex, 1);
            // Update last message
            const msgs = data.chats[charId].messages;
            if (msgs.length > 0) {
                const last = msgs[msgs.length - 1];
                data.chats[charId].lastMessage = last.text || '';
                data.chats[charId].lastTimestamp = last.timestamp;
            } else {
                data.chats[charId].lastMessage = null;
                data.chats[charId].lastTimestamp = null;
            }
            this.save(data);
        }
    }

    editMessage(charId, msgIndex, newText) {
        const data = this.load();
        if (data.chats[charId] && data.chats[charId].messages[msgIndex]) {
            data.chats[charId].messages[msgIndex].text = newText;
            data.chats[charId].messages[msgIndex].edited = true;
            this.save(data);
        }
    }

    addReaction(charId, msgIndex, emoji) {
        const data = this.load();
        if (data.chats[charId] && data.chats[charId].messages[msgIndex]) {
            if (!data.chats[charId].messages[msgIndex].reactions) {
                data.chats[charId].messages[msgIndex].reactions = [];
            }
            data.chats[charId].messages[msgIndex].reactions.push(emoji);
            this.save(data);
        }
    }

    addChannel(channel) {
        const data = this.load();
        data.channels[channel.id] = channel;
        this.save(data);
    }

    getChannel(id) {
        const data = this.load();
        return data.channels[id] || null;
    }

    addPost(channelId, post) {
        const data = this.load();
        if (data.channels[channelId]) {
            if (!data.channels[channelId].posts) data.channels[channelId].posts = [];
            data.channels[channelId].posts.push(post);
            data.channels[channelId].lastPost = post.text?.substring(0, 50) || '';
            this.save(data);
        }
    }

    addComment(channelId, postIndex, comment) {
        const data = this.load();
        if (data.channels[channelId]?.posts?.[postIndex]) {
            if (!data.channels[channelId].posts[postIndex].comments) {
                data.channels[channelId].posts[postIndex].comments = [];
            }
            data.channels[channelId].posts[postIndex].comments.push(comment);
            this.save(data);
        }
    }

    addStory(authorId, story) {
        const data = this.load();
        if (!data.stories[authorId]) data.stories[authorId] = [];
        data.stories[authorId].push(story);
        this.save(data);
    }

    addToGallery(image) {
        const data = this.load();
        data.gallery.push(image);
        this.save(data);
    }

    removeFromGallery(index) {
        const data = this.load();
        if (data.gallery[index]) {
            data.gallery.splice(index, 1);
            this.save(data);
        }
    }

    clearChat(charId) {
        const data = this.load();
        if (data.chats[charId]) {
            data.chats[charId].messages = [];
            data.chats[charId].lastMessage = null;
            data.chats[charId].lastTimestamp = null;
            data.chats[charId].unread = 0;
            this.save(data);
        }
    }
}

// ============================================
// AI ENGINE
// ============================================

class AIEngine {
    constructor(app) {
        this.app = app;
    }

    async generateChatResponse(charId, charName, userMessage, chatHistory, rpContext) {
        const historyStr = chatHistory.slice(-15).map(m =>
            `${m.sender === 'user' ? 'User' : charName}: ${m.text || (m.type === 'sticker' ? `[стикер ${m.sticker}]` : '[медиа]')}`
        ).join('\n');

        const prompt = `[SYSTEM: Ты отыгрываешь персонажа ${charName} в переписке Telegram. ` +
            `Пиши как в реальном мессенджере: коротко, живо, с эмодзи если подходит по характеру. ` +
            `НЕ пиши действия от лица пользователя. НЕ описывай действия в звёздочках, это чат. ` +
            `Если хочешь отправить стикер-реакцию, добавь в конце [sticker:эмодзи]. ` +
            `Если хочешь поставить реакцию на сообщение, добавь [reaction:эмодзи].` +
            (rpContext ? `\n\nКонтекст ролевой:\n${rpContext}` : '') +
            `]\n\nПереписка:\n${historyStr}\nUser: ${userMessage}\n\n${charName}:`;

        try {
            const response = await generateQuietPrompt(prompt, false, false);
            return this._parseResponse(response);
        } catch (e) {
            console.error('[Cherry Gram] AI generation error:', e);
            return this._fallback();
        }
    }

    async generateChannelPost(charName, channelName, channelTheme) {
        const prompt = `[SYSTEM: Ты — ${charName}. Ты ведёшь Telegram-канал "${channelName}". ` +
            `Тема канала: ${channelTheme || 'личный блог'}. ` +
            `Напиши новый пост. Пиши естественно, как настоящий блогер. С эмодзи. 2-6 предложений.]\n\n${charName}:`;

        try {
            const response = await generateQuietPrompt(prompt, false, false);
            return response?.trim() || `Новый пост ✨`;
        } catch (e) {
            return `Новый пост в ${channelName} ✨`;
        }
    }

    async generateComment(charName, postText) {
        const prompt = `[SYSTEM: Ты — ${charName}. Ты видишь пост в Telegram:\n"${postText}"\n` +
            `Напиши короткий комментарий (1-2 предложения). Естественно, как в Telegram.]\n\n${charName}:`;

        try {
            const response = await generateQuietPrompt(prompt, false, false);
            return response?.trim() || '👍';
        } catch (e) {
            return '👍';
        }
    }

    async generateStory(charName) {
        const prompt = `[SYSTEM: Ты — ${charName}. Ты хочешь выложить историю (story) в Telegram. ` +
            `Опиши что на фото/видео и напиши подпись (1-2 предложения с эмодзи).]\n\n${charName}:`;

        try {
            const response = await generateQuietPrompt(prompt, false, false);
            return response?.trim() || '✨';
        } catch (e) {
            return '✨';
        }
    }

    async generateImagePrompt(descriptionRu) {
        const prompt = `[SYSTEM: Convert the following Russian image description into a detailed English prompt for AI image generation. ` +
            `Use tags describing style, composition, lighting, details. ` +
            `Reply ONLY with the English prompt, no explanations.]\n\nDescription: ${descriptionRu}\n\nPrompt:`;

        try {
            const response = await generateQuietPrompt(prompt, false, false);
            return response?.trim() || descriptionRu;
        } catch (e) {
            return descriptionRu;
        }
    }

    async generateAutoMessage(charName, charDescription) {
        const prompt = `[SYSTEM: Ты — ${charName}. ${charDescription ? `Описание: ${charDescription}. ` : ''}` +
            `Ты хочешь написать в Telegram первым/первой. ` +
            `Напиши короткое сообщение (1-2 предложения): вопрос, мысль, делишься чем-то, или просто реакцию. ` +
            `Пиши естественно как в Telegram. С эмодзи.]\n\n${charName}:`;

        try {
            const response = await generateQuietPrompt(prompt, false, false);
            return response?.trim() || null;
        } catch (e) {
            return null;
        }
    }

    _parseResponse(raw) {
        if (!raw) return this._fallback();
        let text = raw.trim();

        // Extract sticker
        const stickerMatch = text.match(/\[sticker:(.+?)\]/i);
        let sticker = null;
        if (stickerMatch) {
            sticker = stickerMatch[1].trim();
            text = text.replace(/\[sticker:.+?\]/gi, '').trim();
        }

        // Extract reaction
        const reactionMatch = text.match(/\[reaction:(.+?)\]/i);
        let reaction = null;
        if (reactionMatch) {
            reaction = reactionMatch[1].trim();
            text = text.replace(/\[reaction:.+?\]/gi, '').trim();
        }

        // If only sticker, no text
        if (!text && sticker) {
            return { type: 'sticker', sticker, text: '', reaction };
        }

        return { type: 'text', text, sticker, reaction };
    }

    _fallback() {
        const f = ['😊', 'ахах', '♡', 'дааа', '))', 'ого', 'хмм', '🌸', 'лааадно', 'ну такое'];
        return { type: 'text', text: f[Math.floor(Math.random() * f.length)] };
    }
}

// ============================================
// IMAGE GENERATOR
// ============================================

class ImageGenerator {
    constructor(app) {
        this.app = app;
    }

    async generate(prompt, negativePrompt, width, height) {
        const settings = this.app.settings;
        const provider = settings.imageProvider;

        switch (provider) {
            case 'novelai':
                return this._generateNovelAI(prompt, negativePrompt, width, height);
            case 'custom':
                return this._generateCustomAPI(prompt, negativePrompt, width, height);
            case 'sd':
                return this._generateSD(prompt, negativePrompt, width, height);
            default:
                throw new Error('Провайдер не выбран');
        }
    }

    async _generateNovelAI(prompt, negativePrompt, width, height) {
        try {
            // Use SillyTavern's built-in NovelAI image generation
            const response = await fetch('/api/novelai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    negative_prompt: negativePrompt || '',
                    width: width || 512,
                    height: height || 768,
                    steps: 28,
                    scale: 5,
                    sampler: 'k_euler',
                    n_samples: 1,
                    model: 'nai-diffusion-3',
                }),
            });

            if (!response.ok) {
                throw new Error(`NovelAI error: ${response.status}`);
            }

            const data = await response.json();
            if (data?.images?.[0]) {
                return `data:image/png;base64,${data.images[0]}`;
            }
            throw new Error('No image in response');
        } catch (e) {
            console.error('[Cherry Gram] NovelAI generation error:', e);
            throw e;
        }
    }

    async _generateCustomAPI(prompt, negativePrompt, width, height) {
        const settings = this.app.settings;
        if (!settings.imageApiUrl) {
            throw new Error('API URL не указан');
        }

        try {
            const response = await fetch(settings.imageApiUrl + '/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.imageApiKey || ''}`,
                },
                body: JSON.stringify({
                    prompt: prompt,
                    negative_prompt: negativePrompt || '',
                    width: width || 512,
                    height: height || 768,
                    n: 1,
                }),
            });

            if (!response.ok) {
                throw new Error(`Custom API error: ${response.status}`);
            }

            const data = await response.json();
            // Try different response formats
            if (data?.data?.[0]?.url) return data.data[0].url;
            if (data?.data?.[0]?.b64_json) return `data:image/png;base64,${data.data[0].b64_json}`;
            if (data?.images?.[0]) return `data:image/png;base64,${data.images[0]}`;
            if (data?.output?.[0]) return data.output[0];

            throw new Error('Unknown response format');
        } catch (e) {
            console.error('[Cherry Gram] Custom API error:', e);
            throw e;
        }
    }

    async _generateSD(prompt, negativePrompt, width, height) {
        try {
            const response = await fetch('/api/sd/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt, negative_prompt: negativePrompt || '',
                    width: width || 512, height: height || 768,
                    steps: 20, cfg_scale: 7,
                }),
            });

            if (!response.ok) throw new Error(`SD error: ${response.status}`);
            const data = await response.json();
            if (data?.images?.[0]) return `data:image/png;base64,${data.images[0]}`;
            throw new Error('No image');
        } catch (e) {
            console.error('[Cherry Gram] SD error:', e);
            throw e;
        }
    }

    getDimensions(ratio) {
        const dims = {
            'square': { w: 512, h: 512 },
            'portrait': { w: 512, h: 768 },
            'landscape': { w: 768, h: 512 },
            'wide': { w: 896, h: 512 },
            'tall': { w: 512, h: 896 },
        };
        return dims[ratio] || dims['portrait'];
    }
}

// ============================================
// MAIN APP
// ============================================

class CherryGram {
    constructor() {
        this.storage = new Storage();
        this.ai = new AIEngine(this);
        this.imageGen = new ImageGenerator(this);
        this.settings = { ...DEFAULT_SETTINGS };
        this.characters = [];
        this.isOpen = false;
        this.currentScreen = 'home';
        this.currentChat = null;
        this.currentChannel = null;
        this.replyTo = null;
        this.editingMsg = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    // ============================================
    // INIT
    // ============================================

    async init() {
        console.log('[Cherry Gram ♡] Initializing...');
        this._loadSettings();
        this._loadCharacters();
        this._injectHTML();
        this._bindEvents();
        this._startClock();
        this._bindSTEvents();
        console.log('[Cherry Gram ♡] Ready! ✈️');
    }

    _loadSettings() {
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
        }
        this.settings = extension_settings[EXTENSION_NAME];
        // Fill missing defaults
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
            if (this.settings[k] === undefined) this.settings[k] = v;
        }
    }

    _saveSettings() {
        extension_settings[EXTENSION_NAME] = this.settings;
        saveSettingsDebounced();
    }

    _loadCharacters() {
        try {
            const ctx = getContext();
            if (ctx?.characters) {
                this.characters = ctx.characters.map(c => ({
                    id: c.avatar || c.name,
                    name: c.name,
                    avatar: c.avatar ? `characters/${c.avatar}` : '',
                    description: c.description || '',
                    personality: c.personality || '',
                    scenario: c.scenario || '',
                }));
            }
        } catch (e) {
            console.error('[Cherry Gram] Load characters error:', e);
        }
    }

    _bindSTEvents() {
        try {
            eventSource.on(event_types.CHAT_CHANGED, () => this._loadCharacters());
            eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, () => {
                if (this.settings.autoMessages) this._maybeAutoMessage();
            });
        } catch (e) {
            console.error('[Cherry Gram] ST events error:', e);
        }
    }

    // ============================================
    // HTML INJECTION
    // ============================================

    _injectHTML() {
        const html = `
        <!-- CHERRY GRAM BUTTON -->
        <div id="cg-btn" class="cg-btn" title="Cherry Gram ♡">
            <span class="cg-btn-icon">✈️</span>
            <span class="cg-btn-badge cg-hidden" id="cg-btn-badge">0</span>
        </div>

        <!-- OVERLAY -->
        <div id="cg-overlay" class="cg-overlay cg-hidden">
            <div id="cg-phone" class="cg-phone">
                <!-- STATUS BAR -->
                <div class="cg-statusbar">
                    <span id="cg-clock" class="cg-clock">00:00</span>
                    <span class="cg-statusbar-title">Cherry Gram ♡</span>
                    <div class="cg-statusbar-right">
                        <span>📶</span>
                        <span>🔋</span>
                    </div>
                </div>

                <!-- HEADER -->
                <div class="cg-header" id="cg-header">
                    <button class="cg-icon-btn cg-hidden" id="cg-back">←</button>
                    <div class="cg-header-center">
                        <div class="cg-header-avatar cg-hidden" id="cg-header-avatar"></div>
                        <div class="cg-header-info">
                            <h2 id="cg-header-title" class="cg-header-title">Чаты</h2>
                            <span id="cg-header-subtitle" class="cg-header-subtitle cg-hidden"></span>
                        </div>
                    </div>
                    <div class="cg-header-actions">
                        <button class="cg-icon-btn" id="cg-search-toggle">🔍</button>
                        <button class="cg-icon-btn" id="cg-close-phone">✕</button>
                    </div>
                </div>

                <!-- SEARCH -->
                <div class="cg-search cg-hidden" id="cg-search">
                    <input type="text" id="cg-search-input" class="cg-search-input" placeholder="Поиск...">
                </div>

                <!-- CONTENT -->
                <div class="cg-content" id="cg-content"></div>

                <!-- INPUT AREA -->
                <div class="cg-input-area cg-hidden" id="cg-input-area">
                    <!-- Reply Preview -->
                    <div class="cg-reply-bar cg-hidden" id="cg-reply-bar">
                        <div class="cg-reply-info">
                            <span class="cg-reply-name" id="cg-reply-name"></span>
                            <span class="cg-reply-text" id="cg-reply-text"></span>
                        </div>
                        <button class="cg-icon-btn cg-reply-close" id="cg-reply-close">✕</button>
                    </div>
                    <!-- Edit Preview -->
                    <div class="cg-edit-bar cg-hidden" id="cg-edit-bar">
                        <div class="cg-edit-info">
                            <span class="cg-edit-label">✏️ Редактирование</span>
                            <span class="cg-edit-text" id="cg-edit-text"></span>
                        </div>
                        <button class="cg-icon-btn cg-edit-close" id="cg-edit-close">✕</button>
                    </div>
                    <div class="cg-input-row">
                        <button class="cg-icon-btn" id="cg-attach">📎</button>
                        <input type="text" id="cg-msg-input" class="cg-msg-input" placeholder="Сообщение...">
                        <button class="cg-icon-btn" id="cg-sticker-toggle">😺</button>
                        <button class="cg-icon-btn" id="cg-emoji-toggle">😊</button>
                        <button class="cg-send-btn" id="cg-send">
                            <span>➤</span>
                        </button>
                    </div>
                </div>

                <!-- ATTACH MENU -->
                <div class="cg-popup cg-attach-menu cg-hidden" id="cg-attach-menu">
                    <button class="cg-attach-opt" id="cg-attach-photo">🖼 Фото</button>
                    <button class="cg-attach-opt" id="cg-attach-gen">✨ Сгенерировать</button>
                </div>

                <!-- STICKER PICKER -->
                <div class="cg-popup cg-sticker-picker cg-hidden" id="cg-sticker-picker">
                    <div class="cg-sticker-tabs" id="cg-sticker-tabs">
                        <button class="cg-sticker-tab active" data-pack="recent">🕐</button>
                        <button class="cg-sticker-tab" data-pack="fav">⭐</button>
                        <button class="cg-sticker-tab" data-pack="cute">🎀</button>
                        <button class="cg-sticker-tab" data-pack="meme">😂</button>
                        <button class="cg-sticker-tab" data-pack="mood">🌸</button>
                        <button class="cg-sticker-tab" data-pack="chaos">💀</button>
                    </div>
                    <div class="cg-sticker-grid" id="cg-sticker-grid"></div>
                </div>

                <!-- EMOJI PICKER -->
                <div class="cg-popup cg-emoji-picker cg-hidden" id="cg-emoji-picker">
                    <div class="cg-emoji-grid" id="cg-emoji-grid"></div>
                </div>

                <!-- IMAGE GEN DIALOG -->
                <div class="cg-dialog cg-hidden" id="cg-imggen-dialog">
                    <div class="cg-dialog-content">
                        <h3>✨ Генерация изображения</h3>
                        <div class="cg-field">
                            <label>Описание (рус):</label>
                            <textarea id="cg-imggen-ru" class="cg-textarea" placeholder="Опишите что хотите увидеть..."></textarea>
                        </div>
                        <div class="cg-field">
                            <label>Формат:</label>
                            <select id="cg-imggen-ratio" class="cg-select">
                                <option value="portrait">Портрет (2:3)</option>
                                <option value="square">Квадрат (1:1)</option>
                                <option value="landscape">Пейзаж (3:2)</option>
                                <option value="wide">Широкий (16:9)</option>
                                <option value="tall">Высокий (9:16)</option>
                            </select>
                        </div>
                        <div class="cg-field">
                            <label>Негативный промпт:</label>
                            <input type="text" id="cg-imggen-neg" class="cg-input" placeholder="low quality, blurry...">
                        </div>
                        <div class="cg-field">
                            <label>Провайдер:</label>
                            <select id="cg-imggen-provider" class="cg-select">
                                <option value="novelai">NovelAI</option>
                                <option value="custom">Свой API</option>
                                <option value="sd">Stable Diffusion (локальный)</option>
                            </select>
                        </div>
                        <div class="cg-field">
                            <label><input type="checkbox" id="cg-imggen-useai" checked> AI генерирует промпт</label>
                        </div>
                        <div class="cg-field cg-hidden" id="cg-imggen-en-wrap">
                            <label>Промпт (EN):</label>
                            <textarea id="cg-imggen-en" class="cg-textarea" placeholder="AI сгенерирует..."></textarea>
                        </div>
                        <div class="cg-dialog-buttons">
                            <button class="cg-btn" id="cg-imggen-translate">📝 Промпт</button>
                            <button class="cg-btn cg-btn-primary" id="cg-imggen-go">✨ Создать</button>
                            <button class="cg-btn" id="cg-imggen-cancel">Отмена</button>
                        </div>
                    </div>
                </div>

                <!-- CONTEXT MENU (for messages) -->
                <div class="cg-popup cg-context-menu cg-hidden" id="cg-context-menu">
                    <button class="cg-ctx-opt" data-action="reply">↩️ Ответить</button>
                    <button class="cg-ctx-opt" data-action="react">❤️ Реакция</button>
                    <button class="cg-ctx-opt" data-action="edit">✏️ Редактировать</button>
                    <button class="cg-ctx-opt" data-action="delete">🗑 Удалить</button>
                    <button class="cg-ctx-opt" data-action="copy">📋 Копировать</button>
                </div>

                <!-- REACTION PICKER -->
                <div class="cg-popup cg-reaction-picker cg-hidden" id="cg-reaction-picker">
                    <div class="cg-reaction-grid">
                        ${['❤️','👍','😂','😮','😢','😡','🔥','💀','🤡','🌸','✨','💗','👏','🤔','😈','🥺'].map(e =>
                            `<button class="cg-reaction-opt" data-emoji="${e}">${e}</button>`
                        ).join('')}
                    </div>
                </div>

                <!-- BOTTOM NAV -->
                <div class="cg-nav">
                    <button class="cg-nav-btn active" data-screen="home">
                        <span class="cg-nav-icon">💬</span>
                        <span class="cg-nav-label">Чаты</span>
                    </button>
                    <button class="cg-nav-btn" data-screen="channels">
                        <span class="cg-nav-icon">📢</span>
                        <span class="cg-nav-label">Каналы</span>
                    </button>
                    <button class="cg-nav-btn" data-screen="stories">
                        <span class="cg-nav-icon">🌸</span>
                        <span class="cg-nav-label">Истории</span>
                    </button>
                    <button class="cg-nav-btn" data-screen="gallery">
                        <span class="cg-nav-icon">🖼</span>
                        <span class="cg-nav-label">Галерея</span>
                    </button>
                    <button class="cg-nav-btn" data-screen="profile">
                        <span class="cg-nav-icon">👤</span>
                        <span class="cg-nav-label">Профиль</span>
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        // Restore button position
        const btn = document.getElementById('cg-btn');
        if (this.settings.buttonPosX !== null && this.settings.buttonPosY !== null) {
            btn.style.left = this.settings.buttonPosX + 'px';
            btn.style.top = this.settings.buttonPosY + 'px';
            btn.style.right = 'auto';
            btn.style.bottom = 'auto';
        }
    }

    // ============================================
    // EVENTS
    // ============================================

    _bindEvents() {
        const $ = (id) => document.getElementById(id);

        // ---- Draggable button ----
        const btn = $('cg-btn');
        btn.addEventListener('mousedown', (e) => {
            this.isDragging = false;
            this.dragOffset = {
                x: e.clientX - btn.getBoundingClientRect().left,
                y: e.clientY - btn.getBoundingClientRect().top,
            };
            const onMove = (ev) => {
                this.isDragging = true;
                btn.style.left = (ev.clientX - this.dragOffset.x) + 'px';
                btn.style.top = (ev.clientY - this.dragOffset.y) + 'px';
                btn.style.right = 'auto';
                btn.style.bottom = 'auto';
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (this.isDragging) {
                    this.settings.buttonPosX = parseInt(btn.style.left);
                    this.settings.buttonPosY = parseInt(btn.style.top);
                    this._saveSettings();
                }
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        btn.addEventListener('click', (e) => {
            if (!this.isDragging) this.toggle();
        });

        // ---- Close ----
        $('cg-close-phone').addEventListener('click', () => this.close());
        $('cg-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'cg-overlay') this.close();
        });

        // ---- Navigation ----
        document.querySelectorAll('.cg-nav-btn').forEach(b => {
            b.addEventListener('click', () => this._navigate(b.dataset.screen));
        });
        $('cg-back').addEventListener('click', () => this._goBack());

        // ---- Search ----
        $('cg-search-toggle').addEventListener('click', () => {
            $('cg-search').classList.toggle('cg-hidden');
            if (!$('cg-search').classList.contains('cg-hidden')) {
                $('cg-search-input').focus();
            }
        });

        $('cg-search-input').addEventListener('input', (e) => {
            this._onSearch(e.target.value);
        });

        // ---- Send ----
        $('cg-send').addEventListener('click', () => this._sendMessage());
        $('cg-msg-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._sendMessage();
            }
        });

        // ---- Attach ----
        $('cg-attach').addEventListener('click', () => {
            this._closeAllPopups();
            $('cg-attach-menu').classList.toggle('cg-hidden');
        });
        $('cg-attach-photo').addEventListener('click', () => this._attachPhoto());
        $('cg-attach-gen').addEventListener('click', () => {
            $('cg-attach-menu').classList.add('cg-hidden');
            $('cg-imggen-dialog').classList.remove('cg-hidden');
            // Set current settings
            $('cg-imggen-neg').value = this.settings.negativePrompt || '';
            $('cg-imggen-provider').value = this.settings.imageProvider || 'novelai';
        });

        // ---- Stickers ----
        $('cg-sticker-toggle').addEventListener('click', () => {
            this._closeAllPopups();
            $('cg-sticker-picker').classList.toggle('cg-hidden');
            if (!$('cg-sticker-picker').classList.contains('cg-hidden')) {
                this._loadStickers('recent');
            }
        });

        document.querySelectorAll('.cg-sticker-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.cg-sticker-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._loadStickers(tab.dataset.pack);
            });
        });

        // ---- Emoji ----
        $('cg-emoji-toggle').addEventListener('click', () => {
            this._closeAllPopups();
            $('cg-emoji-picker').classList.toggle('cg-hidden');
            if (!$('cg-emoji-picker').classList.contains('cg-hidden')) {
                this._loadEmojis();
            }
        });

        // ---- Reply / Edit ----
        $('cg-reply-close').addEventListener('click', () => this._cancelReply());
        $('cg-edit-close').addEventListener('click', () => this._cancelEdit());

        // ---- Image Gen Dialog ----
        $('cg-imggen-cancel').addEventListener('click', () => {
            $('cg-imggen-dialog').classList.add('cg-hidden');
        });

        $('cg-imggen-useai').addEventListener('change', (e) => {
            $('cg-imggen-en-wrap').classList.toggle('cg-hidden', !e.target.checked);
        });

        $('cg-imggen-translate').addEventListener('click', () => this._genImagePrompt());
        $('cg-imggen-go').addEventListener('click', () => this._genImage());

        // ---- Context menu actions ----
        document.querySelectorAll('.cg-ctx-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                this._handleContextAction(opt.dataset.action);
            });
        });

        // ---- Reaction picker ----
        document.querySelectorAll('.cg-reaction-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                this._addReaction(opt.dataset.emoji);
                $('cg-reaction-picker').classList.add('cg-hidden');
            });
        });

        // ---- Close popups on content click ----
        $('cg-content').addEventListener('click', () => {
            this._closeAllPopups();
        });
    }

    _closeAllPopups() {
        document.querySelectorAll('.cg-popup').forEach(p => p.classList.add('cg-hidden'));
    }

    // ============================================
    // NAVIGATION
    // ============================================

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        document.getElementById('cg-overlay').classList.remove('cg-hidden');
        this.isOpen = true;
        this._navigate('home');
        this._updateBadge();
    }

    close() {
        document.getElementById('cg-overlay').classList.add('cg-hidden');
        this.isOpen = false;
        this._closeAllPopups();
    }

    _navigate(screen) {
        this.currentScreen = screen;

        // Nav active state
        document.querySelectorAll('.cg-nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.screen === screen);
        });

        const back = document.getElementById('cg-back');
        const input = document.getElementById('cg-input-area');
        const headerAvatar = document.getElementById('cg-header-avatar');
        const headerSub = document.getElementById('cg-header-subtitle');
        const title = document.getElementById('cg-header-title');

        // Reset
        back.classList.add('cg-hidden');
        input.classList.add('cg-hidden');
        headerAvatar.classList.add('cg-hidden');
        headerSub.classList.add('cg-hidden');
        this._closeAllPopups();

        switch (screen) {
            case 'home':
                title.textContent = 'Чаты';
                this._renderChatList();
                break;
            case 'chat':
                back.classList.remove('cg-hidden');
                input.classList.remove('cg-hidden');
                title.textContent = this.currentChat?.name || 'Чат';
                if (this.currentChat?.avatar) {
                    headerAvatar.classList.remove('cg-hidden');
                    headerAvatar.innerHTML = `<img src="${this.currentChat.avatar}" alt="">`;
                }
                headerSub.classList.remove('cg-hidden');
                headerSub.textContent = 'в сети';
                this._renderChat();
                break;
            case 'channels':
                title.textContent = 'Каналы';
                this._renderChannels();
                break;
            case 'channel-view':
                back.classList.remove('cg-hidden');
                title.textContent = this.currentChannel?.name || 'Канал';
                this._renderChannelView();
                break;
            case 'stories':
                title.textContent = 'Истории';
                this._renderStories();
                break;
            case 'gallery':
                title.textContent = 'Галерея';
                this._renderGallery();
                break;
            case 'profile':
                title.textContent = 'Профиль';
                this._renderProfile();
                break;
            case 'settings':
                back.classList.remove('cg-hidden');
                title.textContent = 'Настройки';
                this._renderSettings();
                break;
            case 'char-profile':
                back.classList.remove('cg-hidden');
                title.textContent = this.currentChat?.name || 'Профиль';
                this._renderCharProfile();
                break;
        }
    }

    _goBack() {
        switch (this.currentScreen) {
            case 'chat': this._navigate('home'); break;
            case 'channel-view': this._navigate('channels'); break;
            case 'settings': this._navigate('profile'); break;
            case 'char-profile': this._navigate('chat'); break;
            default: this._navigate('home');
        }
    }

    // ============================================
    // RENDER: Chat List
    // ============================================

    _renderChatList() {
        const content = document.getElementById('cg-content');
        const data = this.storage.load();
        let entries = [];

        // Existing chats
        for (const [id, chat] of Object.entries(data.chats)) {
            const char = this.characters.find(c => c.id === id);
            entries.push({
                id, name: char?.name || id, avatar: char?.avatar || '',
                lastMessage: chat.lastMessage || '', unread: chat.unread || 0,
                timestamp: chat.lastTimestamp, pinned: chat.pinned,
            });
        }

        // Characters without chats
        this.characters.forEach(c => {
            if (!data.chats[c.id]) {
                entries.push({
                    id: c.id, name: c.name, avatar: c.avatar,
                    lastMessage: '', unread: 0, timestamp: null, pinned: false,
                });
            }
        });

        // Sort
        entries.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return (b.timestamp || 0) - (a.timestamp || 0);
        });

        if (entries.length === 0) {
            content.innerHTML = `
                <div class="cg-empty">
                    <div class="cg-empty-icon">✈️</div>
                    <p>Нет контактов</p>
                    <p class="cg-hint">Персонажи SillyTavern появятся здесь</p>
                </div>`;
            return;
        }

        content.innerHTML = entries.map(c => `
            <div class="cg-chat-item" data-id="${c.id}">
                <div class="cg-avatar">
                    ${c.avatar ? `<img src="${c.avatar}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="cg-avatar-letter" style="display:none">${c.name[0]}</span>` : `<span class="cg-avatar-letter">${c.name[0]}</span>`}
                </div>
                <div class="cg-chat-info">
                    <div class="cg-chat-row-top">
                        <span class="cg-chat-name">${this._esc(c.name)}</span>
                        <span class="cg-chat-time">${c.timestamp ? this._time(c.timestamp) : ''}</span>
                    </div>
                    <div class="cg-chat-row-bot">
                        <span class="cg-chat-preview">${this._esc(c.lastMessage) || '<span class="cg-hint">Начните переписку ♡</span>'}</span>
                        ${c.unread > 0 ? `<span class="cg-badge">${c.unread}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        // Click handlers
        content.querySelectorAll('.cg-chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const char = this.characters.find(c => c.id === id) ||
                    { id, name: id, avatar: '' };
                this.currentChat = char;
                this.storage.markRead(id);
                this._navigate('chat');
            });
        });
    }

    // ============================================
    // RENDER: Chat
    // ============================================

    _renderChat() {
        if (!this.currentChat) return;
        const content = document.getElementById('cg-content');
        const chatData = this.storage.getChat(this.currentChat.id);
        const msgs = chatData.messages || [];

        if (msgs.length === 0) {
            content.innerHTML = `
                <div class="cg-chat-start">
                    <div class="cg-chat-start-avatar" id="cg-chat-start-avatar-click">
                        ${this.currentChat.avatar ? `<img src="${this.currentChat.avatar}">` : `<span class="cg-avatar-letter-lg">${this.currentChat.name[0]}</span>`}
                    </div>
                    <h3>${this._esc(this.currentChat.name)}</h3>
                    <p class="cg-hint">Начните переписку ♡</p>
                </div>
                <div class="cg-typing cg-hidden" id="cg-typing">
                    <span class="cg-typing-anim"><span>•</span><span>•</span><span>•</span></span>
                    <span>${this._esc(this.currentChat.name)} печатает</span>
                </div>`;
        } else {
            content.innerHTML = `
                <div class="cg-messages" id="cg-messages">
                    ${msgs.map((m, i) => this._renderMsg(m, i)).join('')}
                    <div class="cg-typing cg-hidden" id="cg-typing">
                        <span class="cg-typing-anim"><span>•</span><span>•</span><span>•</span></span>
                        <span>${this._esc(this.currentChat.name)} печатает</span>
                    </div>
                </div>`;
            this._scrollBottom();
        }

        // Avatar click -> char profile
        const avatarClick = document.getElementById('cg-chat-start-avatar-click');
        if (avatarClick) {
            avatarClick.addEventListener('click', () => this._navigate('char-profile'));
        }

        // Message context menus
        this._bindMsgEvents(content);
    }

    _renderMsg(msg, index) {
        const isUser = msg.sender === 'user';
        const cls = isUser ? 'cg-msg-user' : 'cg-msg-char';
        const time = msg.timestamp ? this._time(msg.timestamp) : '';

        let body = '';
        if (msg.type === 'sticker') {
            body = `<div class="cg-msg-sticker">${msg.sticker || '🎀'}</div>`;
        } else if (msg.type === 'image') {
            body = `<div class="cg-msg-image"><img src="${msg.imageUrl}" class="cg-msg-img" loading="lazy"></div>`;
            if (msg.text) body += `<div class="cg-msg-text">${this._esc(msg.text)}</div>`;
        } else {
            body = `<div class="cg-msg-text">${this._esc(msg.text || '')}</div>`;
        }

        const reply = msg.replyToText ? `<div class="cg-msg-reply">↩ ${this._esc(msg.replyToText.substring(0, 60))}</div>` : '';
        const edited = msg.edited ? '<span class="cg-msg-edited">ред.</span>' : '';
        const reactions = msg.reactions?.length ? `<div class="cg-msg-reactions">${msg.reactions.map(r => `<span class="cg-msg-react">${r}</span>`).join('')}</div>` : '';

        return `
            <div class="cg-msg ${cls}" data-index="${index}">
                ${reply}
                ${body}
                <div class="cg-msg-meta">
                    ${edited}
                    <span class="cg-msg-time">${time}</span>
                    ${isUser ? '<span class="cg-msg-check">✓✓</span>' : ''}
                </div>
                ${reactions}
            </div>`;
    }

    _bindMsgEvents(container) {
        container.querySelectorAll('.cg-msg').forEach(el => {
            // Right click / long press
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this._contextMsgIndex = parseInt(el.dataset.index);
                this._contextMsgIsUser = el.classList.contains('cg-msg-user');
                const menu = document.getElementById('cg-context-menu');
                // Show/hide edit option
                menu.querySelector('[data-action="edit"]').classList.toggle('cg-hidden', !this._contextMsgIsUser);
                menu.style.top = (e.clientY - document.getElementById('cg-phone').getBoundingClientRect().top) + 'px';
                menu.style.left = Math.min(e.clientX - document.getElementById('cg-phone').getBoundingClientRect().left, 200) + 'px';
                this._closeAllPopups();
                menu.classList.remove('cg-hidden');
            });

            // Double click = quick react ❤️
            el.addEventListener('dblclick', () => {
                this._contextMsgIndex = parseInt(el.dataset.index);
                this._addReaction('❤️');
            });
        });
    }

    _handleContextAction(action) {
        const idx = this._contextMsgIndex;
        document.getElementById('cg-context-menu').classList.add('cg-hidden');

        if (idx === undefined || idx === null) return;
        const chatData = this.storage.getChat(this.currentChat.id);
        const msg = chatData.messages[idx];
        if (!msg) return;

        switch (action) {
            case 'reply':
                this.replyTo = { index: idx, text: msg.text || '[медиа]', sender: msg.sender };
                document.getElementById('cg-reply-name').textContent = msg.sender === 'user' ? 'Вы' : this.currentChat.name;
                document.getElementById('cg-reply-text').textContent = (msg.text || '[медиа]').substring(0, 50);
                document.getElementById('cg-reply-bar').classList.remove('cg-hidden');
                document.getElementById('cg-msg-input').focus();
                break;
            case 'react':
                this._contextMsgIndex = idx;
                document.getElementById('cg-reaction-picker').classList.toggle('cg-hidden');
                break;
            case 'edit':
                if (msg.sender === 'user' && msg.type === 'text') {
                    this.editingMsg = { index: idx, text: msg.text };
                    document.getElementById('cg-edit-text').textContent = msg.text.substring(0, 50);
                    document.getElementById('cg-edit-bar').classList.remove('cg-hidden');
                    document.getElementById('cg-msg-input').value = msg.text;
                    document.getElementById('cg-msg-input').focus();
                }
                break;
            case 'delete':
                this.storage.deleteMessage(this.currentChat.id, idx);
                this._renderChat();
                break;
            case 'copy':
                if (msg.text) navigator.clipboard?.writeText(msg.text);
                this._notify('Скопировано');
                break;
        }
    }

    _addReaction(emoji) {
        if (this._contextMsgIndex === undefined) return;
        this.storage.addReaction(this.currentChat.id, this._contextMsgIndex, emoji);
        this._renderChat();
    }

    _cancelReply() {
        this.replyTo = null;
        document.getElementById('cg-reply-bar').classList.add('cg-hidden');
    }

    _cancelEdit() {
        this.editingMsg = null;
        document.getElementById('cg-edit-bar').classList.add('cg-hidden');
        document.getElementById('cg-msg-input').value = '';
    }

    // ============================================
    // SEND MESSAGE
    // ============================================

    async _sendMessage() {
        const input = document.getElementById('cg-msg-input');
        if (!input || !this.currentChat) return;
        const text = input.value.trim();
        if (!text) return;

        // If editing
        if (this.editingMsg) {
            this.storage.editMessage(this.currentChat.id, this.editingMsg.index, text);
            this._cancelEdit();
            input.value = '';
            this._renderChat();
            return;
        }

        const msg = {
            sender: 'user',
            type: 'text',
            text,
            timestamp: Date.now(),
            replyTo: this.replyTo?.index ?? null,
            replyToText: this.replyTo?.text ?? null,
        };

        this.storage.addMessage(this.currentChat.id, msg);
        input.value = '';
        this._cancelReply();
        this._renderChat();
        this._updateBadge();

        // AI response
        await this._genCharResponse(text);
    }

    async _genCharResponse(userMessage) {
        if (!this.currentChat) return;
        const charId = this.currentChat.id;
        const charName = this.currentChat.name;

        // Show typing
        const typing = document.getElementById('cg-typing');
        if (typing) typing.classList.remove('cg-hidden');
        this._scrollBottom();

        // Delay
        await this._delay(800 + Math.random() * 2500);

        // RP context
        let rpContext = '';
        if (this.settings.syncWithRoleplay) {
            try {
                const ctx = getContext();
                if (ctx?.chat?.length) {
                    rpContext = ctx.chat.slice(-5).map(m => m.mes).join('\n').substring(0, 1000);
                }
            } catch (e) { /* ignore */ }
        }

        const chatHistory = this.storage.getChat(charId).messages;
        const response = await this.ai.generateChatResponse(charId, charName, userMessage, chatHistory, rpContext);

        if (typing) typing.classList.add('cg-hidden');

        // Send character message
        const charMsg = {
            sender: 'character',
            type: response.type || 'text',
            text: response.text || '',
            sticker: response.sticker || null,
            timestamp: Date.now(),
        };

        // If response has sticker as separate message
        if (response.sticker && response.text) {
            this.storage.addMessage(charId, charMsg);
            // Also send sticker
            this.storage.addMessage(charId, {
                sender: 'character',
                type: 'sticker',
                sticker: response.sticker,
                timestamp: Date.now() + 1,
            });
        } else if (response.type === 'sticker') {
            charMsg.type = 'sticker';
            this.storage.addMessage(charId, charMsg);
        } else {
            this.storage.addMessage(charId, charMsg);
        }

        // Reaction on user's message
        if (response.reaction) {
            const data = this.storage.load();
            const msgs = data.chats[charId]?.messages;
            if (msgs) {
                for (let i = msgs.length - 1; i >= 0; i--) {
                    if (msgs[i].sender === 'user') {
                        if (!msgs[i].reactions) msgs[i].reactions = [];
                        msgs[i].reactions.push(response.reaction);
                        this.storage.save(data);
                        break;
                    }
                }
            }
        }

        if (this.currentScreen === 'chat' && this.currentChat?.id === charId) {
            this._renderChat();
        }
        this._updateBadge();
    }

    // ============================================
    // STICKERS & EMOJI
    // ============================================

    _loadStickers(pack) {
        const grid = document.getElementById('cg-sticker-grid');
        if (!grid) return;

        const packs = {
            recent: ['😂','❤️','🔥','👍','😭','🤣','💕','🥺','✨','💗'],
            fav: ['💗','✨','🌸','🎀','💫','🦋','🌺','💖','🥰','😘'],
            cute: ['😺','😸','😹','😻','😼','😽','🙀','🐱','🐾','🎀','🌸','💗','✨','🌷','🦋','💝'],
            meme: ['💀','🤡','🗿','🫠','😈','🤪','🥴','😵‍💫','🤯','👀','🤭','😏','🫢','🤓','👾','🤖'],
            mood: ['🌸','🌺','🌷','🌹','💐','🌻','🌼','🏵️','🌾','🍃','🍂','🍁','🌿','☘️','🪷','🌱'],
            chaos: ['💀','☠️','👹','👺','😈','👿','💣','🔪','⚡','🌪️','🫥','😶‍🌫️','🤐','🫣','🙈','🙊'],
        };

        const stickers = packs[pack] || packs.cute;
        grid.innerHTML = stickers.map(s =>
            `<button class="cg-sticker-item" data-sticker="${s}">${s}</button>`
        ).join('');

        grid.querySelectorAll('.cg-sticker-item').forEach(item => {
            item.addEventListener('click', () => this._sendSticker(item.dataset.sticker));
        });
    }

    _loadEmojis() {
        const grid = document.getElementById('cg-emoji-grid');
        if (!grid) return;

        const emojis = [
            '😀','😂','🤣','😍','🥰','😘','😊','😇','🤗','🤔','😏','😌','😴','😋','😛','😜',
            '🤪','😝','🤑','🤯','😱','😨','😰','😥','😢','😭','😤','😡','💀','🤡','👻','👽',
            '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','💗','💖','💘','💝',
            '🌸','🌺','🌷','🌹','🌻','💐','🎀','✨','🔥','⭐','💫','💥','🦋',
            '👍','👎','👊','✊','🤝','👏','🙌','🤞','✌️','🤟','🤙','👋',
        ];

        grid.innerHTML = emojis.map(e =>
            `<button class="cg-emoji-item" data-emoji="${e}">${e}</button>`
        ).join('');

        grid.querySelectorAll('.cg-emoji-item').forEach(item => {
            item.addEventListener('click', () => {
                const input = document.getElementById('cg-msg-input');
                if (input) { input.value += item.dataset.emoji; input.focus(); }
            });
        });
    }

    _sendSticker(sticker) {
        if (!this.currentChat) return;
        this.storage.addMessage(this.currentChat.id, {
            sender: 'user', type: 'sticker', sticker, timestamp: Date.now(),
        });
        document.getElementById('cg-sticker-picker').classList.add('cg-hidden');
        this._renderChat();
        this._genCharResponse(`[отправил стикер: ${sticker}]`);
    }

    // ============================================
    // IMAGES
    // ============================================

    _attachPhoto() {
        document.getElementById('cg-attach-menu').classList.add('cg-hidden');
        const fi = document.createElement('input');
        fi.type = 'file';
        fi.accept = 'image/*';
        fi.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                this._sendImage(ev.target.result);
            };
            reader.readAsDataURL(file);
        };
        fi.click();
    }

    _sendImage(url, text = '') {
        if (!this.currentChat) return;
        this.storage.addMessage(this.currentChat.id, {
            sender: 'user', type: 'image', imageUrl: url, text, timestamp: Date.now(),
        });
        this.storage.addToGallery({ url, timestamp: Date.now(), source: 'sent' });
        this._renderChat();
    }

    async _genImagePrompt() {
        const ruInput = document.getElementById('cg-imggen-ru');
        const enInput = document.getElementById('cg-imggen-en');
        const wrap = document.getElementById('cg-imggen-en-wrap');

        if (!ruInput?.value?.trim()) {
            this._notify('Опишите изображение');
            return;
        }

        wrap.classList.remove('cg-hidden');
        enInput.value = 'Генерация промпта... ⏳';

        const prompt = await this.ai.generateImagePrompt(ruInput.value.trim());
        enInput.value = prompt;
    }

    async _genImage() {
        const useAI = document.getElementById('cg-imggen-useai').checked;
        const ruText = document.getElementById('cg-imggen-ru').value.trim();
        const enText = document.getElementById('cg-imggen-en').value.trim();
        const ratio = document.getElementById('cg-imggen-ratio').value;
        const neg = document.getElementById('cg-imggen-neg').value.trim();
        const provider = document.getElementById('cg-imggen-provider').value;

        let prompt = useAI && enText ? enText : ruText;
        if (!prompt) {
            this._notify('Введите описание');
            return;
        }

        // If AI prompt not generated yet
        if (useAI && !enText) {
            await this._genImagePrompt();
            prompt = document.getElementById('cg-imggen-en').value.trim();
            if (!prompt) return;
        }

        this._notify('Генерация... ✨');
        document.getElementById('cg-imggen-dialog').classList.add('cg-hidden');

        // Temporarily set provider
        const origProvider = this.settings.imageProvider;
        this.settings.imageProvider = provider;

        try {
            const dims = this.imageGen.getDimensions(ratio);
            const url = await this.imageGen.generate(prompt, neg || this.settings.negativePrompt, dims.w, dims.h);
            this._sendImage(url);
            this.storage.addToGallery({ url, timestamp: Date.now(), source: 'generated', prompt });
            this._notify('Изображение создано ♡');
        } catch (e) {
            this._notify('Ошибка генерации: ' + (e.message || 'Неизвестная ошибка'));
        }

        this.settings.imageProvider = origProvider;
    }

    // ============================================
    // RENDER: Channels
    // ============================================

    _renderChannels() {
        const content = document.getElementById('cg-content');
        const data = this.storage.load();
        const channels = Object.values(data.channels || {});

        content.innerHTML = `
            <div class="cg-channels-top">
                <button class="cg-btn cg-btn-primary" id="cg-create-channel">+ Создать канал</button>
            </div>
            ${channels.length === 0 ? `
                <div class="cg-empty">
                    <div class="cg-empty-icon">📢</div>
                    <p>Нет каналов</p>
                    <p class="cg-hint">Создайте канал или персонаж создаст свой</p>
                </div>
            ` : channels.map(ch => `
                <div class="cg-channel-item" data-id="${ch.id}">
                    <div class="cg-avatar cg-avatar-square">
                        <span class="cg-avatar-letter">${(ch.name || '📢')[0]}</span>
                    </div>
                    <div class="cg-channel-info">
                        <span class="cg-channel-name">${this._esc(ch.name)}</span>
                        <span class="cg-channel-subs">${ch.subscribers || 0} подписчиков</span>
                        <span class="cg-channel-preview">${this._esc(ch.lastPost || 'Нет публикаций')}</span>
                    </div>
                </div>
            `).join('')}`;

        document.getElementById('cg-create-channel')?.addEventListener('click', () => this._showCreateChannel());
        content.querySelectorAll('.cg-channel-item').forEach(item => {
            item.addEventListener('click', () => this._openChannel(item.dataset.id));
        });
    }

    _showCreateChannel() {
        const content = document.getElementById('cg-content');
        content.innerHTML = `
            <div class="cg-form">
                <h3>📢 Новый канал</h3>
                <div class="cg-field"><label>Название:</label><input type="text" id="cg-ch-name" class="cg-input" placeholder="Мой канал"></div>
                <div class="cg-field"><label>Описание:</label><textarea id="cg-ch-desc" class="cg-textarea" placeholder="О чём канал..."></textarea></div>
                <div class="cg-field"><label>Тема:</label><input type="text" id="cg-ch-theme" class="cg-input" placeholder="личный блог, мемы, лайфстайл..."></div>
                <div class="cg-field">
                    <label>Владелец:</label>
                    <select id="cg-ch-owner" class="cg-select">
                        <option value="user">Я</option>
                        ${this.characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <button class="cg-btn cg-btn-primary" id="cg-ch-create-go">Создать</button>
                <button class="cg-btn" id="cg-ch-create-cancel">Отмена</button>
            </div>`;

        document.getElementById('cg-ch-create-go')?.addEventListener('click', () => {
            const name = document.getElementById('cg-ch-name')?.value?.trim();
            if (!name) { this._notify('Введите название'); return; }
            this.storage.addChannel({
                id: 'ch_' + Date.now(),
                name,
                description: document.getElementById('cg-ch-desc')?.value?.trim() || '',
                theme: document.getElementById('cg-ch-theme')?.value?.trim() || '',
                owner: document.getElementById('cg-ch-owner')?.value || 'user',
                subscribers: Math.floor(Math.random() * 200) + 5,
                posts: [],
                lastPost: '',
                createdAt: Date.now(),
            });
            this._notify(`Канал "${name}" создан ♡`);
            this._renderChannels();
        });

        document.getElementById('cg-ch-create-cancel')?.addEventListener('click', () => this._renderChannels());
    }

    _openChannel(id) {
        this.currentChannel = this.storage.getChannel(id);
        if (!this.currentChannel) return;
        this._navigate('channel-view');
    }

    _renderChannelView() {
        const content = document.getElementById('cg-content');
        const ch = this.currentChannel;
        if (!ch) return;

        const ownerChar = this.characters.find(c => c.id === ch.owner);
        const ownerName = ch.owner === 'user' ? this.settings.userName : (ownerChar?.name || ch.owner);
        const posts = ch.posts || [];

        content.innerHTML = `
            <div class="cg-channel-header-info">
                <h3>${this._esc(ch.name)}</h3>
                <p>${ch.subscribers} подписчиков • ${ownerName}</p>
                ${ch.description ? `<p class="cg-hint">${this._esc(ch.description)}</p>` : ''}
            </div>
            <div class="cg-posts">
                ${posts.length === 0 ? '<div class="cg-empty"><p>Нет публикаций</p></div>' :
                    posts.slice().reverse().map((p, ri) => {
                        const i = posts.length - 1 - ri;
                        return `
                        <div class="cg-post">
                            <div class="cg-post-author">${this._esc(p.authorName || ownerName)}</div>
                            <div class="cg-post-text">${this._esc(p.text)}</div>
                            ${p.image ? `<img src="${p.image}" class="cg-post-img">` : ''}
                            <div class="cg-post-meta">
                                <span>${p.timestamp ? this._time(p.timestamp) : ''}</span>
                                <span>👁 ${p.views || Math.floor(Math.random() * ch.subscribers)}</span>
                            </div>
                            ${(p.reactions?.length) ? `<div class="cg-post-reactions">${p.reactions.map(r => `<span class="cg-msg-react">${r}</span>`).join('')}</div>` : ''}
                            <div class="cg-post-comments">
                                ${(p.comments || []).map(c => `
                                    <div class="cg-comment">
                                        <strong>${this._esc(c.author)}</strong> ${this._esc(c.text)}
                                    </div>
                                `).join('')}
                                <div class="cg-comment-row">
                                    <input type="text" class="cg-comment-input" data-post="${i}" placeholder="Комментарий...">
                                    <button class="cg-icon-btn cg-comment-send" data-post="${i}">➤</button>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
            </div>
            ${(ch.owner === 'user') ? `
                <div class="cg-new-post">
                    <textarea id="cg-new-post-text" class="cg-textarea" placeholder="Новая публикация..."></textarea>
                    <button class="cg-btn cg-btn-primary" id="cg-publish">📢 Опубликовать</button>
                </div>
            ` : `
                <div class="cg-new-post">
                    <button class="cg-btn" id="cg-gen-post">🤖 Сгенерировать пост от ${this._esc(ownerName)}</button>
                </div>
            `}`;

        // Publish
        document.getElementById('cg-publish')?.addEventListener('click', () => {
            const text = document.getElementById('cg-new-post-text')?.value?.trim();
            if (!text) return;
            this.storage.addPost(ch.id, {
                text, authorName: this.settings.userName, timestamp: Date.now(),
                views: Math.floor(Math.random() * ch.subscribers), reactions: [], comments: [],
            });
            this._notify('Опубликовано ♡');
            this.currentChannel = this.storage.getChannel(ch.id);
            this._renderChannelView();
        });

        // Generate post
        document.getElementById('cg-gen-post')?.addEventListener('click', async () => {
            this._notify('Генерация поста... ✨');
            const text = await this.ai.generateChannelPost(ownerName, ch.name, ch.theme);
            this.storage.addPost(ch.id, {
                text, authorName: ownerName, timestamp: Date.now(),
                views: Math.floor(Math.random() * ch.subscribers), reactions: [], comments: [],
            });
            this.currentChannel = this.storage.getChannel(ch.id);
            this._renderChannelView();
        });

        // Comments
        content.querySelectorAll('.cg-comment-send').forEach(btn => {
            btn.addEventListener('click', () => {
                const postIdx = parseInt(btn.dataset.post);
                const input = content.querySelector(`.cg-comment-input[data-post="${postIdx}"]`);
                if (input?.value?.trim()) {
                    this.storage.addComment(ch.id, postIdx, {
                        author: this.settings.userName, text: input.value.trim(), timestamp: Date.now(),
                    });
                    input.value = '';
                    this.currentChannel = this.storage.getChannel(ch.id);
                    this._renderChannelView();

                    // AI comment response
                    if (ch.owner !== 'user') {
                        setTimeout(async () => {
                            const comment = await this.ai.generateComment(ownerName, posts[postIdx]?.text || '');
                            this.storage.addComment(ch.id, postIdx, {
                                author: ownerName, text: comment, timestamp: Date.now(),
                            });
                            this.currentChannel = this.storage.getChannel(ch.id);
                            if (this.currentScreen === 'channel-view') this._renderChannelView();
                        }, 1500 + Math.random() * 3000);
                    }
                }
            });
        });
    }

    // ============================================
    // RENDER: Stories
    // ============================================

    _renderStories() {
        const content = document.getElementById('cg-content');
        const data = this.storage.load();
        const allStories = data.stories || {};

        let items = [];
        for (const [authorId, stories] of Object.entries(allStories)) {
            if (stories.length === 0) continue;
            const char = this.characters.find(c => c.id === authorId);
            items.push({
                authorId, name: char?.name || (authorId === 'user' ? this.settings.userName : authorId),
                avatar: char?.avatar || '', count: stories.length,
                last: stories[stories.length - 1],
            });
        }

        content.innerHTML = `
            <div class="cg-stories-row">
                <div class="cg-story-add" id="cg-story-add">
                    <div class="cg-story-add-circle">+</div>
                    <span>Моя</span>
                </div>
                ${items.map(s => `
                    <div class="cg-story-circle" data-author="${s.authorId}">
                        <div class="cg-story-ring">
                            ${s.avatar ? `<img src="${s.avatar}">` : `<span class="cg-avatar-letter">${s.name[0]}</span>`}
                        </div>
                        <span>${this._esc(s.name).substring(0, 8)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="cg-stories-feed">
                ${items.length === 0 ? `
                    <div class="cg-empty">
                        <div class="cg-empty-icon">🌸</div>
                        <p>Нет историй</p>
                    </div>
                ` : items.map(s => `
                    <div class="cg-story-card" data-author="${s.authorId}">
                        <div class="cg-story-card-header">
                            <span class="cg-story-card-name">${this._esc(s.name)}</span>
                            <span class="cg-story-card-time">${s.last.timestamp ? this._time(s.last.timestamp) : ''}</span>
                        </div>
                        <div class="cg-story-card-text">${this._esc(s.last.text || '')}</div>
                        ${s.last.image ? `<img src="${s.last.image}" class="cg-story-card-img">` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="cg-stories-actions">
                <button class="cg-btn" id="cg-gen-stories">🤖 Сгенерировать истории персонажей</button>
            </div>`;

        document.getElementById('cg-story-add')?.addEventListener('click', () => {
            this._showCreateStory();
        });

        document.getElementById('cg-gen-stories')?.addEventListener('click', async () => {
            this._notify('Генерация историй... 🌸');
            for (const char of this.characters.slice(0, 3)) {
                const text = await this.ai.generateStory(char.name);
                this.storage.addStory(char.id, {
                    text, timestamp: Date.now(), image: null, views: Math.floor(Math.random() * 50),
                });
            }
            this._renderStories();
        });
    }

    _showCreateStory() {
        const content = document.getElementById('cg-content');
        content.innerHTML = `
            <div class="cg-form">
                <h3>🌸 Новая история</h3>
                <div class="cg-field"><label>Текст:</label><textarea id="cg-story-text" class="cg-textarea" placeholder="Подпись к истории..."></textarea></div>
                <button class="cg-btn cg-btn-primary" id="cg-story-publish">Опубликовать</button>
                <button class="cg-btn" id="cg-story-cancel">Отмена</button>
            </div>`;

        document.getElementById('cg-story-publish')?.addEventListener('click', () => {
            const text = document.getElementById('cg-story-text')?.value?.trim();
            if (!text) return;
            this.storage.addStory('user', { text, timestamp: Date.now(), image: null, views: 0 });
            this._notify('История опубликована ♡');
            this._renderStories();
        });

        document.getElementById('cg-story-cancel')?.addEventListener('click', () => this._renderStories());
    }

    // ============================================
    // RENDER: Gallery
    // ============================================

    _renderGallery() {
        const content = document.getElementById('cg-content');
        const data = this.storage.load();
        const images = data.gallery || [];

        if (images.length === 0) {
            content.innerHTML = `
                <div class="cg-empty">
                    <div class="cg-empty-icon">🖼</div>
                    <p>Галерея пуста</p>
                    <p class="cg-hint">Изображения появятся здесь</p>
                </div>`;
            return;
        }

        content.innerHTML = `
            <div class="cg-gallery-grid">
                ${images.map((img, i) => `
                    <div class="cg-gallery-item" data-index="${i}">
                        <img src="${img.url}" loading="lazy">
                        ${img.prompt ? `<div class="cg-gallery-prompt" title="${this._esc(img.prompt)}">📝</div>` : ''}
                    </div>
                `).join('')}
            </div>`;

        content.querySelectorAll('.cg-gallery-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                this._showImageViewer(images[idx]);
            });
        });
    }

    _showImageViewer(image) {
        const content = document.getElementById('cg-content');
        content.innerHTML = `
            <div class="cg-image-viewer">
                <img src="${image.url}" class="cg-image-viewer-img">
                ${image.prompt ? `<div class="cg-image-viewer-prompt"><strong>Промпт:</strong> ${this._esc(image.prompt)}</div>` : ''}
                <button class="cg-btn" id="cg-image-viewer-back">← Назад</button>
            </div>`;

        document.getElementById('cg-image-viewer-back')?.addEventListener('click', () => this._renderGallery());
    }

    // ============================================
    // RENDER: Profile
    // ============================================

    _renderProfile() {
        const content = document.getElementById('cg-content');
        content.innerHTML = `
            <div class="cg-profile-card">
                <div class="cg-profile-avatar">
                    ${this.settings.userAvatar ? `<img src="${this.settings.userAvatar}">` : `<span class="cg-avatar-letter-lg">${this.settings.userName[0]}</span>`}
                </div>
                <h2 class="cg-profile-name">${this._esc(this.settings.userName)}</h2>
                <p class="cg-profile-username">${this._esc(this.settings.userUsername)}</p>
                ${this.settings.userBio ? `<p class="cg-profile-bio">${this._esc(this.settings.userBio)}</p>` : ''}
            </div>
            <div class="cg-profile-btns">
                <button class="cg-btn" id="cg-edit-profile">✏️ Редактировать</button>
                <button class="cg-btn" id="cg-open-settings">⚙️ Настройки</button>
            </div>`;

        document.getElementById('cg-edit-profile')?.addEventListener('click', () => this._showEditProfile());
        document.getElementById('cg-open-settings')?.addEventListener('click', () => this._navigate('settings'));
    }

    _showEditProfile() {
        const content = document.getElementById('cg-content');
        content.innerHTML = `
            <div class="cg-form">
                <h3>✏️ Профиль</h3>
                <div class="cg-field"><label>Имя:</label><input type="text" id="cg-pf-name" class="cg-input" value="${this._esc(this.settings.userName)}"></div>
                <div class="cg-field"><label>Юзернейм:</label><input type="text" id="cg-pf-uname" class="cg-input" value="${this._esc(this.settings.userUsername)}"></div>
                <div class="cg-field"><label>О себе:</label><textarea id="cg-pf-bio" class="cg-textarea">${this._esc(this.settings.userBio)}</textarea></div>
                <button class="cg-btn cg-btn-primary" id="cg-pf-save">💾 Сохранить</button>
                <button class="cg-btn" id="cg-pf-cancel">Отмена</button>
            </div>`;

        document.getElementById('cg-pf-save')?.addEventListener('click', () => {
            this.settings.userName = document.getElementById('cg-pf-name')?.value || 'User';
            this.settings.userUsername = document.getElementById('cg-pf-uname')?.value || '@user';
            this.settings.userBio = document.getElementById('cg-pf-bio')?.value || '';
            this._saveSettings();
            this._notify('Профиль обновлён ♡');
            this._renderProfile();
        });

        document.getElementById('cg-pf-cancel')?.addEventListener('click', () => this._renderProfile());
    }

    _renderCharProfile() {
        if (!this.currentChat) return;
        const content = document.getElementById('cg-content');
        const char = this.characters.find(c => c.id === this.currentChat.id);

        content.innerHTML = `
            <div class="cg-profile-card">
                <div class="cg-profile-avatar">
                    ${this.currentChat.avatar ? `<img src="${this.currentChat.avatar}">` : `<span class="cg-avatar-letter-lg">${this.currentChat.name[0]}</span>`}
                </div>
                <h2 class="cg-profile-name">${this._esc(this.currentChat.name)}</h2>
                ${char?.description ? `<p class="cg-profile-bio">${this._esc(char.description.substring(0, 200))}</p>` : ''}
            </div>
            <div class="cg-profile-btns">
                <button class="cg-btn cg-btn-primary" id="cg-char-write">💬 Написать</button>
                <button class="cg-btn" id="cg-char-clear">🗑 Очистить чат</button>
            </div>`;

        document.getElementById('cg-char-write')?.addEventListener('click', () => this._navigate('chat'));
        document.getElementById('cg-char-clear')?.addEventListener('click', () => {
            this.storage.clearChat(this.currentChat.id);
            this._notify('Чат очищен');
            this._navigate('chat');
        });
    }

    // ============================================
    // RENDER: Settings
    // ============================================

    _renderSettings() {
        const content = document.getElementById('cg-content');
        const s = this.settings;

        content.innerHTML = `
            <div class="cg-settings">
                <div class="cg-settings-section">
                    <h3>🤖 AI — Чаты</h3>
                    <div class="cg-field"><label><input type="checkbox" id="cg-s-mainprov" ${s.useMainProvider ? 'checked' : ''}> Основной провайдер ST</label></div>
                    <div class="cg-field"><label><input type="checkbox" id="cg-s-automsg" ${s.autoMessages ? 'checked' : ''}> Авто-сообщения</label></div>
                    <div class="cg-field"><label>Частота:</label>
                        <select id="cg-s-autofreq" class="cg-select">
                            <option value="low" ${s.autoMessageFrequency === 'low' ? 'selected' : ''}>Редко</option>
                            <option value="medium" ${s.autoMessageFrequency === 'medium' ? 'selected' : ''}>Средне</option>
                            <option value="high" ${s.autoMessageFrequency === 'high' ? 'selected' : ''}>Часто</option>
                        </select>
                    </div>
                    <div class="cg-field"><label>Макс длина:</label><input type="number" id="cg-s-maxlen" class="cg-input" value="${s.messageMaxLength}" min="50" max="2000"></div>
                </div>

                <div class="cg-settings-section">
                    <h3>🖼 Изображения</h3>
                    <div class="cg-field"><label>Провайдер:</label>
                        <select id="cg-s-imgprov" class="cg-select">
                            <option value="novelai" ${s.imageProvider === 'novelai' ? 'selected' : ''}>NovelAI</option>
                            <option value="custom" ${s.imageProvider === 'custom' ? 'selected' : ''}>Свой API</option>
                            <option value="sd" ${s.imageProvider === 'sd' ? 'selected' : ''}>Stable Diffusion</option>
                        </select>
                    </div>
                    <div class="cg-field"><label>API URL (свой):</label><input type="text" id="cg-s-imgurl" class="cg-input" value="${s.imageApiUrl || ''}" placeholder="https://..."></div>
                    <div class="cg-field"><label>API Key:</label><input type="password" id="cg-s-imgkey" class="cg-input" value="${s.imageApiKey || ''}" placeholder="Ключ..."></div>
                    <div class="cg-field"><label>Формат:</label>
                        <select id="cg-s-imgratio" class="cg-select">
                            <option value="portrait" ${s.imageAspectRatio === 'portrait' ? 'selected' : ''}>Портрет</option>
                            <option value="square" ${s.imageAspectRatio === 'square' ? 'selected' : ''}>Квадрат</option>
                            <option value="landscape" ${s.imageAspectRatio === 'landscape' ? 'selected' : ''}>Пейзаж</option>
                            <option value="wide" ${s.imageAspectRatio === 'wide' ? 'selected' : ''}>Широкий</option>
                        </select>
                    </div>
                    <div class="cg-field"><label>Негативный промпт:</label><input type="text" id="cg-s-neg" class="cg-input" value="${s.negativePrompt || ''}"></div>
                    <div class="cg-field"><label><input type="checkbox" id="cg-s-aiprompt" ${s.useAiForPrompt ? 'checked' : ''}> AI генерирует промпт</label></div>
                </div>

                <div class="cg-settings-section">
                    <h3>📢 Каналы и Истории</h3>
                    <div class="cg-field"><label><input type="checkbox" id="cg-s-autoposts" ${s.autoChannelPosts ? 'checked' : ''}> Авто-посты</label></div>
                    <div class="cg-field"><label><input type="checkbox" id="cg-s-autostory" ${s.autoStories ? 'checked' : ''}> Авто-истории</label></div>
                    <div class="cg-field"><label>Длительность историй (ч):</label><input type="number" id="cg-s-storydur" class="cg-input" value="${s.storyDuration}" min="1" max="168"></div>
                </div>

                <div class="cg-settings-section">
                    <h3>🔄 Синхронизация</h3>
                    <div class="cg-field"><label><input type="checkbox" id="cg-s-sync" ${s.syncWithRoleplay ? 'checked' : ''}> Синхронизировать с ролевой</label></div>
                </div>

                <button class="cg-btn cg-btn-primary cg-btn-full" id="cg-s-save">💾 Сохранить настройки</button>
            </div>`;

        document.getElementById('cg-s-save')?.addEventListener('click', () => {
            this.settings.useMainProvider = document.getElementById('cg-s-mainprov')?.checked ?? true;
            this.settings.autoMessages = document.getElementById('cg-s-automsg')?.checked ?? true;
            this.settings.autoMessageFrequency = document.getElementById('cg-s-autofreq')?.value || 'medium';
            this.settings.messageMaxLength = parseInt(document.getElementById('cg-s-maxlen')?.value) || 600;
            this.settings.imageProvider = document.getElementById('cg-s-imgprov')?.value || 'novelai';
            this.settings.imageApiUrl = document.getElementById('cg-s-imgurl')?.value || '';
            this.settings.imageApiKey = document.getElementById('cg-s-imgkey')?.value || '';
            this.settings.imageAspectRatio = document.getElementById('cg-s-imgratio')?.value || 'portrait';
            this.settings.negativePrompt = document.getElementById('cg-s-neg')?.value || '';
            this.settings.useAiForPrompt = document.getElementById('cg-s-aiprompt')?.checked ?? true;
            this.settings.autoChannelPosts = document.getElementById('cg-s-autoposts')?.checked ?? true;
            this.settings.autoStories = document.getElementById('cg-s-autostory')?.checked ?? true;
            this.settings.storyDuration = parseInt(document.getElementById('cg-s-storydur')?.value) || 24;
            this.settings.syncWithRoleplay = document.getElementById('cg-s-sync')?.checked ?? true;
            this._saveSettings();
            this._notify('Настройки сохранены ♡');
        });
    }

    // ============================================
    // AUTO MESSAGES
    // ============================================

    async _maybeAutoMessage() {
        const chances = { low: 0.08, medium: 0.2, high: 0.4 };
        if (Math.random() > (chances[this.settings.autoMessageFrequency] || 0.15)) return;
        if (this.characters.length === 0) return;

        const char = this.characters[Math.floor(Math.random() * this.characters.length)];
        const text = await this.ai.generateAutoMessage(char.name, char.description);
        if (!text) return;

        this.storage.addMessage(char.id, {
            sender: 'character', type: 'text', text, timestamp: Date.now(), auto: true,
        });
        this._updateBadge();
        this._notify(`${char.name}: ${text.substring(0, 40)}...`);

        if (this.isOpen && this.currentScreen === 'chat' && this.currentChat?.id === char.id) {
            this._renderChat();
        }
    }

    // ============================================
    // SEARCH
    // ============================================

    _onSearch(query) {
        if (!query.trim()) {
            if (this.currentScreen === 'home') this._renderChatList();
            return;
        }

        const q = query.toLowerCase();
        const content = document.getElementById('cg-content');

        if (this.currentScreen === 'home') {
            const items = content.querySelectorAll('.cg-chat-item');
            items.forEach(item => {
                const name = item.querySelector('.cg-chat-name')?.textContent?.toLowerCase() || '';
                const preview = item.querySelector('.cg-chat-preview')?.textContent?.toLowerCase() || '';
                item.style.display = (name.includes(q) || preview.includes(q)) ? '' : 'none';
            });
        }
    }

    // ============================================
    // UTILITY
    // ============================================

    _startClock() {
        const update = () => {
            const now = new Date();
            const el = document.getElementById('cg-clock');
            if (el) el.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        };
        update();
        setInterval(update, 30000);
    }

    _updateBadge() {
        const data = this.storage.load();
        let total = 0;
        for (const chat of Object.values(data.chats)) {
            total += chat.unread || 0;
        }
        const badge = document.getElementById('cg-btn-badge');
        if (badge) {
            badge.textContent = total;
            badge.classList.toggle('cg-hidden', total === 0);
        }
    }

    _scrollBottom() {
        const content = document.getElementById('cg-content');
        if (content) setTimeout(() => { content.scrollTop = content.scrollHeight; }, 50);
    }

    _notify(text) {
        const n = document.createElement('div');
        n.className = 'cg-toast';
        n.textContent = text;
        document.body.appendChild(n);
        requestAnimationFrame(() => n.classList.add('cg-toast-show'));
        setTimeout(() => {
            n.classList.remove('cg-toast-show');
            setTimeout(() => n.remove(), 300);
        }, 3000);
    }

    _time(ts) {
        const d = new Date(ts);
        const now = new Date();
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        if (d.toDateString() === now.toDateString()) return `${h}:${m}`;
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${h}:${m}`;
    }

    _esc(text) {
        if (!text) return '';
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    _delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

// ============================================
// INIT
// ============================================

jQuery(async () => {
    const app = new CherryGram();
    // Wait for ST
    let attempts = 0;
    while (attempts < 20) {
        try {
            const ctx = getContext();
            if (ctx) break;
        } catch (e) { /* wait */ }
        await new Promise(r => setTimeout(r, 500));
        attempts++;
    }
    await app.init();
    window.cherryGram = app;
});
