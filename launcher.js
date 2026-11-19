(() => {
    'use strict';

    function startCherryGram() {
        // Убираем предыдущий экземпляр этого запускателя.
        document.getElementById('cherry-gram-launcher-v2')?.remove();

        // Убираем кнопки старых версий Cherry Gram.
        // Другие расширения эти идентификаторы не используют.
        document.getElementById('cg-fab')?.remove();
        document.getElementById('cg-btn')?.remove();

        const host = document.createElement('div');
        host.id = 'cherry-gram-launcher-v2';

        // Отдельный слой поверх основного интерфейса.
        host.style.cssText = `
            all: initial !important;
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            display: block !important;
            z-index: 2147483000 !important;
            pointer-events: none !important;
        `;

        // Shadow DOM защищает оформление от CSS темы.
        const root = host.attachShadow({ mode: 'open' });

        root.innerHTML = `
            <style>
                :host {
                    color-scheme: dark;
                }

                *, *::before, *::after {
                    box-sizing: border-box;
                }

                button {
                    font: inherit;
                    cursor: pointer;
                    -webkit-tap-highlight-color: transparent;
                }

                .launcher {
                    position: absolute;
                    right: 14px;
                    top: 45%;
                    width: 54px;
                    height: 54px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    border: 2px solid #f3b6d6;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #d98bb8, #7d4370);
                    color: white;
                    box-shadow: 0 4px 18px #0007;
                    pointer-events: auto;
                    touch-action: none;
                    user-select: none;
                }

                .launcher svg {
                    width: 28px;
                    height: 28px;
                    pointer-events: none;
                }

                .backdrop {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 12px;
                    background: #110b18b8;
                    pointer-events: auto;
                    font-family: system-ui, -apple-system, sans-serif;
                    color: #f8e7f1;
                }

                [hidden] {
                    display: none !important;
                }

                .phone {
                    display: flex;
                    flex-direction: column;
                    width: min(390px, 100%);
                    height: min(650px, 100%);
                    min-height: 0;
                    overflow: hidden;
                    border: 2px solid #cc8eb4;
                    border-radius: 25px;
                    background: #251c2b;
                    box-shadow: 0 18px 60px #0009;
                }

                .header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-shrink: 0;
                    padding: 14px;
                    background: #38263b;
                    border-bottom: 1px solid #d69cbd33;
                }

                .title {
                    flex: 1;
                    margin: 0;
                    font-size: 19px;
                    font-weight: 600;
                    color: #f3b6d6;
                }

                .close {
                    width: 38px;
                    height: 38px;
                    padding: 0;
                    border: 1px solid #d69cbd55;
                    border-radius: 50%;
                    background: #4a3049;
                    color: #ffe6f4;
                    font-size: 27px;
                    line-height: 1;
                }

                .body {
                    flex: 1;
                    min-height: 0;
                    overflow: auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    text-align: center;
                }

                .symbol {
                    font-size: 56px;
                    color: #f3b6d6;
                }

                h2 {
                    margin: 18px 0 10px;
                    font-size: 23px;
                }

                p {
                    margin: 0;
                    font-size: 15px;
                    line-height: 1.6;
                    color: #cfb5c9;
                }

                .footer {
                    flex-shrink: 0;
                    padding: 12px;
                    text-align: center;
                    font-size: 12px;
                    color: #bb98af;
                    border-top: 1px solid #d69cbd33;
                }

                button:focus-visible {
                    outline: 3px solid #fff;
                    outline-offset: 3px;
                }
            </style>

            <button class="launcher"
                type="button"
                aria-label="Открыть Cherry Gram"
                aria-expanded="false"
                title="Cherry Gram — кнопку можно перетаскивать">
                <svg viewBox="0 0 24 24" fill="currentColor"
                    aria-hidden="true">
                    <path d="M21.7 3.3 18.4 20c-.2 1-1 1.2-1.8.6l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1L18 6.2c.4-.4-.1-.5-.6-.2L5.8 13.3 1 11.8c-1-.3-1-1 .2-1.5L20.4 2.9c.9-.3 1.5.2 1.3.4Z"/>
                </svg>
            </button>

            <div class="backdrop" hidden>
                <section class="phone"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cherry-title">
                    <header class="header">
                        <h1 class="title" id="cherry-title">
                            ♡ Cherry Gram ♡
                        </h1>
                        <button class="close" type="button"
                            aria-label="Закрыть">×</button>
                    </header>

                    <main class="body">
                        <div class="symbol" aria-hidden="true">✈</div>
                        <h2>Cherry Gram открыт</h2>
                        <p>
                            Окно мессенджера готово.<br>
                            Здесь пока проверяется открытие и закрытие.
                            Переписки подключим следующим шагом.
                        </p>
                    </main>

                    <footer class="footer">
                        Запускатель 1.0.1 · Cherry Gram
                    </footer>
                </section>
            </div>
        `;

        document.body.appendChild(host);

        const launcher = root.querySelector('.launcher');
        const backdrop = root.querySelector('.backdrop');
        const closeButton = root.querySelector('.close');
        const positionKey = 'cherry-gram:launcher-position:v2';

        function openPhone() {
            backdrop.hidden = false;
            launcher.hidden = true;
            launcher.setAttribute('aria-expanded', 'true');
            closeButton.focus();
        }

        function closePhone() {
            backdrop.hidden = true;
            launcher.hidden = false;
            launcher.setAttribute('aria-expanded', 'false');
            launcher.focus();
        }

        closeButton.addEventListener('click', closePhone);

        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) closePhone();
        });

        root.addEventListener('keydown', (event) => {
            if (backdrop.hidden) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closePhone();
            }

            // В этом проверочном окне одна доступная кнопка.
            if (event.key === 'Tab') {
                event.preventDefault();
                closeButton.focus();
            }
        });

        function placeButton(x, y) {
            const left = Math.max(
                0, Math.min(x, host.clientWidth - 54)
            );
            const top = Math.max(
                0, Math.min(y, host.clientHeight - 54)
            );

            launcher.style.left = left + 'px';
            launcher.style.top = top + 'px';
            launcher.style.right = 'auto';

            return { x: left, y: top };
        }

        try {
            const saved = JSON.parse(localStorage.getItem(positionKey));
            if (saved &&
                Number.isFinite(saved.x) &&
                Number.isFinite(saved.y)) {
                placeButton(saved.x, saved.y);
            }
        } catch (error) {
            console.debug('[Cherry Gram] Позиция не восстановлена', error);
        }

        let drag = null;
        let suppressClick = false;

        launcher.addEventListener('pointerdown', (event) => {
            if (!event.isPrimary || event.button !== 0) return;

            suppressClick = false;

            drag = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                left: launcher.offsetLeft,
                top: launcher.offsetTop,
                moved: false,
                position: null
            };

            launcher.setPointerCapture(event.pointerId);
        });

        launcher.addEventListener('pointermove', (event) => {
            if (!drag || event.pointerId !== drag.id) return;

            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;

            if (!drag.moved && Math.hypot(dx, dy) < 8) return;

            drag.moved = true;
            drag.position = placeButton(
                drag.left + dx,
                drag.top + dy
            );
        });

        function finishDrag(event) {
            if (!drag || event.pointerId !== drag.id) return;

            suppressClick = drag.moved || event.type === 'pointercancel';

            if (drag.position) {
                try {
                    localStorage.setItem(
                        positionKey,
                        JSON.stringify(drag.position)
                    );
                } catch (error) {
                    console.debug('[Cherry Gram] Позиция не сохранена', error);
                }
            }

            drag = null;
        }

        launcher.addEventListener('pointerup', finishDrag);
        launcher.addEventListener('pointercancel', finishDrag);
        launcher.addEventListener('lostpointercapture', () => {
            drag = null;
        });

        launcher.addEventListener('click', (event) => {
            if (suppressClick && event.detail !== 0) {
                suppressClick = false;
                return;
            }

            suppressClick = false;
            openPhone();
        });

        const observer = new ResizeObserver(() => {
            if (!host.isConnected) {
                observer.disconnect();
                return;
            }

            if (launcher.style.left) {
                placeButton(
                    parseFloat(launcher.style.left),
                    parseFloat(launcher.style.top)
                );
            }
        });

        observer.observe(host);
    }

    function boot() {
        try {
            startCherryGram();
        } catch (error) {
            console.error('[Cherry Gram]', error);
            window.toastr?.error(
                'Cherry Gram: ' + error.message
            );
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
