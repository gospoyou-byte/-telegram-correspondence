jQuery(() => {
    try {
        if (window.toastr) toastr.success('Cherry Gram загружен ✈️');
        if (document.getElementById('cg-fab')) return;

        const fab = document.createElement('div');
        fab.id = 'cg-fab';
        fab.textContent = '✈️';
        fab.style.cssText = 'position:fixed;top:45%;right:12px;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#d98bb8,#7d4370);border:2px solid #f3b6d6;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,.5);';
        document.body.appendChild(fab);

        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:none;align-items:center;justify-content:center;';
        ov.innerHTML = '<div style="width:92%;max-width:370px;height:80%;background:#2a1f2b;border:2px solid #c98bb3;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f3dbe8;text-align:center;padding:20px;"><div style="font-size:50px">✈️</div><h2 style="color:#f3b6d6;margin:10px 0">♡ Cherry Gram ♡</h2><p style="color:#b89aae">Работает! Нажми, чтобы закрыть</p></div>';
        document.body.appendChild(ov);

        fab.addEventListener('click', () => { ov.style.display = 'flex'; });
        ov.addEventListener('click', () => { ov.style.display = 'none'; });
    } catch (e) {
        if (window.toastr) toastr.error('Cherry Gram ошибка: ' + e.message);
        console.error(e);
    }
});
