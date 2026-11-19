jQuery(async () => {
    const buttonHtml = `
        <div id="cg-btn" style="
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: linear-gradient(135deg, #e84393, #b8255f);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9998;
            box-shadow: 0 4px 20px rgba(232,67,147,0.4);
            font-size: 22px;
        " title="Cherry Gram">✈️</div>
    `;
    document.body.insertAdjacentHTML('beforeend', buttonHtml);

    document.getElementById('cg-btn').addEventListener('click', () => {
        alert('Cherry Gram работает! ✈️');
    });
});
