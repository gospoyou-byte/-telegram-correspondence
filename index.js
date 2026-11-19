jQuery(async () => {
    try {
        console.log('[Cherry Gram] Starting...');

        // Кнопка
        const btn = document.createElement('div');
        btn.id = 'cg-fab';
        btn.innerHTML = '✈️';
        btn.title = 'Cherry Gram ♡';
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e84393, #b8255f)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            cursor: 'pointer',
            zIndex: '9998',
            boxShadow: '0 4px 20px rgba(232,67,147,0.4)',
            userSelect: 'none',
        });
        document.body.appendChild(btn);

        // Телефон
        const overlay = document.createElement('div');
        overlay.id = 'cg-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0', left: '0', right: '0', bottom: '0',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: '9999',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
        });

        overlay.innerHTML = `
            <div style="
                width: 370px; height: 670px;
                background: #0c0c1d;
                border-radius: 24px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 60px rgba(232,67,147,0.1);
            ">
                <div style="
                    padding: 10px 16px;
                    background: #111128;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <span style="color: #fd79a8; font-size: 15px; font-weight: 600;">Cherry Gram ♡</span>
                    <button id="cg-close" style="
                        background: none; border: none; color: #9090aa;
                        font-size: 18px; cursor: pointer; padding: 4px 8px;
                    ">✕</button>
                </div>
                <div style="
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    color: #ededf5;
                    text-align: center;
                    padding: 20px;
                ">
                    <div style="font-size: 52px; margin-bottom: 16px;">✈️</div>
                    <h2 style="margin: 0 0 8px; font-size: 20px; color: #fd79a8;">Работает!</h2>
                    <p style="color: #9090aa; font-size: 13px; line-height: 1.5;">
                        Кнопка появилась — расширение загрузилось!<br>
                        Теперь можно добавлять чаты, каналы и всё остальное.
                    </p>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Открыть
        btn.addEventListener('click', () => {
            overlay.style.display = 'flex';
        });

        // Закрыть
        document.getElementById('cg-close').addEventListener('click', () => {
            overlay.style.display = 'none';
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });

        console.log('[Cherry Gram] Ready! ✈️');

    } catch (error) {
        console.error('[Cherry Gram] Error:', error);
    }
});
